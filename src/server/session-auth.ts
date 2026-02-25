import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { recoverMessageAddress } from "viem";
import type { SessionAuthChallenge, SessionAuthProof } from "@/server/schema";

const SESSION_AUTH_VERSION = 1;
const SESSION_AUTH_TTL_MS = 60 * 60 * 1000; // 1 hour

type ChallengePayload = {
  v: number;
  scheme: "evm";
  sessionId: string;
  sourceAddress: string;
  solanaAddress: string;
  provider: string;
  routeId: string;
  nonce: string;
  iat: number;
  exp: number;
  host?: string;
};

type SessionAuthContext = {
  id: string;
  sourceAddress: string;
  solanaAddress: string;
  provider: string;
  routeId: string;
};

let memoizedSecret: Buffer | null = null;
let warnedAboutEphemeralSecret = false;

function getSecret(): Buffer {
  if (memoizedSecret) {
    return memoizedSecret;
  }

  const configured =
    process.env.SESSION_AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.ADMIN_API_KEY;

  if (configured && configured.trim()) {
    memoizedSecret = createHash("sha256").update(configured).digest();
    return memoizedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_AUTH_SECRET is required in production");
  }

  if (!warnedAboutEphemeralSecret) {
    warnedAboutEphemeralSecret = true;
    console.warn("SESSION_AUTH_SECRET not set; using ephemeral in-memory secret for development");
  }
  memoizedSecret = randomBytes(32);
  return memoizedSecret;
}

function encodeBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function signChallengePayload(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function normalizeHost(host: string | null): string | undefined {
  if (!host) return undefined;
  return host.trim().toLowerCase() || undefined;
}

function normalizeEvmAddress(address: string): string {
  return address.trim().toLowerCase();
}

function buildMessage(payload: ChallengePayload): string {
  const lines = [
    "ToSolana Session Authorization",
    "",
    `Session ID: ${payload.sessionId}`,
    `Source Wallet (EVM): ${payload.sourceAddress}`,
    `Destination Wallet (Solana): ${payload.solanaAddress}`,
    `Provider: ${payload.provider}`,
    `Route ID: ${payload.routeId}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${new Date(payload.iat).toISOString()}`,
    `Expires At: ${new Date(payload.exp).toISOString()}`,
  ];

  if (payload.host) {
    lines.push(`Host: ${payload.host}`);
  }

  lines.push("", "Authorize bridge execution and step status updates for this session only.");

  return lines.join("\n");
}

function makePayload(
  session: SessionAuthContext,
  requestHost?: string,
): ChallengePayload {
  const now = Date.now();
  return {
    v: SESSION_AUTH_VERSION,
    scheme: "evm",
    sessionId: session.id,
    sourceAddress: normalizeEvmAddress(session.sourceAddress),
    solanaAddress: session.solanaAddress.trim(),
    provider: session.provider,
    routeId: session.routeId,
    nonce: randomBytes(16).toString("hex"),
    iat: now,
    exp: now + SESSION_AUTH_TTL_MS,
    host: normalizeHost(requestHost ?? null),
  };
}

function parseAndVerifyChallengeToken(token: string): ChallengePayload {
  const [encodedPayload, providedSig] = token.split(".");
  if (!encodedPayload || !providedSig) {
    throw new Error("Invalid session auth challenge format");
  }

  const expectedSig = signChallengePayload(encodedPayload);
  const expectedBuf = decodeBase64Url(expectedSig);
  const providedBuf = decodeBase64Url(providedSig);

  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error("Invalid session auth challenge signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
  } catch {
    throw new Error("Invalid session auth challenge payload");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid session auth challenge payload");
  }

  const p = payload as Partial<ChallengePayload>;
  if (
    p.v !== SESSION_AUTH_VERSION ||
    p.scheme !== "evm" ||
    typeof p.sessionId !== "string" ||
    typeof p.sourceAddress !== "string" ||
    typeof p.solanaAddress !== "string" ||
    typeof p.provider !== "string" ||
    typeof p.routeId !== "string" ||
    typeof p.nonce !== "string" ||
    typeof p.iat !== "number" ||
    typeof p.exp !== "number"
  ) {
    throw new Error("Invalid session auth challenge payload");
  }

  return {
    ...p,
    host: typeof p.host === "string" ? normalizeHost(p.host) : undefined,
  } as ChallengePayload;
}

export function createSessionAuthChallenge(
  session: SessionAuthContext,
  requestHost?: string | null,
): SessionAuthChallenge {
  if (!/^0x[a-fA-F0-9]{40}$/.test(session.sourceAddress)) {
    throw new Error("Only EVM source wallet session auth is currently supported");
  }

  const payload = makePayload(session, requestHost ?? undefined);
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signChallengePayload(encodedPayload);
  const challenge = `${encodedPayload}.${signature}`;

  return {
    scheme: "evm",
    challenge,
    message: buildMessage(payload),
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function verifySessionAuthProof(
  proof: SessionAuthProof,
  session: SessionAuthContext,
  requestHost?: string | null,
): Promise<void> {
  if (proof.scheme !== "evm") {
    throw new Error("Unsupported session auth scheme");
  }

  const payload = parseAndVerifyChallengeToken(proof.challenge);

  const now = Date.now();
  if (payload.exp < now) {
    throw new Error("Session auth proof expired");
  }

  if (payload.iat > now + 60_000) {
    throw new Error("Session auth proof is not yet valid");
  }

  if (payload.sessionId !== session.id) {
    throw new Error("Session auth session mismatch");
  }
  if (payload.provider !== session.provider) {
    throw new Error("Session auth provider mismatch");
  }
  if (payload.routeId !== session.routeId) {
    throw new Error("Session auth route mismatch");
  }
  if (normalizeEvmAddress(payload.sourceAddress) !== normalizeEvmAddress(session.sourceAddress)) {
    throw new Error("Session auth source wallet mismatch");
  }
  if (payload.solanaAddress !== session.solanaAddress.trim()) {
    throw new Error("Session auth destination wallet mismatch");
  }

  const currentHost = normalizeHost(requestHost ?? null);
  if (payload.host && currentHost && payload.host !== currentHost) {
    throw new Error("Session auth host mismatch");
  }

  const expectedMessage = buildMessage(payload);
  if (proof.message !== expectedMessage) {
    throw new Error("Session auth message mismatch");
  }

  const recovered = await recoverMessageAddress({
    message: proof.message,
    signature: proof.signature as `0x${string}`,
  });

  if (normalizeEvmAddress(recovered) !== normalizeEvmAddress(session.sourceAddress)) {
    throw new Error("Invalid session auth signature");
  }
}


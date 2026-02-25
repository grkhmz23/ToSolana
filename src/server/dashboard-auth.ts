import { buildDashboardAuthMessage, isFreshTimestamp, verifySolanaSignature } from "@/lib/solana-auth";

const AUTH_WINDOW_MS = 5 * 60 * 1000;

export function verifyDashboardAuth(params: {
  wallet: string;
  signature: string;
  timestamp: number;
  action: string;
  resource?: string;
}): boolean {
  if (!isFreshTimestamp(params.timestamp, AUTH_WINDOW_MS)) {
    return false;
  }

  const message = buildDashboardAuthMessage({
    action: params.action,
    wallet: params.wallet,
    timestamp: params.timestamp,
    resource: params.resource,
  });

  return verifySolanaSignature({
    wallet: params.wallet,
    message,
    signature: params.signature,
  });
}

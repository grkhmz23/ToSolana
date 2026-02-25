import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

export function buildDashboardAuthMessage(params: {
  action: string;
  wallet: string;
  timestamp: number;
  resource?: string;
}): string {
  const { action, wallet, timestamp, resource } = params;
  const lines = [
    "ToSolana Dashboard Authorization",
    "",
    `Action: ${action}`,
    `Wallet: ${wallet}`,
    `Timestamp: ${timestamp}`,
  ];
  if (resource) lines.push(`Resource: ${resource}`);
  return lines.join("\n");
}

export function buildClaimMessage(params: {
  campaignId: string;
  wallet: string;
  amount: string;
  timestamp: number;
}): string {
  const { campaignId, wallet, amount, timestamp } = params;
  return [
    "ToSolana Claim Authorization",
    "",
    `Campaign: ${campaignId}`,
    `Wallet: ${wallet}`,
    `Amount: ${amount}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}

export function verifySolanaSignature(params: {
  wallet: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const publicKey = new PublicKey(params.wallet);
    const signatureBytes = bs58.decode(params.signature);
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes(),
    );
  } catch {
    return false;
  }
}

export function isFreshTimestamp(timestamp: number, windowMs: number): boolean {
  const now = Date.now();
  return Math.abs(now - timestamp) <= windowMs;
}

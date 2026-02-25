import { Connection } from "@solana/web3.js";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { getChain, getRpcUrl } from "@/lib/chains";
import { checkTransactionStatus } from "@/lib/non-evm-broadcast";
import type { ChainType } from "@/server/schema";

const DEFAULT_SOLANA_RPC =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export type VerifyTxFinalityInput = {
  chainType: ChainType;
  chainId?: number | string;
  txHashOrSig: string;
  expectedEvmSender?: string;
};

export type VerifyTxFinalityResult = {
  ok: boolean;
  finality?: "confirmed" | "finalized";
  reason?: string;
  details?: unknown;
};

function normalizeHex(address: string): string {
  return address.trim().toLowerCase();
}

async function verifyEvmTxFinality({
  chainId,
  txHashOrSig,
  expectedEvmSender,
}: VerifyTxFinalityInput): Promise<VerifyTxFinalityResult> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHashOrSig)) {
    return { ok: false, reason: "Invalid EVM transaction hash format" };
  }

  const numericChainId =
    typeof chainId === "number"
      ? chainId
      : typeof chainId === "string" && /^\d+$/.test(chainId)
        ? Number(chainId)
        : NaN;

  if (!Number.isInteger(numericChainId) || numericChainId <= 0) {
    return { ok: false, reason: "Missing or invalid EVM chainId for confirmation" };
  }

  const rpcUrl = getRpcUrl(numericChainId);
  if (!rpcUrl) {
    return { ok: false, reason: `No RPC configured for EVM chain ${numericChainId}` };
  }

  const client = createPublicClient({
    chain: getChain(numericChainId) ?? mainnet,
    transport: http(rpcUrl),
  });

  try {
    const receipt = await client.getTransactionReceipt({
      hash: txHashOrSig as `0x${string}`,
    });

    if (receipt.status !== "success") {
      return { ok: false, reason: "EVM transaction reverted" };
    }

    if (expectedEvmSender && normalizeHex(receipt.from) !== normalizeHex(expectedEvmSender)) {
      return { ok: false, reason: "EVM transaction sender mismatch" };
    }

    return { ok: true, finality: "confirmed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `EVM receipt lookup failed: ${message}` };
  }
}

async function verifySolanaTxFinality({
  txHashOrSig,
}: VerifyTxFinalityInput): Promise<VerifyTxFinalityResult> {
  if (!txHashOrSig || txHashOrSig.length < 32) {
    return { ok: false, reason: "Invalid Solana transaction signature format" };
  }

  const connection = new Connection(DEFAULT_SOLANA_RPC, "confirmed");

  try {
    const statuses = await connection.getSignatureStatuses([txHashOrSig], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];

    if (!status) {
      return { ok: false, reason: "Solana signature not found" };
    }
    if (status.err) {
      return { ok: false, reason: `Solana transaction failed: ${JSON.stringify(status.err)}` };
    }

    const finality = status.confirmationStatus;
    if (finality === "confirmed" || finality === "finalized") {
      return { ok: true, finality };
    }

    if (typeof status.confirmations === "number" && status.confirmations >= 1) {
      return { ok: true, finality: "confirmed" };
    }

    return { ok: false, reason: "Solana transaction is not yet confirmed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Solana signature lookup failed: ${message}` };
  }
}

async function verifyBitcoinTxFinality({
  txHashOrSig,
}: VerifyTxFinalityInput): Promise<VerifyTxFinalityResult> {
  if (!txHashOrSig || txHashOrSig.length !== 64) {
    return { ok: false, reason: "Invalid Bitcoin transaction ID format" };
  }

  try {
    const status = await checkTransactionStatus("bitcoin", txHashOrSig);
    
    if (!status.confirmed) {
      return { ok: false, reason: "Bitcoin transaction not yet confirmed" };
    }

    // Require at least 1 confirmation for basic confirmation
    // Require 6 confirmations for "finalized" (industry standard for Bitcoin)
    const confirmations = (status.details as { confirmations?: number })?.confirmations || 0;
    const finality = confirmations >= 6 ? "finalized" : "confirmed";
    
    return { 
      ok: true, 
      finality,
      details: status.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Bitcoin transaction lookup failed: ${message}` };
  }
}

async function verifyCosmosTxFinality({
  txHashOrSig,
  chainId,
}: VerifyTxFinalityInput): Promise<VerifyTxFinalityResult> {
  if (!txHashOrSig) {
    return { ok: false, reason: "Invalid Cosmos transaction hash" };
  }

  const cosmosChainId = typeof chainId === "string" ? chainId : "cosmoshub-4";
  
  try {
    const status = await checkTransactionStatus("cosmos", txHashOrSig, cosmosChainId);
    
    if (!status.confirmed) {
      return { ok: false, reason: "Cosmos transaction not yet confirmed" };
    }

    // Cosmos transactions are considered confirmed once included in a block with code 0
    // "Finalized" after a few blocks (typically 2-3 for IBC)
    return { 
      ok: true, 
      finality: "confirmed",
      details: status.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `Cosmos transaction lookup failed: ${message}` };
  }
}

async function verifyTonTxFinality({
  txHashOrSig,
}: VerifyTxFinalityInput): Promise<VerifyTxFinalityResult> {
  if (!txHashOrSig) {
    return { ok: false, reason: "Invalid TON transaction hash" };
  }

  try {
    const status = await checkTransactionStatus("ton", txHashOrSig);
    
    if (!status.confirmed) {
      return { ok: false, reason: "TON transaction not yet confirmed" };
    }

    // TON transactions are typically considered confirmed after appearing in a block
    return { 
      ok: true, 
      finality: "confirmed",
      details: status.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: `TON transaction lookup failed: ${message}` };
  }
}

export async function verifyTxFinality(
  input: VerifyTxFinalityInput,
): Promise<VerifyTxFinalityResult> {
  switch (input.chainType) {
    case "evm":
      return verifyEvmTxFinality(input);
    case "solana":
      return verifySolanaTxFinality(input);
    case "bitcoin":
      return verifyBitcoinTxFinality(input);
    case "cosmos":
      return verifyCosmosTxFinality(input);
    case "ton":
      return verifyTonTxFinality(input);
    default:
      return { ok: false, reason: "Unsupported chain type" };
  }
}

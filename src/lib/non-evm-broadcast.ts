/**
 * Non-EVM Transaction Broadcasting and Monitoring
 * 
 * This module provides broadcasting and status checking for non-EVM chains
 * (Bitcoin, Cosmos, TON). It handles:
 * 1. Broadcasting signed transactions to respective networks
 * 2. Polling for transaction confirmation/finality
 * 3. Normalizing status responses across different chain types
 */

import { fetchWithTimeout } from "./fetch-utils";

// ============================================
// Bitcoin Broadcasting
// ============================================

const BITCOIN_RPC_URLS = [
  "https://blockstream.info/api",
  "https://mempool.space/api",
];

export interface BitcoinBroadcastResult {
  txid: string;
  status: "pending" | "confirmed";
  confirmations?: number;
}

/**
 * Broadcast a signed Bitcoin transaction
 * @param signedTxHex - Signed transaction in hex format
 */
export async function broadcastBitcoinTx(
  signedTxHex: string,
): Promise<BitcoinBroadcastResult> {
  const errors: string[] = [];
  
  for (const baseUrl of BITCOIN_RPC_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/tx`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: signedTxHex,
      });

      if (response.ok) {
        const txid = await response.text();
        return {
          txid: txid.trim(),
          status: "pending",
        };
      }
      
      const errorText = await response.text();
      errors.push(`${baseUrl}: ${errorText}`);
    } catch (error) {
      errors.push(`${baseUrl}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  throw new Error(`Failed to broadcast Bitcoin transaction: ${errors.join("; ")}`);
}

/**
 * Check Bitcoin transaction status
 * @param txid - Transaction ID
 */
export async function checkBitcoinTxStatus(
  txid: string,
): Promise<{
  confirmed: boolean;
  confirmations: number;
  blockHeight?: number;
  blockHash?: string;
}> {
  for (const baseUrl of BITCOIN_RPC_URLS) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/tx/${txid}`,
        { method: "GET" }
      );

      if (response.status === 404) {
        // Transaction not found yet
        return { confirmed: false, confirmations: 0 };
      }

      if (!response.ok) {
        continue;
      }

      const data = await response.json() as {
        status?: { confirmed: boolean; block_height?: number; block_hash?: string };
      };
      
      if (data.status?.confirmed) {
        // Get confirmation count
        const confResponse = await fetchWithTimeout(
          `${baseUrl}/tx/${txid}/status`,
          { method: "GET" }
        );
        
        let confirmations = 1;
        if (confResponse.ok) {
          const confData = await confResponse.json() as { confirmed?: boolean; block_height?: number };
          if (confData.confirmed && confData.block_height) {
            // Estimate confirmations based on current block height
            const tipResponse = await fetchWithTimeout(
              `${baseUrl}/blocks/tip/height`,
              { method: "GET" }
            );
            if (tipResponse.ok) {
              const tipHeight = parseInt(await tipResponse.text(), 10);
              confirmations = tipHeight - confData.block_height + 1;
            }
          }
        }
        
        return {
          confirmed: true,
          confirmations,
          blockHeight: data.status.block_height,
          blockHash: data.status.block_hash,
        };
      }
      
      return { confirmed: false, confirmations: 0 };
    } catch {
      // Try next provider
    }
  }
  
  throw new Error("Failed to check Bitcoin transaction status");
}

// ============================================
// Cosmos Broadcasting
// ============================================

const COSMOS_RPC_ENDPOINTS: Record<string, string> = {
  "cosmoshub-4": "https://cosmos-rest.publicnode.com",
  "osmosis-1": "https://osmosis-rest.publicnode.com",
  "injective-1": "https://injective-rest.publicnode.com",
};

export interface CosmosBroadcastResult {
  txHash: string;
  height?: string;
  gasUsed?: string;
  gasWanted?: string;
}

/**
 * Broadcast a signed Cosmos transaction
 * @param signedTxBytes - Signed transaction bytes (base64)
 * @param chainId - Cosmos chain ID (e.g., "cosmoshub-4")
 */
export async function broadcastCosmosTx(
  signedTxBytes: string,
  chainId: string,
): Promise<CosmosBroadcastResult> {
  const rpcUrl = COSMOS_RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    throw new Error(`Unsupported Cosmos chain: ${chainId}`);
  }

  const response = await fetchWithTimeout(
    `${rpcUrl}/cosmos/tx/v1beta1/txs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_bytes: signedTxBytes,
        mode: "BROADCAST_MODE_SYNC",
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(
      `Cosmos broadcast failed: ${(errorData as { message?: string }).message || response.statusText}`
    );
  }

  const data = await response.json() as {
    tx_response?: {
      txhash: string;
      height?: string;
      gas_used?: string;
      gas_wanted?: string;
      code?: number;
      raw_log?: string;
    };
  };
  
  const txResponse = data.tx_response;
  if (!txResponse) {
    throw new Error("Invalid response from Cosmos RPC");
  }

  if (txResponse.code !== undefined && txResponse.code !== 0) {
    throw new Error(`Cosmos transaction failed: ${txResponse.raw_log || "Unknown error"}`);
  }

  return {
    txHash: txResponse.txhash,
    height: txResponse.height,
    gasUsed: txResponse.gas_used,
    gasWanted: txResponse.gas_wanted,
  };
}

/**
 * Check Cosmos transaction status
 * @param txHash - Transaction hash
 * @param chainId - Cosmos chain ID
 */
export async function checkCosmosTxStatus(
  txHash: string,
  chainId: string,
): Promise<{
  confirmed: boolean;
  height?: string;
  code?: number;
}> {
  const rpcUrl = COSMOS_RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    throw new Error(`Unsupported Cosmos chain: ${chainId}`);
  }

  try {
    const response = await fetchWithTimeout(
      `${rpcUrl}/cosmos/tx/v1beta1/txs/${txHash}`,
      { method: "GET" }
    );

    if (response.status === 404) {
      return { confirmed: false };
    }

    if (!response.ok) {
      throw new Error(`Failed to check Cosmos tx: ${response.statusText}`);
    }

    const data = await response.json() as {
      tx_response?: {
        txhash: string;
        height?: string;
        code?: number;
      };
    };
    
    const txResponse = data.tx_response;
    if (!txResponse) {
      return { confirmed: false };
    }

    return {
      confirmed: true,
      height: txResponse.height,
      code: txResponse.code,
    };
  } catch {
    return { confirmed: false };
  }
}

// ============================================
// TON Broadcasting
// ============================================

const TON_API_URL = "https://toncenter.com/api/v2";
const TON_API_KEY = process.env.TON_API_KEY || "";

export interface TonBroadcastResult {
  hash: string;
}

/**
 * Broadcast a signed TON transaction
 * @param signedTxBoc - Signed transaction in Base64 BoC format
 */
export async function broadcastTonTx(
  signedTxBoc: string,
): Promise<TonBroadcastResult> {
  const response = await fetchWithTimeout(
    `${TON_API_URL}/sendBoc`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TON_API_KEY && { "X-API-Key": TON_API_KEY }),
      },
      body: JSON.stringify({ boc: signedTxBoc }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `TON broadcast failed: ${(errorData as { error?: string }).error || response.statusText}`
    );
  }

  const data = await response.json() as { result?: { hash: string } };
  
  if (!data.result?.hash) {
    throw new Error("Invalid response from TON API");
  }

  return { hash: data.result.hash };
}

/**
 * Check TON transaction status
 * @param hash - Transaction hash
 */
export async function checkTonTxStatus(
  hash: string,
): Promise<{
  confirmed: boolean;
  lt?: string;
  blockId?: string;
}> {
  try {
    const response = await fetchWithTimeout(
      `${TON_API_URL}/getTransactions?hash=${encodeURIComponent(hash)}`,
      {
        method: "GET",
        headers: {
          ...(TON_API_KEY && { "X-API-Key": TON_API_KEY }),
        },
      }
    );

    if (!response.ok) {
      return { confirmed: false };
    }

    const data = await response.json() as {
      result?: Array<{
        transaction_id?: { lt: string };
        block_id?: string;
      }>;
    };
    
    if (data.result && data.result.length > 0) {
      const tx = data.result[0];
      return {
        confirmed: true,
        lt: tx.transaction_id?.lt,
        blockId: tx.block_id,
      };
    }

    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

// ============================================
// Unified Interface
// ============================================

export type ChainType = "bitcoin" | "cosmos" | "ton";

export interface BroadcastParams {
  chainType: ChainType;
  signedTx: string;
  chainId?: string;
}

export interface BroadcastResult {
  hash: string;
  chainType: ChainType;
}

/**
 * Broadcast a signed transaction to the appropriate network
 */
export async function broadcastTransaction(
  params: BroadcastParams,
): Promise<BroadcastResult> {
  switch (params.chainType) {
    case "bitcoin": {
      const result = await broadcastBitcoinTx(params.signedTx);
      return { hash: result.txid, chainType: "bitcoin" };
    }
    case "cosmos": {
      if (!params.chainId) {
        throw new Error("chainId is required for Cosmos transactions");
      }
      const result = await broadcastCosmosTx(params.signedTx, params.chainId);
      return { hash: result.txHash, chainType: "cosmos" };
    }
    case "ton": {
      const result = await broadcastTonTx(params.signedTx);
      return { hash: result.hash, chainType: "ton" };
    }
    default:
      throw new Error(`Unsupported chain type: ${(params as { chainType: string }).chainType}`);
  }
}

/**
 * Check transaction status on the appropriate network
 */
export async function checkTransactionStatus(
  chainType: ChainType,
  hash: string,
  chainId?: string,
): Promise<{ confirmed: boolean; details?: unknown }> {
  switch (chainType) {
    case "bitcoin": {
      const status = await checkBitcoinTxStatus(hash);
      return {
        confirmed: status.confirmed && status.confirmations >= 1,
        details: status,
      };
    }
    case "cosmos": {
      if (!chainId) {
        throw new Error("chainId is required for Cosmos transactions");
      }
      const status = await checkCosmosTxStatus(hash, chainId);
      return {
        confirmed: status.confirmed && status.code === 0,
        details: status,
      };
    }
    case "ton": {
      const status = await checkTonTxStatus(hash);
      return {
        confirmed: status.confirmed,
        details: status,
      };
    }
    default:
      throw new Error(`Unsupported chain type: ${(chainType as string)}`);
  }
}

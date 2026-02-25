// Allbridge provider for cross-chain transfers
// Docs: https://docs.allbridge.io/

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const ALLBRIDGE_API_URL = "https://api.allbridge.io/v1";

interface AllbridgeChain {
  chainId: string;
  name: string;
  tokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
  }>;
}

interface AllbridgeQuoteResponse {
  fee?: string;
  receivedAmount?: string;
  minimumReceivedAmount?: string;
  error?: string;
}

interface AllbridgeTxResponse {
  tx?: {
    to: string;
    data: string;
    value: string;
  };
  error?: string;
}

// Allbridge chain mapping
const ALLBRIDGE_CHAIN_IDS: Record<string | number, string> = {
  1: "ETH",
  137: "POL",
  42161: "ARB",
  10: "OPT",
  56: "BSC",
  8453: "BASE",
  43114: "AVA",
  7565164: "SOL", // Solana
};

export class AllbridgeProvider implements BridgeProvider {
  name = "allbridge" as const;

  isConfigured(): boolean {
    // Allbridge works without an API key
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? intent.sourceChainId 
      : String(intent.sourceChainId);
    
    const allbridgeSrcChain = ALLBRIDGE_CHAIN_IDS[sourceChainId];
    if (!allbridgeSrcChain || allbridgeSrcChain === "SOL") {
      return []; // Not an EVM source
    }

    try {
      // Get supported chains and tokens
      const chainsRes = await fetchWithTimeout(`${ALLBRIDGE_API_URL}/chains`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!chainsRes.ok) {
        return [];
      }

      const chains = (await chainsRes.json()) as AllbridgeChain[];
      const srcChain = chains.find((c) => c.chainId === allbridgeSrcChain);
      const dstChain = chains.find((c) => c.chainId === "SOL");

      if (!srcChain || !dstChain) {
        return [];
      }

      // Find token match
      const srcToken = srcChain.tokens.find(
        (t) => t.address.toLowerCase() === intent.sourceTokenAddress.toLowerCase()
      );

      if (!srcToken) {
        return [];
      }

      // Get quote
      const body = {
        sourceChain: allbridgeSrcChain,
        destinationChain: "SOL",
        sourceToken: srcToken.address,
        destinationToken: intent.destinationTokenAddress === "SOL"
          ? "native"
          : intent.destinationTokenAddress,
        amount: intent.sourceAmount,
      };

      const res = await fetchWithTimeout(`${ALLBRIDGE_API_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as AllbridgeQuoteResponse;

      if (data.error || !data.receivedAmount) {
        return [];
      }

      return [{
        provider: "allbridge",
        routeId: `allbridge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        steps: [
          {
            chainType: "evm",
            chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
            description: `Bridge via Allbridge`,
          },
          {
            chainType: "solana",
            description: `Receive on Solana`,
          },
        ],
        estimatedOutput: {
          token: "TOKEN", // Should get from API response
          amount: data.minimumReceivedAmount || data.receivedAmount,
        },
        fees: data.fee ? [{ token: srcToken.symbol, amount: data.fee }] : [],
        etaSeconds: 600, // Allbridge typically takes 5-15 minutes
        warnings: [
          "Transfer via Allbridge",
          "Native token transfers between chains",
        ],
      }];
    } catch (error) {
      console.error("Allbridge quote error:", error);
      return [];
    }
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? intent.sourceChainId 
      : String(intent.sourceChainId);
    
    const allbridgeSrcChain = ALLBRIDGE_CHAIN_IDS[sourceChainId];
    if (!allbridgeSrcChain) {
      throw new Error("Unsupported source chain for Allbridge");
    }

    const body = {
      sourceChain: allbridgeSrcChain,
      destinationChain: "SOL",
      sourceToken: intent.sourceTokenAddress,
      destinationToken: intent.destinationTokenAddress === "SOL"
        ? "native"
        : intent.destinationTokenAddress,
      amount: intent.sourceAmount,
      recipient: intent.solanaAddress,
    };

    const res = await fetchWithTimeout(`${ALLBRIDGE_API_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Allbridge transaction creation failed: ${error}`);
    }

    const data = (await res.json()) as AllbridgeTxResponse;

    if (data.error || !data.tx) {
      throw new Error(`Allbridge error: ${data.error || "No transaction data"}`);
    }

    return {
      kind: "evm",
      chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
      to: data.tx.to,
      data: data.tx.data,
      value: data.tx.value || "0",
    };
  }
}

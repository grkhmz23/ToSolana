// Symbiosis provider for cross-chain swaps
// Docs: https://docs.symbiosis.finance/integration-guide/api

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const SYMBIOSIS_API_URL = "https://api.symbiosis.finance/crosschain/v1";

interface SymbiosisQuoteResponse {
  tokenAmountOut?: {
    amount: string;
    token: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
  };
  tokenAmountOutMin?: {
    amount: string;
    token: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
  };
  priceImpact?: string;
  executionTime?: number;
  routes?: Array<{
    provider: string;
    path: string[];
  }>;
  fees?: Array<{
    token: string;
    amount: string;
  }>;
  error?: string;
  errorCode?: string;
}

interface SymbiosisSwapResponse {
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  error?: string;
}

// Chain IDs for Symbiosis
const SYMBIOSIS_CHAIN_IDS: Record<string | number, number> = {
  1: 1,           // Ethereum
  137: 137,       // Polygon
  42161: 42161,   // Arbitrum
  10: 10,         // Optimism
  56: 56,         // BSC
  8453: 8453,     // Base
  43114: 43114,   // Avalanche
  324: 324,       // zkSync
  59144: 59144,   // Linea
  169: 169,       // Manta
  534352: 534352, // Scroll
  1399811149: 1399811149, // Solana
};

export class SymbiosisProvider implements BridgeProvider {
  name = "symbiosis" as const;

  isConfigured(): boolean {
    // Symbiosis works without an API key
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    
    const symbiosisSrcChain = SYMBIOSIS_CHAIN_IDS[sourceChainId];
    if (!symbiosisSrcChain || symbiosisSrcChain === 1399811149) {
      return []; // Not an EVM source
    }

    try {
      const body = {
        chainIdFrom: symbiosisSrcChain,
        chainIdTo: 1399811149, // Solana
        tokenFrom: intent.sourceTokenAddress,
        tokenTo: intent.destinationTokenAddress === "SOL" 
          ? "native" 
          : intent.destinationTokenAddress,
        amountFrom: intent.sourceAmount,
        slippage: intent.slippage / 100,
        // Optional: referrer for fees
        referrer: "tosolana",
      };

      const res = await fetchWithTimeout(`${SYMBIOSIS_API_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(`Symbiosis API error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as SymbiosisQuoteResponse;

      if (data.error || !data.tokenAmountOut) {
        console.error("Symbiosis quote error:", data.error);
        return [];
      }

      const fees = (data.fees || []).map((f) => ({
        token: f.token,
        amount: f.amount,
      }));

      return [{
        provider: "symbiosis",
        routeId: `symbiosis-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        steps: [
          {
            chainType: "evm",
            chainId: sourceChainId,
            description: `Send via Symbiosis from ${this.getChainName(sourceChainId)}`,
          },
          {
            chainType: "solana",
            description: `Receive ${data.tokenAmountOut.token.symbol} on Solana`,
          },
        ],
        estimatedOutput: {
          token: data.tokenAmountOut.token.symbol,
          amount: data.tokenAmountOutMin?.amount || data.tokenAmountOut.amount,
        },
        fees,
        etaSeconds: data.executionTime || 300,
        warnings: [
          "Cross-chain via Symbiosis",
          data.priceImpact ? `Price impact: ${data.priceImpact}%` : "",
        ].filter(Boolean),
      }];
    } catch (error) {
      console.error("Symbiosis quote error:", error);
      return [];
    }
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    
    const symbiosisSrcChain = SYMBIOSIS_CHAIN_IDS[sourceChainId];
    if (!symbiosisSrcChain) {
      throw new Error("Unsupported source chain for Symbiosis");
    }

    const body = {
      chainIdFrom: symbiosisSrcChain,
      chainIdTo: 1399811149, // Solana
      tokenFrom: intent.sourceTokenAddress,
      tokenTo: intent.destinationTokenAddress === "SOL" 
        ? "native" 
        : intent.destinationTokenAddress,
      amountFrom: intent.sourceAmount,
      recipient: intent.solanaAddress,
      slippage: intent.slippage / 100,
      referrer: "tosolana",
    };

    const res = await fetchWithTimeout(`${SYMBIOSIS_API_URL}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Symbiosis swap error: ${res.status}`);
    }

    const data = (await res.json()) as SymbiosisSwapResponse;

    if (data.error) {
      throw new Error(`Symbiosis error: ${data.error}`);
    }

    if (!data.transaction) {
      throw new Error("No transaction data from Symbiosis");
    }

    return {
      kind: "evm",
      chainId: sourceChainId,
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || "0",
    };
  }

  private getChainName(chainId: number): string {
    const names: Record<number, string> = {
      1: "Ethereum",
      137: "Polygon",
      42161: "Arbitrum",
      10: "Optimism",
      56: "BSC",
      8453: "Base",
      43114: "Avalanche",
      324: "zkSync",
      59144: "Linea",
      169: "Manta",
      534352: "Scroll",
    };
    return names[chainId] || `Chain ${chainId}`;
  }
}

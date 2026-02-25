// Wormhole Connect provider for cross-chain transfers
// Docs: https://docs.wormhole.com/wormhole/quick-start/cross-chain-transfers

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

// Wormhole Connect uses the Portal Bridge API
const WORMHOLE_CONNECT_API = "https://portalbridge.com/api";
const WORMHOLE_SCAN_API = "https://wormholescan.io/api/v1";

// Wormhole chain IDs
const WORMHOLE_CHAIN_IDS: Record<string | number, number> = {
  1: 2,        // Ethereum
  137: 5,      // Polygon
  42161: 23,   // Arbitrum
  10: 24,      // Optimism
  56: 4,       // BSC
  8453: 30,    // Base
  43114: 6,    // Avalanche
  7565164: 1,  // Solana
};

interface WormholeQuoteResponse {
  route?: {
    sourceToken: {
      symbol: string;
      decimals: number;
      address: string;
    };
    destinationToken: {
      symbol: string;
      decimals: number;
      address: string;
    };
    sourceChain: number;
    destinationChain: number;
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    eta: number;
    fee: string;
    priceImpact: string;
  };
  error?: string;
}

interface WormholeTxResponse {
  transaction?: {
    to: string;
    data: string;
    value: string;
  };
  error?: string;
}

export class WormholeProvider implements BridgeProvider {
  name = "wormhole" as const;

  isConfigured(): boolean {
    // Wormhole Connect works without an API key
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    
    const wormholeSrcChain = WORMHOLE_CHAIN_IDS[sourceChainId];
    if (!wormholeSrcChain || wormholeSrcChain === 1) {
      return []; // Not an EVM source
    }

    try {
      const body = {
        sourceChain: wormholeSrcChain,
        targetChain: 1, // Solana
        sourceToken: intent.sourceTokenAddress,
        targetToken: intent.destinationTokenAddress === "SOL"
          ? "native"
          : intent.destinationTokenAddress,
        amount: intent.sourceAmount,
        recipient: intent.solanaAddress,
        slippage: intent.slippage / 100,
      };

      const res = await fetchWithTimeout(`${WORMHOLE_CONNECT_API}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(`Wormhole API error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as WormholeQuoteResponse;

      if (data.error || !data.route) {
        return [];
      }

      const route = data.route;

      return [{
        provider: "wormhole",
        routeId: `wormhole-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        steps: [
          {
            chainType: "evm",
            chainId: sourceChainId,
            description: `Bridge via Wormhole from ${this.getChainName(sourceChainId)}`,
          },
          {
            chainType: "solana",
            description: `Receive ${route.destinationToken.symbol} on Solana`,
          },
        ],
        estimatedOutput: {
          token: route.destinationToken.symbol,
          amount: route.minAmountOut || route.amountOut,
        },
        fees: [{ token: route.sourceToken.symbol, amount: route.fee }],
        etaSeconds: route.eta || 600,
        warnings: [
          "Cross-chain via Wormhole",
          `Price impact: ${route.priceImpact}%`,
          "Transfers may take 5-15 minutes",
        ],
      }];
    } catch (error) {
      console.error("Wormhole quote error:", error);
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
    
    const wormholeSrcChain = WORMHOLE_CHAIN_IDS[sourceChainId];
    if (!wormholeSrcChain) {
      throw new Error("Unsupported source chain for Wormhole");
    }

    const body = {
      sourceChain: wormholeSrcChain,
      targetChain: 1, // Solana
      sourceToken: intent.sourceTokenAddress,
      targetToken: intent.destinationTokenAddress === "SOL"
        ? "native"
        : intent.destinationTokenAddress,
      amount: intent.sourceAmount,
      recipient: intent.solanaAddress,
      slippage: intent.slippage / 100,
    };

    const res = await fetchWithTimeout(`${WORMHOLE_CONNECT_API}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Wormhole swap error: ${res.status}`);
    }

    const data = (await res.json()) as WormholeTxResponse;

    if (data.error) {
      throw new Error(`Wormhole error: ${data.error}`);
    }

    if (!data.transaction) {
      throw new Error("No transaction data from Wormhole");
    }

    return {
      kind: "evm",
      chainId: sourceChainId,
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || "0",
    };
  }

  // Check transaction status
  async checkTransactionStatus(
    emitterChain: number,
    emitterAddress: string,
    sequence: string
  ): Promise<{
    status: "pending" | "completed" | "failed";
    txHash?: string;
  }> {
    try {
      const res = await fetchWithTimeout(
        `${WORMHOLE_SCAN_API}/api/v1/transactions/${emitterChain}/${emitterAddress}/${sequence}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      if (!res.ok) return { status: "pending" };

      const data = await res.json();

      if (data.targetTxHash) {
        return { status: "completed", txHash: data.targetTxHash };
      }

      return { status: "pending" };
    } catch {
      return { status: "pending" };
    }
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
    };
    return names[chainId] || `Chain ${chainId}`;
  }
}

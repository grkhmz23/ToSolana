// Socket (Bungee) provider for cross-chain swaps
// Docs: https://docs.bungee.exchange/
// Note: Socket has two products - Bungee (bridge aggregator) and EVMx (interoperability protocol)
// This provider uses the Bungee API

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

// Socket Bungee API - supports both v1.0 and v2
const BUNGEE_API_URL = "https://api.bungee.exchange/v1";

interface BungeeQuoteResponse {
  success?: boolean;
  result?: {
    routes: Array<{
      routeId: string;
      isActive: boolean;
      fromChainId: number;
      toChainId: number;
      fromAmount: string;
      toAmount: string;
      totalUserTx: number;
      totalGasFeesInUsd: string;
      sender: string;
      recipient: string;
      userTxs: Array<{
        userTxType: string;
        txType: string;
        chainId: number;
        toAmount: string;
        steps: Array<{
          bridge: string;
          fromChainId: number;
          toChainId: number;
          fromAsset: {
            symbol: string;
            decimals: number;
          };
          toAsset: {
            symbol: string;
            decimals: number;
          };
        }>;
      }>;
    }>;
  };
  message?: string;
}

interface BungeeTxResponse {
  success?: boolean;
  result?: {
    txData?: string;
    txTarget?: string;
    chainId?: number;
    value?: string;
    approvalData?: {
      allowanceTarget: string;
      minimumApprovalAmount: string;
      approvalTokenAddress: string;
    };
  };
  message?: string;
}

// Chain ID mapping
const BUNGEE_CHAIN_IDS: Record<string | number, number> = {
  1: 1,        // Ethereum
  137: 137,    // Polygon
  42161: 42161, // Arbitrum
  10: 10,      // Optimism
  56: 56,      // BSC
  8453: 8453,  // Base
  43114: 43114, // Avalanche
  7565164: 7565164, // Solana
};

export class SocketProvider implements BridgeProvider {
  name = "socket" as const;

  isConfigured(): boolean {
    // Bungee API may work without an API key for basic usage
    // Try with API key if available, otherwise attempt without
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    
    const bungeeSrcChain = BUNGEE_CHAIN_IDS[sourceChainId];
    if (!bungeeSrcChain) {
      return [];
    }

    // Bungee does not directly support Solana as a destination via their standard API
    // Routes to Solana typically go through Wormhole
    const bungeeDstChain = BUNGEE_CHAIN_IDS[7565164];
    if (!bungeeDstChain) {
      // Solana not directly supported - would need Wormhole integration
      return [];
    }

    try {
      const body = {
        fromChainId: bungeeSrcChain,
        toChainId: bungeeDstChain,
        fromTokenAddress: intent.sourceTokenAddress,
        toTokenAddress: intent.destinationTokenAddress === "SOL"
          ? "0x0000000000000000000000000000000000000000" // Native placeholder
          : intent.destinationTokenAddress,
        fromAmount: intent.sourceAmount,
        userAddress: intent.sourceAddress,
        recipient: intent.solanaAddress,
        uniqueRoutesPerBridge: true,
        sort: "output",
        singleTxOnly: false,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      // Add API key if available (optional for Bungee)
      if (process.env.SOCKET_API_KEY) {
        headers["API-KEY"] = process.env.SOCKET_API_KEY;
      }

      const res = await fetchWithTimeout(`${BUNGEE_API_URL}/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Bungee quote error:", error);
        return [];
      }

      const data = (await res.json()) as BungeeQuoteResponse;

      if (!data.success || !data.result?.routes?.length) {
        return [];
      }

      // Return the best route
      const route = data.result.routes[0];
      const userTx = route.userTxs[0];
      const step = userTx?.steps?.[0];

      return [{
        provider: "socket",
        routeId: `socket-${route.routeId}`,
        steps: [
          {
            chainType: "evm",
            chainId: sourceChainId,
            description: `Bridge via ${step?.bridge || "Bungee"} from ${this.getChainName(sourceChainId)}`,
          },
          {
            chainType: "solana",
            description: `Receive tokens on Solana`,
          },
        ],
        estimatedOutput: {
          token: step?.toAsset?.symbol || "TOKEN",
          amount: route.toAmount,
        },
        fees: [
          { token: "USD", amount: route.totalGasFeesInUsd },
        ],
        etaSeconds: 600, // Estimate 10 minutes
        warnings: [
          "Cross-chain via Socket/Bungee",
          `Steps: ${route.totalUserTx}`,
          step?.bridge ? `Bridge: ${step.bridge}` : "",
        ].filter(Boolean),
      }];
    } catch (error) {
      console.error("Socket/Bungee quote error:", error);
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

    // Extract actual route ID
    const actualRouteId = routeId.replace("socket-", "");

    const body = {
      routeId: actualRouteId,
      fromChainId: BUNGEE_CHAIN_IDS[sourceChainId],
      toChainId: BUNGEE_CHAIN_IDS[7565164],
      fromTokenAddress: intent.sourceTokenAddress,
      toTokenAddress: intent.destinationTokenAddress === "SOL"
        ? "0x0000000000000000000000000000000000000000"
        : intent.destinationTokenAddress,
      fromAmount: intent.sourceAmount,
      userAddress: intent.sourceAddress,
      recipient: intent.solanaAddress,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (process.env.SOCKET_API_KEY) {
      headers["API-KEY"] = process.env.SOCKET_API_KEY;
    }

    const res = await fetchWithTimeout(`${BUNGEE_API_URL}/build-tx`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Bungee transaction build failed: ${error}`);
    }

    const data = (await res.json()) as BungeeTxResponse;

    if (!data.success || !data.result) {
      throw new Error(`Bungee error: ${data.message || "No transaction data"}`);
    }

    return {
      kind: "evm",
      chainId: sourceChainId,
      to: data.result.txTarget || "",
      data: data.result.txData || "0x",
      value: data.result.value || "0",
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
    };
    return names[chainId] || `Chain ${chainId}`;
  }
}

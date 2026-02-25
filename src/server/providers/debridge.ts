// deBridge provider for cross-chain swaps
// Docs: https://docs.debridge.finance/api

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const DEBRIDGE_API_URL = "https://api.dln.trade/v1.0/dln";

interface DebridgeQuoteResponse {
  estimation?: {
    srcChainTokenIn?: {
      address: string;
      symbol: string;
      decimals: number;
      amount: string;
    };
    srcChainTokenOut?: {
      address: string;
      symbol: string;
      decimals: number;
      amount: string;
    };
    dstChainTokenOut?: {
      address: string;
      symbol: string;
      decimals: number;
      amount: string;
      minAmount: string;
    };
    recommendedSlippage?: string;
    costsDetails?: Array<{
      type: string;
      payload: {
        tokenSymbol: string;
        amount: string;
      };
    }>;
  };
  tx?: {
    to: string;
    data: string;
    value: string;
  };
  orderId?: string;
  error?: string;
}

// Chain ID mapping for deBridge
const DEBRIDGE_CHAIN_IDS: Record<string | number, number> = {
  1: 1,        // Ethereum
  137: 137,    // Polygon
  42161: 42161, // Arbitrum
  10: 10,      // Optimism
  56: 56,      // BSC
  8453: 8453,  // Base
  43114: 43114, // Avalanche
  7565164: 7565164, // Solana
};

export class DebridgeProvider implements BridgeProvider {
  name = "debridge" as const;

  isConfigured(): boolean {
    // deBridge works without an API key for basic usage
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    // Only handle EVM -> Solana flows
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    
    const debridgeSrcChain = DEBRIDGE_CHAIN_IDS[sourceChainId];
    if (!debridgeSrcChain || debridgeSrcChain === 7565164) {
      return []; // Not an EVM source
    }

    try {
      const params = new URLSearchParams({
        srcChainId: debridgeSrcChain.toString(),
        srcChainTokenIn: intent.sourceTokenAddress,
        srcChainTokenInAmount: intent.sourceAmount,
        dstChainId: "7565164", // Solana
        dstChainTokenOut: intent.destinationTokenAddress === "SOL" 
          ? "11111111111111111111111111111111" // Wrapped SOL mint
          : intent.destinationTokenAddress,
        slippage: String(intent.slippage / 100), // Convert bps to percentage
        prependOperatingExpenses: "true",
      });

      const res = await fetchWithTimeout(`${DEBRIDGE_API_URL}/order/estimate?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("deBridge quote error:", error);
        return [];
      }

      const data = (await res.json()) as DebridgeQuoteResponse;

      if (data.error || !data.estimation?.dstChainTokenOut) {
        return [];
      }

      const estimation = data.estimation;
      const output = estimation.dstChainTokenOut;
      if (!output) {
        return [];
      }
      
      // Calculate fees from costsDetails
      const fees = (estimation.costsDetails || [])
        .filter((c) => c.type === "fixedFee")
        .map((c) => ({
          token: c.payload.tokenSymbol,
          amount: c.payload.amount,
        }));

      return [{
        provider: "debridge",
        routeId: `debridge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        steps: [
          {
            chainType: "evm",
            chainId: sourceChainId,
            description: `Send tokens via deBridge from ${this.getChainName(sourceChainId)}`,
          },
          {
            chainType: "solana",
            description: `Receive ${output.symbol} on Solana`,
          },
        ],
        estimatedOutput: {
          token: output.symbol,
          amount: output.minAmount || output.amount,
        },
        fees,
        etaSeconds: 180, // deBridge is typically fast (3-5 min)
        warnings: [
          `Slippage: ${estimation.recommendedSlippage || "0.5%"}`,
          "Cross-chain transfer via deBridge DLN",
        ],
      }];
    } catch (error) {
      console.error("deBridge quote error:", error);
      return [];
    }
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    if (stepIndex !== 0) {
      throw new Error("deBridge route only has one executable step");
    }

    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? parseInt(intent.sourceChainId, 10) 
      : intent.sourceChainId;
    const debridgeSrcChain = DEBRIDGE_CHAIN_IDS[sourceChainId];

    if (!debridgeSrcChain) {
      throw new Error("Unsupported source chain for deBridge");
    }

    const params = new URLSearchParams({
      srcChainId: debridgeSrcChain.toString(),
      srcChainTokenIn: intent.sourceTokenAddress,
      srcChainTokenInAmount: intent.sourceAmount,
      dstChainId: "7565164", // Solana
      dstChainTokenOut: intent.destinationTokenAddress === "SOL"
        ? "11111111111111111111111111111111"
        : intent.destinationTokenAddress,
      slippage: String(intent.slippage / 100),
      dstChainTokenOutRecipient: intent.solanaAddress,
      sender: intent.sourceAddress,
      prependOperatingExpenses: "true",
    });

    const res = await fetchWithTimeout(`${DEBRIDGE_API_URL}/order/create-tx?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`deBridge transaction creation failed: ${error}`);
    }

    const data = (await res.json()) as DebridgeQuoteResponse;

    if (data.error || !data.tx) {
      throw new Error(`deBridge error: ${data.error || "No transaction data"}`);
    }

    return {
      kind: "evm",
      chainId: sourceChainId,
      to: data.tx.to,
      data: data.tx.data,
      value: data.tx.value || "0",
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

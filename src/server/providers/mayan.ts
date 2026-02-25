// Mayan provider for cross-chain swaps using Wormhole
// Docs: https://docs.mayan.finance/

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

// Mayan uses Wormhole SDK directly, not a REST API
// For quotes, we use the Mayan Swap API
const MAYAN_API_URL = "https://mayan.sh/v3";

interface MayanQuoteResponse {
  quotes?: Array<{
    bridge: string;
    amountOut: string;
    minAmountOut: string;
    gasDrop: string;
    etaSeconds: number;
    protocol: string;
    solanaRelayerFee?: string;
    evmRelayerFee?: string;
    error?: string;
  }>;
  error?: string;
}

interface MayanSwapResponse {
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  error?: string;
}

// Mayan supported chains
const MAYAN_CHAIN_NAMES: Record<string | number, string> = {
  1: "ethereum",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  56: "bsc",
  8453: "base",
  43114: "avalanche",
  "solana": "solana",
};

export class MayanProvider implements BridgeProvider {
  name = "mayan" as const;

  isConfigured(): boolean {
    // Mayan works without an API key
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? intent.sourceChainId 
      : String(intent.sourceChainId);
    
    const mayanSrcChain = MAYAN_CHAIN_NAMES[sourceChainId];
    if (!mayanSrcChain || mayanSrcChain === "solana") {
      return []; // Not an EVM source
    }

    try {
      const params = new URLSearchParams({
        fromChain: mayanSrcChain,
        toChain: "solana",
        fromToken: intent.sourceTokenAddress,
        toToken: intent.destinationTokenAddress === "SOL"
          ? "0x0000000000000000000000000000000000000000"
          : intent.destinationTokenAddress,
        amount: intent.sourceAmount,
        slippage: String(intent.slippage / 100),
        sender: intent.sourceAddress,
        recipient: intent.solanaAddress,
      });

      const res = await fetchWithTimeout(`${MAYAN_API_URL}/quote?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error(`Mayan API error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as MayanQuoteResponse;

      if (data.error || !data.quotes?.length) {
        return [];
      }

      const routes: NormalizedRoute[] = [];

      for (const quote of data.quotes) {
        if (quote.error) continue;

        const fees: Array<{ token: string; amount: string }> = [];
        if (quote.evmRelayerFee) {
          fees.push({ token: "ETH", amount: quote.evmRelayerFee });
        }
        if (quote.solanaRelayerFee) {
          fees.push({ token: "SOL", amount: quote.solanaRelayerFee });
        }

        routes.push({
          provider: "mayan",
          routeId: `mayan-${quote.bridge}-${Date.now()}`,
          steps: [
            {
              chainType: "evm",
              chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
              description: `Bridge via ${quote.bridge} using Mayan`,
            },
            {
              chainType: "solana",
              description: `Receive on Solana via Wormhole`,
            },
          ],
          estimatedOutput: {
            token: "SOL", // Simplified - should use actual token symbol
            amount: quote.minAmountOut || quote.amountOut,
          },
          fees,
          etaSeconds: quote.etaSeconds || 300,
          warnings: [
            `Protocol: ${quote.protocol}`,
            quote.gasDrop ? `Gas drop: ${quote.gasDrop}` : "",
          ].filter(Boolean),
        });
      }

      return routes;
    } catch (error) {
      console.error("Mayan quote error:", error);
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
    
    const mayanSrcChain = MAYAN_CHAIN_NAMES[sourceChainId];
    if (!mayanSrcChain) {
      throw new Error("Unsupported source chain for Mayan");
    }

    const params = new URLSearchParams({
      fromChain: mayanSrcChain,
      toChain: "solana",
      fromToken: intent.sourceTokenAddress,
      toToken: intent.destinationTokenAddress === "SOL"
        ? "0x0000000000000000000000000000000000000000"
        : intent.destinationTokenAddress,
      amount: intent.sourceAmount,
      slippage: String(intent.slippage / 100),
      sender: intent.sourceAddress,
      recipient: intent.solanaAddress,
    });

    const res = await fetchWithTimeout(`${MAYAN_API_URL}/swap?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Mayan swap error: ${res.status}`);
    }

    const data = (await res.json()) as MayanSwapResponse;

    if (data.error) {
      throw new Error(`Mayan error: ${data.error}`);
    }

    if (!data.transaction) {
      throw new Error("No transaction data from Mayan");
    }

    return {
      kind: "evm",
      chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
      to: data.transaction.to,
      data: data.transaction.data,
      value: data.transaction.value || "0",
    };
  }
}

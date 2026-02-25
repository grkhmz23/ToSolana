// Jupiter provider for Solana DEX aggregation
// This is used for Solana-side swaps after bridging
// Docs: https://station.jup.ag/docs/apis/

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// WSOL mint address
const WSOL_MINT = "So11111111111111111111111111111111111111112";

interface JupiterQuoteResponse {
  data?: Array<{
    id: string;
    mintA: string;
    mintB: string;
    amountIn: string;
    amountOut: string;
    priceImpact: number;
    otherAmountThreshold: string;
    swapMode: string;
    fees: {
      signatureFee: number;
      openOrdersDeposits: number[];
      ataDeposits: number[];
      totalFeeAndDeposits: number;
      minimumSolForTransaction: number;
    };
  }>;
  error?: string;
}

interface JupiterSwapResponse {
  swapTransaction?: string;
  error?: string;
}

export class JupiterProvider implements BridgeProvider {
  name = "jupiter" as const;

  isConfigured(): boolean {
    // Jupiter is a Solana-only provider, not a cross-chain bridge
    // It can be used for post-bridge swaps on Solana
    return process.env.ENABLE_JUPITER_PROVIDER === "true";
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    // Jupiter is only for Solana-side swaps
    // Only process if destination chain is Solana and we want to swap from SOL to another token
    
    if (intent.destinationTokenAddress === "SOL") {
      // No swap needed, user wants native SOL
      return [];
    }

    // Check if source is coming from EVM (we only do Solana-side swaps)
    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? intent.sourceChainId 
      : String(intent.sourceChainId);
    
    const isEvmSource = ["1", "137", "42161", "10", "56", "8453", "43114"].includes(sourceChainId);
    
    if (!isEvmSource) {
      return [];
    }

    try {
      // Get a quote for swapping SOL to the destination token
      // The input amount would be the expected bridged amount (which we don't know yet)
      // This is a simplified implementation - in practice, you'd compose this with bridge routes
      
      const params = new URLSearchParams({
        inputMint: WSOL_MINT,
        outputMint: intent.destinationTokenAddress,
        amount: intent.sourceAmount, // This is rough - should be post-bridge amount
        slippageBps: String(intent.slippage),
        onlyDirectRoutes: "false",
        asLegacyTransaction: "false",
      });

      const res = await fetchWithTimeout(`${JUPITER_QUOTE_API}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error(`Jupiter API error: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as JupiterQuoteResponse;

      if (data.error || !data.data?.length) {
        return [];
      }

      const bestRoute = data.data[0];

      // Jupiter routes should be composed with bridge routes
      // This is a standalone Jupiter-only route (swap on Solana only)
      return [{
        provider: "jupiter",
        routeId: `jupiter-${bestRoute.id}`,
        steps: [
          {
            chainType: "solana",
            description: `Swap SOL to target token via Jupiter`,
          },
        ],
        estimatedOutput: {
          token: "TOKEN", // Should decode from mint
          amount: bestRoute.amountOut,
        },
        fees: [
          { token: "SOL", amount: String(bestRoute.fees.totalFeeAndDeposits) },
        ],
        etaSeconds: 30, // Solana is fast
        warnings: [
          "Solana DEX swap via Jupiter",
          `Price impact: ${(bestRoute.priceImpact * 100).toFixed(2)}%`,
          "This is a Solana-side swap only",
        ],
      }];
    } catch (error) {
      console.error("Jupiter quote error:", error);
      return [];
    }
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    // Get swap transaction
    const params = {
      quoteResponse: {
        inputMint: WSOL_MINT,
        outputMint: intent.destinationTokenAddress,
        amount: intent.sourceAmount,
        slippageBps: intent.slippage,
      },
      userPublicKey: intent.solanaAddress,
      wrapAndUnwrapSol: true,
      asLegacyTransaction: false,
    };

    const res = await fetchWithTimeout(JUPITER_SWAP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Jupiter swap error: ${res.status}`);
    }

    const data = (await res.json()) as JupiterSwapResponse;

    if (data.error || !data.swapTransaction) {
      throw new Error(`Jupiter error: ${data.error || "No swap transaction"}`);
    }

    return {
      kind: "solana",
      rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      serializedTxBase64: data.swapTransaction,
    };
  }
}

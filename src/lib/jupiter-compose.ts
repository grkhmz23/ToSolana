import type { NormalizedRoute, QuoteRequest } from "@/server/schema";
import { getJupiterQuote, isJupiterSwapEnabled, WSOL_MINT } from "@/lib/jupiter";

const SOL_MINT = "11111111111111111111111111111111";

export async function composeJupiterSwapRoutes(
  routes: NormalizedRoute[],
  intent: QuoteRequest,
): Promise<NormalizedRoute[]> {
  if (!isJupiterSwapEnabled()) return routes;

  if (intent.destinationTokenAddress === SOL_MINT || intent.destinationTokenAddress === "SOL") {
    return routes;
  }

  const slippageBps = Math.round((intent.slippage ?? 3) * 100);

  const composed = await Promise.all(
    routes.map(async (route) => {
      if (route.action) return route;
      if (route.steps.some((s) => s.provider === "jupiter")) return route;
      if (route.estimatedOutput.token !== "SOL") return route;

      const amountIn = route.estimatedOutput.amount;
      const quote = await getJupiterQuote({
        inputMint: WSOL_MINT,
        outputMint: intent.destinationTokenAddress,
        amount: amountIn,
        slippageBps,
      });

      if (!quote) {
        return {
          ...route,
          warnings: [...(route.warnings ?? []), "Jupiter swap unavailable; output remains SOL"],
        };
      }

      return {
        ...route,
        steps: [
          ...route.steps,
          {
            chainType: "solana" as const,
            description: "Swap via Jupiter to target SPL",
            provider: "jupiter" as const,
            metadata: {
              inputMint: WSOL_MINT,
              outputMint: intent.destinationTokenAddress,
              amountIn,
              slippageBps,
            },
          },
        ],
        estimatedOutput: {
          token: intent.destinationTokenAddress,
          amount: quote.outAmount,
        },
        warnings: [...(route.warnings ?? []), "Includes Jupiter swap on Solana"],
      };
    }),
  );

  return composed;
}

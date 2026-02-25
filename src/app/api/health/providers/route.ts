// Health check endpoint for bridge providers
// GET /api/health/providers

import { NextResponse } from "next/server";
import { providers } from "@/server/providers";
import type { QuoteRequest } from "@/server/schema";

const testQuoteRequest: QuoteRequest = {
  sourceChainId: 1,
  sourceTokenAddress: "0x0000000000000000000000000000000000000000",
  sourceAmount: "10000000000000000", // 0.01 ETH
  destinationTokenAddress: "SOL",
  sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
};

export async function GET() {
  const results = await Promise.all(
    providers.map(async (provider) => {
      const startTime = Date.now();
      const isConfigured = provider.isConfigured();
      
      let routes = 0;
      let error: string | null = null;
      let responseTime = 0;

      if (isConfigured) {
        try {
          const quotes = await provider.getQuotes(testQuoteRequest);
          routes = quotes.length;
          responseTime = Date.now() - startTime;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          responseTime = Date.now() - startTime;
        }
      }

      return {
        name: provider.name,
        configured: isConfigured,
        routes,
        error,
        responseTimeMs: responseTime,
      };
    })
  );

  const summary = {
    total: results.length,
    configured: results.filter((r) => r.configured).length,
    working: results.filter((r) => r.configured && r.routes > 0).length,
    errors: results.filter((r) => r.error).length,
  };

  const status = summary.working === 0 ? "error" : summary.errors > 0 ? "degraded" : "healthy";
  const httpStatus = status === "error" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      summary,
      providers: results,
    },
    { status: httpStatus }
  );
}

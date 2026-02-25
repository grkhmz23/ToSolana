#!/usr/bin/env tsx
// Test a single provider with detailed output
// Usage: pnpm tsx scripts/test-single-provider.ts <provider-name>

import { getProvider } from "../src/server/providers";
import type { QuoteRequest } from "../src/server/schema";

const providerName = process.argv[2] || "lifi";

const testQuoteRequest: QuoteRequest = {
  sourceChainId: 1,
  sourceTokenAddress: "0x0000000000000000000000000000000000000000",
  sourceAmount: "10000000000000000", // 0.01 ETH
  destinationTokenAddress: "SOL",
  sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
};

async function testProvider(name: string) {
  console.log(`\n🔍 Testing ${name} provider...\n`);
  
  try {
    const provider = getProvider(name as any);
    console.log(`✅ Provider found: ${provider.name}`);
    
    const isConfigured = provider.isConfigured();
    console.log(`Configuration: ${isConfigured ? "✅ Configured" : "❌ Not Configured"}`);
    
    if (!isConfigured) {
      console.log("\n⚠️  Provider is not configured. Check your environment variables.");
      return;
    }
    
    console.log("\n📡 Fetching quotes...");
    console.log(`Request: 0.01 ETH → SOL`);
    
    const startTime = Date.now();
    const quotes = await provider.getQuotes(testQuoteRequest);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Response received in ${duration}ms`);
    console.log(`Routes found: ${quotes.length}`);
    
    if (quotes.length > 0) {
      console.log("\n📋 Route Details:");
      quotes.forEach((route, i) => {
        console.log(`\n  Route ${i + 1}:`);
        console.log(`    Provider: ${route.provider}`);
        console.log(`    Route ID: ${route.routeId}`);
        console.log(`    Output: ${route.estimatedOutput.amount} ${route.estimatedOutput.token}`);
        console.log(`    ETA: ${route.etaSeconds || 'unknown'}s`);
        console.log(`    Steps: ${route.steps.length}`);
        route.steps.forEach((step, j) => {
          console.log(`      ${j + 1}. ${step.chainType}${step.chainId ? ` (${step.chainId})` : ''}: ${step.description}`);
        });
        if (route.fees.length > 0) {
          console.log(`    Fees: ${route.fees.map(f => `${f.amount} ${f.token}`).join(', ')}`);
        }
        if (route.warnings?.length) {
          console.log(`    Warnings: ${route.warnings.join(', ')}`);
        }
      });
    } else {
      console.log("\n⚠️  No routes returned (this may be normal if the provider doesn't support this pair)");
    }
    
  } catch (error) {
    console.error(`\n❌ Error testing ${name}:`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

testProvider(providerName).catch(console.error);

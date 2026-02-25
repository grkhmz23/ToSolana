#!/usr/bin/env tsx
// CLI script to test all bridge providers
// Usage: pnpm tsx scripts/test-providers.ts

import { providers, getProvider } from "../src/server/providers";
import type { QuoteRequest } from "../src/server/schema";

const testQuoteRequest: QuoteRequest = {
  sourceChainId: 1,
  sourceTokenAddress: "0x0000000000000000000000000000000000000000",
  sourceAmount: "10000000000000000", // 0.01 ETH
  destinationTokenAddress: "SOL",
  sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5", // Valid Ethereum address
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
};

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testProvider(name: string) {
  const provider = getProvider(name as any);
  const isConfigured = provider.isConfigured();
  
  log(`\n📦 Testing ${name}...`, "cyan");
  log(`   Configured: ${isConfigured ? "✅ Yes" : "❌ No"}`, isConfigured ? "green" : "red");
  
  if (!isConfigured) {
    return { name, configured: false, routes: 0, error: null };
  }

  try {
    const startTime = Date.now();
    const quotes = await provider.getQuotes(testQuoteRequest);
    const duration = Date.now() - startTime;
    
    log(`   Routes found: ${quotes.length}`, quotes.length > 0 ? "green" : "yellow");
    log(`   Response time: ${duration}ms`, "blue");
    
    if (quotes.length > 0) {
      const bestRoute = quotes[0];
      log(`   Best output: ${bestRoute.estimatedOutput.amount} ${bestRoute.estimatedOutput.token}`, "green");
      log(`   ETA: ${bestRoute.etaSeconds}s`, "blue");
    }
    
    return { name, configured: true, routes: quotes.length, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`   Error: ${errorMessage}`, "red");
    return { name, configured: true, routes: 0, error: errorMessage };
  }
}

async function main() {
  log("\n🚀 Bridge Provider Test Suite\n", "cyan");
  log("============================\n", "cyan");
  
  // Show environment
  log("Environment:", "blue");
  log(`  NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
  log(`  LIFI_API_KEY: ${process.env.LIFI_API_KEY ? "✅ set" : "❌ not set"}`);
  log(`  LIFI_INTEGRATOR: ${process.env.LIFI_INTEGRATOR ? "✅ set" : "❌ not set"}`);
  log(`  RANGO_API_KEY: ${process.env.RANGO_API_KEY ? "✅ set" : "❌ not set"}`);
  log(`  FLASHIFT_API_KEY: ${process.env.FLASHIFT_API_KEY ? "✅ set" : "❌ not set"}`);
  log(`  TON_API_KEY: ${process.env.TON_API_KEY ? "✅ set" : "❌ not set"}`);
  log(`  ENABLE_THORCHAIN_PROVIDER: ${process.env.ENABLE_THORCHAIN_PROVIDER}`);
  log(`  ENABLE_IBC_PROVIDER: ${process.env.ENABLE_IBC_PROVIDER}`);
  log(`  ENABLE_TON_PROVIDER: ${process.env.ENABLE_TON_PROVIDER}`);
  log("");
  
  const results = [];
  
  // Test all providers
  for (const provider of providers) {
    const result = await testProvider(provider.name);
    results.push(result);
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  log("\n============================", "cyan");
  log("📊 Summary\n", "cyan");
  
  const configured = results.filter(r => r.configured);
  const working = results.filter(r => r.configured && r.routes > 0);
  const errors = results.filter(r => r.error);
  
  log(`Total providers: ${results.length}`, "blue");
  log(`Configured: ${configured.length}`, "blue");
  log(`Working (returning routes): ${working.length}`, working.length > 0 ? "green" : "yellow");
  log(`Errors: ${errors.length}`, errors.length > 0 ? "red" : "green");
  
  if (errors.length > 0) {
    log("\n❌ Providers with errors:", "red");
    errors.forEach(e => log(`  - ${e.name}: ${e.error}`, "red"));
  }
  
  log("");
  
  // Exit with error code if no providers are working
  if (working.length === 0) {
    log("⚠️  No providers are returning routes!", "red");
    process.exit(1);
  }
  
  log("✅ Test completed successfully!", "green");
  process.exit(0);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

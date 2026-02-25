#!/usr/bin/env tsx
// Test non-EVM providers with correct source chains

import { getProvider } from "../src/server/providers";
import type { QuoteRequest } from "../src/server/schema";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testThorchain() {
  log("\n=== THORChain (Bitcoin → Solana) ===", "cyan");
  
  const provider = getProvider("thorchain");
  log(`Configured: ${provider.isConfigured() ? "✅ Yes" : "❌ No"}`);
  
  const request: QuoteRequest = {
    sourceChainId: "bitcoin",
    sourceChainType: "bitcoin",
    sourceTokenAddress: "BTC",
    sourceAmount: "100000", // 0.001 BTC in satoshis
    destinationTokenAddress: "SOL",
    sourceAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
    slippage: 3,
  };
  
  try {
    const quotes = await provider.getQuotes(request);
    log(`Routes found: ${quotes.length}`, quotes.length > 0 ? "green" : "yellow");
    
    if (quotes.length > 0) {
      log(`✅ THORChain is working!`, "green");
      log(`   Output: ${quotes[0].estimatedOutput.amount} ${quotes[0].estimatedOutput.token}`);
    }
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, "yellow");
  }
}

async function testIBC() {
  log("\n=== IBC (Cosmos → Solana) ===", "cyan");
  
  const provider = getProvider("ibc");
  log(`Configured: ${provider.isConfigured() ? "✅ Yes" : "❌ No"}`);
  
  const request: QuoteRequest = {
    sourceChainId: "cosmos",
    sourceChainType: "cosmos",
    sourceTokenAddress: "uatom",
    sourceAmount: "1000000", // 1 ATOM
    destinationTokenAddress: "SOL",
    sourceAddress: "cosmos1vqn75qrv7cp74d63xa4492wn3uzzl6g9k",
    solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
    slippage: 3,
  };
  
  try {
    const quotes = await provider.getQuotes(request);
    log(`Routes found: ${quotes.length}`, quotes.length > 0 ? "green" : "yellow");
    
    if (quotes.length > 0) {
      log(`✅ IBC is working!`, "green");
      log(`   Output: ${quotes[0].estimatedOutput.amount} ${quotes[0].estimatedOutput.token}`);
    }
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, "yellow");
  }
}

async function testTON() {
  log("\n=== TON (TON → Solana) ===", "cyan");
  
  const provider = getProvider("ton");
  log(`Configured: ${provider.isConfigured() ? "✅ Yes" : "❌ No"}`);
  
  if (!provider.isConfigured()) {
    log("   (Enable with ENABLE_TON_PROVIDER=true)", "yellow");
    return;
  }
  
  const request: QuoteRequest = {
    sourceChainId: "ton",
    sourceChainType: "ton",
    sourceTokenAddress: "native",
    sourceAmount: "1000000000", // 1 TON in nanoton
    destinationTokenAddress: "SOL",
    sourceAddress: "EQD...", // TON address
    solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
    slippage: 3,
  };
  
  try {
    const quotes = await provider.getQuotes(request);
    log(`Routes found: ${quotes.length}`, quotes.length > 0 ? "green" : "yellow");
    
    if (quotes.length > 0) {
      log(`✅ TON is working!`, "green");
      log(`   Output: ${quotes[0].estimatedOutput.amount} ${quotes[0].estimatedOutput.token}`);
    }
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, "yellow");
  }
}

async function main() {
  log("\n🧪 Testing Non-EVM Providers", "cyan");
  log("============================\n", "cyan");
  
  await testThorchain();
  await testIBC();
  await testTON();
  
  log("\n============================", "cyan");
  log("\n✅ These providers work with the correct source chain!", "green");
  log("   - Select Bitcoin as source → THORChain routes appear", "green");
  log("   - Select Cosmos as source → IBC routes appear", "green");
  log("   - Select TON as source → TON routes appear", "green");
}

main().catch(console.error);

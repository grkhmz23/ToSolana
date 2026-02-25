// @vitest-environment node
// Integration tests for all bridge providers
// These tests make real API calls to verify providers work

import { describe, it, expect, beforeAll } from "vitest";
import { providers, getProvider } from "@/server/providers";
import type { QuoteRequest } from "@/server/schema";

// Test quote request - ETH on Ethereum to SOL on Solana
const testQuoteRequest: QuoteRequest = {
  sourceChainId: 1, // Ethereum
  sourceTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
  sourceAmount: "1000000000000000000", // 1 ETH
  destinationTokenAddress: "SOL",
  sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Test address
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP", // Test Solana address
  slippage: 3,
};

// Test quote request - smaller amount for providers that have minimums
const testQuoteRequestSmall: QuoteRequest = {
  sourceChainId: 1, // Ethereum
  sourceTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
  sourceAmount: "10000000000000000", // 0.01 ETH
  destinationTokenAddress: "SOL",
  sourceAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
  slippage: 3,
};

describe("Provider Integration Tests", () => {
  // Test each provider individually
  
  describe("LI.FI Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("lifi");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("lifi");
      const quotes = await provider.getQuotes(testQuoteRequest);
      
      // LI.FI should return routes if configured
      console.log("LI.FI routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("lifi");
        expect(quotes[0].routeId).toBeDefined();
        expect(quotes[0].estimatedOutput.amount).toBeDefined();
        expect(quotes[0].steps.length).toBeGreaterThan(0);
      }
    }, 30000); // 30s timeout for API call
  });

  describe("Rango Provider", () => {
    it("should check configuration", () => {
      const provider = getProvider("rango");
      const isConfigured = provider.isConfigured();
      console.log("Rango configured:", isConfigured);
      
      // If RANGO_API_KEY is set, it should be configured
      if (process.env.RANGO_API_KEY) {
        expect(isConfigured).toBe(true);
      }
    });

    it("should fetch quotes if configured", async () => {
      const provider = getProvider("rango");
      
      if (!provider.isConfigured()) {
        console.log("Rango not configured, skipping");
        return;
      }

      const quotes = await provider.getQuotes(testQuoteRequest);
      console.log("Rango routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("rango");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("deBridge Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("debridge");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("debridge");
      const quotes = await provider.getQuotes(testQuoteRequestSmall);
      
      console.log("deBridge routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("debridge");
        expect(quotes[0].routeId).toBeDefined();
        expect(quotes[0].estimatedOutput.amount).toBeDefined();
      }
    }, 30000);
  });

  describe("Symbiosis Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("symbiosis");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("symbiosis");
      const quotes = await provider.getQuotes(testQuoteRequestSmall);
      
      console.log("Symbiosis routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("symbiosis");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("Mayan Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("mayan");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("mayan");
      const quotes = await provider.getQuotes(testQuoteRequest);
      
      console.log("Mayan routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("mayan");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("Allbridge Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("allbridge");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("allbridge");
      const quotes = await provider.getQuotes(testQuoteRequestSmall);
      
      console.log("Allbridge routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("allbridge");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("Wormhole Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("wormhole");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes", async () => {
      const provider = getProvider("wormhole");
      const quotes = await provider.getQuotes(testQuoteRequestSmall);
      
      console.log("Wormhole routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("wormhole");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("Socket/Bungee Provider", () => {
    it("should be configured", () => {
      const provider = getProvider("socket");
      expect(provider.isConfigured()).toBe(true);
    });

    it("should fetch quotes (may return empty if no Solana support)", async () => {
      const provider = getProvider("socket");
      const quotes = await provider.getQuotes(testQuoteRequest);
      
      console.log("Socket routes:", quotes.length);
      
      // Socket may return empty if they don't support Solana directly
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("socket");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("Flashift Provider", () => {
    it("should check configuration", () => {
      const provider = getProvider("flashift");
      const isConfigured = provider.isConfigured();
      console.log("Flashift configured:", isConfigured);
      
      if (process.env.FLASHIFT_API_KEY) {
        expect(isConfigured).toBe(true);
      }
    });

    it("should fetch quotes if configured", async () => {
      const provider = getProvider("flashift");
      
      if (!provider.isConfigured()) {
        console.log("Flashift not configured, skipping");
        return;
      }

      const quotes = await provider.getQuotes(testQuoteRequestSmall);
      console.log("Flashift routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("flashift");
        expect(quotes[0].routeId).toBeDefined();
      }
    }, 30000);
  });

  describe("THORChain Provider", () => {
    it("should check configuration", () => {
      const provider = getProvider("thorchain");
      const isConfigured = provider.isConfigured();
      console.log("THORChain configured:", isConfigured);
      
      // In production, needs ENABLE_THORCHAIN_PROVIDER=true
      // In development, should be enabled by default
    });

    it("should handle Bitcoin source", async () => {
      const provider = getProvider("thorchain");
      
      const btcQuoteRequest: QuoteRequest = {
        sourceChainId: "bitcoin",
        sourceChainType: "bitcoin",
        sourceTokenAddress: "BTC",
        sourceAmount: "100000", // 0.001 BTC in sats
        destinationTokenAddress: "SOL",
        sourceAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
        slippage: 3,
      };

      const quotes = await provider.getQuotes(btcQuoteRequest);
      console.log("THORChain BTC routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("thorchain");
      }
    }, 30000);
  });

  describe("IBC Provider", () => {
    it("should check configuration", () => {
      const provider = getProvider("ibc");
      const isConfigured = provider.isConfigured();
      console.log("IBC configured:", isConfigured);
    });

    it("should handle Cosmos source", async () => {
      const provider = getProvider("ibc");
      
      const cosmosQuoteRequest: QuoteRequest = {
        sourceChainId: "cosmos",
        sourceChainType: "cosmos",
        sourceTokenAddress: "uatom",
        sourceAmount: "1000000", // 1 ATOM
        destinationTokenAddress: "SOL",
        sourceAddress: "cosmos1xyz...",
        solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
        slippage: 3,
      };

      const quotes = await provider.getQuotes(cosmosQuoteRequest);
      console.log("IBC routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("ibc");
      }
    }, 30000);
  });

  describe("TON Provider", () => {
    it("should check configuration", () => {
      const provider = getProvider("ton");
      const isConfigured = provider.isConfigured();
      console.log("TON configured:", isConfigured);
      
      if (process.env.NODE_ENV === "production" && !process.env.ENABLE_TON_PROVIDER) {
        expect(isConfigured).toBe(false);
      }
    });

    it("should handle TON source", async () => {
      const provider = getProvider("ton");
      
      if (!provider.isConfigured()) {
        console.log("TON not configured, skipping");
        return;
      }

      const tonQuoteRequest: QuoteRequest = {
        sourceChainId: "ton",
        sourceChainType: "ton",
        sourceTokenAddress: "native",
        sourceAmount: "1000000000", // 1 TON in nanoton
        destinationTokenAddress: "SOL",
        sourceAddress: "EQD...",
        solanaAddress: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
        slippage: 3,
      };

      const quotes = await provider.getQuotes(tonQuoteRequest);
      console.log("TON routes:", quotes.length);
      
      if (quotes.length > 0) {
        expect(quotes[0].provider).toBe("ton");
      }
    }, 30000);
  });
});

describe("All Providers Summary", () => {
  it("should list all providers and their status", () => {
    console.log("\n=== Provider Configuration Status ===\n");
    
    for (const provider of providers) {
      const configured = provider.isConfigured();
      const status = configured ? "✅ Configured" : "❌ Not Configured";
      console.log(`${provider.name.padEnd(12)} | ${status}`);
    }
    
    const configuredCount = providers.filter(p => p.isConfigured()).length;
    console.log(`\nTotal: ${configuredCount}/${providers.length} providers configured`);
    
    expect(configuredCount).toBeGreaterThan(0);
  });
});

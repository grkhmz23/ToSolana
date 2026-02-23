// TON (The Open Network) bridge provider
// Uses Symbiosis or TON Bridge for TON -> Solana
// Docs: https://docs.ton.org/v3/guidelines/dapps/apis-sdks/api-types

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

// Symbiosis API for cross-chain swaps
const SYMBIOSIS_API = "https://api.symbiosis.finance/crosschain/v1";

// TON HTTP API endpoints
const TON_API_URL = "https://toncenter.com/api/v2";
const TON_API_KEY = process.env.TON_API_KEY || "";

// Chain IDs for Symbiosis
const CHAIN_IDS = {
  ton: 2147483647,    // TON in Symbiosis
  solana: 1399811149, // Solana in Symbiosis
};

// TON Bridge contract
const TON_BRIDGE_ADDRESS = "Ef9NXAIQs12t2qIZ-sRZ26D977H65Ol6DQeXc5_gUNbUCR5z";

interface SymbiosisQuoteResponse {
  tokenAmountOut?: {
    amount: string;
    token: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
  };
  tokenAmountOutMin?: {
    amount: string;
    token: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
  };
  priceImpact?: string;
  executionTime?: number;
  routes?: Array<{
    provider: string;
    path: string[];
  }>;
  fees?: Array<{
    token: string;
    amount: string;
  }>;
  error?: string;
  errorCode?: string;
}

interface SymbiosisSwapResponse {
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  error?: string;
}

interface TonAccountResponse {
  ok: boolean;
  result?: {
    balance: string;
    code: string;
    data: string;
    last_transaction_id: {
      lt: string;
      hash: string;
    };
  };
}

export class TonProvider implements BridgeProvider {
  name = "ton" as const;

  isConfigured(): boolean {
    // Symbiosis doesn't require API key for basic functionality
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    // Validate TON chain
    const chainIdStr = String(intent.sourceChainId);
    if (chainIdStr !== "ton" && intent.sourceChainType !== "ton") {
      return [];
    }

    const routes: NormalizedRoute[] = [];

    // Try Symbiosis for TON -> SOL swaps
    try {
      const symbiosisRoute = await this.getSymbiosisQuote(intent);
      if (symbiosisRoute) {
        routes.push(symbiosisRoute);
      }
    } catch (error) {
      console.error("Symbiosis quote error:", error);
    }

    // Fallback estimated route
    if (routes.length === 0) {
      routes.push(this.getEstimatedRoute(intent));
    }

    return routes;
  }

  private async getSymbiosisQuote(intent: QuoteRequest): Promise<NormalizedRoute | null> {
    // Convert amount to nanotons
    const amountNano = BigInt(intent.sourceAmount);
    
    const body = {
      chainIdFrom: CHAIN_IDS.ton,
      chainIdTo: CHAIN_IDS.solana,
      tokenFrom: "native", // TON native
      tokenTo: intent.destinationTokenAddress === "SOL" ? "native" : intent.destinationTokenAddress,
      amountFrom: amountNano.toString(),
      recipient: intent.solanaAddress,
      slippage: intent.slippage / 100,
      // Optional: referrer for fees
      referrer: "tosolana",
    };

    const res = await fetchWithTimeout(`${SYMBIOSIS_API}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`Symbiosis API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as SymbiosisQuoteResponse;

    if (data.error || !data.tokenAmountOut) {
      console.error("Symbiosis quote error:", data.error);
      return null;
    }

    const fees = (data.fees || []).map((f) => ({
      token: f.token,
      amount: f.amount,
    }));

    return {
      provider: "ton",
      routeId: `ton-sym-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      steps: [
        {
          chainType: "ton",
          chainId: "ton",
          description: "Send TON to Symbiosis cross-chain router",
        },
        {
          chainType: "solana",
          description: `Receive ${data.tokenAmountOut.token.symbol} on Solana`,
        },
      ],
      estimatedOutput: {
        token: data.tokenAmountOut.token.symbol,
        amount: data.tokenAmountOutMin?.amount || data.tokenAmountOut.amount,
      },
      fees,
      etaSeconds: data.executionTime || 300,
      warnings: data.priceImpact ? [`Price impact: ${data.priceImpact}%`] : undefined,
    };
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    if (stepIndex !== 0) {
      throw new Error("TON bridge route only has one executable step");
    }

    // Get swap transaction from Symbiosis
    const amountNano = BigInt(intent.sourceAmount);

    const body = {
      chainIdFrom: CHAIN_IDS.ton,
      chainIdTo: CHAIN_IDS.solana,
      tokenFrom: "native",
      tokenTo: intent.destinationTokenAddress === "SOL" ? "native" : intent.destinationTokenAddress,
      amountFrom: amountNano.toString(),
      recipient: intent.solanaAddress,
      slippage: intent.slippage / 100,
      referrer: "tosolana",
    };

    const res = await fetchWithTimeout(`${SYMBIOSIS_API}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Symbiosis swap error: ${res.status}`);
    }

    const data = (await res.json()) as SymbiosisSwapResponse;

    if (data.error) {
      throw new Error(`Symbiosis error: ${data.error}`);
    }

    if (!data.transaction) {
      // Fallback to manual TON transfer if Symbiosis doesn't return a transaction
      return {
        kind: "ton",
        to: TON_BRIDGE_ADDRESS,
        amount: amountNano.toString(),
        payload: this.buildBridgePayload(intent),
        stateInit: undefined,
      };
    }

    // Return Symbiosis transaction
    return {
      kind: "ton",
      to: data.transaction.to,
      amount: data.transaction.value,
      payload: data.transaction.data,
    };
  }

  // Build bridge payload for TON transaction
  private buildBridgePayload(intent: QuoteRequest): string {
    // TON uses BoC (Bag of Cells) format
    // This creates a simple text payload for the bridge
    const bridgeData = {
      type: "bridge_to_solana",
      destination: intent.solanaAddress,
      token: intent.destinationTokenAddress,
      amount: intent.sourceAmount,
      timestamp: Date.now(),
    };

    // Convert to base64 (simplified - real implementation would use proper BoC serialization)
    return Buffer.from(JSON.stringify(bridgeData)).toString("base64");
  }

  // Fallback estimated route
  private getEstimatedRoute(intent: QuoteRequest): NormalizedRoute {
    const amountNano = BigInt(intent.sourceAmount);
    const estimatedFee = (amountNano * BigInt(1)) / BigInt(100); // 1% estimated
    const estimatedOutput = amountNano - estimatedFee;

    return {
      provider: "ton",
      routeId: `ton-est-${Date.now()}`,
      steps: [
        {
          chainType: "ton",
          chainId: "ton",
          description: "TON cross-chain transfer to Solana",
        },
        {
          chainType: "solana",
          description: "Receive tokens on Solana",
        },
      ],
      estimatedOutput: {
        token: intent.destinationTokenAddress === "SOL" ? "SOL" : "wTON",
        amount: estimatedOutput.toString(),
      },
      fees: [{ token: "TON", amount: estimatedFee.toString() }],
      etaSeconds: 600,
      warnings: [
        "Estimated route - actual rates may vary",
        "TON -> Solana transfers may take 5-15 minutes",
        "Verify destination address before sending",
      ],
    };
  }

  // Helper to get TON account info
  async getTonAccountInfo(address: string): Promise<TonAccountResponse | null> {
    try {
      const res = await fetchWithTimeout(
        `${TON_API_URL}/getAddressInformation?address=${encodeURIComponent(address)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(TON_API_KEY && { "X-API-Key": TON_API_KEY }),
          },
        }
      );

      if (!res.ok) return null;

      return (await res.json()) as TonAccountResponse;
    } catch {
      return null;
    }
  }

  // Validate TON address format
  static isValidAddress(address: string): boolean {
    // TON addresses start with EQ, UQ, or are in raw format
    const validPrefixes = ["EQ", "UQ", "0:"];
    return validPrefixes.some((prefix) => address.startsWith(prefix)) ||
           /^[0-9a-fA-F]{64}$/.test(address);
  }
}

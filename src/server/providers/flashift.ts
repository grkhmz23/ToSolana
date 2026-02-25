// Flashift provider for cross-chain swaps
// Docs: https://docs.flashift.app/
// Contact: affiliate@flashift.app for API key

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const FLASHIFT_API_URL = "https://interface.flashift.app/api/dev/v1";

interface FlashiftCurrency {
  code: string;
  name: string;
  network: string;
  address?: string;
  decimals: number;
}

interface FlashiftQuoteResponse {
  id?: string;
  from?: FlashiftCurrency;
  to?: FlashiftCurrency;
  amount?: string;
  amountTo?: string;
  rate?: string;
  fee?: string;
  min?: string;
  max?: string;
  error?: string;
}

interface FlashiftTxResponse {
  id?: string;
  payinAddress?: string;
  payoutAddress?: string;
  payinExtraId?: string;
  refundAddress?: string;
  status?: string;
  error?: string;
}

// Network mapping - Flashift network codes
const FLASHIFT_NETWORKS: Record<string | number, string> = {
  1: "ETH",
  137: "POLYGON",
  42161: "ARBITRUM",
  10: "OPTIMISM",
  56: "BSC",
  8453: "BASE",
  43114: "AVAXC",
  "solana": "SOL",
};

export class FlashiftProvider implements BridgeProvider {
  name = "flashift" as const;

  isConfigured(): boolean {
    // Flashift requires an API key (Bearer token)
    return !!process.env.FLASHIFT_API_KEY;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const apiKey = process.env.FLASHIFT_API_KEY;
    if (!apiKey) return [];

    const sourceChainId = typeof intent.sourceChainId === "string" 
      ? intent.sourceChainId 
      : String(intent.sourceChainId);
    
    const srcNetwork = FLASHIFT_NETWORKS[sourceChainId];
    if (!srcNetwork || srcNetwork === "SOL") {
      return []; // Not an EVM source
    }

    const dstNetwork = "SOL";

    try {
      // Get available currencies to find matching codes
      const currenciesRes = await fetchWithTimeout(`${FLASHIFT_API_URL}/currencies`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!currenciesRes.ok) {
        console.error("Flashift currencies error:", await currenciesRes.text());
        return [];
      }

      const currencies = (await currenciesRes.json()) as FlashiftCurrency[];
      
      // Find matching currency codes
      const srcCurrency = currencies.find(
        (c) => c.network === srcNetwork && 
        (c.address?.toLowerCase() === intent.sourceTokenAddress.toLowerCase() || 
         (intent.sourceTokenAddress === "0x0000000000000000000000000000000000000000" && !c.address))
      );

      const dstCurrency = currencies.find(
        (c) => c.network === dstNetwork &&
        (intent.destinationTokenAddress === "SOL" || 
         c.address === intent.destinationTokenAddress)
      );

      if (!srcCurrency || !dstCurrency) {
        return [];
      }

      // Get quote
      const params = new URLSearchParams({
        from: srcCurrency.code,
        to: dstCurrency.code,
        amount: intent.sourceAmount,
      });

      const res = await fetchWithTimeout(`${FLASHIFT_API_URL}/exchange?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        console.error("Flashift quote error:", await res.text());
        return [];
      }

      const data = (await res.json()) as FlashiftQuoteResponse;

      if (data.error || !data.amountTo) {
        return [];
      }

      return [{
        provider: "flashift",
        routeId: `flashift-${data.id || Date.now()}`,
        steps: [
          {
            chainType: "evm",
            chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
            description: `Send ${srcCurrency.name} via Flashift`,
          },
          {
            chainType: "solana",
            description: `Receive ${dstCurrency.name} on Solana`,
          },
        ],
        estimatedOutput: {
          token: dstCurrency.code || "SOL",
          amount: data.amountTo,
        },
        fees: data.fee ? [{ token: srcCurrency.code, amount: data.fee }] : [],
        etaSeconds: 600, // Flashift typically takes 5-15 minutes
        warnings: [
          "Exchange via Flashift",
          `Rate: ${data.rate || "variable"}`,
          data.min ? `Min: ${data.min}` : "",
          data.max ? `Max: ${data.max}` : "",
        ].filter(Boolean),
      }];
    } catch (error) {
      console.error("Flashift quote error:", error);
      return [];
    }
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    const apiKey = process.env.FLASHIFT_API_KEY;
    if (!apiKey) {
      throw new Error("Flashift API key not configured");
    }

    // Extract exchange ID
    const exchangeId = routeId.replace("flashift-", "");

    const body = {
      id: exchangeId,
      address: intent.solanaAddress,
      refundAddress: intent.sourceAddress,
    };

    const res = await fetchWithTimeout(`${FLASHIFT_API_URL}/exchange/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Flashift transaction creation failed: ${error}`);
    }

    const data = (await res.json()) as FlashiftTxResponse;

    if (data.error || !data.payinAddress) {
      throw new Error(`Flashift error: ${data.error || "No payment address"}`);
    }

    // Flashift uses deposit-based swaps, not contract calls
    // Return a special transaction type
    return {
      kind: "evm",
      chainId: typeof intent.sourceChainId === "string" ? parseInt(intent.sourceChainId, 10) : intent.sourceChainId,
      to: data.payinAddress,
      data: "0x", // Simple transfer
      value: intent.sourceAmount,
    } as TxRequest;
  }
}

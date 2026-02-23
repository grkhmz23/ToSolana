// IBC (Inter-Blockchain Communication) provider for Cosmos chains
// Uses Wormhole Connect for Cosmos -> Solana bridging
// Docs: https://wormhole.com/docs

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

// Wormhole Connect API endpoints
const WORMHOLE_API_URL = "https://api.wormholeconnect.net";
const WORMHOLE_SCAN_API = "https://api.wormholescan.io";

// Wormhole chain IDs
const CHAIN_IDS: Record<string, number> = {
  cosmos: 4000,   // Wormchain (Cosmos hub in Wormhole)
  osmosis: 4001,  // Osmosis
  injective: 4002, // Injective
  evmos: 4003,    // Evmos
  solana: 1,      // Solana
};

// Native token denoms for Cosmos chains
const NATIVE_DENOMS: Record<string, string> = {
  cosmos: "uatom",
  osmosis: "uosmo",
  injective: "inj",
  evmos: "aevmos",
  juno: "ujuno",
  stargaze: "ustars",
};

// IBC channel mappings for Wormhole Gateway
const WORMHOLE_CHANNELS: Record<string, string> = {
  cosmos: "channel-261",
  osmosis: "channel-2186",
  injective: "channel-102",
  evmos: "channel-94",
  juno: "channel-210",
  stargaze: "channel-162",
};

interface WormholeQuoteResponse {
  route?: {
    sourceToken: {
      symbol: string;
      decimals: number;
      address: string;
    };
    destinationToken: {
      symbol: string;
      decimals: number;
      address: string;
    };
    sourceChain: number;
    destinationChain: number;
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    eta: number;
    fee: string;
    priceImpact: string;
  };
  error?: string;
}

interface WormholeTxResponse {
  transaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  error?: string;
}

// Token addresses on Wormhole
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  cosmos: {
    uatom: "uatom",
    native: "uatom",
  },
  osmosis: {
    uosmo: "uosmo",
    native: "uosmo",
  },
  injective: {
    inj: "inj",
    native: "inj",
  },
};

export class IbcProvider implements BridgeProvider {
  name = "ibc" as const;

  isConfigured(): boolean {
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    // Validate Cosmos chain
    const chainIdStr = String(intent.sourceChainId);
    if (!this.isSupportedCosmosChain(chainIdStr)) {
      return [];
    }

    const wormholeChainId = CHAIN_IDS[chainIdStr];
    if (!wormholeChainId) {
      return [];
    }

    const amount = intent.sourceAmount;
    const denom = NATIVE_DENOMS[chainIdStr] || "native";

    try {
      // Try Wormhole Connect API first
      const quote = await this.getWormholeQuote(
        wormholeChainId,
        CHAIN_IDS.solana,
        amount,
        intent.destinationTokenAddress,
        intent.solanaAddress
      );

      if (quote) {
        return [this.normalizeWormholeRoute(quote, chainIdStr, intent)];
      }
    } catch (error) {
      console.error("Wormhole quote error:", error);
    }

    // Fallback to manual IBC route estimation
    return this.getEstimatedRoute(intent, chainIdStr, denom);
  }

  private async getWormholeQuote(
    sourceChain: number,
    destChain: number,
    amount: string,
    destToken: string,
    recipient: string
  ): Promise<WormholeQuoteResponse["route"] | null> {
    // Wormhole Connect API for cross-chain quotes
    // Note: This is a simplified implementation
    // Real implementation would use the Wormhole Connect SDK or REST API

    const body = {
      sourceChain,
      targetChain: destChain,
      sourceToken: "native", // For now, only support native tokens
      targetToken: destToken === "SOL" ? "native" : destToken,
      amount,
      recipient,
      slippage: 0.5, // 0.5% default slippage
    };

    try {
      const res = await fetchWithTimeout(`${WORMHOLE_API_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as WormholeQuoteResponse;
      return data.route || null;
    } catch {
      return null;
    }
  }

  private normalizeWormholeRoute(
    route: WormholeQuoteResponse["route"],
    chainIdStr: string,
    intent: QuoteRequest
  ): NormalizedRoute {
    if (!route) throw new Error("Invalid route data");

    return {
      provider: "ibc",
      routeId: `ibc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      steps: [
        {
          chainType: "cosmos",
          chainId: chainIdStr,
          description: `IBC transfer from ${this.getChainName(chainIdStr)} to Wormhole Gateway`,
        },
        {
          chainType: "solana",
          description: `Receive ${route.destinationToken.symbol} on Solana via Wormhole`,
        },
      ],
      estimatedOutput: {
        token: route.destinationToken.symbol,
        amount: route.minAmountOut || route.amountOut,
      },
      fees: [
        { token: route.sourceToken.symbol, amount: route.fee },
      ],
      etaSeconds: route.eta || 600,
      warnings: [
        "Cosmos -> Solana via Wormhole Gateway",
        `Price impact: ${route.priceImpact}%`,
        "Transfers may take 5-10 minutes",
      ],
    };
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    if (stepIndex !== 0) {
      throw new Error("IBC route only has one executable step");
    }

    const chainIdStr = String(intent.sourceChainId);
    const denom = NATIVE_DENOMS[chainIdStr];
    const channel = WORMHOLE_CHANNELS[chainIdStr];

    if (!denom || !channel) {
      throw new Error(`Unsupported Cosmos chain: ${chainIdStr}`);
    }

    // Build IBC transfer message for Keplr
    const ibcTransferMsg = {
      typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
      value: {
        sourcePort: "transfer",
        sourceChannel: channel,
        token: {
          denom,
          amount: intent.sourceAmount,
        },
        sender: intent.sourceAddress,
        receiver: intent.solanaAddress,
        timeoutHeight: {
          revisionNumber: "0",
          revisionHeight: "0",
        },
        timeoutTimestamp: String((Date.now() + 600000) * 1_000_000), // 10 min timeout
        memo: JSON.stringify({
          wormhole: {
            recipient: intent.solanaAddress,
            chain: 1, // Solana chain ID in Wormhole
            fee: "0", // Fee for the wormhole relayer
          },
        }),
      },
    };

    // Also include a fee grant message if needed
    const fee = {
      amount: [{ denom, amount: "5000" }],
      gas: "200000",
    };

    return {
      kind: "cosmos",
      chainId: this.getCosmosChainId(chainIdStr),
      messages: [ibcTransferMsg],
      fee,
      memo: "Transfer to Solana via Wormhole Gateway",
    };
  }

  // Helper methods
  private isSupportedCosmosChain(chainId: string): boolean {
    return chainId in CHAIN_IDS && chainId !== "solana";
  }

  private getChainName(chainId: string): string {
    const names: Record<string, string> = {
      cosmos: "Cosmos Hub",
      osmosis: "Osmosis",
      injective: "Injective",
      evmos: "Evmos",
      juno: "Juno",
      stargaze: "Stargaze",
    };
    return names[chainId] || chainId;
  }

  private getCosmosChainId(chainId: string): string {
    const ids: Record<string, string> = {
      cosmos: "cosmoshub-4",
      osmosis: "osmosis-1",
      injective: "injective-1",
      evmos: "evmos_9001-2",
      juno: "juno-1",
      stargaze: "stargaze-1",
    };
    return ids[chainId] || chainId;
  }

  // Fallback estimated route when API is unavailable
  private getEstimatedRoute(
    intent: QuoteRequest,
    chainId: string,
    denom: string
  ): NormalizedRoute[] {
    // Estimate output with 2% slippage/fees assumption
    const inputAmount = BigInt(intent.sourceAmount);
    const estimatedOutput = (inputAmount * BigInt(98)) / BigInt(100);

    return [
      {
        provider: "ibc",
        routeId: `ibc-est-${Date.now()}`,
        steps: [
          {
            chainType: "cosmos",
            chainId,
            description: `IBC transfer from ${this.getChainName(chainId)} to Wormhole`,
          },
          {
            chainType: "solana",
            description: "Receive tokens on Solana via Wormhole",
          },
        ],
        estimatedOutput: {
          token: intent.destinationTokenAddress === "SOL" ? "SOL" : "TOKEN",
          amount: estimatedOutput.toString(),
        },
        fees: [{ token: denom, amount: "5000" }],
        etaSeconds: 600,
        warnings: [
          "Estimated route - actual rates may vary",
          "Cosmos -> Solana transfers use Wormhole gateway",
          "Transfers may take 5-10 minutes",
        ],
      },
    ];
  }

  // Check if a transaction has completed via Wormhole
  async checkTransactionStatus(
    emitterChain: number,
    emitterAddress: string,
    sequence: string
  ): Promise<{
    status: "pending" | "completed" | "failed";
    txHash?: string;
  }> {
    try {
      const res = await fetchWithTimeout(
        `${WORMHOLE_SCAN_API}/api/v1/transactions/${emitterChain}/${emitterAddress}/${sequence}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
      }
      );

      if (!res.ok) return { status: "pending" };

      const data = await res.json();

      if (data.targetTxHash) {
        return { status: "completed", txHash: data.targetTxHash };
      }

      return { status: "pending" };
    } catch {
      return { status: "pending" };
    }
  }
}

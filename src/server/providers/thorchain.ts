// THORChain provider for Bitcoin bridging to Solana
// Uses real THORChain API for BTC -> SOL swaps
// Docs: https://dev.thorchain.org/swap-guide/quickstart-guide.html

import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const THORCHAIN_API_URL = "https://thornode.ninerealms.com/thorchain";
const THORCHAIN_QUOTE_ENDPOINT = `${THORCHAIN_API_URL}/quote/swap`;

// Asset identifiers for THORChain
const BTC_ASSET = "BTC.BTC";
const ETH_ASSET = "ETH.ETH";
// Solana is not directly supported by THORChain, so we route through ETH or use Maya Protocol
// For now, we'll use ETH as an intermediate and suggest the user bridges ETH->SOL via Wormhole
// OR use Maya Protocol which supports SOL
const MAYA_PROTOCOL_API = "https://mayanode.mayaprotocol.com/mayachain/quote/swap";
const SOL_ASSET_MAYA = "SOL.SOL";

interface ThorchainQuoteResponse {
  inbound_address: string;
  inbound_confirmation_blocks: number;
  inbound_confirmation_seconds: number;
  outbound_delay_blocks: number;
  outbound_delay_seconds: number;
  fees: {
    asset: string;
    affiliate: string;
    outbound: string;
    liquidity: string;
    total: string;
    slippage_bps: number;
    total_bps: number;
  };
  slippage_bps: number;
  streaming_slippage_bps?: number;
  expiry: number;
  warning?: string;
  notes?: string;
  dust_threshold: string;
  recommended_min_amount_in: string;
  recommended_gas_rate: string;
  gas_rate_units: string;
  memo: string;
  expected_amount_out: string;
  expected_amount_out_streaming?: string;
  max_streaming_quantity?: number;
  streaming_swap_blocks?: number;
  streaming_swap_seconds?: number;
  total_swap_seconds: number;
}

interface MayachainQuoteResponse {
  inbound_address: string;
  inbound_confirmation_blocks: number;
  inbound_confirmation_seconds: number;
  outbound_delay_blocks: number;
  outbound_delay_seconds: number;
  fees: {
    asset: string;
    affiliate: string;
    outbound: string;
    liquidity: string;
    total: string;
    slippage_bps: number;
    total_bps: number;
  };
  expiry: number;
  warning?: string;
  dust_threshold: string;
  recommended_min_amount_in: string;
  memo: string;
  expected_amount_out: string;
}

interface ThorchainPoolsResponse {
  pools: Array<{
    asset: string;
    status: string;
    balance_asset: string;
    balance_rune: string;
  }>;
}

export class ThorchainProvider implements BridgeProvider {
  name = "thorchain" as const;

  isConfigured(): boolean {
    // THORChain/Maya provider is disabled in production until full
    // server-side finality verification is implemented.
    // Set ENABLE_THORCHAIN_PROVIDER=true to enable.
    if (process.env.NODE_ENV === "production") {
      return process.env.ENABLE_THORCHAIN_PROVIDER === "true";
    }
    return true;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    // THORChain provider is only for Bitcoin-source flows in this app.
    // If chain type is provided, trust it. Otherwise accept only explicit "bitcoin" sourceChainId.
    const isBitcoinSource =
      intent.sourceChainType === "bitcoin" ||
      (intent.sourceChainType === undefined && intent.sourceChainId === "bitcoin");
    if (!isBitcoinSource) {
      return [];
    }

    // THORChain uses 1e8 precision for all amounts
    const amountSats = parseInt(intent.sourceAmount, 10);
    if (isNaN(amountSats) || amountSats <= 0) {
      return [];
    }

    const amount1e8 = amountSats; // Already in satoshis

    // Try Maya Protocol first for direct BTC -> SOL
    try {
      const mayaRoute = await this.getMayaQuote(intent, amount1e8);
      if (mayaRoute) return [mayaRoute];
    } catch {
      console.log("Maya Protocol not available for BTC -> SOL quote");
    }

    // THORChain BTC->ETH fallback is intentionally disabled here:
    // this Solana-only flow does not collect an ETH destination address, so the
    // THORChain fallback route cannot be quoted safely/executably.

    return [];
  }

  private async getMayaQuote(
    intent: QuoteRequest,
    amount1e8: number
  ): Promise<NormalizedRoute | null> {
    // Maya Protocol supports direct SOL swaps
    const params = new URLSearchParams({
      from_asset: BTC_ASSET,
      to_asset: SOL_ASSET_MAYA,
      amount: amount1e8.toString(),
      destination: intent.solanaAddress,
      affiliate: "ts", // ToSolana affiliate
      affiliate_bps: "10", // 0.1% affiliate fee
    });

    const res = await fetchWithTimeout(`${MAYA_PROTOCOL_API}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 503) {
        throw new Error("Maya Protocol rate limit exceeded. Please try again in a few seconds.");
      }
      return null;
    }

    const data = (await res.json()) as MayachainQuoteResponse;

    // Check if quote expired
    if (Date.now() / 1000 > data.expiry) {
      throw new Error("Quote expired. Please request a new quote.");
    }

    const outputAmount = data.expected_amount_out;
    const etaSeconds = data.inbound_confirmation_seconds + data.outbound_delay_seconds;

    return {
      provider: "thorchain",
      routeId: `maya-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      steps: [
        {
          chainType: "bitcoin",
          chainId: "bitcoin",
          description: `Send BTC to Maya vault for SOL swap`,
        },
        {
          chainType: "solana",
          description: `Receive SOL on Solana`,
        },
      ],
      estimatedOutput: {
        token: "SOL",
        amount: outputAmount,
      },
      fees: [
        { token: "BTC", amount: data.fees.liquidity },
        { token: "SOL", amount: data.fees.outbound },
      ],
      etaSeconds,
      warnings: [
        "Maya Protocol: BTC -> SOL direct swap",
        `Min amount: ${data.recommended_min_amount_in} sats`,
        `Dust threshold: ${data.dust_threshold} sats`,
        "Do not send from an exchange",
      ],
      // Store the quote data for later use
      usdValues: {
        input: undefined,
        output: undefined,
        fees: undefined,
      },
    };
  }

  private async getThorchainQuote(
    intent: QuoteRequest,
    amount1e8: number
  ): Promise<NormalizedRoute | null> {
    // THORChain routes BTC -> ETH (intermediate), then user bridges ETH->SOL
    const params = new URLSearchParams({
      from_asset: BTC_ASSET,
      to_asset: ETH_ASSET,
      amount: amount1e8.toString(),
      destination: intent.solanaAddress, // THORChain will send ETH here
      streaming_interval: "1",
      streaming_quantity: "0", // Let THORChain optimize
      affiliate: "ts",
      affiliate_bps: "10",
    });

    const res = await fetchWithTimeout(`${THORCHAIN_QUOTE_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 503) {
        throw new Error("THORChain rate limit exceeded. Please try again in a few seconds.");
      }
      const errorText = await res.text();
      throw new Error(`THORChain API error: ${res.status} - ${errorText}`);
    }

    const data = (await res.json()) as ThorchainQuoteResponse;

    // Check if quote expired
    if (Date.now() / 1000 > data.expiry) {
      throw new Error("Quote expired. Please request a new quote.");
    }

    const outputAmount = data.expected_amount_out_streaming ?? data.expected_amount_out;
    const etaSeconds = data.total_swap_seconds;

    return {
      provider: "thorchain",
      routeId: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      steps: [
        {
          chainType: "bitcoin",
          chainId: "bitcoin",
          description: `Send BTC to THORChain vault`,
        },
        {
          chainType: "evm",
          chainId: 1, // Ethereum
          description: `Receive ETH on Ethereum (bridge to Solana separately)`,
        },
      ],
      estimatedOutput: {
        token: "ETH",
        amount: outputAmount,
      },
      fees: [
        { token: "BTC", amount: data.fees.liquidity },
        { token: "ETH", amount: data.fees.outbound },
      ],
      etaSeconds,
      warnings: [
        "THORChain routes BTC -> ETH (intermediate)",
        "You'll need to bridge ETH -> SOL separately via Wormhole",
        `Min amount: ${data.recommended_min_amount_in} sats`,
        `Dust threshold: ${data.dust_threshold} sats`,
        "Do not send from an exchange",
        `Streaming swap: ${data.streaming_swap_seconds}s`,
      ],
    };
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest
  ): Promise<TxRequest> {
    if (stepIndex !== 0) {
      throw new Error("THORChain route only has one executable step");
    }

    // Re-fetch the quote to get fresh inbound address
    const amountSats = parseInt(intent.sourceAmount, 10);
    if (isNaN(amountSats) || amountSats <= 0) {
      throw new Error("Invalid amount");
    }

    // Try Maya first
    try {
      const params = new URLSearchParams({
        from_asset: BTC_ASSET,
        to_asset: SOL_ASSET_MAYA,
        amount: amountSats.toString(),
        destination: intent.solanaAddress,
        affiliate: "ts",
        affiliate_bps: "10",
      });

      const res = await fetchWithTimeout(`${MAYA_PROTOCOL_API}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        const data = (await res.json()) as MayachainQuoteResponse;

        if (Date.now() / 1000 > data.expiry) {
          throw new Error("Quote expired. Please request a new quote.");
        }

        return {
          kind: "bitcoin",
          psbtBase64: "", // Will be constructed by the wallet
          inputsToSign: [{ index: 0, address: intent.sourceAddress }],
          toAddress: data.inbound_address,
          amount: amountSats.toString(),
          memo: data.memo,
          expiry: data.expiry,
          warnings: [data.warning || ""],
        } as unknown as TxRequest;
      }
    } catch {
      // Fall through to THORChain
    }

    // THORChain fallback
    const params = new URLSearchParams({
      from_asset: BTC_ASSET,
      to_asset: ETH_ASSET,
      amount: amountSats.toString(),
      destination: intent.solanaAddress,
      streaming_interval: "1",
      streaming_quantity: "0",
      affiliate: "ts",
      affiliate_bps: "10",
    });

    const res = await fetchWithTimeout(`${THORCHAIN_QUOTE_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`THORChain quote failed: ${res.status}`);
    }

    const data = (await res.json()) as ThorchainQuoteResponse;

    if (Date.now() / 1000 > data.expiry) {
      throw new Error("Quote expired. Please request a new quote.");
    }

    return {
      kind: "bitcoin",
      psbtBase64: "",
      inputsToSign: [{ index: 0, address: intent.sourceAddress }],
      toAddress: data.inbound_address,
      amount: amountSats.toString(),
      memo: data.memo,
      expiry: data.expiry,
      warnings: [data.warning || "", data.notes || ""],
      recommendedGasRate: data.recommended_gas_rate,
      gasRateUnits: data.gas_rate_units,
    } as unknown as TxRequest;
  }

  // Helper to check if a pool exists for an asset
  async checkPoolExists(asset: string): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${THORCHAIN_API_URL}/pools`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) return false;

      const data = (await res.json()) as ThorchainPoolsResponse;
      return data.pools.some(
        (p) => p.asset === asset && p.status === "Available"
      );
    } catch {
      return false;
    }
  }
}

import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const LIFI_BASE_URL = "https://li.quest/v1";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const apiKey = process.env.LIFI_API_KEY;
  if (apiKey) {
    headers["x-lifi-api-key"] = apiKey;
  }
  return headers;
}

function getIntegrator(): string {
  return process.env.LIFI_INTEGRATOR || "tosolana-dev";
}

// LI.FI uses chain IDs. Solana chainId in LI.FI is 1151111081099710
const LIFI_SOLANA_CHAIN_ID = 1151111081099710;

// Map "SOL" native to LI.FI's native token address representation
const NATIVE_SOL_ADDRESS = "11111111111111111111111111111111";

interface LiFiQuoteResponse {
  routes?: LiFiRoute[];
  message?: string;
}

interface LiFiRoute {
  id: string;
  steps: LiFiStep[];
  toAmountMin: string;
  toAmount: string;
  toToken: { symbol: string; address: string; decimals: number };
  gasCostUSD?: string;
  tags?: string[];
}

interface LiFiStep {
  id: string;
  type: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { symbol: string };
    toToken: { symbol: string };
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    gasCosts?: { amount: string; token: { symbol: string } }[];
    feeCosts?: { amount: string; token: { symbol: string } }[];
    executionDuration?: number;
  };
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
  };
}

interface LiFiStepResponse {
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    chainId?: number;
    // Solana fields
    data_solana?: string;
  };
  action?: {
    fromChainId: number;
    toChainId: number;
  };
}

export class LiFiProvider implements BridgeProvider {
  name = "lifi" as const;

  isConfigured(): boolean {
    return !!(process.env.LIFI_API_KEY || process.env.LIFI_INTEGRATOR);
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const res = await fetch(`${LIFI_BASE_URL}/advanced/routes`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        fromChainId: intent.sourceChainId,
        toChainId: LIFI_SOLANA_CHAIN_ID,
        fromTokenAddress: intent.sourceTokenAddress,
        toTokenAddress: intent.destinationTokenAddress === "SOL"
          ? NATIVE_SOL_ADDRESS
          : intent.destinationTokenAddress,
        fromAmount: intent.sourceAmount,
        fromAddress: intent.sourceAddress,
        toAddress: intent.solanaAddress,
        options: {
          integrator: getIntegrator(),
          order: "RECOMMENDED",
          slippage: 0.03,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LI.FI API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as LiFiQuoteResponse;
    if (!data.routes || data.routes.length === 0) {
      return [];
    }

    return data.routes.slice(0, 5).map((route): NormalizedRoute => {
      const fees = route.steps.flatMap((step) => [
        ...(step.estimate.gasCosts ?? []).map((g) => ({
          token: g.token.symbol,
          amount: g.amount,
        })),
        ...(step.estimate.feeCosts ?? []).map((f) => ({
          token: f.token.symbol,
          amount: f.amount,
        })),
      ]);

      const etaSeconds = route.steps.reduce(
        (sum, s) => sum + (s.estimate.executionDuration ?? 0),
        0,
      );

      return {
        provider: "lifi",
        routeId: route.id,
        steps: route.steps.map((step) => ({
          chainType: isEvmChain(step.action.fromChainId) ? "evm" : "solana",
          chainId: step.action.fromChainId,
          description: `${step.type}: ${step.action.fromToken.symbol} → ${step.action.toToken.symbol}`,
        })),
        estimatedOutput: {
          token: route.toToken.symbol,
          amount: route.toAmountMin,
        },
        fees,
        etaSeconds: etaSeconds > 0 ? etaSeconds : undefined,
        warnings: route.tags?.includes("REFUEL") ? ["Includes gas refuel step"] : undefined,
      };
    });
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest,
  ): Promise<TxRequest> {
    // LI.FI requires re-fetching the route and getting the step transaction
    const res = await fetch(`${LIFI_BASE_URL}/advanced/routes`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        fromChainId: intent.sourceChainId,
        toChainId: LIFI_SOLANA_CHAIN_ID,
        fromTokenAddress: intent.sourceTokenAddress,
        toTokenAddress: intent.destinationTokenAddress === "SOL"
          ? NATIVE_SOL_ADDRESS
          : intent.destinationTokenAddress,
        fromAmount: intent.sourceAmount,
        fromAddress: intent.sourceAddress,
        toAddress: intent.solanaAddress,
        options: {
          integrator: getIntegrator(),
          order: "RECOMMENDED",
          slippage: 0.03,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`LI.FI routes error: ${res.status}`);
    }

    const data = (await res.json()) as LiFiQuoteResponse;
    const route = data.routes?.find((r) => r.id === routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found in LI.FI response`);
    }

    const step = route.steps[stepIndex];
    if (!step) {
      throw new Error(`Step ${stepIndex} not found in route`);
    }

    // Get step transaction
    const stepRes = await fetch(`${LIFI_BASE_URL}/advanced/stepTransaction`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        ...step,
        fromAddress: intent.sourceAddress,
        toAddress: intent.solanaAddress,
      }),
    });

    if (!stepRes.ok) {
      throw new Error(`LI.FI step tx error: ${stepRes.status}`);
    }

    const stepData = (await stepRes.json()) as LiFiStepResponse;

    if (!stepData.transactionRequest) {
      throw new Error("No transaction request in LI.FI step response");
    }

    const fromChainId = step.action.fromChainId;

    if (isEvmChain(fromChainId)) {
      return {
        kind: "evm",
        chainId: stepData.transactionRequest.chainId ?? fromChainId,
        to: stepData.transactionRequest.to ?? "",
        data: stepData.transactionRequest.data,
        value: stepData.transactionRequest.value,
      };
    }

    // Solana transaction
    const solanaData =
      stepData.transactionRequest.data_solana ?? stepData.transactionRequest.data;
    if (!solanaData) {
      throw new Error("No Solana transaction data in LI.FI response");
    }

    return {
      kind: "solana",
      rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      serializedTxBase64: solanaData,
    };
  }
}

function isEvmChain(chainId: number): boolean {
  // Solana in LI.FI has a very large chain ID
  return chainId < 1000000000;
}

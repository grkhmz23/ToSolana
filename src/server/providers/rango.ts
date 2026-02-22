import { fetchWithTimeout } from "@/lib/fetch-utils";
import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

const RANGO_BASE_URL = "https://api.rango.exchange";

function getApiKey(): string {
  return process.env.RANGO_API_KEY ?? "";
}

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "API-KEY": getApiKey(),
  };
}

// Rango blockchain names
function evmChainToRango(chainId: number): string {
  const map: Record<number, string> = {
    1: "ETH",
    10: "OPTIMISM",
    56: "BSC",
    137: "POLYGON",
    42161: "ARBITRUM",
    8453: "BASE",
    43114: "AVAX_CCHAIN",
  };
  return map[chainId] ?? `EVM_${chainId}`;
}

interface RangoQuoteResponse {
  results?: RangoRoute[];
  result?: RangoRoute;
  error?: string;
  errorCode?: string;
}

interface RangoRoute {
  requestId: string;
  resultType: string;
  outputAmount: string;
  outputAmountMin: string;
  route: RangoRouteStep[] | null;
  fee: RangoFee[];
  estimatedTimeInSeconds?: number;
  tags?: string[];
}

interface RangoRouteStep {
  from: { blockchain: string; symbol: string; address: string | null };
  to: { blockchain: string; symbol: string; address: string | null };
  swapperType: string;
  swapperId: string;
  expectedOutput: string;
  estimatedTimeInSeconds?: number;
}

interface RangoFee {
  name: string;
  token: { symbol: string };
  amount: string;
  expenseType: string;
}

interface RangoSwapResponse {
  resultType: string;
  tx: RangoTx | null;
  error?: string;
}

interface RangoTx {
  type: string;
  // EVM fields
  txTo?: string;
  txData?: string;
  value?: string;
  chainId?: number | null;
  // Solana fields
  serializedMessage?: string | null;
}

export class RangoProvider implements BridgeProvider {
  name = "rango" as const;

  isConfigured(): boolean {
    return !!process.env.RANGO_API_KEY;
  }

  async getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]> {
    const fromBlockchain = evmChainToRango(intent.sourceChainId);
    const isNativeSource =
      intent.sourceTokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
      intent.sourceTokenAddress === "native";

    const fromToken = isNativeSource ? null : intent.sourceTokenAddress;
    const fromSymbol = isNativeSource ? nativeSymbol(intent.sourceChainId) : undefined;

    const isNativeDest =
      intent.destinationTokenAddress === "SOL" ||
      intent.destinationTokenAddress === "11111111111111111111111111111111";

    const body = {
      from: {
        blockchain: fromBlockchain,
        symbol: fromSymbol,
        address: fromToken,
      },
      to: {
        blockchain: "SOLANA",
        symbol: isNativeDest ? "SOL" : undefined,
        address: isNativeDest ? null : intent.destinationTokenAddress,
      },
      amount: intent.sourceAmount,
      slippage: "3",
      fromAddress: intent.sourceAddress,
      toAddress: intent.solanaAddress,
    };

    const res = await fetchWithTimeout(`${RANGO_BASE_URL}/routing/best?apiKey=${getApiKey()}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      // Sanitize error message to avoid leaking sensitive info
      const sanitized = text.length > 500 ? text.slice(0, 500) + '...' : text;
      throw new Error(`Rango API error ${res.status}: ${sanitized}`);
    }

    const data = (await res.json()) as RangoQuoteResponse;

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from Rango API');
    }

    if (data.error) {
      throw new Error(`Rango: ${data.error}`);
    }

    const routes: RangoRoute[] = data.results ?? (data.result ? [data.result] : []);

    return routes
      .filter((r) => r.resultType !== "NO_ROUTE")
      .slice(0, 5)
      .map((route): NormalizedRoute => {
        const steps = (route.route ?? []).map((step) => ({
          chainType: step.from.blockchain === "SOLANA" ? ("solana" as const) : ("evm" as const),
          chainId: step.from.blockchain === "SOLANA" ? undefined : intent.sourceChainId,
          description: `${step.swapperId}: ${step.from.symbol} → ${step.to.symbol}`,
        }));

        // If no route steps, add a single cross-chain step
        if (steps.length === 0) {
          steps.push({
            chainType: "evm" as const,
            chainId: intent.sourceChainId,
            description: "Cross-chain swap to Solana",
          });
        }

        const fees = route.fee.map((f) => ({
          token: f.token.symbol,
          amount: f.amount,
        }));

        return {
          provider: "rango",
          routeId: route.requestId,
          steps,
          estimatedOutput: {
            token: "SOL",
            amount: route.outputAmountMin || route.outputAmount,
          },
          fees,
          etaSeconds: route.estimatedTimeInSeconds,
          warnings: route.tags?.includes("HIGH_IMPACT")
            ? ["High price impact"]
            : undefined,
        };
      });
  }

  async getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest,
  ): Promise<TxRequest> {
    // Validate stepIndex
    if (stepIndex < 0 || !Number.isInteger(stepIndex)) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const fromBlockchain = evmChainToRango(intent.sourceChainId);
    const isNativeSource =
      intent.sourceTokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ||
      intent.sourceTokenAddress === "native";

    const isNativeDest =
      intent.destinationTokenAddress === "SOL" ||
      intent.destinationTokenAddress === "11111111111111111111111111111111";

    const body = {
      requestId: routeId,
      step: stepIndex + 1,
      userSettings: { slippage: "3" },
      validations: { balance: false, fee: false },
      from: {
        blockchain: fromBlockchain,
        symbol: isNativeSource ? nativeSymbol(intent.sourceChainId) : undefined,
        address: isNativeSource ? null : intent.sourceTokenAddress,
      },
      to: {
        blockchain: "SOLANA",
        symbol: isNativeDest ? "SOL" : undefined,
        address: isNativeDest ? null : intent.destinationTokenAddress,
      },
      amount: intent.sourceAmount,
      fromAddress: intent.sourceAddress,
      toAddress: intent.solanaAddress,
    };

    const res = await fetchWithTimeout(`${RANGO_BASE_URL}/tx/create?apiKey=${getApiKey()}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      const sanitized = text.length > 500 ? text.slice(0, 500) + '...' : text;
      throw new Error(`Rango tx create error ${res.status}: ${sanitized}`);
    }

    const data = (await res.json()) as RangoSwapResponse;

    if (data.error) {
      throw new Error(`Rango tx error: ${data.error}`);
    }

    if (!data.tx) {
      throw new Error("No transaction data in Rango response");
    }

    if (data.tx.type === "SOLANA" || data.tx.type === "solana") {
      if (!data.tx.serializedMessage) {
        throw new Error("No serialized Solana transaction from Rango");
      }
      return {
        kind: "solana",
        rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        serializedTxBase64: data.tx.serializedMessage,
      };
    }

    // EVM transaction
    return {
      kind: "evm",
      chainId: data.tx.chainId ?? intent.sourceChainId,
      to: data.tx.txTo ?? "",
      data: data.tx.txData,
      value: data.tx.value,
    };
  }
}

function nativeSymbol(chainId: number): string {
  const map: Record<number, string> = {
    1: "ETH",
    10: "ETH",
    56: "BNB",
    137: "MATIC",
    42161: "ETH",
    8453: "ETH",
    43114: "AVAX",
  };
  return map[chainId] ?? "ETH";
}

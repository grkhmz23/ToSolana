import { fetchWithTimeout } from "@/lib/fetch-utils";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";

const DEFAULT_JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const DEFAULT_JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

export type JupiterQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct?: string;
  routePlan?: unknown[];
};

type JupiterQuoteResponse = {
  data?: JupiterQuote[];
};

type JupiterSwapResponse = {
  swapTransaction?: string;
};

export function getJupiterQuoteUrl(): string {
  return process.env.JUPITER_QUOTE_URL?.trim() || DEFAULT_JUPITER_QUOTE_URL;
}

export function getJupiterSwapUrl(): string {
  return process.env.JUPITER_SWAP_URL?.trim() || DEFAULT_JUPITER_SWAP_URL;
}

export function isJupiterSwapEnabled(): boolean {
  return process.env.ENABLE_JUPITER_SWAP === "true";
}

export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}): Promise<JupiterQuote | null> {
  const url = new URL(getJupiterQuoteUrl());
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amount);
  url.searchParams.set("slippageBps", String(params.slippageBps));
  url.searchParams.set("onlyDirectRoutes", "false");

  const res = await fetchWithTimeout(url.toString(), { method: "GET" });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as JupiterQuoteResponse;
  const quote = data?.data?.[0];
  if (!quote) return null;
  return quote;
}

export async function getJupiterSwapTransaction(params: {
  quote: JupiterQuote;
  userPublicKey: string;
}): Promise<string> {
  const res = await fetchWithTimeout(getJupiterSwapUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: params.quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as JupiterSwapResponse;
  if (!data.swapTransaction) {
    throw new Error("Jupiter swap transaction missing");
  }
  return data.swapTransaction;
}

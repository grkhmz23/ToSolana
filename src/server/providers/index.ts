import { compareNumericStrings } from "@/lib/fetch-utils";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

export interface BridgeProvider {
  name: "rango" | "lifi";
  isConfigured(): boolean;
  getQuotes(intent: QuoteRequest): Promise<NormalizedRoute[]>;
  getStepTx(
    routeId: string,
    stepIndex: number,
    intent: QuoteRequest,
  ): Promise<TxRequest>;
}

import { LiFiProvider } from "./lifi";
import { RangoProvider } from "./rango";

const lifiProvider = new LiFiProvider();
const rangoProvider = new RangoProvider();

export const providers: BridgeProvider[] = [lifiProvider, rangoProvider];

export function getProvider(name: "rango" | "lifi"): BridgeProvider {
  const p = providers.find((p) => p.name === name);
  if (!p) throw new Error(`Unknown provider: ${name}`);
  return p;
}

export async function getAllQuotes(
  intent: QuoteRequest,
): Promise<{ routes: NormalizedRoute[]; errors: string[] }> {
  const results = await Promise.allSettled(
    providers
      .filter((p) => p.isConfigured())
      .map((p) => p.getQuotes(intent)),
  );

  const routes: NormalizedRoute[] = [];
  const errors: string[] = [];

  const configuredProviders = providers.filter((p) => p.isConfigured());

  if (configuredProviders.length === 0) {
    errors.push(
      "No bridge providers configured. Set RANGO_API_KEY and/or LIFI_API_KEY (or LIFI_INTEGRATOR) in your .env file.",
    );
    return { routes, errors };
  }

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      routes.push(...result.value);
    } else {
      const providerName = configuredProviders[i]?.name ?? "unknown";
      errors.push(`${providerName}: ${String(result.reason)}`);
    }
  });

  // Sort by estimated output descending using safe BigInt comparison
  routes.sort((a, b) => {
    // Compare output amounts (higher is better)
    const outputCompare = compareNumericStrings(b.estimatedOutput.amount, a.estimatedOutput.amount);
    if (outputCompare !== 0) return outputCompare;
    
    // If outputs are equal, compare fees (lower is better)
    const aFeeTotal = a.fees.reduce((s, f) => {
      try { return (BigInt(s) + BigInt(f.amount)).toString(); } catch { return s; }
    }, "0");
    const bFeeTotal = b.fees.reduce((s, f) => {
      try { return (BigInt(s) + BigInt(f.amount)).toString(); } catch { return s; }
    }, "0");
    
    return compareNumericStrings(aFeeTotal, bFeeTotal);
  });

  return { routes: routes.slice(0, 10), errors };
}

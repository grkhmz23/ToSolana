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

  // Sort by estimated output descending (basic heuristic)
  routes.sort((a, b) => {
    const aOut = parseFloat(a.estimatedOutput.amount) || 0;
    const bOut = parseFloat(b.estimatedOutput.amount) || 0;
    const aFee = a.fees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const bFee = b.fees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    return bOut - bFee - (aOut - aFee);
  });

  return { routes: routes.slice(0, 10), errors };
}

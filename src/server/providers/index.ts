import { compareNumericStrings } from "@/lib/fetch-utils";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

export interface BridgeProvider {
  name:
    | "rango"
    | "lifi"
    | "thorchain"
    | "ibc"
    | "ton"
    | "jupiter"
    | "socket"
    | "flashift"
    | "wormhole"
    | "allbridge"
    | "debridge"
    | "symbiosis"
    | "mayan";
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
import { ThorchainProvider } from "./thorchain";
import { IbcProvider } from "./ibc";
import { TonProvider } from "./ton";
import { JupiterProvider } from "./jupiter";
import { SocketProvider } from "./socket";
import { FlashiftProvider } from "./flashift";
import { WormholeProvider } from "./wormhole";
import { AllbridgeProvider } from "./allbridge";
import { DebridgeProvider } from "./debridge";
import { SymbiosisProvider } from "./symbiosis";
import { MayanProvider } from "./mayan";

const lifiProvider = new LiFiProvider();
const rangoProvider = new RangoProvider();
const thorchainProvider = new ThorchainProvider();
const ibcProvider = new IbcProvider();
const tonProvider = new TonProvider();
const jupiterProvider = new JupiterProvider();
const socketProvider = new SocketProvider();
const flashiftProvider = new FlashiftProvider();
const wormholeProvider = new WormholeProvider();
const allbridgeProvider = new AllbridgeProvider();
const debridgeProvider = new DebridgeProvider();
const symbiosisProvider = new SymbiosisProvider();
const mayanProvider = new MayanProvider();

export const providers: BridgeProvider[] = [
  lifiProvider,
  rangoProvider,
  thorchainProvider,
  ibcProvider,
  tonProvider,
  jupiterProvider,
  socketProvider,
  flashiftProvider,
  wormholeProvider,
  allbridgeProvider,
  debridgeProvider,
  symbiosisProvider,
  mayanProvider,
];

export function getProvider(
  name:
    | "rango"
    | "lifi"
    | "thorchain"
    | "ibc"
    | "ton"
    | "jupiter"
    | "socket"
    | "flashift"
    | "wormhole"
    | "allbridge"
    | "debridge"
    | "symbiosis"
    | "mayan",
): BridgeProvider {
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
      // Only log non-critical errors
      const errorMsg = String(result.reason);
      if (!errorMsg.includes("Unsupported chain")) {
        errors.push(`${providerName}: ${errorMsg}`);
      }
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

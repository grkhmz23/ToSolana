import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

export class SymbiosisProvider implements BridgeProvider {
  name = "symbiosis" as const;

  isConfigured(): boolean {
    // Disabled until a full integration is implemented.
    return false;
  }

  async getQuotes(_intent: QuoteRequest): Promise<NormalizedRoute[]> {
    return [];
  }

  async getStepTx(): Promise<TxRequest> {
    throw new Error("Symbiosis provider is not enabled.");
  }
}

import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

export class AllbridgeProvider implements BridgeProvider {
  name = "allbridge" as const;

  isConfigured(): boolean {
    // Disabled until a full integration is implemented.
    return false;
  }

  async getQuotes(_intent: QuoteRequest): Promise<NormalizedRoute[]> {
    return [];
  }

  async getStepTx(): Promise<TxRequest> {
    throw new Error("Allbridge provider is not enabled.");
  }
}

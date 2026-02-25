import type { BridgeProvider } from "./index";
import type { NormalizedRoute, QuoteRequest, TxRequest } from "../schema";

export class WormholeProvider implements BridgeProvider {
  name = "wormhole" as const;

  isConfigured(): boolean {
    // Disabled until a full integration is implemented.
    return false;
  }

  async getQuotes(_intent: QuoteRequest): Promise<NormalizedRoute[]> {
    return [];
  }

  async getStepTx(): Promise<TxRequest> {
    throw new Error("Wormhole provider is not enabled.");
  }
}

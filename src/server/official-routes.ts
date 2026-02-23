// Official 1:1 route injection logic
import { getProjectTokenBySource } from "@/server/db";
import type { NormalizedRoute, QuoteRequest, RouteAction } from "@/server/schema";

/**
 * Check if a token has an official 1:1 bridge and return action
 */
export async function getOfficialRouteAction(
  sourceChainId: number | string,
  sourceTokenAddress: string
): Promise<{ action: RouteAction; tokenId: string; mode: string } | null> {
  // Only check EVM chains for now
  if (typeof sourceChainId !== "number") {
    return null;
  }

  const token = await getProjectTokenBySource(sourceChainId, sourceTokenAddress);

  if (!token) {
    return null;
  }

  // Only inject for ACTIVE tokens with NTT or OFT mode
  if (token.status !== "ACTIVE") {
    return null;
  }

  if (token.mode !== "NTT" && token.mode !== "OFT") {
    return null;
  }

  return {
    action: {
      kind: "internal_nav",
      href: `/official/${token.id}`,
      label: `Open Official 1:1 Bridge`,
    },
    tokenId: token.id,
    mode: token.mode,
  };
}

/**
 * Create an official route object
 */
export async function createOfficialRoute(
  intent: QuoteRequest,
  tokenId: string,
  mode: string
): Promise<NormalizedRoute> {
  // Get token details
  const { prisma } = await import("@/server/db");
  const token = await prisma.projectToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    throw new Error("Token not found");
  }

  const action: RouteAction = {
    kind: "internal_nav",
    href: `/official/${tokenId}`,
    label: "Open Official 1:1 Bridge",
  };

  return {
    provider: "lifi", // Use lifi as placeholder since it's a valid enum value
    routeId: `official-${tokenId}-${Date.now()}`,
    steps: [
      {
        chainType: "evm",
        chainId: token.sourceChainId,
        description: `Send ${token.symbol} via Official 1:1 ${mode}`,
      },
      {
        chainType: "solana",
        description: `Receive ${token.symbol} on Solana`,
      },
    ],
    estimatedOutput: {
      token: token.symbol,
      amount: intent.sourceAmount, // 1:1 ratio
    },
    fees: [], // No bridge fees for 1:1
    etaSeconds: 120, // Typically fast
    warnings: [
      `Official 1:1 ${mode} Bridge`,
      "Native token transfer with no slippage",
      "Requires destination wallet on Solana",
    ],
    action,
  };
}

/**
 * Inject official route at the top if applicable
 */
export async function injectOfficialRoute(
  routes: NormalizedRoute[],
  intent: QuoteRequest
): Promise<NormalizedRoute[]> {
  if (typeof intent.sourceChainId !== "number") {
    return routes;
  }

  const official = await getOfficialRouteAction(
    intent.sourceChainId,
    intent.sourceTokenAddress
  );

  if (!official) {
    return routes;
  }

  try {
    const officialRoute = await createOfficialRoute(
      intent,
      official.tokenId,
      official.mode
    );

    // Inject at the top
    return [officialRoute, ...routes];
  } catch (error) {
    console.error("Failed to create official route:", error);
    return routes;
  }
}

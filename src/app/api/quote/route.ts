import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/server/schema";
import { getAllQuotes } from "@/server/providers";
import { injectOfficialRoute } from "@/server/official-routes";
import { composeJupiterSwapRoutes } from "@/lib/jupiter-compose";
import { isValidNumericString } from "@/lib/fetch-utils";
import { isChainSupported, getChainType } from "@/lib/chains";
import { isValidEvmAddress, isValidSolanaAddress, isValidSolanaMint } from "@/lib/tokens";
import { validateNonEvmAddress } from "@/lib/nonEvmWallets";
import { checkDistributedRateLimit, getClientIp, RATE_LIMITS } from "@/lib/upstash-rate-limit";
import { signRoute, stripRouteSignature, type SignedRoute } from "@/lib/route-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Distributed rate limiting with Upstash Redis (falls back to memory)
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkDistributedRateLimit(
      clientIp,
      RATE_LIMITS.quote.windowMs,
      RATE_LIMITS.quote.max,
      "quote"
    );
    
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
          },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = quoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const intent = parsed.data;

    // Additional validations
    if (!isChainSupported(intent.sourceChainId)) {
      return NextResponse.json(
        { error: "Unsupported source chain" },
        { status: 400 },
      );
    }

    const chainType = getChainType(intent.sourceChainId);

    // Validate source token address
    if (chainType === "evm") {
      if (intent.sourceTokenAddress !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" &&
          intent.sourceTokenAddress !== "native" &&
          !isValidEvmAddress(intent.sourceTokenAddress)) {
        return NextResponse.json(
          { error: "Invalid source token address" },
          { status: 400 },
        );
      }
    } else {
      // Non-EVM chains use "native" or specific token identifiers
      if (intent.sourceTokenAddress !== "native" && 
          typeof intent.sourceTokenAddress !== "string") {
        return NextResponse.json(
          { error: "Invalid source token address" },
          { status: 400 },
        );
      }
    }

    // Validate destination token address
    if (!isValidSolanaMint(intent.destinationTokenAddress)) {
      return NextResponse.json(
        { error: "Invalid destination token address" },
        { status: 400 },
      );
    }

    // Validate source address based on chain type (allow placeholder addresses for quotes)
    const isPlaceholderEvm = intent.sourceAddress === '0x0000000000000000000000000000000000000000';
    const isPlaceholderSolana = intent.solanaAddress === 'H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP';
    
    if (chainType === "evm" && !isPlaceholderEvm) {
      if (!isValidEvmAddress(intent.sourceAddress)) {
        return NextResponse.json(
          { error: "Invalid source address" },
          { status: 400 },
        );
      }
    } else if (chainType === "bitcoin" && !intent.sourceAddress?.includes('...')) {
      if (!validateNonEvmAddress(intent.sourceAddress, "bitcoin")) {
        return NextResponse.json(
          { error: "Invalid Bitcoin address" },
          { status: 400 },
        );
      }
    } else if (chainType === "cosmos" && !intent.sourceAddress?.includes('...')) {
      if (!validateNonEvmAddress(intent.sourceAddress, "cosmos")) {
        return NextResponse.json(
          { error: "Invalid Cosmos address" },
          { status: 400 },
        );
      }
    } else if (chainType === "ton" && !intent.sourceAddress?.includes('...')) {
      if (!validateNonEvmAddress(intent.sourceAddress, "ton")) {
        return NextResponse.json(
          { error: "Invalid TON address" },
          { status: 400 },
        );
      }
    }

    // Validate Solana address (allow placeholder)
    if (!isPlaceholderSolana && !isValidSolanaAddress(intent.solanaAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana address" },
        { status: 400 },
      );
    }

    // Validate amount is a valid positive number string
    if (!isValidNumericString(intent.sourceAmount)) {
      return NextResponse.json(
        { error: "Invalid amount format" },
        { status: 400 },
      );
    }

    // Enforce: destination is always Solana
    // (sourceChainId must be an EVM chain - checked by isEvmChainSupported)
    // This is validated by the provider integrations which only support Solana as destination

    const { routes, errors } = await getAllQuotes(intent);

    // Inject official 1:1 routes if applicable
    const routesWithOfficial = await injectOfficialRoute(routes, intent);
    const routesWithSolanaSwap = await composeJupiterSwapRoutes(routesWithOfficial, intent);

    if (routesWithSolanaSwap.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { routes: [], errors },
        { status: errors.some((e) => e.includes("No bridge providers configured")) ? 400 : 200 },
      );
    }

    // Sign routes for integrity verification during execution
    // Routes include HMAC signatures that will be verified before execution
    const signedRoutes: SignedRoute[] = routesWithSolanaSwap.map(route => 
      signRoute(route, intent, 10 * 60 * 1000) // 10 minute expiry
    );

    return NextResponse.json(
      { routes: signedRoutes, errors: errors.length > 0 ? errors : undefined },
      {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Sanitize error in production
    const sanitizedMessage = process.env.NODE_ENV === "production" 
      ? "An error occurred while fetching quotes" 
      : message;
    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

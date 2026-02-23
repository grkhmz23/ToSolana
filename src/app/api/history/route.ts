import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionHistory, getSessionHistoryCount } from "@/server/sessions";
import { isValidEvmAddress, isValidSolanaAddress } from "@/lib/tokens";

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

const historyQuerySchema = z.object({
  sourceAddress: z.string().min(1).optional(),
  solanaAddress: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = historyQuerySchema.parse({
      sourceAddress: searchParams.get("sourceAddress") ?? undefined,
      solanaAddress: searchParams.get("solanaAddress") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    // At least one address must be provided
    if (!params.sourceAddress && !params.solanaAddress) {
      return NextResponse.json(
        { error: "At least one wallet address is required" },
        { status: 400 },
      );
    }

    // Validate addresses if provided
    if (params.sourceAddress && !isValidEvmAddress(params.sourceAddress)) {
      return NextResponse.json(
        { error: "Invalid EVM source address" },
        { status: 400 },
      );
    }

    if (params.solanaAddress && !isValidSolanaAddress(params.solanaAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana address" },
        { status: 400 },
      );
    }

    const sourceAddress = params.sourceAddress?.toLowerCase() ?? "";
    const solanaAddress = params.solanaAddress?.toLowerCase() ?? "";

    const [sessions, total] = await Promise.all([
      getSessionHistory(sourceAddress, solanaAddress, params.limit, params.offset),
      getSessionHistoryCount(sourceAddress, solanaAddress),
    ]);

    // Transform sessions to a cleaner response format
    const historyItems = sessions.map((session) => {
      const route = JSON.parse(session.selectedRouteJson);
      return {
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
        status: session.status,
        provider: session.provider,
        source: {
          chainId: session.sourceChainId,
          address: session.sourceAddress,
          token: session.sourceToken,
          amount: session.sourceAmount,
        },
        destination: {
          address: session.solanaAddress,
          token: session.destToken,
          estimatedOutput: session.estimatedOutput,
        },
        steps: session.steps.map((step) => ({
          index: step.index,
          chainType: step.chainType,
          status: step.status,
          txHashOrSig: step.txHashOrSig,
          description: route.steps[step.index]?.description ?? `Step ${step.index + 1}`,
        })),
        errorMessage: session.errorMessage,
      };
    });

    return NextResponse.json({
      items: historyItems,
      total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error("History API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    const sanitizedMessage =
      process.env.NODE_ENV === "production"
        ? "An error occurred while fetching history"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

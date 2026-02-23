import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTokenList, POPULAR_SOLANA_TOKENS } from "@/lib/token-lists";
import { SUPPORTED_CHAINS } from "@/lib/chains";

// Rate limiting map
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

// Query schema
const tokenListQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
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
    const params = tokenListQuerySchema.parse({
      chainId: searchParams.get("chainId"),
    });

    // Validate chain is supported
    const isSupportedEvm = SUPPORTED_CHAINS.some((c) => c.id === params.chainId);
    const isSolana = params.chainId === 101 || params.chainId === 102; // 101 = mainnet, 102 = devnet

    if (!isSupportedEvm && !isSolana) {
      return NextResponse.json(
        { error: "Unsupported chain ID" },
        { status: 400 },
      );
    }

    const tokens = await fetchTokenList(params.chainId);

    return NextResponse.json({
      chainId: params.chainId,
      tokens,
    });
  } catch (error) {
    console.error("Token list API error:", error);

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
        ? "An error occurred while fetching token list"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

// Also support fetching Solana tokens via POST for convenience
export async function POST(request: Request) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  try {
    const body: unknown = await request.json();
    const { chainId } = z.object({ chainId: z.number().int().positive() }).parse(body);

    // For Solana, return pre-defined list immediately
    if (chainId === 101 || chainId === 102) {
      return NextResponse.json({
        chainId,
        tokens: POPULAR_SOLANA_TOKENS,
      });
    }

    const tokens = await fetchTokenList(chainId);

    return NextResponse.json({ chainId, tokens });
  } catch (error) {
    console.error("Token list API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    const sanitizedMessage =
      process.env.NODE_ENV === "production"
        ? "An error occurred while fetching token list"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTokenPrices, formatUsd } from "@/lib/prices";
import { isValidEvmAddress, isValidSolanaMint } from "@/lib/tokens";

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

// Query schema for single price
const priceQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  address: z.string().min(1),
});

// Body schema for batch prices
const batchPriceSchema = z.object({
  tokens: z.array(
    z.object({
      chainId: z.number().int().positive(),
      address: z.string().min(1),
    }),
  ).max(50), // Limit batch size
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
    const params = priceQuerySchema.parse({
      chainId: searchParams.get("chainId"),
      address: searchParams.get("address"),
    });

    // Validate address format
    const isEvm = params.address.startsWith("0x");
    if (isEvm && !isValidEvmAddress(params.address)) {
      return NextResponse.json(
        { error: "Invalid EVM address format" },
        { status: 400 },
      );
    }
    if (!isEvm && !isValidSolanaMint(params.address)) {
      return NextResponse.json(
        { error: "Invalid Solana address format" },
        { status: 400 },
      );
    }

    const prices = await fetchTokenPrices([{ 
      chainId: params.chainId, 
      address: params.address 
    }]);
    
    const price = prices.get(`${params.chainId}:${params.address.toLowerCase()}`) ?? null;

    return NextResponse.json({
      chainId: params.chainId,
      address: params.address,
      priceUsd: price,
      formatted: price !== null ? formatUsd(price) : null,
    });
  } catch (error) {
    console.error("Price API error:", error);

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
        ? "An error occurred while fetching price"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

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
    const { tokens } = batchPriceSchema.parse(body);

    // Validate addresses
    for (const token of tokens) {
      const isEvm = token.address.startsWith("0x");
      if (isEvm && !isValidEvmAddress(token.address)) {
        return NextResponse.json(
          { error: `Invalid EVM address: ${token.address}` },
          { status: 400 },
        );
      }
      if (!isEvm && !isValidSolanaMint(token.address)) {
        return NextResponse.json(
          { error: `Invalid Solana address: ${token.address}` },
          { status: 400 },
        );
      }
    }

    const prices = await fetchTokenPrices(tokens);
    
    const result = tokens.map((token) => {
      const key = `${token.chainId}:${token.address.toLowerCase()}`;
      const price = prices.get(key) ?? null;
      return {
        chainId: token.chainId,
        address: token.address,
        priceUsd: price,
        formatted: price !== null ? formatUsd(price) : null,
      };
    });

    return NextResponse.json({ prices: result });
  } catch (error) {
    console.error("Price API error:", error);

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
        ? "An error occurred while fetching prices"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

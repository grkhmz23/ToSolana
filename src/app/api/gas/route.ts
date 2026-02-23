import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchGasPrice, estimateBridgeGas, GAS_LIMITS } from "@/lib/gas";

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
const gasQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
});

// Body schema for gas estimation
const gasEstimateSchema = z.object({
  chainId: z.number().int().positive(),
  gasLimit: z.number().int().positive().optional(),
  priority: z.enum(["slow", "standard", "fast"]).optional(),
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
    const params = gasQuerySchema.parse({
      chainId: searchParams.get("chainId"),
    });

    const gasPrice = await fetchGasPrice(params.chainId);
    
    if (!gasPrice) {
      return NextResponse.json(
        { error: "Unable to fetch gas price for this chain" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      chainId: params.chainId,
      gasPrice,
    });
  } catch (error) {
    console.error("Gas API error:", error);

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
        ? "An error occurred while fetching gas price"
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
    const { chainId, gasLimit, priority } = gasEstimateSchema.parse(body);

    const estimate = await estimateBridgeGas(
      chainId,
      gasLimit ?? GAS_LIMITS.BRIDGE_SWAP,
      priority ?? "standard",
    );

    if (!estimate) {
      return NextResponse.json(
        { error: "Unable to estimate gas for this chain" },
        { status: 500 },
      );
    }

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error("Gas estimation API error:", error);

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
        ? "An error occurred while estimating gas"
        : message;

    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

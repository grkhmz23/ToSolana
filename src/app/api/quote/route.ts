import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/server/schema";
import { getAllQuotes } from "@/server/providers";
import { isValidNumericString } from "@/lib/fetch-utils";
import { isEvmChainSupported } from "@/lib/chains";
import { isValidEvmAddress, isValidSolanaMint } from "@/lib/tokens";

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

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

function getClientIp(request: Request): string {
  // Try to get IP from headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
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
    if (!isEvmChainSupported(intent.sourceChainId)) {
      return NextResponse.json(
        { error: "Unsupported source chain" },
        { status: 400 },
      );
    }

    // Validate source token address
    if (intent.sourceTokenAddress !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" &&
        intent.sourceTokenAddress !== "native" &&
        !isValidEvmAddress(intent.sourceTokenAddress)) {
      return NextResponse.json(
        { error: "Invalid source token address" },
        { status: 400 },
      );
    }

    // Validate destination token address
    if (!isValidSolanaMint(intent.destinationTokenAddress)) {
      return NextResponse.json(
        { error: "Invalid destination token address" },
        { status: 400 },
      );
    }

    // Validate source address
    if (!isValidEvmAddress(intent.sourceAddress)) {
      return NextResponse.json(
        { error: "Invalid source address" },
        { status: 400 },
      );
    }

    // Validate Solana address
    if (!isValidSolanaMint(intent.solanaAddress)) {
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

    if (routes.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { routes: [], errors },
        { status: errors.some((e) => e.includes("No bridge providers configured")) ? 400 : 200 },
      );
    }

    return NextResponse.json({ routes, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Sanitize error in production
    const sanitizedMessage = process.env.NODE_ENV === "production" 
      ? "An error occurred while fetching quotes" 
      : message;
    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { statusQuerySchema } from "@/server/schema";
import { getSession } from "@/server/sessions";

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute for status polling

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
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = statusQuerySchema.safeParse({
      sessionId: searchParams.get("sessionId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid sessionId parameter" },
        { status: 400 },
      );
    }

    const session = await getSession(parsed.data.sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Don't leak sensitive data - only return necessary fields
    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      currentStep: session.currentStep,
      errorMessage: session.errorMessage,
      steps: session.steps.map((s) => ({
        index: s.index,
        chainType: s.chainType,
        status: s.status,
        txHashOrSig: s.txHashOrSig,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const sanitizedMessage = process.env.NODE_ENV === "production" 
      ? "An error occurred" 
      : message;
    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

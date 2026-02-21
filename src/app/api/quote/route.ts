import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/server/schema";
import { getAllQuotes } from "@/server/providers";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = quoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const intent = parsed.data;

    // Enforce: destination is always Solana
    // (sourceChainId must be an EVM chain)
    if (intent.sourceChainId > 1000000000) {
      return NextResponse.json(
        { error: "Source chain must be an EVM chain. Only EVM → Solana is supported." },
        { status: 400 },
      );
    }

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

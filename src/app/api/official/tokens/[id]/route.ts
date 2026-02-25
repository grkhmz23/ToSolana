import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Public endpoint: GET /api/official/tokens/[id]
export const GET = async (_request: NextRequest, context: RouteContext) => {
  try {
    const params = await context.params;
    const token = await prisma.projectToken.findUnique({
      where: { id: params.id },
    });

    if (!token || token.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        sourceChainId: token.sourceChainId,
        sourceTokenAddress: token.sourceTokenAddress,
        solanaMint: token.solanaMint,
        decimals: token.decimals,
        mode: token.mode,
      },
    });
  } catch (error) {
    console.error("Official token get error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch token" } },
      { status: 500 },
    );
  }
};

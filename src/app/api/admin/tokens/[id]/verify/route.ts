// Admin API: Verify token on-chain metadata
import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/server/admin-auth";
import { prisma, updateProjectToken, createVerificationLog } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params?: Promise<{ id: string }> | { id: string };
};

async function getRouteId(context?: RouteContext): Promise<string | null> {
  if (!context?.params) {
    return null;
  }
  const resolved = await context.params;
  return typeof resolved?.id === "string" && resolved.id.length > 0 ? resolved.id : null;
}

// POST /api/admin/tokens/[id]/verify
export const POST = withAdminAuth(async (request: NextRequest, context?: RouteContext) => {
  try {
    const id = await getRouteId(context);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing token id" } },
        { status: 400 }
      );
    }

    const token = await prisma.projectToken.findUnique({
      where: { id },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404 }
      );
    }

    // Run verification
    const { verifyToken } = await import("@/server/token-verification");
    const result = await verifyToken({
      sourceChainId: token.sourceChainId,
      sourceTokenAddress: token.sourceTokenAddress,
      solanaMint: token.solanaMint,
      expectedDecimals: token.decimals,
    });

    // Log verification
    await createVerificationLog(id, result.ok, result.details);

    // If successful, update token metadata if needed
    if (result.ok && result.details.erc20) {
      const updates: Record<string, unknown> = {};
      const erc20 = result.details.erc20 as Record<string, unknown>;
      
      if (erc20.name && (!token.name || token.name === "")) {
        updates.name = erc20.name;
      }
      if (erc20.symbol && (!token.symbol || token.symbol === "")) {
        updates.symbol = erc20.symbol;
      }
      if (erc20.decimals && token.decimals !== erc20.decimals) {
        updates.decimals = erc20.decimals;
      }

      if (Object.keys(updates).length > 0) {
        await updateProjectToken(id, updates);
      }
    }

    if (result.ok) {
      await updateProjectToken(id, { verifiedAt: new Date() });
    }

    return NextResponse.json({
      ok: result.ok,
      data: {
        verified: result.ok,
        details: result.details,
      },
    });
  } catch (error) {
    console.error("Admin token verify error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
});

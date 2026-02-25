// Admin API: Project Token CRUD
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/server/admin-auth";
import {
  createProjectToken,
  getProjectTokensForAdmin,
  getProjectTokenBySource,
} from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Create token schema
const createTokenSchema = z.object({
  sourceChainId: z.number().int().positive().default(1),
  sourceTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid ERC20 address"),
  solanaMint: z.string().min(32).max(44), // Base58 Solana address
  mode: z.enum(["WRAPPED", "NTT", "OFT"]),
  notes: z.string().optional(),
});

// GET /api/admin/tokens - List all tokens
export const GET = withAdminAuth(async () => {
  try {
    const tokens = await getProjectTokensForAdmin();
    return NextResponse.json({
      ok: true,
      data: tokens.map((t) => ({
        ...t,
        verificationCount: t._count.verificationLogs,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Admin tokens list error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch tokens" },
      },
      { status: 500 }
    );
  }
});

// POST /api/admin/tokens - Create new token
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sourceChainId, sourceTokenAddress, solanaMint, mode, notes } = parsed.data;

    // Check for duplicates
    const existing = await getProjectTokenBySource(sourceChainId, sourceTokenAddress);
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DUPLICATE",
            message: "Token already registered for this chain",
          },
        },
        { status: 409 }
      );
    }

    // Auto-fetch ERC20 metadata
    let metadata = { name: "", symbol: "", decimals: 18 };
    try {
      const { verifyErc20Metadata } = await import("@/server/token-verification");
      metadata = await verifyErc20Metadata(sourceChainId, sourceTokenAddress);
    } catch (error) {
      console.warn("Failed to auto-fetch ERC20 metadata:", error);
      // Continue with empty metadata, admin can update later
    }

    const token = await createProjectToken({
      sourceChainId,
      sourceTokenAddress,
      solanaMint,
      mode,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      notes,
    });

    return NextResponse.json({ ok: true, data: token }, { status: 201 });
  } catch (error) {
    console.error("Admin token create error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INTERNAL_ERROR", message },
      },
      { status: 500 }
    );
  }
});

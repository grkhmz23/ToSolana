// Admin API: Individual Project Token operations
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/server/admin-auth";
import { prisma, updateProjectToken } from "@/server/db";

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

const updateTokenSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(18).optional(),
  solanaMint: z.string().min(32).max(44).optional(),
  mode: z.enum(["WRAPPED", "NTT", "OFT"]).optional(),
  notes: z.string().optional(),
  providerConfig: z.record(z.unknown()).optional(),
});

// GET /api/admin/tokens/[id]
export const GET = withAdminAuth(async (request: NextRequest, context?: RouteContext) => {
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
      include: {
        verificationLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: token });
  } catch (error) {
    console.error("Admin token get error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch token" } },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/tokens/[id]
export const PATCH = withAdminAuth(async (request: NextRequest, context?: RouteContext) => {
  try {
    const id = await getRouteId(context);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing token id" } },
        { status: 400 }
      );
    }
    const body = await request.json();
    const parsed = updateTokenSchema.safeParse(body);

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

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.providerConfig) {
      updateData.providerConfig = JSON.stringify(parsed.data.providerConfig);
    }

    const token = await updateProjectToken(id, updateData);

    return NextResponse.json({ ok: true, data: token });
  } catch (error) {
    console.error("Admin token update error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
});

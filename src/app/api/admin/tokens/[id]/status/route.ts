// Admin API: Update token status (ACTIVE/DISABLED)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/server/admin-auth";
import { prisma, updateProjectToken } from "@/server/db";

const statusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]),
});

// POST /api/admin/tokens/[id]/status
export const POST = withAdminAuth(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // Get token to check verification
    const token = await prisma.projectToken.findUnique({
      where: { id },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404 }
      );
    }

    // Require verification before activating
    if (status === "ACTIVE" && !token.verifiedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_VERIFIED",
            message: "Token must be verified before activation",
          },
        },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { status };
    
    // Set verifiedAt timestamp when activating if not set
    if (status === "ACTIVE" && !token.verifiedAt) {
      updates.verifiedAt = new Date();
    }

    const updated = await updateProjectToken(id, updates);

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Admin token status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
});

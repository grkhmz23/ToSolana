import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { tokenCreateSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`tokens:post:${ip}`, 60_000, 30);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = tokenCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const {
      projectId,
      sourceChainId,
      sourceTokenAddress,
      symbol,
      decimals,
      totalSupply,
      signature,
      timestamp,
    } = parsed.data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const ok = verifyDashboardAuth({
      wallet: project.ownerWallet,
      signature,
      timestamp,
      action: "create_token",
      resource: projectId,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const token = await prisma.token.create({
      data: {
        projectId,
        sourceChainId,
        sourceTokenAddress: sourceTokenAddress.toLowerCase(),
        symbol,
        decimals,
        totalSupply,
      },
    });

    return NextResponse.json({ ok: true, data: token }, { status: 201 });
  } catch (error) {
    console.error("Token create error:", error);
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}

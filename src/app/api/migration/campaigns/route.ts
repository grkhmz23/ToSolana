import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { campaignCreateSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`campaigns:post:${ip}`, 60_000, 30);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = campaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, tokenId, name, snapshotBlock, signature, timestamp } = parsed.data;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const ok = verifyDashboardAuth({
      wallet: project.ownerWallet,
      signature,
      timestamp,
      action: "create_campaign",
      resource: projectId,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const token = await prisma.token.findUnique({ where: { id: tokenId } });
    if (!token || token.projectId !== projectId) {
      return NextResponse.json({ error: "Token not found for project" }, { status: 400 });
    }

    const campaign = await prisma.migrationCampaign.create({
      data: {
        projectId,
        tokenId,
        name,
        snapshotBlock,
        status: "draft",
      },
    });

    return NextResponse.json({ ok: true, data: campaign }, { status: 201 });
  } catch (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

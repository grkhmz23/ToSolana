import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { snapshotStartSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";
import { canTransition } from "@/lib/campaign-status";
import { generateSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`snapshot:start:${ip}`, 60_000, 10);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = snapshotStartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: parsed.data.campaignId },
      include: { project: true, token: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const ok = verifyDashboardAuth({
      wallet: campaign.project.ownerWallet,
      signature: parsed.data.signature,
      timestamp: parsed.data.timestamp,
      action: "start_snapshot",
      resource: campaign.id,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!canTransition(campaign.status as any, "snapshotting")) {
      return NextResponse.json({ error: "Campaign is not in draft state" }, { status: 400 });
    }

    await prisma.migrationCampaign.update({
      where: { id: campaign.id },
      data: { status: "snapshotting" },
    });

    const blockNumber = Number(campaign.snapshotBlock);
    if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
      return NextResponse.json({ error: "Invalid snapshot block" }, { status: 400 });
    }

    void generateSnapshot({
      campaignId: campaign.id,
      chainId: campaign.token.sourceChainId,
      tokenAddress: campaign.token.sourceTokenAddress,
      blockNumber,
    }).catch((err) => {
      console.error("Snapshot generation failed:", err);
    });

    return NextResponse.json({ ok: true, status: "snapshotting" });
  } catch (error) {
    console.error("Snapshot start error:", error);
    return NextResponse.json({ error: "Failed to start snapshot" }, { status: 500 });
  }
}

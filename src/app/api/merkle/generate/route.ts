import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { merkleGenerateSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";
import { buildMerkleTree } from "@/lib/merkle";
import { canTransition } from "@/lib/campaign-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`merkle:generate:${ip}`, 60_000, 10);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = merkleGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: parsed.data.campaignId },
      include: { project: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const ok = verifyDashboardAuth({
      wallet: campaign.project.ownerWallet,
      signature: parsed.data.signature,
      timestamp: parsed.data.timestamp,
      action: "generate_merkle",
      resource: campaign.id,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!canTransition(campaign.status as "snapshotting", "ready")) {
      return NextResponse.json({ error: "Campaign not ready for merkle generation" }, { status: 400 });
    }

    const snapshotCount = await prisma.snapshotEntry.count({ where: { campaignId: campaign.id } });
    if (snapshotCount === 0) {
      return NextResponse.json({ error: "Snapshot is empty" }, { status: 400 });
    }

    const result = await buildMerkleTree(campaign.id);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("Merkle generate error:", error);
    return NextResponse.json({ error: "Failed to generate merkle tree" }, { status: 500 });
  }
}

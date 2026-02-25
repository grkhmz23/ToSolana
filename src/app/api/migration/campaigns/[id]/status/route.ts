import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { campaignStatusSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";
import { canTransition, type CampaignStatus } from "@/lib/campaign-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`campaigns:status:${ip}`, 60_000, 30);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const params = await context.params;
    const parsed = campaignStatusSchema.safeParse({ ...body, campaignId: params.id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: params.id },
      include: { project: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const ok = verifyDashboardAuth({
      wallet: campaign.project.ownerWallet,
      signature: parsed.data.signature,
      timestamp: parsed.data.timestamp,
      action: "update_campaign_status",
      resource: params.id,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const current = campaign.status as CampaignStatus;
    const next = parsed.data.status as CampaignStatus;
    if (!canTransition(current, next)) {
      return NextResponse.json({ error: `Invalid transition: ${current} -> ${next}` }, { status: 400 });
    }

    const updated = await prisma.migrationCampaign.update({
      where: { id: params.id },
      data: { status: next },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Campaign status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

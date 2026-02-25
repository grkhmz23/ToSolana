import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { claimQuerySchema } from "@/lib/migration-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ campaignId: string; address: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`claim:get:${ip}`, 60_000, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const params = await context.params;
    const parsed = claimQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: parsed.data.campaignId },
    });
    if (!campaign || campaign.status !== "live") {
      return NextResponse.json({ error: "Campaign not live" }, { status: 400 });
    }

    const claim = await prisma.claim.findFirst({
      where: {
        campaignId: parsed.data.campaignId,
        address: parsed.data.address.toLowerCase(),
      },
    });

    if (!claim) {
      return NextResponse.json({ ok: true, data: null });
    }

    return NextResponse.json({
      ok: true,
      data: {
        campaignId: claim.campaignId,
        address: claim.address,
        amount: claim.amount,
        proof: JSON.parse(claim.proof),
        claimed: claim.claimed,
        claimedAt: claim.claimedAt?.toISOString() ?? null,
        merkleRoot: campaign.merkleRoot,
      },
    });
  } catch (error) {
    console.error("Claim fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch claim" }, { status: 500 });
  }
}

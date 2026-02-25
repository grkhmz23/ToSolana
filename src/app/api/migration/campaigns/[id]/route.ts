import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`campaigns:get:${ip}`, 60_000, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const params = await context.params;
    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        token: true,
        snapshots: { take: 1 },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: campaign });
  } catch (error) {
    console.error("Campaign fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

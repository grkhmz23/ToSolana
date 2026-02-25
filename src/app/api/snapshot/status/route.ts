import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSnapshotProgress } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`snapshot:status:${ip}`, 60_000, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const campaignId = request.nextUrl.searchParams.get("campaignId") ?? "";
  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  const progress = getSnapshotProgress(campaignId);
  if (!progress) {
    return NextResponse.json({ status: "idle", processedBlocks: 0, totalBlocks: 0, holders: 0 });
  }

  return NextResponse.json(progress);
}

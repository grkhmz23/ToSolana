import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`providers:stats:${ip}`, 60_000, 30);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const rows = await prisma.quoteSession.groupBy({
      by: ["provider", "status"],
      where: { status: { in: ["completed", "failed"] } },
      _count: { _all: true },
    });

    const stats: Record<string, { completed: number; failed: number; successRate: number }> = {};
    for (const row of rows) {
      const provider = row.provider;
      if (!stats[provider]) {
        stats[provider] = { completed: 0, failed: 0, successRate: 0 };
      }
      if (row.status === "completed") stats[provider].completed += row._count._all;
      if (row.status === "failed") stats[provider].failed += row._count._all;
    }

    for (const provider of Object.keys(stats)) {
      const { completed, failed } = stats[provider];
      const total = completed + failed;
      stats[provider].successRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    }

    return NextResponse.json({ ok: true, data: stats });
  } catch (error) {
    console.error("Provider stats error:", error);
    return NextResponse.json({ error: "Failed to load provider stats" }, { status: 500 });
  }
}

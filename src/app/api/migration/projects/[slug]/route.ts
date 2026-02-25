import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`projects:get:${ip}`, 60_000, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const params = await context.params;
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        tokens: { orderBy: { createdAt: "desc" } },
        campaigns: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: project });
  } catch (error) {
    console.error("Project fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

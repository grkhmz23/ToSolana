import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { projectCreateSchema, projectListSchema } from "@/lib/migration-schema";
import { verifyDashboardAuth } from "@/server/dashboard-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`projects:get:${ip}`, 60_000, 60);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = projectListSchema.safeParse({
      ownerWallet: searchParams.get("ownerWallet"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const projects = await prisma.project.findMany({
      where: { ownerWallet: parsed.data.ownerWallet },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: projects });
  } catch (error) {
    console.error("Projects list error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`projects:post:${ip}`, 60_000, 20);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, slug, ownerWallet, signature, timestamp } = parsed.data;
    const ok = verifyDashboardAuth({
      wallet: ownerWallet,
      signature,
      timestamp,
      action: "create_project",
      resource: slug,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const existing = await prisma.project.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const project = await prisma.project.create({
      data: { name, slug, ownerWallet },
    });

    return NextResponse.json({ ok: true, data: project }, { status: 201 });
  } catch (error) {
    console.error("Project create error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

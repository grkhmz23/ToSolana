import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { claimVerifySchema } from "@/lib/migration-schema";
import { buildClaimMessage, isFreshTimestamp } from "@/lib/solana-auth";
import { hashLeaf, verifyProof } from "@/lib/merkle";
import { recoverMessageAddress } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAIM_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`claim:verify:${ip}`, 60_000, 30);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = claimVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, address, amount, proof, signature, timestamp } = parsed.data;

    if (!isFreshTimestamp(timestamp, CLAIM_WINDOW_MS)) {
      return NextResponse.json({ error: "Signature expired" }, { status: 401 });
    }

    const campaign = await prisma.migrationCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.status !== "live" || !campaign.merkleRoot) {
      return NextResponse.json({ error: "Campaign not live" }, { status: 400 });
    }

    const claim = await prisma.claim.findFirst({
      where: { campaignId, address: address.toLowerCase() },
    });
    if (!claim) {
      return NextResponse.json({ error: "Not eligible" }, { status: 404 });
    }
    if (claim.claimed) {
      return NextResponse.json({ error: "Already claimed" }, { status: 409 });
    }

    if (claim.amount !== amount) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const leaf = hashLeaf(address, amount);
    const okProof = verifyProof({
      leaf,
      proof: proof as `0x${string}`[],
      root: campaign.merkleRoot as `0x${string}`,
    });

    if (!okProof) {
      return NextResponse.json({ error: "Invalid proof" }, { status: 400 });
    }

    const message = buildClaimMessage({
      campaignId,
      wallet: address,
      amount,
      timestamp,
    });

    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await prisma.claim.update({
      where: { id: claim.id },
      data: { claimed: true, claimedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Claim verify error:", error);
    return NextResponse.json({ error: "Failed to verify claim" }, { status: 500 });
  }
}

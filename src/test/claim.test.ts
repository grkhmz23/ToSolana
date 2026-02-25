// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, resetDb } from "./db-utils";
import { buildMerkleTree } from "@/lib/merkle";
import { buildClaimMessage } from "@/lib/solana-auth";
import { privateKeyToAccount } from "viem/accounts";
import { POST as verifyClaim } from "@/app/api/claim/verify/route";
import { NextRequest } from "next/server";

describe("claim verification", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("verifies merkle proof and marks claim as claimed", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Claim Project",
        slug: "claim-project",
        ownerWallet: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
      },
    });
    const token = await prisma.token.create({
      data: {
        projectId: project.id,
        sourceChainId: 1,
        sourceTokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        symbol: "CLM",
        decimals: 18,
        totalSupply: "1000000",
      },
    });
    const campaign = await prisma.migrationCampaign.create({
      data: {
        projectId: project.id,
        tokenId: token.id,
        name: "Claim Campaign",
        snapshotBlock: "100",
        status: "snapshotting",
      },
    });

    const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f094538b03d13a2d3b2e6e7c1d5d5a3a7edb6c1b");
    const address = account.address;

    await prisma.snapshotEntry.createMany({
      data: [
        { campaignId: campaign.id, address: address.toLowerCase(), balance: "100" },
      ],
    });

    const { merkleRoot } = await buildMerkleTree(campaign.id);

    await prisma.migrationCampaign.update({
      where: { id: campaign.id },
      data: { status: "live", merkleRoot },
    });

    const claim = await prisma.claim.findFirst({
      where: { campaignId: campaign.id, address: address.toLowerCase() },
    });
    if (!claim) throw new Error("Claim not found");

    const proof = JSON.parse(claim.proof);
    const timestamp = Date.now();
    const message = buildClaimMessage({
      campaignId: campaign.id,
      wallet: address,
      amount: claim.amount,
      timestamp,
    });
    const signature = await account.signMessage({ message });

    const request = new NextRequest("http://localhost/api/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        address,
        amount: claim.amount,
        proof,
        signature,
        timestamp,
      }),
    });

    const response = await verifyClaim(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);

    const updated = await prisma.claim.findFirst({
      where: { id: claim.id },
    });
    expect(updated?.claimed).toBe(true);
  });
});

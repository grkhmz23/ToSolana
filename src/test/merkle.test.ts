// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, resetDb } from "./db-utils";
import { buildMerkleTree, hashLeaf, verifyProof } from "@/lib/merkle";

describe("merkle builder", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("builds merkle root and stores proofs", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Test Project",
        slug: "merkle-project",
        ownerWallet: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
      },
    });
    const token = await prisma.token.create({
      data: {
        projectId: project.id,
        sourceChainId: 1,
        sourceTokenAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        symbol: "TST",
        decimals: 18,
        totalSupply: "1000000",
      },
    });
    const campaign = await prisma.migrationCampaign.create({
      data: {
        projectId: project.id,
        tokenId: token.id,
        name: "Merkle Campaign",
        snapshotBlock: "100",
        status: "snapshotting",
      },
    });

    await prisma.snapshotEntry.createMany({
      data: [
        { campaignId: campaign.id, address: "0x1111111111111111111111111111111111111111", balance: "100" },
        { campaignId: campaign.id, address: "0x2222222222222222222222222222222222222222", balance: "50" },
      ],
    });

    const result = await buildMerkleTree(campaign.id);
    expect(result.leafCount).toBe(2);
    expect(result.merkleRoot.startsWith("0x")).toBe(true);

    const claims = await prisma.claim.findMany({ where: { campaignId: campaign.id } });
    expect(claims.length).toBe(2);

    const sample = claims[0];
    const proof = JSON.parse(sample.proof) as `0x${string}`[];
    const leaf = hashLeaf(sample.address, sample.amount);
    const ok = verifyProof({ leaf, proof, root: result.merkleRoot });
    expect(ok).toBe(true);
  });
});

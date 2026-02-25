// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { resetDb, prisma } from "./db-utils";

vi.mock("viem", () => {
  return {
    createPublicClient: () => ({
      getLogs: vi.fn().mockResolvedValue([
        {
          args: {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x1111111111111111111111111111111111111111",
            value: BigInt(100),
          },
        },
        {
          args: {
            from: "0x1111111111111111111111111111111111111111",
            to: "0x2222222222222222222222222222222222222222",
            value: BigInt(40),
          },
        },
      ]),
    }),
    http: () => ({}),
    parseAbiItem: () => ({}),
  };
});

import { generateSnapshot } from "@/lib/snapshot";

describe("snapshot generator", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores snapshot entries from transfer logs", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Test Project",
        slug: "test-project",
        ownerWallet: "H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP",
      },
    });
    const token = await prisma.token.create({
      data: {
        projectId: project.id,
        sourceChainId: 1,
        sourceTokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        symbol: "TST",
        decimals: 18,
        totalSupply: "1000000",
      },
    });
    const campaign = await prisma.migrationCampaign.create({
      data: {
        projectId: project.id,
        tokenId: token.id,
        name: "Test Campaign",
        snapshotBlock: "100",
        status: "draft",
      },
    });

    await generateSnapshot({
      campaignId: campaign.id,
      chainId: 1,
      tokenAddress: token.sourceTokenAddress,
      blockNumber: 100,
    });

    const entries = await prisma.snapshotEntry.findMany({ where: { campaignId: campaign.id } });
    expect(entries.length).toBe(2);

    const holder1 = entries.find((e) => e.address === "0x1111111111111111111111111111111111111111");
    const holder2 = entries.find((e) => e.address === "0x2222222222222222222222222222222222222222");
    expect(holder1?.balance).toBe("60");
    expect(holder2?.balance).toBe("40");
  });
});

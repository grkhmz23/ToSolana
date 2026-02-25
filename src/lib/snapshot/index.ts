import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { getRpcUrl } from "@/lib/chains";
import { prisma } from "@/server/db";

type SnapshotProgress = {
  status: "idle" | "running" | "completed" | "failed";
  processedBlocks: number;
  totalBlocks: number;
  holders: number;
  error?: string;
};

const progressMap = new Map<string, SnapshotProgress>();

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export function getSnapshotProgress(campaignId: string): SnapshotProgress | null {
  return progressMap.get(campaignId) ?? null;
}

export async function generateSnapshot(params: {
  campaignId: string;
  chainId: number;
  tokenAddress: string;
  blockNumber: number;
}): Promise<void> {
  const { campaignId, chainId, tokenAddress, blockNumber } = params;
  try {
    const rpcUrl = getRpcUrl(chainId) ?? process.env.SNAPSHOT_RPC_URL;
    if (!rpcUrl) {
      throw new Error("RPC URL not configured for this chain");
    }

    const client = createPublicClient({ transport: http(rpcUrl) });
    const toBlock = BigInt(blockNumber);
    const fromBlock = BigInt(0);
    const chunkSize = BigInt(10_000);

    const totalBlocks = Number(toBlock - fromBlock + BigInt(1));
    progressMap.set(campaignId, {
      status: "running",
      processedBlocks: 0,
      totalBlocks,
      holders: 0,
    });

    const balances = new Map<string, bigint>();
    let current = fromBlock;

    while (current <= toBlock) {
      const end =
        current + chunkSize - BigInt(1) > toBlock
          ? toBlock
          : current + chunkSize - BigInt(1);
      const logs = (await getLogsWithRetry(client, {
        address: tokenAddress as Address,
        event: transferEvent,
        fromBlock: current,
        toBlock: end,
      })) as Array<{
        args?: {
          from?: string;
          to?: string;
          value?: bigint;
        };
      }>;

      for (const log of logs) {
        const from = (log.args?.from as string | undefined)?.toLowerCase();
        const to = (log.args?.to as string | undefined)?.toLowerCase();
        const value = log.args?.value as bigint | undefined;

        if (!value || value === BigInt(0)) continue;

        if (from && from !== "0x0000000000000000000000000000000000000000") {
          const prev = balances.get(from) ?? BigInt(0);
          const next = prev - value;
          balances.set(from, next);
        }
        if (to && to !== "0x0000000000000000000000000000000000000000") {
          const prev = balances.get(to) ?? BigInt(0);
          balances.set(to, prev + value);
        }
      }

      const processed = Number(end - fromBlock + BigInt(1));
      progressMap.set(campaignId, {
        status: "running",
        processedBlocks: processed,
        totalBlocks,
        holders: balances.size,
      });

      current = end + BigInt(1);
    }

    const entries = Array.from(balances.entries())
      .filter(([, balance]) => balance > BigInt(0))
      .map(([address, balance]) => ({
        campaignId,
        address,
        balance: balance.toString(),
      }));

    await prisma.snapshotEntry.deleteMany({ where: { campaignId } });
    const chunk = 500;
    for (let i = 0; i < entries.length; i += chunk) {
      await prisma.snapshotEntry.createMany({
        data: entries.slice(i, i + chunk),
      });
    }

    progressMap.set(campaignId, {
      status: "completed",
      processedBlocks: totalBlocks,
      totalBlocks,
      holders: entries.length,
    });
  } catch (error) {
    progressMap.set(campaignId, {
      status: "failed",
      processedBlocks: 0,
      totalBlocks: 0,
      holders: 0,
      error: error instanceof Error ? error.message : "Snapshot failed",
    });
    throw error;
  }
}

async function getLogsWithRetry(
  client: ReturnType<typeof createPublicClient>,
  params: Parameters<typeof client.getLogs>[0],
  attempts: number = 3,
): Promise<Awaited<ReturnType<typeof client.getLogs>>> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.getLogs(params);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw lastError;
}

// Prisma client singleton for server-side usage
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Project Token helpers
export async function getProjectTokenBySource(
  sourceChainId: number,
  sourceTokenAddress: string
) {
  return prisma.projectToken.findUnique({
    where: {
      sourceChainId_sourceTokenAddress: {
        sourceChainId,
        sourceTokenAddress: sourceTokenAddress.toLowerCase(),
      },
    },
  });
}

export async function getActiveProjectTokens() {
  return prisma.projectToken.findMany({
    where: { status: "ACTIVE" },
    orderBy: { symbol: "asc" },
  });
}

export async function getProjectTokensForAdmin() {
  return prisma.projectToken.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { verificationLogs: true },
      },
    },
  });
}

export async function createProjectToken(data: {
  sourceChainId: number;
  sourceTokenAddress: string;
  solanaMint: string;
  mode: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  notes?: string;
}) {
  return prisma.projectToken.create({
    data: {
      sourceChainId: data.sourceChainId,
      sourceTokenAddress: data.sourceTokenAddress.toLowerCase(),
      solanaMint: data.solanaMint,
      mode: data.mode,
      name: data.name || "",
      symbol: data.symbol || "",
      decimals: data.decimals ?? 18,
      status: "DRAFT",
      notes: data.notes,
    },
  });
}

export async function updateProjectToken(
  id: string,
  data: Partial<{
    name: string;
    symbol: string;
    decimals: number;
    solanaMint: string;
    mode: string;
    status: string;
    providerConfig: string;
    notes: string;
    verifiedAt: Date | null;
  }>
) {
  return prisma.projectToken.update({
    where: { id },
    data,
  });
}

export async function createVerificationLog(
  projectTokenId: string,
  ok: boolean,
  details: Record<string, unknown>
) {
  return prisma.tokenVerificationLog.create({
    data: {
      projectTokenId,
      ok,
      details: JSON.stringify(details),
    },
  });
}

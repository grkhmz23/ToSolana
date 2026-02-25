// Prisma client singleton for server-side usage
import { PrismaClient } from "@prisma/client";

// Prevent multiple instances during development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Check if we're in build/static generation mode
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                   process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.DATABASE_URL;

// Create Prisma client only when not in build time
export const prisma = globalForPrisma.prisma ?? (
  isBuildTime 
    ? null as unknown as PrismaClient  // Return null during build, will be initialized at runtime
    : new PrismaClient()
);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Helper to ensure prisma is initialized
function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized');
  }
  return prisma;
}

// Project Token helpers
export async function getProjectTokenBySource(
  sourceChainId: number,
  sourceTokenAddress: string
) {
  return getPrisma().projectToken.findUnique({
    where: {
      sourceChainId_sourceTokenAddress: {
        sourceChainId,
        sourceTokenAddress: sourceTokenAddress.toLowerCase(),
      },
    },
  });
}

export async function getActiveProjectTokens() {
  return getPrisma().projectToken.findMany({
    where: { status: "ACTIVE" },
    orderBy: { symbol: "asc" },
  });
}

export async function getProjectTokensForAdmin() {
  return getPrisma().projectToken.findMany({
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
  return getPrisma().projectToken.create({
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
  return getPrisma().projectToken.update({
    where: { id },
    data,
  });
}

export async function createVerificationLog(
  projectTokenId: string,
  ok: boolean,
  details: Record<string, unknown>
) {
  return getPrisma().tokenVerificationLog.create({
    data: {
      projectTokenId,
      ok,
      details: JSON.stringify(details),
    },
  });
}

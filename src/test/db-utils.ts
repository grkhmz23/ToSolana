import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function resetDb() {
  await prisma.claim.deleteMany();
  await prisma.snapshotEntry.deleteMany();
  await prisma.migrationCampaign.deleteMany();
  await prisma.token.deleteMany();
  await prisma.project.deleteMany();
  await prisma.tokenVerificationLog.deleteMany();
  await prisma.projectToken.deleteMany();
  await prisma.step.deleteMany();
  await prisma.quoteSession.deleteMany();
}

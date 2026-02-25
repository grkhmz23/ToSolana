import { z } from "zod";
import { isValidEvmAddress, isValidSolanaAddress } from "@/lib/tokens";

export const slugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric and hyphen");

export const solanaAddressSchema = z
  .string()
  .refine((v) => isValidSolanaAddress(v), "Invalid Solana address");

export const evmAddressSchema = z
  .string()
  .refine((v) => isValidEvmAddress(v), "Invalid EVM address");

export const projectCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema,
  ownerWallet: solanaAddressSchema,
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const projectListSchema = z.object({
  ownerWallet: solanaAddressSchema,
});

export const tokenCreateSchema = z.object({
  projectId: z.string().min(1),
  sourceChainId: z.number().int().positive(),
  sourceTokenAddress: evmAddressSchema,
  symbol: z.string().min(1).max(16),
  decimals: z.number().int().min(0).max(18),
  totalSupply: z.string().regex(/^[0-9]+$/, "Total supply must be integer string"),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const campaignCreateSchema = z.object({
  projectId: z.string().min(1),
  tokenId: z.string().min(1),
  name: z.string().min(2).max(80),
  snapshotBlock: z.string().regex(/^[0-9]+$/, "Snapshot block must be integer string"),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const campaignStatusSchema = z.object({
  campaignId: z.string().min(1),
  status: z.enum(["draft", "snapshotting", "ready", "live", "ended"]),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const snapshotStartSchema = z.object({
  campaignId: z.string().min(1),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const merkleGenerateSchema = z.object({
  campaignId: z.string().min(1),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

export const claimQuerySchema = z.object({
  campaignId: z.string().min(1),
  address: evmAddressSchema,
});

export const claimVerifySchema = z.object({
  campaignId: z.string().min(1),
  address: evmAddressSchema,
  amount: z.string().regex(/^[0-9]+$/, "Amount must be integer string"),
  proof: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  signature: z.string().min(10),
  timestamp: z.number().int(),
});

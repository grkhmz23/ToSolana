import { z } from "zod";

// ---- Shared enums & primitives ----

export const providerEnum = z.enum(["rango", "lifi"]);
export type Provider = z.infer<typeof providerEnum>;

export const chainTypeEnum = z.enum(["evm", "solana"]);
export type ChainType = z.infer<typeof chainTypeEnum>;

export const stepStatusEnum = z.enum([
  "idle",
  "quoted",
  "signing",
  "submitted",
  "confirmed",
  "bridging",
  "completed",
  "failed",
]);
export type StepStatus = z.infer<typeof stepStatusEnum>;

// ---- Quote request/response ----

export const quoteRequestSchema = z.object({
  sourceChainId: z.number().int().positive(),
  sourceTokenAddress: z.string().min(1),
  sourceAmount: z.string().min(1),
  destinationTokenAddress: z.string().min(1),
  sourceAddress: z.string().min(1),
  solanaAddress: z.string().min(1),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const routeStepSchema = z.object({
  chainType: chainTypeEnum,
  chainId: z.number().optional(),
  description: z.string(),
});
export type RouteStep = z.infer<typeof routeStepSchema>;

export const feeSchema = z.object({
  token: z.string(),
  amount: z.string(),
});

export const normalizedRouteSchema = z.object({
  provider: providerEnum,
  routeId: z.string(),
  steps: z.array(routeStepSchema),
  estimatedOutput: z.object({
    token: z.string(),
    amount: z.string(),
  }),
  fees: z.array(feeSchema),
  etaSeconds: z.number().optional(),
  warnings: z.array(z.string()).optional(),
});
export type NormalizedRoute = z.infer<typeof normalizedRouteSchema>;

export const quoteResponseSchema = z.object({
  routes: z.array(normalizedRouteSchema),
  errors: z.array(z.string()).optional(),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

// ---- Execute step request/response ----

export const executeStepRequestSchema = z.object({
  sessionId: z.string().min(1),
  provider: providerEnum,
  routeId: z.string().min(1),
  stepIndex: z.number().int().min(0),
});
export type ExecuteStepRequest = z.infer<typeof executeStepRequestSchema>;

export const evmTxRequestSchema = z.object({
  kind: z.literal("evm"),
  chainId: z.number(),
  to: z.string(),
  data: z.string().optional(),
  value: z.string().optional(),
});

export const solanaTxRequestSchema = z.object({
  kind: z.literal("solana"),
  rpc: z.string(),
  serializedTxBase64: z.string(),
});

export const txRequestSchema = z.discriminatedUnion("kind", [
  evmTxRequestSchema,
  solanaTxRequestSchema,
]);
export type TxRequest = z.infer<typeof txRequestSchema>;

export const executeStepResponseSchema = z.object({
  sessionId: z.string(),
  stepIndex: z.number(),
  txRequest: txRequestSchema,
});
export type ExecuteStepResponse = z.infer<typeof executeStepResponseSchema>;

// ---- Status ----

export const stepStateSchema = z.object({
  index: z.number(),
  chainType: chainTypeEnum,
  status: stepStatusEnum,
  txHashOrSig: z.string().nullable(),
});

export const statusResponseSchema = z.object({
  sessionId: z.string(),
  status: stepStatusEnum,
  currentStep: z.number(),
  errorMessage: z.string().nullable(),
  steps: z.array(stepStateSchema),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;

// ---- Session creation ----

export const createSessionRequestSchema = z.object({
  sourceAddress: z.string().min(1),
  solanaAddress: z.string().min(1),
  provider: providerEnum,
  routeId: z.string().min(1),
  route: normalizedRouteSchema,
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

// ---- Status query ----

export const statusQuerySchema = z.object({
  sessionId: z.string().min(1),
});

// ---- Update step status ----

export const updateStepRequestSchema = z.object({
  sessionId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  status: stepStatusEnum,
  txHashOrSig: z.string().optional(),
});
export type UpdateStepRequest = z.infer<typeof updateStepRequestSchema>;

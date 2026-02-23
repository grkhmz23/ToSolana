import { z } from "zod";

// ---- Shared enums & primitives ----

export const providerEnum = z.enum(["rango", "lifi", "thorchain", "ibc", "ton"]);
export type Provider = z.infer<typeof providerEnum>;

export const chainTypeEnum = z.enum(["evm", "solana", "bitcoin", "cosmos", "ton"]);
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
  sourceChainId: z.union([z.number().int().positive(), z.string().min(1)]),
  sourceTokenAddress: z.string().min(1),
  sourceAmount: z.string().min(1),
  destinationTokenAddress: z.string().min(1),
  sourceAddress: z.string().min(1),
  solanaAddress: z.string().min(1),
  slippage: z.number().min(0.1).max(50).default(3), // 0.1% to 50%, default 3%
  // Non-EVM specific fields
  sourceChainType: chainTypeEnum.optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const routeStepSchema = z.object({
  chainType: chainTypeEnum,
  chainId: z.union([z.number(), z.string()]).optional(),
  description: z.string(),
});
export type RouteStep = z.infer<typeof routeStepSchema>;

export const feeSchema = z.object({
  token: z.string(),
  amount: z.string(),
});

export const routeActionSchema = z.object({
  kind: z.enum(["internal_nav", "external_link"]),
  href: z.string(),
  label: z.string(),
});
export type RouteAction = z.infer<typeof routeActionSchema>;

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
  // USD values for price display
  usdValues: z.object({
    input: z.number().optional(),
    output: z.number().optional(),
    fees: z.number().optional(),
  }).optional(),
  // Action for special routes (e.g., Official 1:1 bridge)
  action: routeActionSchema.optional(),
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

export const bitcoinTxRequestSchema = z.object({
  kind: z.literal("bitcoin"),
  psbtBase64: z.string(),
  inputsToSign: z.array(z.object({
    index: z.number(),
    address: z.string(),
  })),
});

export const cosmosTxRequestSchema = z.object({
  kind: z.literal("cosmos"),
  chainId: z.string(),
  messages: z.array(z.record(z.unknown())),
  fee: z.object({
    amount: z.array(z.object({ denom: z.string(), amount: z.string() })),
    gas: z.string(),
  }),
  memo: z.string().optional(),
});

export const tonTxRequestSchema = z.object({
  kind: z.literal("ton"),
  to: z.string(),
  amount: z.string(),
  payload: z.string().optional(),
  stateInit: z.string().optional(),
});

export const txRequestSchema = z.discriminatedUnion("kind", [
  evmTxRequestSchema,
  solanaTxRequestSchema,
  bitcoinTxRequestSchema,
  cosmosTxRequestSchema,
  tonTxRequestSchema,
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
  // History fields
  sourceChainId: z.union([z.number().int().positive(), z.string().min(1)]),
  sourceToken: z.string().min(1),
  sourceAmount: z.string().min(1),
  destToken: z.string().min(1),
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

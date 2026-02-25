import { NextResponse } from "next/server";
import {
  executeStepRequestSchema,
  createSessionRequestSchema,
  updateStepRequestSchema,
  type SessionAuthProof,
} from "@/server/schema";
import { getProvider } from "@/server/providers";
import { getJupiterQuote, getJupiterSwapTransaction, WSOL_MINT } from "@/lib/jupiter";
import { createSession, getSession, updateStepStatus } from "@/server/sessions";
import {
  createSessionAuthChallenge,
  verifySessionAuthProof,
} from "@/server/session-auth";
import {
  formatNonEvmExecutionPolicyMessage,
  getRoutePolicyBlockedChainTypes,
  isChainExecutionDisabledByPolicy,
} from "@/lib/execution-policy";
import { checkDistributedRateLimit, getClientIp, RATE_LIMITS } from "@/lib/upstash-rate-limit";
import { validateRouteForExecution } from "@/lib/route-verification";
import type { NormalizedRoute } from "@/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredRouteStep = { chainType: string; chainId?: number | string };
type StoredRouteLike = {
  steps: StoredRouteStep[];
  action?: unknown;
};

type StoredExecutionContext = {
  sourceChainId?: number | string;
  sourceChainType?: "evm" | "bitcoin" | "cosmos" | "ton" | "solana";
  sourceTokenAddress?: string;
  destinationTokenAddress?: string;
  sourceAmountRaw?: string;
  slippage?: number;
};

function parseStoredSessionData(selectedRouteJson: string): {
  route: StoredRouteLike;
  executionContext?: StoredExecutionContext;
} {
  const parsed = JSON.parse(selectedRouteJson) as unknown;

  if (
    parsed &&
    typeof parsed === "object" &&
    "route" in parsed &&
    parsed.route &&
    typeof parsed.route === "object"
  ) {
    const wrapped = parsed as {
      route: StoredRouteLike;
      executionContext?: StoredExecutionContext;
    };
    return { route: wrapped.route, executionContext: wrapped.executionContext };
  }

  return { route: parsed as StoredRouteLike };
}

// Helper to verify origin for CSRF protection
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  
  // In development, allow requests without origin
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  
  // Require origin header in production
  if (!origin || !host) {
    return false;
  }
  
  // Verify origin matches host
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

async function ensureSessionAuthenticated(
  request: Request,
  session: {
    id: string;
    sourceAddress: string;
    solanaAddress: string;
    provider: string;
    routeId: string;
  },
  sessionAuth: SessionAuthProof,
): Promise<NextResponse | null> {
  try {
    await verifySessionAuthProof(sessionAuth, session, request.headers.get("host"));
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid session authentication";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    // CSRF protection
    if (!verifyOrigin(request)) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 },
      );
    }

    // Distributed rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkDistributedRateLimit(
      clientIp,
      RATE_LIMITS.execute.windowMs,
      RATE_LIMITS.execute.max,
      "execute"
    );
    
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
          },
        },
      );
    }

    const body: unknown = await request.json();

    // Check if this is a "create session" request
    const createParsed = createSessionRequestSchema.safeParse(body);
    if (createParsed.success) {
      const blockedChains = getRoutePolicyBlockedChainTypes(createParsed.data.route.steps);
      if (blockedChains.length > 0) {
        return NextResponse.json(
          { error: formatNonEvmExecutionPolicyMessage(blockedChains) },
          { status: 403 },
        );
      }

      const session = await createSession(createParsed.data);
      let sessionAuthChallenge;
      try {
        sessionAuthChallenge = createSessionAuthChallenge(
          {
            id: session.id,
            sourceAddress: session.sourceAddress,
            solanaAddress: session.solanaAddress,
            provider: session.provider,
            routeId: session.routeId,
          },
          request.headers.get("host"),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to prepare session authentication";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
        sessionAuthChallenge,
        steps: session.steps.map((s) => ({
          index: s.index,
          chainType: s.chainType,
          status: s.status,
        })),
      });
    }

    // Check if this is an "update step" request
    const updateParsed = updateStepRequestSchema.safeParse(body);
    if (updateParsed.success) {
      const session = await getSession(updateParsed.data.sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.provider !== updateParsed.data.provider) {
        return NextResponse.json({ error: "Provider mismatch" }, { status: 400 });
      }

      if (session.routeId !== updateParsed.data.routeId) {
        return NextResponse.json({ error: "Route ID mismatch" }, { status: 400 });
      }

      const authError = await ensureSessionAuthenticated(request, session, updateParsed.data.sessionAuth);
      if (authError) {
        return authError;
      }

      if (session.status === "completed" || session.status === "failed") {
        return NextResponse.json(
          { error: `Session already ${session.status}` },
          { status: 400 },
        );
      }

      if (
        updateParsed.data.status === "submitted" &&
        !updateParsed.data.txHashOrSig
      ) {
        return NextResponse.json(
          { error: "txHashOrSig is required for submitted updates" },
          { status: 400 },
        );
      }

      const existingStep = session.steps.find((s) => s.index === updateParsed.data.stepIndex);
      if (!existingStep) {
        return NextResponse.json(
          { error: `Step ${updateParsed.data.stepIndex} not found` },
          { status: 400 },
        );
      }

      if (
        updateParsed.data.status === "submitted" &&
        isChainExecutionDisabledByPolicy(existingStep.chainType)
      ) {
        return NextResponse.json(
          { error: formatNonEvmExecutionPolicyMessage([existingStep.chainType]) },
          { status: 403 },
        );
      }

      if (
        existingStep.txHashOrSig &&
        updateParsed.data.txHashOrSig &&
        existingStep.txHashOrSig !== updateParsed.data.txHashOrSig
      ) {
        return NextResponse.json(
          { error: "txHashOrSig does not match previously submitted transaction" },
          { status: 400 },
        );
      }

      if (
        (existingStep.status === "confirmed" || existingStep.status === "completed")
      ) {
        return NextResponse.json(
          { error: `Step ${updateParsed.data.stepIndex} is already ${existingStep.status}` },
          { status: 400 },
        );
      }

      if (
        updateParsed.data.status === "failed" &&
        existingStep.status === "idle"
      ) {
        return NextResponse.json(
          { error: `Cannot fail step ${updateParsed.data.stepIndex} before it is submitted` },
          { status: 400 },
        );
      }

      if (
        updateParsed.data.status === "submitted" &&
        existingStep.status === "submitted" &&
        existingStep.txHashOrSig === updateParsed.data.txHashOrSig
      ) {
        return NextResponse.json({ success: true, step: existingStep });
      }

      if (
        updateParsed.data.status === "submitted" &&
        !["idle", "signing", "submitted"].includes(existingStep.status)
      ) {
        return NextResponse.json(
          {
            error: `Cannot submit step ${updateParsed.data.stepIndex} from status ${existingStep.status}`,
          },
          { status: 400 },
        );
      }

      const step = await updateStepStatus(
        updateParsed.data.sessionId,
        updateParsed.data.stepIndex,
        updateParsed.data.status,
        updateParsed.data.txHashOrSig,
      );
      return NextResponse.json({ success: true, step });
    }

    // Otherwise, this is an "execute step" request (get tx)
    const execParsed = executeStepRequestSchema.safeParse(body);
    if (!execParsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: execParsed.error.flatten() },
        { status: 400 },
      );
    }

    const { sessionId, provider, routeId, stepIndex } = execParsed.data;

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify session is in a valid state for execution
    if (session.status === "completed") {
      return NextResponse.json(
        { error: "Session already completed" },
        { status: 400 },
      );
    }
    if (session.status === "failed") {
      return NextResponse.json(
        { error: "Session failed, cannot continue" },
        { status: 400 },
      );
    }

    // Verify provider matches stored session
    if (session.provider !== provider) {
      return NextResponse.json(
        { error: "Provider mismatch" },
        { status: 400 },
      );
    }

    // Verify routeId matches stored session
    if (session.routeId !== routeId) {
      return NextResponse.json(
        { error: "Route ID mismatch" },
        { status: 400 },
      );
    }

    const authError = await ensureSessionAuthenticated(request, session, execParsed.data.sessionAuth);
    if (authError) {
      return authError;
    }

    // Parse and validate stored route
    let route: StoredRouteLike;
    let executionContext: StoredExecutionContext | undefined;
    let signedRoute: NormalizedRoute & { _signature?: string; _timestamp?: number; _expiresAt?: number };
    try {
      const parsedSessionData = parseStoredSessionData(session.selectedRouteJson);
      route = parsedSessionData.route;
      executionContext = parsedSessionData.executionContext;
      signedRoute = JSON.parse(session.selectedRouteJson) as typeof signedRoute;
    } catch {
      return NextResponse.json(
        { error: "Invalid route data in session" },
        { status: 500 },
      );
    }

    // Validate stepIndex is within bounds
    if (!Array.isArray(route.steps) || stepIndex >= route.steps.length) {
      return NextResponse.json(
        { error: `Step ${stepIndex} not found` },
        { status: 400 },
      );
    }

    if (route.action) {
      return NextResponse.json(
        { error: "Selected route is an informational/official route and is not executable via this endpoint" },
        { status: 400 },
      );
    }

    const step = route.steps[stepIndex] as StoredRouteStep & {
      provider?: string;
      metadata?: Record<string, unknown>;
    };
    if (!step) {
      return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 400 });
    }

    // Verify route integrity
    const intent = {
      sourceChainId:
        executionContext?.sourceChainId ??
        step.chainId ??
        session.sourceChainId ??
        1,
      sourceTokenAddress: executionContext?.sourceTokenAddress ?? "native",
      sourceAmount: executionContext?.sourceAmountRaw ?? session.sourceAmount ?? "0",
      destinationTokenAddress:
        executionContext?.destinationTokenAddress ?? session.destToken ?? "SOL",
      sourceAddress: session.sourceAddress,
      solanaAddress: session.solanaAddress,
      slippage: executionContext?.slippage ?? 3,
    };

    const verificationResult = validateRouteForExecution(signedRoute, intent);
    if (!verificationResult.valid) {
      return NextResponse.json(
        { error: `Route verification failed: ${verificationResult.reason}` },
        { status: 403 },
      );
    }

    if (isChainExecutionDisabledByPolicy(step.chainType)) {
      return NextResponse.json(
        { error: formatNonEvmExecutionPolicyMessage([step.chainType]) },
        { status: 403 },
      );
    }

    const stepProviderName = step.provider ?? provider;

    // Extend intent with sourceChainType for the provider
    const intentWithChainType = {
      ...intent,
      sourceChainType:
        executionContext?.sourceChainType ??
        (step.chainType as "evm" | "bitcoin" | "cosmos" | "ton" | "solana"),
    };

    let txRequest;
    if (stepProviderName === "jupiter") {
      const meta = step.metadata ?? {};
      const inputMint = typeof meta.inputMint === "string" ? meta.inputMint : WSOL_MINT;
      const outputMint = typeof meta.outputMint === "string" ? meta.outputMint : intentWithChainType.destinationTokenAddress;
      const amountIn = typeof meta.amountIn === "string" ? meta.amountIn : intentWithChainType.sourceAmount;
      const slippageBps =
        typeof meta.slippageBps === "number"
          ? meta.slippageBps
          : Math.round((intent.slippage ?? 3) * 100);

      const quote = await getJupiterQuote({
        inputMint,
        outputMint,
        amount: amountIn,
        slippageBps,
      });
      if (!quote) {
        return NextResponse.json({ error: "Jupiter quote unavailable" }, { status: 400 });
      }

      const swapTx = await getJupiterSwapTransaction({
        quote,
        userPublicKey: intentWithChainType.solanaAddress,
      });

      txRequest = {
        kind: "solana",
        rpc:
          process.env.SOLANA_RPC_URL ||
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
          "https://api.mainnet-beta.solana.com",
        serializedTxBase64: swapTx,
      };
    } else {
      const bridgeProvider = getProvider(stepProviderName as any);
      txRequest = await bridgeProvider.getStepTx(routeId, stepIndex, intentWithChainType);
    }

    // Mark step as signing
    await updateStepStatus(sessionId, stepIndex, "signing");

    return NextResponse.json({
      sessionId,
      stepIndex,
      txRequest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Sanitize error message in production
    const sanitizedMessage = process.env.NODE_ENV === "production" 
      ? "An error occurred while processing your request" 
      : message;
    return NextResponse.json({ error: sanitizedMessage }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import {
  executeStepRequestSchema,
  createSessionRequestSchema,
  updateStepRequestSchema,
} from "@/server/schema";
import { getProvider } from "@/server/providers";
import { createSession, getSession, updateStepStatus } from "@/server/sessions";

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

export async function POST(request: Request) {
  try {
    // CSRF protection
    if (!verifyOrigin(request)) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    // Check if this is a "create session" request
    const createParsed = createSessionRequestSchema.safeParse(body);
    if (createParsed.success) {
      const session = await createSession(createParsed.data);
      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
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

    // Parse and validate stored route
    let route: { steps: { chainType: string; chainId?: number | string }[] };
    try {
      route = JSON.parse(session.selectedRouteJson) as typeof route;
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

    const step = route.steps[stepIndex];
    if (!step) {
      return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 400 });
    }

    const bridgeProvider = getProvider(provider);

    // We need the original intent to pass to the provider
    // Store it in the session or reconstruct from context
    // For now, we pass a minimal intent with session data
    const intent = {
      sourceChainId: step.chainId ?? session.sourceChainId ?? 1,
      sourceTokenAddress: "native",
      sourceAmount: session.sourceAmount ?? "0",
      destinationTokenAddress: session.destToken ?? "SOL",
      sourceAddress: session.sourceAddress,
      solanaAddress: session.solanaAddress,
      slippage: 3, // Default slippage for execute step
      sourceChainType: step.chainType as "evm" | "bitcoin" | "cosmos" | "ton" | "solana",
    };

    const txRequest = await bridgeProvider.getStepTx(routeId, stepIndex, intent);

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

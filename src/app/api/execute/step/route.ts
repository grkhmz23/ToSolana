import { NextResponse } from "next/server";
import {
  executeStepRequestSchema,
  createSessionRequestSchema,
  updateStepRequestSchema,
} from "@/server/schema";
import { getProvider } from "@/server/providers";
import { createSession, getSession, updateStepStatus } from "@/server/sessions";

export async function POST(request: Request) {
  try {
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

    // Reconstruct intent from session
    const route = JSON.parse(session.selectedRouteJson) as {
      steps: { chainType: string; chainId?: number }[];
    };
    const step = route.steps[stepIndex];
    if (!step) {
      return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 400 });
    }

    const bridgeProvider = getProvider(provider);

    // We need the original intent to pass to the provider
    // Store it in the session or reconstruct from context
    // For now, we pass a minimal intent
    const intent = {
      sourceChainId: step.chainId ?? 1,
      sourceTokenAddress: "native",
      sourceAmount: "0",
      destinationTokenAddress: "SOL",
      sourceAddress: session.sourceAddress,
      solanaAddress: session.solanaAddress,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { prisma } from "./db";
import type { ChainType, CreateSessionRequest, StepStatus } from "./schema";

// ---- History queries ----

export async function getSessionHistory(
  sourceAddress: string,
  solanaAddress: string,
  limit: number = 50,
  offset: number = 0,
) {
  const sessions = await prisma.quoteSession.findMany({
    where: {
      OR: [
        { sourceAddress: sourceAddress.toLowerCase() },
        { solanaAddress: solanaAddress.toLowerCase() },
      ],
      status: { in: ["completed", "failed"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: { steps: { orderBy: { index: "asc" } } },
  });
  return sessions;
}

export async function getSessionHistoryCount(
  sourceAddress: string,
  solanaAddress: string,
) {
  return prisma.quoteSession.count({
    where: {
      OR: [
        { sourceAddress: sourceAddress.toLowerCase() },
        { solanaAddress: solanaAddress.toLowerCase() },
      ],
      status: { in: ["completed", "failed"] },
    },
  });
}

export async function createSession(req: CreateSessionRequest) {
  const session = await prisma.quoteSession.create({
    data: {
      sourceAddress: req.sourceAddress,
      solanaAddress: req.solanaAddress,
      provider: req.provider,
      routeId: req.routeId,
      status: "quoted",
      selectedRouteJson: JSON.stringify({
        route: req.route,
        executionContext: req.executionContext,
      }),
      currentStep: 0,
      // History fields
      sourceChainId: String(req.sourceChainId),
      sourceToken: req.sourceToken,
      sourceAmount: req.sourceAmount,
      destToken: req.destToken,
      estimatedOutput: req.route.estimatedOutput.amount,
      steps: {
        create: req.route.steps.map((step, index) => ({
          index,
          chainType: step.chainType,
          status: "idle",
          metaJson: JSON.stringify(step),
        })),
      },
    },
    include: { steps: true },
  });
  return session;
}

export async function getSession(sessionId: string) {
  return prisma.quoteSession.findUnique({
    where: { id: sessionId },
    include: { steps: { orderBy: { index: "asc" } } },
  });
}

type ParsedStepMeta = {
  chainType?: ChainType;
  chainId?: number | string;
};

function parseStepMeta(metaJson: string | null): ParsedStepMeta {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const candidate = parsed as { chainType?: unknown; chainId?: unknown };
    return {
      chainType:
        candidate.chainType === "evm" ||
        candidate.chainType === "solana" ||
        candidate.chainType === "bitcoin" ||
        candidate.chainType === "cosmos" ||
        candidate.chainType === "ton"
          ? candidate.chainType
          : undefined,
      chainId:
        typeof candidate.chainId === "number" || typeof candidate.chainId === "string"
          ? candidate.chainId
          : undefined,
    };
  } catch {
    return {};
  }
}

function isServerConfirmableChainType(chainType: string): chainType is "evm" | "solana" {
  return chainType === "evm" || chainType === "solana";
}

export async function reconcileSessionFinality(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return null;

  if (session.status === "completed" || session.status === "failed") {
    return session;
  }

  const pendingSubmittedSteps = session.steps.filter(
    (step) => step.status === "submitted" && !!step.txHashOrSig,
  );

  if (pendingSubmittedSteps.length === 0) {
    return session;
  }

  const { verifyTxFinality } = await import("@/server/tx-finality");
  let changed = false;

  for (const step of pendingSubmittedSteps) {
    if (!step.txHashOrSig) continue;

    const meta = parseStepMeta(step.metaJson);
    const chainType = (meta.chainType ?? step.chainType) as string;
    if (!isServerConfirmableChainType(chainType)) {
      continue;
    }

    const verification = await verifyTxFinality({
      chainType,
      chainId: meta.chainId,
      txHashOrSig: step.txHashOrSig,
      expectedEvmSender: chainType === "evm" ? session.sourceAddress : undefined,
    });

    if (!verification.ok) {
      continue;
    }

    await updateStepStatus(session.id, step.index, "confirmed", step.txHashOrSig);
    changed = true;
  }

  if (!changed) {
    return session;
  }

  return getSession(sessionId);
}

export async function updateSessionStatus(sessionId: string, status: StepStatus, error?: string) {
  return prisma.quoteSession.update({
    where: { id: sessionId },
    data: {
      status,
      ...(error ? { errorMessage: error } : {}),
    },
  });
}

export async function updateStepStatus(
  sessionId: string,
  stepIndex: number,
  status: StepStatus,
  txHashOrSig?: string,
) {
  const step = await prisma.step.update({
    where: { sessionId_index: { sessionId, index: stepIndex } },
    data: {
      status,
      ...(txHashOrSig ? { txHashOrSig } : {}),
    },
  });

  // Advance session currentStep if step is completed
  if (status === "confirmed" || status === "completed") {
    const session = await prisma.quoteSession.findUnique({
      where: { id: sessionId },
      include: { steps: { orderBy: { index: "asc" } } },
    });
    if (session) {
      const allDone = session.steps.every(
        (s) => s.status === "confirmed" || s.status === "completed",
      );
      await prisma.quoteSession.update({
        where: { id: sessionId },
        data: {
          currentStep: stepIndex + 1,
          status: allDone ? "completed" : "bridging",
          ...(allDone ? { completedAt: new Date() } : {}),
        },
      });
    }
  }

  if (status === "failed") {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: { status: "failed", errorMessage: `Step ${stepIndex} failed` },
    });
  }

  return step;
}

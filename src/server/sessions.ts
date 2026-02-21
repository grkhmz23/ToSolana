import { prisma } from "./db";
import type { CreateSessionRequest, StepStatus } from "./schema";

export async function createSession(req: CreateSessionRequest) {
  const session = await prisma.quoteSession.create({
    data: {
      sourceAddress: req.sourceAddress,
      solanaAddress: req.solanaAddress,
      provider: req.provider,
      routeId: req.routeId,
      status: "quoted",
      selectedRouteJson: JSON.stringify(req.route),
      currentStep: 0,
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

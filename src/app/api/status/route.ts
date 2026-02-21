import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/sessions";

const statusQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = statusQuerySchema.safeParse({
      sessionId: searchParams.get("sessionId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid sessionId parameter" },
        { status: 400 },
      );
    }

    const session = await getSession(parsed.data.sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      currentStep: session.currentStep,
      errorMessage: session.errorMessage,
      steps: session.steps.map((s) => ({
        index: s.index,
        chainType: s.chainType,
        status: s.status,
        txHashOrSig: s.txHashOrSig,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

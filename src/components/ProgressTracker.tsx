"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { useWalletClient, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type { NormalizedRoute, StatusResponse, TxRequest } from "@/server/schema";
import { shortenAddress } from "@/lib/format";

interface ProgressTrackerProps {
  route: NormalizedRoute;
  sourceAddress: string;
  solanaAddress: string;
}

type SessionState = {
  sessionId: string | null;
  isExecuting: boolean;
  error: string | null;
  currentStepIndex: number;
  completed: boolean;
};

export function ProgressTracker({ route, sourceAddress, solanaAddress }: ProgressTrackerProps) {
  const { signTransaction } = useWallet();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isExecuting: false,
    error: null,
    currentStepIndex: 0,
    completed: false,
  });

  // Poll session status
  const { data: statusData } = useQuery<StatusResponse>({
    queryKey: ["session-status", state.sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/status?sessionId=${state.sessionId}`);
      return (await res.json()) as StatusResponse;
    },
    enabled: !!state.sessionId,
    refetchInterval: state.isExecuting ? 3000 : false,
  });

  const createSession = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/execute/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAddress,
        solanaAddress,
        provider: route.provider,
        routeId: route.routeId,
        route,
      }),
    });
    const data = (await res.json()) as { sessionId: string; error?: string };
    if (!res.ok || !data.sessionId) {
      throw new Error(data.error ?? "Failed to create session");
    }
    return data.sessionId;
  }, [route, sourceAddress, solanaAddress]);

  const executeStep = useCallback(
    async (sessionId: string, stepIndex: number) => {
      // 1. Get tx request from backend
      const res = await fetch("/api/execute/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          provider: route.provider,
          routeId: route.routeId,
          stepIndex,
        }),
      });
      const data = (await res.json()) as { txRequest: TxRequest; error?: string };
      if (!res.ok || !data.txRequest) {
        throw new Error(data.error ?? "Failed to get transaction");
      }

      const { txRequest } = data;
      let txHashOrSig: string;

      if (txRequest.kind === "evm") {
        // EVM: sign and send via wagmi
        if (!walletClient) throw new Error("EVM wallet not connected");
        txHashOrSig = await walletClient.sendTransaction({
          to: txRequest.to as `0x${string}`,
          data: (txRequest.data as `0x${string}`) ?? undefined,
          value: txRequest.value ? BigInt(txRequest.value) : undefined,
          chain: undefined,
        });

        // Update step as submitted
        await fetch("/api/execute/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            stepIndex,
            status: "submitted",
            txHashOrSig,
          }),
        });

        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: txHashOrSig as `0x${string}`,
          });
        }

        // Mark confirmed
        await fetch("/api/execute/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            stepIndex,
            status: "confirmed",
            txHashOrSig,
          }),
        });
      } else {
        // Solana: deserialize VersionedTransaction, sign, send
        if (!signTransaction) throw new Error("Solana wallet not connected");

        const txBuffer = Buffer.from(txRequest.serializedTxBase64, "base64");
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        const signedTx = await signTransaction(versionedTx);
        const serialized = signedTx.serialize();

        const connection = new Connection(
          txRequest.rpc || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        );

        txHashOrSig = await connection.sendRawTransaction(serialized, {
          skipPreflight: false,
          maxRetries: 3,
        });

        // Update step as submitted
        await fetch("/api/execute/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            stepIndex,
            status: "submitted",
            txHashOrSig,
          }),
        });

        // Poll for confirmation
        const confirmation = await connection.confirmTransaction(txHashOrSig, "confirmed");
        if (confirmation.value.err) {
          throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        await fetch("/api/execute/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            stepIndex,
            status: "confirmed",
            txHashOrSig,
          }),
        });
      }
    },
    [route.provider, route.routeId, walletClient, publicClient, signTransaction],
  );

  const startTransfer = useCallback(async () => {
    setState((s) => ({ ...s, isExecuting: true, error: null }));

    try {
      const sessionId = await createSession();
      setState((s) => ({ ...s, sessionId }));

      for (let i = 0; i < route.steps.length; i++) {
        setState((s) => ({ ...s, currentStepIndex: i }));
        await executeStep(sessionId, i);
      }

      setState((s) => ({ ...s, completed: true, isExecuting: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, error: message, isExecuting: false }));
    }
  }, [createSession, executeStep, route.steps.length]);

  // Sync state from poll
  useEffect(() => {
    if (statusData?.status === "completed") {
      setState((s) => ({ ...s, completed: true, isExecuting: false }));
    }
    if (statusData?.status === "failed") {
      setState((s) => ({
        ...s,
        error: statusData.errorMessage ?? "Transfer failed",
        isExecuting: false,
      }));
    }
  }, [statusData]);

  const stepStatuses = statusData?.steps ?? route.steps.map((_, i) => ({
    index: i,
    chainType: route.steps[i].chainType,
    status: "idle" as const,
    txHashOrSig: null,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">Transfer Progress</h3>

      {/* Summary */}
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--muted)]">Provider</span>
          <span className="font-medium">{route.provider.toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted)]">Estimated receive</span>
          <span className="font-medium text-[var(--accent)]">
            {route.estimatedOutput.amount} {route.estimatedOutput.token}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted)]">Steps</span>
          <span>{route.steps.length} signature{route.steps.length !== 1 ? "s" : ""}</span>
        </div>
        {route.fees.length > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Fees</span>
            <span>{route.fees.map((f) => `${f.amount} ${f.token}`).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {stepStatuses.map((step) => {
          const routeStep = route.steps[step.index];
          const isActive = state.currentStepIndex === step.index && state.isExecuting;
          return (
            <div
              key={step.index}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                step.status === "confirmed" || step.status === "completed"
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : step.status === "failed"
                    ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
                    : isActive
                      ? "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                      : "border-[var(--card-border)] bg-[var(--card)]"
              }`}
            >
              {/* Status icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)]">
                {step.status === "confirmed" || step.status === "completed" ? (
                  <svg viewBox="0 0 20 20" fill="var(--accent)" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : step.status === "failed" ? (
                  <span className="text-xs text-[var(--danger)]">✕</span>
                ) : isActive ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                ) : (
                  <span className="text-xs text-[var(--muted)]">{step.index + 1}</span>
                )}
              </div>

              {/* Step info */}
              <div className="flex-1">
                <div className="text-sm font-medium">{routeStep?.description ?? `Step ${step.index + 1}`}</div>
                <div className="text-xs text-[var(--muted)]">
                  {step.chainType.toUpperCase()}
                  {step.status !== "idle" && ` · ${step.status}`}
                </div>
                {step.txHashOrSig && (
                  <div className="mt-1 text-xs text-[var(--primary)]">
                    TX: {shortenAddress(step.txHashOrSig, 8)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action / Status */}
      {state.completed && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 p-4 text-center">
          <p className="text-sm font-semibold text-[var(--accent)]">Transfer Completed!</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Assets have been bridged to your Solana wallet.
          </p>
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      {!state.sessionId && !state.completed && (
        <button
          onClick={startTransfer}
          disabled={state.isExecuting}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {state.isExecuting ? "Executing..." : "Start Transfer"}
        </button>
      )}
    </div>
  );
}

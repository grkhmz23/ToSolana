"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { useWalletClient, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type {
  NormalizedRoute,
  SessionAuthProof,
  SessionAuthChallenge,
  StatusResponse,
  TxRequest,
} from "@/server/schema";
import { shortenAddress } from "@/lib/format";
import { getChainType } from "@/lib/chains";
import {
  formatNonEvmExecutionPolicyMessage,
  getRoutePolicyBlockedChainTypes,
  isChainExecutionDisabledByPolicy,
} from "@/lib/execution-policy";
import { useToast } from "@/hooks/useToast";
import { NonEvmTransactionModal } from "./NonEvmTransactionModal";

interface ProgressTrackerProps {
  route: NormalizedRoute;
  sourceAddress: string;
  solanaAddress: string;
  // History fields
  sourceChainId: number | string;
  sourceToken: string;
  sourceAmount: string;
  sourceAmountDisplay?: string;
  destToken: string;
  slippage?: number;
}

type SessionState = {
  sessionId: string | null;
  sessionAuth: SessionAuthProof | null;
  isExecuting: boolean;
  error: string | null;
  currentStepIndex: number;
  completed: boolean;
};

type NonEvmTxState = {
  isOpen: boolean;
  txRequest: TxRequest | null;
  stepIndex: number;
  stepDescription: string;
};

export function ProgressTracker({ 
  route, 
  sourceAddress, 
  solanaAddress,
  sourceChainId,
  sourceToken,
  sourceAmount,
  sourceAmountDisplay,
  destToken,
  slippage,
}: ProgressTrackerProps) {
  const { signTransaction } = useWallet();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { success, error: showError, info } = useToast();

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    sessionAuth: null,
    isExecuting: false,
    error: null,
    currentStepIndex: 0,
    completed: false,
  });
  
  // Track previously completed steps for toast notifications
  const [notifiedSteps, setNotifiedSteps] = useState<Set<number>>(new Set());
  
  // Non-EVM transaction modal state
  const [nonEvmTx, setNonEvmTx] = useState<NonEvmTxState>({
    isOpen: false,
    txRequest: null,
    stepIndex: 0,
    stepDescription: "",
  });

  // Poll session status with max duration
  const { data: statusData } = useQuery<StatusResponse>({
    queryKey: ["session-status", state.sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/status?sessionId=${state.sessionId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch status");
      }
      return (await res.json()) as StatusResponse;
    },
    enabled: !!state.sessionId,
    refetchInterval: (query) => {
      // Stop polling if session is completed or failed
      const data = query.state.data;
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      return state.sessionId ? 3000 : false;
    },
    staleTime: 2000,
    retry: 2,
  });

  const signSessionAuthChallenge = useCallback(
    async (challenge: SessionAuthChallenge): Promise<SessionAuthProof> => {
      if (challenge.scheme !== "evm") {
        throw new Error(`Unsupported session auth scheme: ${challenge.scheme}`);
      }
      if (!walletClient) {
        throw new Error("EVM wallet not connected");
      }

      const signature = await walletClient.signMessage({
        account: sourceAddress as `0x${string}`,
        message: challenge.message,
      });

      return {
        scheme: challenge.scheme,
        challenge: challenge.challenge,
        message: challenge.message,
        signature,
      };
    },
    [walletClient, sourceAddress],
  );

  const createSession = useCallback(async (): Promise<{
    sessionId: string;
    sessionAuth: SessionAuthProof;
  }> => {
    const res = await fetch("/api/execute/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAddress,
        solanaAddress,
        provider: route.provider,
        routeId: route.routeId,
        route,
        // History fields
        sourceChainId,
        sourceToken,
        sourceAmount: sourceAmountDisplay ?? sourceAmount,
        destToken,
        executionContext: {
          sourceChainId,
          sourceChainType: getChainType(sourceChainId),
          sourceTokenAddress: sourceToken,
          destinationTokenAddress: destToken,
          sourceAmountRaw: sourceAmount,
          slippage: slippage ?? 3,
        },
      }),
    });
    const data = (await res.json()) as {
      sessionId?: string;
      error?: string;
      sessionAuthChallenge?: SessionAuthChallenge;
    };
    if (!res.ok || !data.sessionId) {
      throw new Error(data.error ?? "Failed to create session");
    }
    if (!data.sessionAuthChallenge) {
      throw new Error("Session auth challenge missing");
    }

    const sessionAuth = await signSessionAuthChallenge(data.sessionAuthChallenge);
    return { sessionId: data.sessionId, sessionAuth };
  }, [
    route,
    sourceAddress,
    solanaAddress,
    sourceChainId,
    sourceToken,
    sourceAmount,
    sourceAmountDisplay,
    destToken,
    slippage,
    signSessionAuthChallenge,
  ]);

  const postStepStatusUpdate = useCallback(
    async (payload: {
      sessionId: string;
      stepIndex: number;
      status: "submitted" | "failed";
      txHashOrSig?: string;
      sessionAuth: SessionAuthProof;
    }) => {
      const res = await fetch("/api/execute/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          provider: route.provider,
          routeId: route.routeId,
          stepIndex: payload.stepIndex,
          status: payload.status,
          txHashOrSig: payload.txHashOrSig,
          sessionAuth: payload.sessionAuth,
        }),
      });

      if (!res.ok) {
        const error = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
          error?: string;
        };
        throw new Error(error.error ?? `Failed to update step status: ${payload.status}`);
      }
    },
    [route.provider, route.routeId],
  );

  const executeStep = useCallback(
    async (sessionId: string, stepIndex: number, sessionAuth: SessionAuthProof) => {
      const stepInfo = route.steps[stepIndex];
      const stepName = stepInfo?.description ?? `Step ${stepIndex + 1}`;

      if (stepInfo && isChainExecutionDisabledByPolicy(stepInfo.chainType)) {
        throw new Error(formatNonEvmExecutionPolicyMessage([stepInfo.chainType]));
      }
      
      // 1. Get tx request from backend
      const res = await fetch("/api/execute/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          provider: route.provider,
          routeId: route.routeId,
          stepIndex,
          sessionAuth,
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
        if (txRequest.chainId && walletClient.chain?.id && walletClient.chain.id !== txRequest.chainId) {
          throw new Error(`Please switch your wallet to chain ${txRequest.chainId} before continuing`);
        }
        txHashOrSig = await walletClient.sendTransaction({
          to: txRequest.to as `0x${string}`,
          data: (txRequest.data as `0x${string}`) ?? undefined,
          value: txRequest.value ? BigInt(txRequest.value) : undefined,
          chain: undefined,
        });

        // Update step as submitted
        await postStepStatusUpdate({
          sessionId,
          stepIndex,
          status: "submitted",
          txHashOrSig,
          sessionAuth,
        });

        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: txHashOrSig as `0x${string}`,
          });
        }

        // Show success toast
        success(`${stepName} confirmed locally`, `Waiting for server confirmation sync`);
      } else {
        // Handle different transaction types
        if (txRequest.kind === "solana") {
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
          await postStepStatusUpdate({
            sessionId,
            stepIndex,
            status: "submitted",
            txHashOrSig,
            sessionAuth,
          });

          // Poll for confirmation with timeout
          const confirmation = await Promise.race([
            connection.confirmTransaction(txHashOrSig, "confirmed"),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Solana confirmation timeout")), 60000)
            ),
          ]);
          if (confirmation.value.err) {
            throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }

          success(`${stepName} confirmed locally`, `Waiting for server confirmation sync`);
        } else if (txRequest.kind === "bitcoin" || txRequest.kind === "cosmos" || txRequest.kind === "ton") {
          // Non-EVM: Show transaction modal for wallet signing
          setNonEvmTx({
            isOpen: true,
            txRequest,
            stepIndex,
            stepDescription: stepName,
          });
          
          // Wait for user to complete the transaction via the modal
          // This is handled by the NonEvmTransactionModal component
          throw new Error(`Please confirm the ${txRequest.kind} transaction in your wallet`);
        } else {
          throw new Error(`Unsupported transaction type: ${(txRequest as TxRequest).kind}`);
        }
      }
    },
    [
      route.provider,
      route.routeId,
      route.steps,
      walletClient,
      publicClient,
      signTransaction,
      success,
      postStepStatusUpdate,
    ],
  );

  const startTransfer = useCallback(async () => {
    const blockedChains = getRoutePolicyBlockedChainTypes(route.steps);
    if (blockedChains.length > 0) {
      const message = formatNonEvmExecutionPolicyMessage(blockedChains);
      setState((s) => ({ ...s, error: message, isExecuting: false }));
      showError("Route Execution Disabled", message);
      return;
    }

    setState((s) => ({ ...s, isExecuting: true, error: null }));
    setNotifiedSteps(new Set()); // Reset notifications
    
    // Show starting toast
    info(
      "Starting bridge transfer...",
      `${route.steps.length} step${route.steps.length > 1 ? "s" : ""} to complete`
    );

    try {
      const { sessionId, sessionAuth } = await createSession();
      setState((s) => ({ ...s, sessionId, sessionAuth }));

      for (let i = 0; i < route.steps.length; i++) {
        setState((s) => ({ ...s, currentStepIndex: i }));
        await executeStep(sessionId, i, sessionAuth);
      }

      setState((s) => ({ ...s, isExecuting: false }));
      info("Transactions submitted", "Waiting for server-verified confirmations");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, error: message, isExecuting: false }));
      
      // Show error toast
      showError("Transfer failed", message);
    }
  }, [createSession, executeStep, route.steps, showError, info]);

  // Sync state from poll and show notifications for step completions
  useEffect(() => {
    if (!statusData) return;
    
    if (statusData.status === "completed") {
      setState((s) => ({ ...s, completed: true, isExecuting: false }));
      
      // Show completion toast if not already notified
      if (!notifiedSteps.has(999)) { // Use 999 to indicate final completion
        success(
          "Transfer completed!",
          `Assets successfully delivered to destination`
        );
        setNotifiedSteps((prev) => new Set([...prev, 999]));
      }
    }
    
    if (statusData.status === "failed") {
      setState((s) => ({
        ...s,
        error: statusData.errorMessage ?? "Transfer failed",
        isExecuting: false,
      }));
      
      // Show error toast if not already notified
      if (!notifiedSteps.has(-1)) { // Use -1 to indicate error
        showError("Transfer failed", statusData.errorMessage ?? "Unknown error");
        setNotifiedSteps((prev) => new Set([...prev, -1]));
      }
    }
    
    // Notify for individual step completions from polling
    statusData.steps?.forEach((step) => {
      if (
        (step.status === "confirmed" || step.status === "completed") &&
        !notifiedSteps.has(step.index)
      ) {
        const stepName = route.steps[step.index]?.description ?? `Step ${step.index + 1}`;
        success(`${stepName} confirmed`, `${step.chainType.toUpperCase()} transaction successful`);
        setNotifiedSteps((prev) => new Set([...prev, step.index]));
      }
    });
  }, [statusData, route.steps, success, showError, notifiedSteps]);

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

      {/* Non-EVM Transaction Modal */}
      <NonEvmTransactionModal
        isOpen={nonEvmTx.isOpen}
        onClose={() => setNonEvmTx((s) => ({ ...s, isOpen: false }))}
        txRequest={nonEvmTx.txRequest}
        stepDescription={nonEvmTx.stepDescription}
        onSuccess={async (txHash) => {
          if (!state.sessionId || !state.sessionAuth) return;
          try {
            await postStepStatusUpdate({
              sessionId: state.sessionId,
              stepIndex: nonEvmTx.stepIndex,
              status: "submitted",
              txHashOrSig: txHash,
              sessionAuth: state.sessionAuth,
            });

            info(
              "Transaction submitted",
              `${nonEvmTx.txRequest?.kind} finality will update when server verification is supported`,
            );
            
            // Close modal
            setNonEvmTx({ isOpen: false, txRequest: null, stepIndex: 0, stepDescription: "" });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update transaction status";
            showError("Transaction status update failed", message);
            setState((s) => ({ ...s, error: message, isExecuting: false }));
          }
        }}
        onError={(error) => {
          showError("Transaction failed", error.message);
          setState((s) => ({ ...s, error: error.message, isExecuting: false }));
        }}
      />
    </div>
  );
}

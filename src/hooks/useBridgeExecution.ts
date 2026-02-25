"use client";

import { useCallback, useState } from "react";
import {
  useSendTransaction,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, Connection } from "@solana/web3.js";
import { useWalletContext } from "./useWalletContext";
import { useNonEvmWallet } from "./useNonEvmWallet";
import { useToast } from "./useToast";
import type {
  NormalizedRoute,
  SessionAuthChallenge,
  SessionAuthProof,
  StatusResponse,
  TxRequest,
} from "@/server/schema";
import {
  formatNonEvmExecutionPolicyMessage,
  getRoutePolicyBlockedChainTypes,
} from "@/lib/execution-policy";
import { getUserFriendlyErrorMessage, isRetryableError } from "@/lib/error-messages";

interface ExecuteStepResponse {
  sessionId: string;
  stepIndex: number;
  txRequest: TxRequest;
}

interface CreateSessionResponse {
  sessionId: string;
  status: string;
  sessionAuthChallenge?: SessionAuthChallenge;
  error?: string;
}

interface BridgeSession {
  id: string;
  status: string;
  currentStep: number;
  provider: NormalizedRoute["provider"];
  routeId: string;
  sessionAuth: SessionAuthProof;
}

interface ExecuteBridgeParams {
  sourceChainId: number | string;
  sourceChainType: "evm" | "bitcoin" | "cosmos" | "ton";
  sourceAmountDisplay: string;
  sourceAmountRaw: string;
  sourceTokenSymbol: string;
  sourceTokenAddress: string;
  destTokenSymbol: string;
  destTokenAddress: string;
  slippage: number;
}

export function useBridgeExecution() {
  const { sourceWallet, destWallet, sourceChain } = useWalletContext();
  const { bitcoinWallet, cosmosWallet, tonWallet } = useNonEvmWallet();
  const solanaWallet = useSolanaWallet();
  const { success, error: showError, info } = useToast();
  
  const { sendTransactionAsync: sendEvmTx } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentSession, setCurrentSession] = useState<BridgeSession | null>(null);

  const waitForServerStepConfirmation = useCallback(async (
    sessionId: string,
    stepIndex: number,
    timeoutMs: number = 180_000,
  ): Promise<void> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const res = await fetch(`/api/status?sessionId=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = (await res.json()) as StatusResponse;
        const step = data.steps.find((s) => s.index === stepIndex);

        if (data.status === "failed" || step?.status === "failed") {
          throw new Error(data.errorMessage ?? `Step ${stepIndex + 1} failed`);
        }

        if (step && (step.status === "confirmed" || step.status === "completed")) {
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error(`Timed out waiting for server confirmation for step ${stepIndex + 1}`);
  }, []);

  const signSessionAuthChallenge = useCallback(
    async (challenge: SessionAuthChallenge): Promise<SessionAuthProof> => {
      if (challenge.scheme !== "evm") {
        throw new Error(`Unsupported session auth scheme: ${challenge.scheme}`);
      }

      if (sourceChain?.type !== "evm") {
        throw new Error("Session auth currently supports EVM source wallets only");
      }

      if (!sourceWallet.address) {
        throw new Error("Source wallet not connected");
      }

      if (!walletClient) {
        throw new Error("EVM wallet client not ready");
      }

      const signature = await walletClient.signMessage({
        account: sourceWallet.address as `0x${string}`,
        message: challenge.message,
      });

      return {
        scheme: challenge.scheme,
        challenge: challenge.challenge,
        message: challenge.message,
        signature,
      };
    },
    [walletClient, sourceChain?.type, sourceWallet.address],
  );

  // Create a new bridge session
  const createSession = useCallback(async (
    route: NormalizedRoute,
    params: ExecuteBridgeParams,
  ): Promise<{ sessionId: string; sessionAuth: SessionAuthProof } | null> => {
    if (!sourceWallet.address || !destWallet.address || !sourceChain) {
      showError("Wallets not connected");
      return null;
    }

    try {
      const response = await fetch("/api/execute/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAddress: sourceWallet.address,
          solanaAddress: destWallet.address,
          provider: route.provider,
          routeId: route.routeId,
          route: route,
          sourceChainId: params.sourceChainId,
          sourceToken: params.sourceTokenAddress,
          sourceAmount: params.sourceAmountDisplay,
          destToken: params.destTokenAddress,
          executionContext: {
            sourceChainId: params.sourceChainId,
            sourceChainType: params.sourceChainType,
            sourceTokenAddress: params.sourceTokenAddress,
            destinationTokenAddress: params.destTokenAddress,
            sourceAmountRaw: params.sourceAmountRaw,
            slippage: params.slippage,
          },
        }),
      });

      const data = (await response.json()) as CreateSessionResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      if (!data.sessionAuthChallenge) {
        throw new Error("Session auth challenge missing from server response");
      }

      const sessionAuth = await signSessionAuthChallenge(data.sessionAuthChallenge);

      setCurrentSession({
        id: data.sessionId,
        status: data.status,
        currentStep: 0,
        provider: route.provider,
        routeId: route.routeId,
        sessionAuth,
      });
      
      return { sessionId: data.sessionId, sessionAuth };
    } catch (err) {
      const { title, message } = getUserFriendlyErrorMessage(err);
      showError(title, message);
      return null;
    }
  }, [
    sourceWallet.address,
    destWallet.address,
    sourceChain,
    showError,
    signSessionAuthChallenge,
  ]);

  // Execute an EVM transaction
  const executeEvmTx = useCallback(async (txRequest: TxRequest & { kind: "evm" }) => {
    if (!sendEvmTx) {
      throw new Error("EVM wallet not ready");
    }

    try {
      // Switch to correct chain if needed
      if (txRequest.chainId) {
        await switchChainAsync?.({ chainId: txRequest.chainId });
      }

      const txHash = await sendEvmTx({
        to: txRequest.to as `0x${string}`,
        data: txRequest.data as `0x${string}` | undefined,
        value: txRequest.value ? BigInt(txRequest.value) : undefined,
      });

      return txHash;
    } catch (err) {
      if (err instanceof Error && err.message.includes("rejected")) {
        throw new Error("Transaction rejected by user");
      }
      throw err;
    }
  }, [sendEvmTx, switchChainAsync]);

  // Execute a Solana transaction
  const executeSolanaTx = useCallback(async (txRequest: TxRequest & { kind: "solana" }) => {
    if (!solanaWallet.signTransaction) {
      throw new Error("Solana wallet does not support transaction signing");
    }

    try {
      // Deserialize the transaction
      const txBuffer = Buffer.from(txRequest.serializedTxBase64, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Sign the transaction
      const signed = await solanaWallet.signTransaction(transaction);

      // Send the transaction
      const connection = new Connection(txRequest.rpc, "confirmed");
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        maxRetries: 3,
        skipPreflight: false,
      });

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      return signature;
    } catch (err) {
      if (err instanceof Error && err.message.includes("rejected")) {
        throw new Error("Transaction rejected by user");
      }
      throw err;
    }
  }, [solanaWallet]);

  // Execute a Bitcoin transaction
  const executeBitcoinTx = useCallback(async (txRequest: TxRequest & { kind: "bitcoin" }) => {
    if (!bitcoinWallet) {
      throw new Error("Bitcoin wallet not connected");
    }

    try {
      // For Bitcoin, we need to sign PSBT
      // This is a simplified version - real implementation would need more handling
      const signedPsbt = await bitcoinWallet.signTransaction?.(txRequest.psbtBase64);
      
      if (!signedPsbt) {
        throw new Error("Failed to sign Bitcoin transaction");
      }

      // Return the signed PSBT (would be submitted to network in real implementation)
      return signedPsbt as string;
    } catch (err) {
      if (err instanceof Error && err.message.includes("rejected")) {
        throw new Error("Transaction rejected by user");
      }
      throw err;
    }
  }, [bitcoinWallet]);

  // Execute a Cosmos transaction
  const executeCosmosTx = useCallback(async (txRequest: TxRequest & { kind: "cosmos" }) => {
    if (!cosmosWallet) {
      throw new Error("Cosmos wallet not connected");
    }

    try {
      // Cosmos transactions would be signed and broadcast here
      // This requires the specific wallet adapter to implement signTransaction
      const result = await cosmosWallet.signTransaction?.(txRequest);
      
      if (!result) {
        throw new Error("Failed to sign Cosmos transaction");
      }

      return JSON.stringify(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes("rejected")) {
        throw new Error("Transaction rejected by user");
      }
      throw err;
    }
  }, [cosmosWallet]);

  // Execute a TON transaction
  const executeTonTx = useCallback(async (txRequest: TxRequest & { kind: "ton" }) => {
    if (!tonWallet) {
      throw new Error("TON wallet not connected");
    }

    try {
      const result = await tonWallet.signTransaction?.(txRequest);
      
      if (!result) {
        throw new Error("Failed to send TON transaction");
      }

      return JSON.stringify(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes("rejected")) {
        throw new Error("Transaction rejected by user");
      }
      throw err;
    }
  }, [tonWallet]);

  // Execute a single step
  const postStepStatusUpdate = useCallback(async (payload: {
    sessionId: string;
    provider: NormalizedRoute["provider"];
    routeId: string;
    stepIndex: number;
    status: "submitted" | "failed";
    txHashOrSig?: string;
    sessionAuth: SessionAuthProof;
  }) => {
    const response = await fetch("/api/execute/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: "Unknown error" }))) as {
        error?: string;
      };
      throw new Error(error.error ?? `Failed to update step status: ${payload.status}`);
    }
  }, []);

  const executeStep = useCallback(async (
    sessionId: string,
    provider: NormalizedRoute["provider"],
    routeId: string,
    stepIndex: number,
    sessionAuth: SessionAuthProof,
  ): Promise<string | null> => {
    try {
      // Get the transaction request from the server
      const response = await fetch("/api/execute/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, provider, routeId, stepIndex, sessionAuth }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get transaction");
      }

      const data: ExecuteStepResponse = await response.json();
      const { txRequest } = data;

      info("Confirm Transaction", "Please confirm the transaction in your wallet");

      // Execute based on transaction type
      let txHash: string;

      switch (txRequest.kind) {
        case "evm":
          txHash = await executeEvmTx(txRequest);
          break;
        case "solana":
          txHash = await executeSolanaTx(txRequest);
          break;
        case "bitcoin":
          txHash = await executeBitcoinTx(txRequest);
          break;
        case "cosmos":
          txHash = await executeCosmosTx(txRequest);
          break;
        case "ton":
          txHash = await executeTonTx(txRequest);
          break;
        default:
          throw new Error(`Unsupported transaction type: ${(txRequest as {kind: string}).kind}`);
      }

      // Update step status on server
      await postStepStatusUpdate({
        sessionId,
        provider,
        routeId,
        stepIndex,
        status: "submitted",
        txHashOrSig: txHash,
        sessionAuth,
      });

      if (txRequest.kind === "evm" || txRequest.kind === "solana") {
        await waitForServerStepConfirmation(sessionId, stepIndex);
        success("Transaction Confirmed", `Transaction hash: ${txHash.slice(0, 10)}...`);
      } else {
        success("Transaction Submitted", `Transaction hash: ${txHash.slice(0, 10)}...`);
      }
      
      return txHash;
    } catch (err) {
      const { title, message } = getUserFriendlyErrorMessage(err);
      showError(title, message);
      
      // Update step status to failed
      try {
        await postStepStatusUpdate({
          sessionId,
          provider,
          routeId,
          stepIndex,
          status: "failed",
          sessionAuth,
        });
      } catch {
        // Preserve original execution error shown above.
      }
      
      return null;
    }
  }, [
    executeEvmTx,
    executeSolanaTx,
    executeBitcoinTx,
    executeCosmosTx,
    executeTonTx,
    info,
    success,
    showError,
    postStepStatusUpdate,
    waitForServerStepConfirmation,
  ]);

  // Execute the full bridge (all steps)
  const executeBridge = useCallback(async (
    route: NormalizedRoute,
    params: ExecuteBridgeParams,
  ): Promise<boolean> => {
    const blockedChains = getRoutePolicyBlockedChainTypes(route.steps);
    if (blockedChains.length > 0) {
      showError("Route Execution Disabled", formatNonEvmExecutionPolicyMessage(blockedChains));
      return false;
    }

    setIsExecuting(true);
    
    try {
      // Create session
      const session = await createSession(route, params);
      if (!session) {
        return false;
      }
      const { sessionId, sessionAuth } = session;

      info("Bridge Started", `Session created: ${sessionId.slice(0, 8)}...`);

      // Execute each step
      for (let i = 0; i < route.steps.length; i++) {
        setCurrentSession(prev => prev ? { ...prev, currentStep: i } : null);
        
        const txHash = await executeStep(sessionId, route.provider, route.routeId, i, sessionAuth);
        if (!txHash) {
          return false;
        }

        // Wait a bit between steps if there are more
        if (i < route.steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      success("Transactions Submitted", "Waiting for server-verified confirmations");
      return true;
    } catch (err) {
      const { title, message } = getUserFriendlyErrorMessage(err);
      showError(title, message);
      return false;
    } finally {
      setIsExecuting(false);
      setCurrentSession(null);
    }
  }, [createSession, executeStep, info, success, showError]);

  return {
    executeBridge,
    executeStep,
    createSession,
    isExecuting,
    currentSession,
  };
}

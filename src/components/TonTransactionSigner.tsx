"use client";

import { useState, useCallback } from "react";
import { useTonWallet } from "@/hooks/useNonEvmWallet";
import type { TxRequest } from "@/server/schema";
import { useToast } from "@/hooks/useToast";

interface TonTransactionSignerProps {
  txRequest: TxRequest & { kind: "ton" };
  onSuccess: (txHash: string) => void;
  onError: (error: Error) => void;
}

export function TonTransactionSigner({
  txRequest,
  onSuccess,
  onError,
}: TonTransactionSignerProps) {
  const { wallet } = useTonWallet();
  const { success, error: showError } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSign = useCallback(async () => {
    if (!wallet?.isConnected) {
      showError("Wallet not connected", "Please connect your TON wallet first");
      onError(new Error("Wallet not connected"));
      return;
    }

    setIsSigning(true);

    try {
      // Check if TON wallet is available
      const tonWallet = (window as unknown as {
        ton?: {
          sendTransaction?: (tx: {
            to: string;
            value: string;
            data?: string;
            stateInit?: string;
          }) => Promise<{ hash: string }>;
        };
      }).ton;

      if (!tonWallet?.sendTransaction) {
        throw new Error("TON wallet not found. Please install TON Wallet extension.");
      }

      const { to, amount, payload, stateInit } = txRequest;

      // Convert amount from nanotons
      const amountTon = BigInt(amount) / BigInt(1_000_000_000);

      console.log("TON transaction:", {
        to,
        amount: amountTon.toString(),
        payload,
        stateInit,
      });

      // Send the transaction
      const result = await tonWallet.sendTransaction({
        to,
        value: amount,
        data: payload,
        stateInit,
      });

      setTxHash(result.hash);
      success("Transaction broadcast", `Hash: ${result.hash.slice(0, 16)}...`);
      onSuccess(result.hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      showError("Transaction failed", message);
      onError(err instanceof Error ? err : new Error(message));
    } finally {
      setIsSigning(false);
    }
  }, [wallet, txRequest, onSuccess, onError, showError]);

  if (txHash) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-green-900">Transaction Broadcast</span>
        </div>
        <p className="text-sm text-green-700 font-mono break-all">{txHash}</p>
        <a
          href={`https://tonscan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center text-sm font-medium text-green-700 hover:text-green-900"
        >
          View on TONScan
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">TON Transaction</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">To:</span>
            <span className="font-mono text-blue-900 truncate max-w-[200px]">
              {txRequest.to}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Amount:</span>
            <span className="font-mono text-blue-900">
              {(BigInt(txRequest.amount) / BigInt(1_000_000_000)).toString()} TON
            </span>
          </div>
          {txRequest.payload && (
            <div className="flex justify-between">
              <span className="text-blue-700">Payload:</span>
              <span className="font-mono text-blue-900 truncate max-w-[150px]">
                {txRequest.payload.slice(0, 20)}...
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
          <p className="font-medium">⚠️ Important:</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>TON transactions are irreversible</li>
            <li>Cross-chain transfers may take 5-10 minutes</li>
            <li>Ensure you have enough TON for gas fees</li>
          </ul>
        </div>
      </div>

      <button
        onClick={handleSign}
        disabled={isSigning || !wallet?.isConnected}
        className={`
          w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium
          transition-colors
          ${!wallet?.isConnected
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
          }
          ${isSigning ? "opacity-70" : ""}
        `}
      >
        {isSigning ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Confirming in TON Wallet...
          </>
        ) : !wallet?.isConnected ? (
          "Connect TON Wallet to Continue"
        ) : (
          "Confirm in TON Wallet"
        )}
      </button>
    </div>
  );
}

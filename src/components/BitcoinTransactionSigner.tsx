"use client";

import { useState, useCallback } from "react";
import { useBitcoinWallet } from "@/hooks/useNonEvmWallet";
import type { TxRequest } from "@/server/schema";
import { useToast } from "@/hooks/useToast";

interface BitcoinTransactionSignerProps {
  txRequest: TxRequest & { kind: "bitcoin" };
  onSuccess: (txHash: string) => void;
  onError: (error: Error) => void;
}

// Extended tx request with Bitcoin-specific fields
type BitcoinTxDetails = {
  kind: "bitcoin";
  psbtBase64: string;
  inputsToSign: { index: number; address: string }[];
  toAddress?: string;
  amount?: string;
  memo?: string;
  vaultPubKey?: string;
}

export function BitcoinTransactionSigner({
  txRequest,
  onSuccess,
  onError,
}: BitcoinTransactionSignerProps) {
  const { wallet } = useBitcoinWallet();
  const { success, error: showError } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const details = txRequest as unknown as BitcoinTxDetails;

  const handleSign = useCallback(async () => {
    if (!wallet?.isConnected) {
      showError("Wallet not connected", "Please connect your Bitcoin wallet first");
      onError(new Error("Wallet not connected"));
      return;
    }

    setIsSigning(true);

    try {
      // Check if Xverse wallet is available
      const xverse = (window as unknown as {
        bitcoin?: {
          request: (method: string, params: unknown) => Promise<unknown>;
        };
      }).bitcoin;

      if (!xverse) {
        throw new Error("Xverse wallet not found. Please install Xverse extension.");
      }

      // For THORChain integration, we need to send BTC to a vault address with a memo
      if (details.toAddress && details.amount) {
        // Construct the transaction
        const satsAmount = parseInt(details.amount, 10);
        if (isNaN(satsAmount) || satsAmount <= 0) {
          throw new Error("Invalid amount");
        }

        // Build the payment transaction
        // Note: This is a simplified version. In production, you'd use a proper
        // Bitcoin library like bitcoinjs-lib to construct the PSBT
        const paymentRequest = {
          address: details.toAddress,
          amount: satsAmount,
          memo: details.memo,
        };

        console.log("Bitcoin payment request:", paymentRequest);

        // Try to use Xverse's sendBitcoin method if available
        // Otherwise, we'll show the user the details to manually send
        const provider = (window as unknown as {
          bitcoin?: {
            sendBitcoin?: (address: string, amount: number, options?: unknown) => Promise<string>;
          };
        }).bitcoin;

        let hash: string;

        if (provider?.sendBitcoin) {
          // Xverse supports direct sendBitcoin
          hash = await provider.sendBitcoin(details.toAddress, satsAmount, {
            memo: details.memo,
          });
        } else {
          // Fallback: Show manual payment instructions
          throw new Error(
            `Please send ${satsAmount} sats to:\n${details.toAddress}\n\nMemo: ${details.memo || "None"}`
          );
        }

        setTxHash(hash);
        success("Transaction signed", `Hash: ${hash.slice(0, 16)}...`);
        onSuccess(hash);
      } else {
        // PSBT signing flow
        if (!txRequest.psbtBase64) {
          throw new Error("No PSBT data provided");
        }

        // Sign the PSBT using Xverse
        const signedPsbt = await signPsbtWithXverse(txRequest.psbtBase64);
        
        // Broadcast the signed transaction
        const hash = await broadcastBitcoinTx(signedPsbt);
        
        setTxHash(hash);
        success("Transaction broadcast", `Hash: ${hash.slice(0, 16)}...`);
        onSuccess(hash);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      showError("Transaction failed", message);
      onError(err instanceof Error ? err : new Error(message));
    } finally {
      setIsSigning(false);
    }
  }, [wallet, details, txRequest, onSuccess, onError, showError]);

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
          href={`https://mempool.space/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center text-sm font-medium text-green-700 hover:text-green-900"
        >
          View on Mempool.space
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
        <h3 className="font-medium text-orange-900 mb-2">Bitcoin Transaction</h3>
        
        {details.toAddress && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-orange-700">To:</span>
              <span className="font-mono text-orange-900 truncate max-w-[200px]">
                {details.toAddress}
              </span>
            </div>
            {details.amount && (
              <div className="flex justify-between">
                <span className="text-orange-700">Amount:</span>
                <span className="font-mono text-orange-900">
                  {(parseInt(details.amount) / 100_000_000).toFixed(8)} BTC
                </span>
              </div>
            )}
            {details.memo && (
              <div className="flex justify-between">
                <span className="text-orange-700">Memo:</span>
                <span className="font-mono text-orange-900 truncate max-w-[200px]">
                  {details.memo}
                </span>
              </div>
            )}
          </div>
        )}

        {!details.toAddress && txRequest.psbtBase64 && (
          <p className="text-sm text-orange-700">
            You have a PSBT to sign. This will authorize the Bitcoin transaction.
          </p>
        )}

        <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-800">
          <p className="font-medium">⚠️ Important:</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Do not close this window until the transaction is confirmed</li>
            <li>THORChain transactions may take 5-15 minutes</li>
            <li>Ensure you have enough BTC for network fees</li>
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
            : "bg-orange-500 text-white hover:bg-orange-600"
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
            Signing with Xverse...
          </>
        ) : !wallet?.isConnected ? (
          "Connect Xverse to Continue"
        ) : (
          "Sign & Broadcast"
        )}
      </button>
    </div>
  );
}

// Helper to sign PSBT with Xverse
async function signPsbtWithXverse(psbtBase64: string): Promise<string> {
  const bitcoin = (window as unknown as {
    bitcoin?: {
      signPsbt?: (psbt: string) => Promise<{ psbt: string }>;
    };
  }).bitcoin;

  if (!bitcoin?.signPsbt) {
    throw new Error("Xverse PSBT signing not available");
  }

  const result = await bitcoin.signPsbt(psbtBase64);
  return result.psbt;
}

// Helper to broadcast Bitcoin transaction
async function broadcastBitcoinTx(signedPsbt: string): Promise<string> {
  // In production, you'd broadcast via a Bitcoin node or API like Blockstream
  // For now, this is a placeholder
  const response = await fetch("https://blockstream.info/api/tx", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: signedPsbt,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }

  return response.text(); // Returns tx hash
}

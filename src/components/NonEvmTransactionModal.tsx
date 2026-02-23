"use client";

import { useState } from "react";
import type { TxRequest } from "@/server/schema";
import { BitcoinTransactionSigner } from "./BitcoinTransactionSigner";
import { CosmosTransactionSigner } from "./CosmosTransactionSigner";
import { TonTransactionSigner } from "./TonTransactionSigner";

interface NonEvmTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  txRequest: TxRequest | null;
  stepDescription: string;
  onSuccess: (txHash: string) => void;
  onError: (error: Error) => void;
}

export function NonEvmTransactionModal({
  isOpen,
  onClose,
  txRequest,
  stepDescription,
  onSuccess,
  onError,
}: NonEvmTransactionModalProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !txRequest) return null;

  const handleSuccess = (txHash: string) => {
    setStatus("success");
    onSuccess(txHash);
  };

  const handleError = (error: Error) => {
    setStatus("error");
    setErrorMessage(error.message);
    onError(error);
  };

  const handleClose = () => {
    setStatus("idle");
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {txRequest.kind === "bitcoin" && "Sign Bitcoin Transaction"}
              {txRequest.kind === "cosmos" && "Sign Cosmos Transaction"}
              {txRequest.kind === "ton" && "Sign TON Transaction"}
            </h2>
            <p className="text-sm text-gray-500">{stepDescription}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === "error" && errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-red-900">Transaction Failed</p>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {txRequest.kind === "bitcoin" && (
            <BitcoinTransactionSigner
              txRequest={txRequest}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}

          {txRequest.kind === "cosmos" && (
            <CosmosTransactionSigner
              txRequest={txRequest}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}

          {txRequest.kind === "ton" && (
            <TonTransactionSigner
              txRequest={txRequest}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure wallet connection</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Verified bridge</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

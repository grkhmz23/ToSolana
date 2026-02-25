"use client";

import { useState, useCallback } from "react";
import { useCosmosWallet } from "@/hooks/useNonEvmWallet";
import type { TxRequest } from "@/server/schema";
import { useToast } from "@/hooks/useToast";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import { getNonEvmChain } from "@/lib/chains";

interface CosmosTransactionSignerProps {
  txRequest: TxRequest & { kind: "cosmos" };
  onSuccess: (txHash: string) => void;
  onError: (error: Error) => void;
}

export function CosmosTransactionSigner({
  txRequest,
  onSuccess,
  onError,
}: CosmosTransactionSignerProps) {
  const { wallet } = useCosmosWallet();
  const { success, error: showError } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSign = useCallback(async () => {
    if (!wallet?.isConnected) {
      showError("Wallet not connected", "Please connect your Keplr wallet first");
      onError(new Error("Wallet not connected"));
      return;
    }

    setIsSigning(true);

    try {
      // Check if Keplr is available
      const keplr = (window as unknown as {
        keplr?: {
          enable: (chainId: string) => Promise<void>;
          getOfflineSigner: (chainId: string) => OfflineSigner;
        };
      }).keplr;

      if (!keplr) {
        throw new Error("Keplr wallet not found. Please install Keplr extension.");
      }

      const { chainId, fee, memo } = txRequest;

      await keplr.enable(chainId);

      // Get the signer for this chain
      const offlineSigner = keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error("No accounts found in Keplr");
      }

      const account = accounts[0];

      const rpc = resolveCosmosRpc(chainId);
      if (!rpc) {
        throw new Error(
          "No RPC configured for this Cosmos chain. Set NEXT_PUBLIC_COSMOS_RPC_URL or add the chain RPC mapping."
        );
      }

      const client = await SigningStargateClient.connectWithSigner(
        rpc,
        offlineSigner,
      );

      const messages = txRequest.messages as unknown as EncodeObject[];
      const result = await client.signAndBroadcast(
        account.address,
        messages,
        fee,
        memo ?? "",
      );

      if (result.code && result.code !== 0) {
        throw new Error(result.rawLog || `Broadcast failed with code ${result.code}`);
      }

      const hash = result.transactionHash;
      setTxHash(hash);
      success("Transaction broadcast", `Hash: ${hash.slice(0, 16)}...`);
      onSuccess(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      showError("Transaction failed", message);
      onError(err instanceof Error ? err : new Error(message));
    } finally {
      setIsSigning(false);
    }
  }, [wallet, txRequest, onSuccess, onError, showError, success]);

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
          href={`https://www.mintscan.io/${txRequest.chainId.split("-")[0].replace("cosmoshub", "cosmos")}/txs/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center text-sm font-medium text-green-700 hover:text-green-900"
        >
          View on Mintscan
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
}
  return (
    <div className="space-y-4">
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h3 className="font-medium text-purple-900 mb-2">Cosmos Transaction</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-purple-700">Chain:</span>
            <span className="font-mono text-purple-900">{txRequest.chainId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">Messages:</span>
            <span className="text-purple-900">{txRequest.messages.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">Gas:</span>
            <span className="font-mono text-purple-900">{txRequest.fee.gas}</span>
          </div>
          {txRequest.memo && (
            <div className="flex justify-between">
              <span className="text-purple-700">Memo:</span>
              <span className="text-purple-900 truncate max-w-[200px]">{txRequest.memo}</span>
            </div>
          )}
        </div>

        <div className="mt-3 p-2 bg-purple-100 rounded text-xs text-purple-800">
          <p className="font-medium">⚠️ Important:</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>This will initiate an IBC transfer to Wormhole gateway</li>
            <li>Transfers may take 5-10 minutes to complete</li>
            <li>Ensure you have enough tokens for gas fees</li>
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
            : "bg-purple-600 text-white hover:bg-purple-700"
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
            Signing with Keplr...
          </>
        ) : !wallet?.isConnected ? (
          "Connect Keplr to Continue"
        ) : (
          "Sign & Broadcast"
        )}
      </button>
    </div>
  );
}

function resolveCosmosRpc(chainId: string): string | null {
  const envRpc = process.env.NEXT_PUBLIC_COSMOS_RPC_URL;
  if (envRpc && envRpc.trim()) return envRpc.trim();

  if (chainId.startsWith("cosmoshub")) {
    return getNonEvmChain("cosmos")?.rpcUrls?.default.http[0] ?? null;
  }

  const fallback: Record<string, string> = {
    "osmosis-1": "https://rpc.osmosis.zone",
    "injective-1": "https://rpc.injective.network",
    "evmos_9001-2": "https://evmos-rpc.publicnode.com:443",
    "juno-1": "https://rpc-juno.itastakers.com",
    "stargaze-1": "https://rpc.stargaze-apis.com",
  };

  return fallback[chainId] ?? null;
}

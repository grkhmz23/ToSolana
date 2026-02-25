// Official 1:1 Bridge Page
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";

interface Token {
  id: string;
  symbol: string;
  name: string;
  sourceChainId: number;
  sourceTokenAddress: string;
  solanaMint: string;
  decimals: number;
  mode: string;
}

export default function OfficialBridgePage() {
  const params = useParams();
  const tokenId = params.tokenId as string;

  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useWallet();

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/official/tokens/${tokenId}`);
      const data = (await res.json()) as {
        ok: boolean;
        data?: Token;
        error?: { message?: string };
      };

      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error?.message || "Token not found");
      }

      setToken(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load token details");
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    if (tokenId) {
      fetchToken();
    }
  }, [tokenId, fetchToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          {error || "Token not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Official 1:1 Bridge</h1>
                <p className="text-blue-100">
                  {token.symbol} ({token.mode})
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                About Official 1:1 {token.mode}
              </h3>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>No slippage - exact 1:1 ratio</li>
                <li>No bridge fees</li>
                <li>Native token transfer (not wrapped)</li>
                <li>Fast settlement (typically 2-5 minutes)</li>
              </ul>
            </div>

            {/* Wallet Connection */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${evmConnected ? "border-green-300 bg-green-50" : "border-gray-300"}`}>
                <div className="text-sm font-medium text-gray-700">Source (EVM)</div>
                {evmConnected ? (
                  <div className="mt-1 text-sm text-green-700 truncate">{evmAddress}</div>
                ) : (
                  <div className="mt-1 text-sm text-gray-500">Connect EVM wallet</div>
                )}
              </div>
              <div className={`p-4 rounded-lg border ${solanaConnected ? "border-green-300 bg-green-50" : "border-gray-300"}`}>
                <div className="text-sm font-medium text-gray-700">Destination (Solana)</div>
                {solanaConnected ? (
                  <div className="mt-1 text-sm text-green-700 truncate">{solanaPublicKey?.toBase58()}</div>
                ) : (
                  <div className="mt-1 text-sm text-gray-500">Connect Solana wallet</div>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount to Bridge
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="block w-full rounded-md border border-gray-300 px-3 py-3 text-lg"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 font-medium">{token.symbol}</span>
                </div>
              </div>
            </div>

            {/* Transfer Button */}
            <button
              disabled={!evmConnected || !solanaConnected || !amount}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!evmConnected
                ? "Connect EVM Wallet"
                : !solanaConnected
                ? "Connect Solana Wallet"
                : !amount
                ? "Enter Amount"
                : `Bridge ${token.symbol}`}
            </button>

            {/* Alternative: External Widget */}
            <div className="text-center">
              <p className="text-sm text-gray-500">or</p>
              <a
                href={`https://portalbridge.com/?sourceChain=${token.sourceChainId}&targetChain=solana&token=${token.sourceTokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-blue-600 hover:text-blue-800"
              >
                Open in Wormhole Portal
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

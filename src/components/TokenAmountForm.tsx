"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation } from "@tanstack/react-query";
import { SUPPORTED_CHAINS, NATIVE_TOKEN_ADDRESS } from "@/lib/chains";
import { isValidEvmAddress, isValidSolanaMint } from "@/lib/tokens";
import { parseTokenAmount } from "@/lib/format";
import type { NormalizedRoute, QuoteResponse } from "@/server/schema";

interface TokenAmountFormProps {
  onQuotesReceived: (routes: NormalizedRoute[], errors?: string[]) => void;
}

export function TokenAmountForm({ onQuotesReceived }: TokenAmountFormProps) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const chainId = useChainId();
  const { publicKey, connected: solConnected } = useWallet();

  const [sourceChainId, setSourceChainId] = useState<number>(1);
  const [sourceToken, setSourceToken] = useState<string>("native");
  const [customSourceToken, setCustomSourceToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [destToken, setDestToken] = useState<string>("SOL");
  const [customDestToken, setCustomDestToken] = useState<string>("");

  const effectiveSourceToken =
    sourceToken === "custom" ? customSourceToken : NATIVE_TOKEN_ADDRESS;
  const effectiveDestToken = destToken === "custom" ? customDestToken : "SOL";

  const sourceTokenValid =
    sourceToken === "native" || (sourceToken === "custom" && isValidEvmAddress(customSourceToken));
  const destTokenValid =
    destToken === "SOL" || (destToken === "custom" && isValidSolanaMint(customDestToken));
  const amountValid = !!amount && parseFloat(amount) > 0;

  const canQuote =
    evmConnected && solConnected && sourceTokenValid && destTokenValid && amountValid;

  // Parse amount to raw token units (assume 18 decimals for native, could be improved)
  const rawAmount = sourceToken === "native" 
    ? parseTokenAmount(amount, 18) 
    : amount; // For custom tokens, assume user enters raw amount or we need to fetch decimals

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChainId,
          sourceTokenAddress: effectiveSourceToken,
          sourceAmount: rawAmount,
          destinationTokenAddress: effectiveDestToken,
          sourceAddress: evmAddress,
          solanaAddress: publicKey?.toBase58(),
        }),
      });
      const data = (await res.json()) as QuoteResponse & { error?: string; details?: unknown };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      onQuotesReceived(data.routes, data.errors);
    },
  });

  const handleQuote = useCallback(() => {
    if (canQuote) quoteMutation.mutate();
  }, [canQuote, quoteMutation]);

  return (
    <div className="space-y-4">
      {/* Source Chain */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Source Chain</label>
        <select
          value={sourceChainId}
          onChange={(e) => setSourceChainId(Number(e.target.value))}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        >
          {SUPPORTED_CHAINS.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
        {evmConnected && chainId !== sourceChainId && (
          <p className="mt-1 text-xs text-[var(--warning)]">
            Your wallet is on a different chain. You may need to switch networks.
          </p>
        )}
      </div>

      {/* Source Token */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Source Token</label>
        <div className="flex gap-2">
          <select
            value={sourceToken}
            onChange={(e) => setSourceToken(e.target.value)}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="native">Native (ETH/MATIC/BNB...)</option>
            <option value="custom">ERC20 Address</option>
          </select>
          {sourceToken === "custom" && (
            <input
              type="text"
              placeholder="0x..."
              value={customSourceToken}
              onChange={(e) => setCustomSourceToken(e.target.value)}
              className={`flex-1 rounded-lg border bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
                customSourceToken && !isValidEvmAddress(customSourceToken)
                  ? "border-[var(--danger)]"
                  : "border-[var(--card-border)] focus:border-[var(--primary)]"
              }`}
            />
          )}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Amount</label>
        <input
          type="text"
          placeholder="0.0"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) setAmount(val);
          }}
          className={`w-full rounded-lg border bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
            amount && !amountValid
              ? "border-[var(--danger)]"
              : "border-[var(--card-border)] focus:border-[var(--primary)]"
          }`}
        />
      </div>

      {/* Destination Token */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Destination Token (Solana)</label>
        <div className="flex gap-2">
          <select
            value={destToken}
            onChange={(e) => setDestToken(e.target.value)}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="SOL">SOL (Native)</option>
            <option value="custom">SPL Mint Address</option>
          </select>
          {destToken === "custom" && (
            <input
              type="text"
              placeholder="Base58 mint address"
              value={customDestToken}
              onChange={(e) => setCustomDestToken(e.target.value)}
              className={`flex-1 rounded-lg border bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
                customDestToken && !isValidSolanaMint(customDestToken)
                  ? "border-[var(--danger)]"
                  : "border-[var(--card-border)] focus:border-[var(--primary)]"
              }`}
            />
          )}
        </div>
      </div>

      {/* Quote Button */}
      <button
        onClick={handleQuote}
        disabled={!canQuote || quoteMutation.isPending}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {quoteMutation.isPending
          ? "Fetching quotes..."
          : !evmConnected
            ? "Connect EVM wallet first"
            : !solConnected
              ? "Connect Solana wallet first"
              : !amountValid
                ? "Enter an amount"
                : "Get Quotes"}
      </button>

      {/* Errors */}
      {quoteMutation.isError && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          {quoteMutation.error.message}
        </div>
      )}
    </div>
  );
}

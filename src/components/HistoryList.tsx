"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { getChainName } from "@/lib/chains";
import { shortenAddress, formatDuration } from "@/lib/format";
import { useTokenPrices, formatUsd, calculateUsdValue } from "@/hooks/useTokenPrices";
import { useMemo } from "react";
import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains";

interface HistoryStep {
  index: number;
  chainType: "evm" | "solana";
  status: string;
  txHashOrSig: string | null;
  description: string;
}

interface HistoryItem {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: "completed" | "failed" | string;
  provider: string;
  source: {
    chainId: number;
    address: string;
    token: string;
    amount: string;
  };
  destination: {
    address: string;
    token: string;
    estimatedOutput: string;
  };
  steps: HistoryStep[];
  errorMessage: string | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

interface HistoryListProps {
  onReExecute?: (item: HistoryItem) => void;
}

export function HistoryList({ onReExecute }: HistoryListProps) {
  const { address: evmAddress } = useAccount();
  const { publicKey } = useWallet();

  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ["history", evmAddress, publicKey?.toBase58()],
    queryFn: async () => {
      if (!evmAddress && !publicKey) {
        throw new Error("Please connect both wallets to view history");
      }

      const params = new URLSearchParams();
      if (evmAddress) params.set("sourceAddress", evmAddress);
      if (publicKey) params.set("solanaAddress", publicKey.toBase58());

      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch history");
      }
      return (await res.json()) as HistoryResponse;
    },
    enabled: !!(evmAddress || publicKey),
    staleTime: 30000, // 30 seconds
  });

  if (!evmAddress && !publicKey) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <div className="mb-4 text-4xl">👛</div>
        <p className="text-[var(--muted)]">Connect your wallets to view transfer history</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
        {error.message}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <div className="mb-4 text-4xl">📭</div>
        <p className="text-[var(--muted)]">No transfer history found</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Complete a bridge transfer to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          Showing {data.items.length} of {data.total} transfers
        </p>
      </div>

      <div className="space-y-3">
        {data.items.map((item) => (
          <HistoryCard key={item.id} item={item} onReExecute={onReExecute} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({
  item,
  onReExecute,
}: {
  item: HistoryItem;
  onReExecute?: (item: HistoryItem) => void;
}) {
  const isCompleted = item.status === "completed";
  const isFailed = item.status === "failed";

  // Calculate duration
  const duration =
    item.completedAt && item.createdAt
      ? new Date(item.completedAt).getTime() - new Date(item.createdAt).getTime()
      : null;

  // Format date
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Fetch current prices for display
  const tokens = useMemo(() => [
    { chainId: item.source.chainId, address: item.source.token },
    { chainId: 1151111081099710, address: "11111111111111111111111111111111" }, // SOL
  ], [item.source.chainId, item.source.token]);
  
  const { data: priceData } = useTokenPrices(tokens);
  
  // Calculate USD values
  const inputUsdValue = useMemo(() => {
    const sourcePrice = priceData?.prices.find(
      (p) => p.chainId === item.source.chainId && 
        p.address.toLowerCase() === item.source.token.toLowerCase()
    )?.priceUsd;
    if (!sourcePrice) return null;
    
    const decimals = item.source.token === NATIVE_TOKEN_ADDRESS ? 18 : 18;
    return calculateUsdValue(item.source.amount, decimals, sourcePrice);
  }, [priceData, item.source]);
  
  const outputUsdValue = useMemo(() => {
    const solPrice = priceData?.prices.find(
      (p) => p.chainId === 1151111081099710
    )?.priceUsd;
    if (!solPrice) return null;
    
    const decimals = item.destination.token === "SOL" ? 9 : 6;
    return calculateUsdValue(item.destination.estimatedOutput, decimals, solPrice);
  }, [priceData, item.destination]);

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--card-border)]/80">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* Status icon */}
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              isCompleted
                ? "bg-[var(--accent)]/20"
                : isFailed
                  ? "bg-[var(--danger)]/20"
                  : "bg-[var(--warning)]/20"
            }`}
          >
            {isCompleted ? (
              <svg viewBox="0 0 20 20" fill="var(--accent)" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : isFailed ? (
              <span className="text-sm text-[var(--danger)]">✕</span>
            ) : (
              <span className="text-sm text-[var(--warning)]">⏳</span>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {getChainName(item.source.chainId)} → Solana
            </p>
            <p className="text-xs text-[var(--muted)]">
              {dateStr} at {timeStr}
              {duration && (
                <span className="ml-2">({formatDuration(Math.round(duration / 1000))})</span>
              )}
            </p>
          </div>
        </div>

        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            isCompleted
              ? "bg-[var(--accent)]/20 text-[var(--accent)]"
              : isFailed
                ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                : "bg-[var(--warning)]/20 text-[var(--warning)]"
          }`}
        >
          {item.status.toUpperCase()}
        </span>
      </div>

      {/* Transfer details */}
      <div className="mb-3 grid grid-cols-2 gap-4 rounded-lg bg-[var(--background)]/50 p-3">
        <div>
          <p className="text-xs text-[var(--muted)]">From</p>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {shortenAddress(item.source.token, 6)} on {getChainName(item.source.chainId)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Amount: {shortenAmount(item.source.amount)}
          </p>
          {inputUsdValue !== null && (
            <p className="text-xs text-[var(--accent)]">
              ≈ {formatUsd(inputUsdValue)}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">To</p>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {item.destination.token === "SOL"
              ? "SOL"
              : shortenAddress(item.destination.token, 6)}{" "}
            on Solana
          </p>
          <p className="text-xs text-[var(--accent)]">
            Est. receive: {shortenAmount(item.destination.estimatedOutput)}
          </p>
          {outputUsdValue !== null && (
            <p className="text-xs text-[var(--accent)]">
              ≈ {formatUsd(outputUsdValue)}
            </p>
          )}
        </div>
      </div>

      {/* Provider & Steps */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-[var(--primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
            {item.provider.toUpperCase()}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {item.steps.length} step{item.steps.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Transaction hashes */}
        <div className="space-y-1">
          {item.steps
            .filter((step) => step.txHashOrSig)
            .map((step) => (
              <a
                key={step.index}
                href={getExplorerUrl(step.chainType, step.txHashOrSig!)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-[var(--primary)] hover:underline"
              >
                {step.description}: {shortenAddress(step.txHashOrSig!, 8)}
              </a>
            ))}
        </div>

        {item.errorMessage && (
          <p className="mt-2 text-xs text-[var(--danger)]">{item.errorMessage}</p>
        )}
      </div>

      {/* Actions */}
      {onReExecute && (
        <button
          onClick={() => onReExecute(item)}
          className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          Repeat Transfer
        </button>
      )}
    </div>
  );
}

function shortenAmount(amount: string): string {
  // Handle large numbers - show in a more readable format
  const num = Number(amount);
  if (isNaN(num)) return amount;

  // If very large (wei), convert to readable
  if (num > 1e15) {
    const ether = num / 1e18;
    return `${ether.toFixed(6)} ETH`;
  }

  // Otherwise just show the number
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function getExplorerUrl(chainType: "evm" | "solana", txHash: string): string {
  if (chainType === "solana") {
    return `https://solscan.io/tx/${txHash}`;
  }
  // For EVM, default to etherscan - ideally we'd have chain-specific explorers
  return `https://etherscan.io/tx/${txHash}`;
}

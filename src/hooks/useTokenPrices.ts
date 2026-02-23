"use client";

import { useQuery } from "@tanstack/react-query";

interface Token {
  chainId: number;
  address: string;
}

interface PriceResponse {
  chainId: number;
  address: string;
  priceUsd: number | null;
  formatted: string | null;
}

interface BatchPriceResponse {
  prices: PriceResponse[];
}

/**
 * Fetch a single token price
 */
export function useTokenPrice(token: Token | null) {
  return useQuery<PriceResponse>({
    queryKey: ["token-price", token?.chainId, token?.address],
    queryFn: async () => {
      if (!token) throw new Error("Token required");
      const res = await fetch(
        `/api/price?chainId=${token.chainId}&address=${token.address}`,
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch price");
      }
      return (await res.json()) as PriceResponse;
    },
    enabled: !!token && !!token.chainId && !!token.address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch multiple token prices in a batch
 */
export function useTokenPrices(tokens: Token[]) {
  return useQuery<BatchPriceResponse>({
    queryKey: ["token-prices", tokens.map((t) => `${t.chainId}:${t.address}`).join(",")],
    queryFn: async () => {
      if (tokens.length === 0) return { prices: [] };
      
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch prices");
      }
      
      return (await res.json()) as BatchPriceResponse;
    },
    enabled: tokens.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Format USD amount with proper decimals
 */
export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$--.--";
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return "<$0.01";
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

/**
 * Calculate USD value from raw amount and price
 */
export function calculateUsdValue(
  rawAmount: string,
  decimals: number,
  priceUsd: number,
): number {
  try {
    const amount = Number(rawAmount) / Math.pow(10, decimals);
    return amount * priceUsd;
  } catch {
    return 0;
  }
}

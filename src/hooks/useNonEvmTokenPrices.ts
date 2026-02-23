"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchNonEvmTokenPrice } from "@/lib/prices";

interface NonEvmPriceResponse {
  chainId: string;
  priceUsd: number | null;
  formatted: string | null;
}

/**
 * Fetch price for a non-EVM chain token (BTC, ATOM, TON, etc.)
 */
export function useNonEvmTokenPrice(chainId: string | null) {
  return useQuery<NonEvmPriceResponse>({
    queryKey: ["non-evm-token-price", chainId],
    queryFn: async () => {
      if (!chainId) throw new Error("Chain ID required");
      const price = await fetchNonEvmTokenPrice(chainId);
      return {
        chainId,
        priceUsd: price,
        formatted: price !== null ? formatUsd(price) : null,
      };
    },
    enabled: !!chainId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Format USD amount with proper decimals
 */
function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$--.--";
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return "<$0.01";
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

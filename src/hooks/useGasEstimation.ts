"use client";

import { useQuery } from "@tanstack/react-query";
import type { GasPriceInfo, GasEstimate } from "@/lib/gas";

interface GasPriceResponse {
  chainId: number;
  gasPrice: GasPriceInfo;
}

interface GasEstimateResponse {
  estimate: GasEstimate;
}

/**
 * Fetch gas prices for a chain
 */
export function useGasPrice(chainId: number | null) {
  return useQuery<GasPriceResponse>({
    queryKey: ["gas-price", chainId],
    queryFn: async () => {
      if (!chainId) throw new Error("Chain ID required");
      const res = await fetch(`/api/gas?chainId=${chainId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch gas price");
      }
      return (await res.json()) as GasPriceResponse;
    },
    enabled: !!chainId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Estimate gas cost for a bridge operation
 */
export function useGasEstimate(
  chainId: number | null,
  gasLimit?: number,
  priority: "slow" | "standard" | "fast" = "standard",
) {
  return useQuery<GasEstimateResponse>({
    queryKey: ["gas-estimate", chainId, gasLimit, priority],
    queryFn: async () => {
      if (!chainId) throw new Error("Chain ID required");
      const res = await fetch("/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId, gasLimit, priority }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to estimate gas");
      }
      return (await res.json()) as GasEstimateResponse;
    },
    enabled: !!chainId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Format gas price to human readable
 */
export function formatGasPrice(gasPrice: GasPriceInfo, priority: "slow" | "standard" | "fast"): string {
  const price = gasPrice[priority];
  
  if (gasPrice.unit === "wei") {
    const gwei = Number(price) / 1e9;
    if (gwei < 0.01) {
      return `${Number(price).toExponential(2)} wei`;
    }
    return `${gwei.toFixed(2)} Gwei`;
  }
  
  return `${price} ${gasPrice.unit}`;
}

/**
 * Get gas price color indicator
 */
export function getGasPriceColor(gasPrice: GasPriceInfo, chainId: number): "low" | "normal" | "high" {
  const standardWei = BigInt(gasPrice.standard);
  
  // Thresholds in wei (approximate)
  const gwei = BigInt(10 ** 9);
  const pointOneGwei = BigInt(100000000); // 0.1 gwei
  const pointFiveGwei = BigInt(500000000); // 0.5 gwei
  
  const thresholds: Record<number, { low: bigint; high: bigint }> = {
    1: { low: BigInt(20) * gwei, high: BigInt(50) * gwei },          // Ethereum: 20-50 gwei
    10: { low: pointOneGwei, high: pointFiveGwei },                   // Optimism: 0.1-0.5 gwei
    56: { low: BigInt(3) * gwei, high: BigInt(10) * gwei },           // BSC: 3-10 gwei
    137: { low: BigInt(50) * gwei, high: BigInt(150) * gwei },        // Polygon: 50-150 gwei
    42161: { low: pointOneGwei, high: pointFiveGwei },                // Arbitrum: 0.1-0.5 gwei
    8453: { low: pointOneGwei, high: pointFiveGwei },                 // Base: 0.1-0.5 gwei
    43114: { low: BigInt(1) * gwei, high: BigInt(5) * gwei },         // Avalanche: 1-5 gwei
    250: { low: BigInt(3) * gwei, high: BigInt(10) * gwei },          // Fantom: 3-10 gwei
    324: { low: pointOneGwei, high: pointFiveGwei },                  // zkSync: 0.1-0.5 gwei
    1101: { low: pointOneGwei, high: pointFiveGwei },                 // Polygon zkEVM: 0.1-0.5 gwei
    59144: { low: pointOneGwei, high: pointFiveGwei },                // Linea: 0.1-0.5 gwei
    534352: { low: pointOneGwei, high: pointFiveGwei },               // Scroll: 0.1-0.5 gwei
    5000: { low: pointOneGwei, high: pointFiveGwei },                 // Mantle: 0.1-0.5 gwei
    81457: { low: pointOneGwei, high: pointFiveGwei },                // Blast: 0.1-0.5 gwei
    100: { low: BigInt(3) * gwei, high: BigInt(10) * gwei },          // Gnosis: 3-10 gwei
    25: { low: BigInt(3000) * gwei, high: BigInt(10000) * gwei },     // Cronos: 3000-10000 gwei
    42220: { low: BigInt(1) * gwei, high: BigInt(5) * gwei },         // Celo: 1-5 gwei
    1313161554: { low: pointOneGwei, high: pointFiveGwei },           // Aurora: 0.1-0.5 gwei
    1666600000: { low: BigInt(1) * gwei, high: BigInt(5) * gwei },    // Harmony: 1-5 gwei
    1088: { low: BigInt(1) * gwei, high: BigInt(5) * gwei },          // Metis: 1-5 gwei
    169: { low: pointOneGwei, high: pointFiveGwei },                  // Manta: 0.1-0.5 gwei
    7777777: { low: pointOneGwei, high: pointFiveGwei },              // Zora: 0.1-0.5 gwei
  };
  
  const threshold = thresholds[chainId];
  if (!threshold) return "normal";
  
  if (standardWei < threshold.low) return "low";
  if (standardWei > threshold.high) return "high";
  return "normal";
}

/**
 * Get gas trend icon/color
 */
export function getGasTrendProps(trend: "low" | "normal" | "high"): {
  color: string;
  bgColor: string;
  label: string;
} {
  switch (trend) {
    case "low":
      return {
        color: "var(--accent)",
        bgColor: "rgba(20, 241, 149, 0.1)",
        label: "Low",
      };
    case "high":
      return {
        color: "var(--danger)",
        bgColor: "rgba(239, 68, 68, 0.1)",
        label: "High",
      };
    default:
      return {
        color: "var(--warning)",
        bgColor: "rgba(245, 158, 11, 0.1)",
        label: "Normal",
      };
  }
}

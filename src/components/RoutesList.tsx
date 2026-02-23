"use client";

import type { NormalizedRoute } from "@/server/schema";
import { formatDuration } from "@/lib/format";
import { useTokenPrices, formatUsd, calculateUsdValue } from "@/hooks/useTokenPrices";
import { useGasPrice, getGasPriceColor, getGasTrendProps } from "@/hooks/useGasEstimation";
import { useMemo } from "react";

interface RoutesListProps {
  routes: NormalizedRoute[];
  errors?: string[];
  selectedRouteId: string | null;
  onSelectRoute: (route: NormalizedRoute) => void;
  sourceChainId: number | string;
}

export function RoutesList({ routes, errors, selectedRouteId, onSelectRoute, sourceChainId }: RoutesListProps) {
  if (routes.length === 0 && (!errors || errors.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">Available Routes</h3>

      {errors && errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]"
            >
              {err}
            </div>
          ))}
        </div>
      )}

      {routes.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No routes found for this transfer.</p>
      )}

      <div className="space-y-2">
        {routes.map((route) => (
          <RouteCard
            key={`${route.provider}-${route.routeId}`}
            route={route}
            isSelected={selectedRouteId === route.routeId}
            onSelect={() => onSelectRoute(route)}
            sourceChainId={sourceChainId}
          />
        ))}
      </div>
    </div>
  );
}

interface RouteCardProps {
  route: NormalizedRoute;
  isSelected: boolean;
  onSelect: () => void;
  sourceChainId: number | string;
}

function RouteCard({ route, isSelected, onSelect, sourceChainId }: RouteCardProps & { sourceChainId: number | string }) {
  // Fetch SOL price for USD calculation
  const { data: solPriceData } = useTokenPrices([
    { chainId: 1151111081099710, address: "11111111111111111111111111111111" }, // Solana native
  ]);

  // Fetch gas price for source chain (only for EVM chains)
  const isEvmChain = typeof sourceChainId === "number";
  const { data: gasPriceData } = useGasPrice(isEvmChain ? sourceChainId : 0);

  const outputUsdValue = useMemo(() => {
    if (!solPriceData?.prices[0]?.priceUsd) return null;
    const solPrice = solPriceData.prices[0].priceUsd;
    
    // For SOL output, use 9 decimals
    const decimals = route.estimatedOutput.token === "SOL" ? 9 : 6;
    return calculateUsdValue(route.estimatedOutput.amount, decimals, solPrice);
  }, [solPriceData, route.estimatedOutput]);

  // Gas price indicator
  const gasTrend = useMemo(() => {
    if (!gasPriceData?.gasPrice || !isEvmChain) return null;
    return getGasPriceColor(gasPriceData.gasPrice, sourceChainId as number);
  }, [gasPriceData, sourceChainId, isEvmChain]);

  const gasTrendProps = gasTrend ? getGasTrendProps(gasTrend) : null;

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary)]/10"
          : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--primary)]/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {route.action ? (
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-500">
                OFFICIAL 1:1
              </span>
            ) : (
              <span className="rounded bg-[var(--primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                {route.provider.toUpperCase()}
              </span>
            )}
            <span className="text-xs text-[var(--muted)]">
              {route.steps.length} step{route.steps.length !== 1 ? "s" : ""}
            </span>
            {route.etaSeconds && (
              <span className="text-xs text-[var(--muted)]">
                ~{formatDuration(route.etaSeconds)}
              </span>
            )}
            {gasTrendProps && (
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{
                  color: gasTrendProps.color,
                  backgroundColor: gasTrendProps.bgColor,
                }}
              >
                Gas: {gasTrendProps.label}
              </span>
            )}
          </div>

          <div className="mb-2">
            <div className="text-sm font-medium text-[var(--foreground)]">
              Receive: {formatTokenAmount(route.estimatedOutput.amount)} {route.estimatedOutput.token}
            </div>
            {outputUsdValue !== null && (
              <div className="text-xs text-[var(--accent)]">
                ≈ {formatUsd(outputUsdValue)}
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-1">
            {route.steps.map((step, i) => (
              <div key={i} className="text-xs text-[var(--muted)]">
                {i + 1}. {step.description}{" "}
                <span className={`
                  ${step.chainType === "bitcoin" ? "text-orange-500" : ""}
                  ${step.chainType === "cosmos" ? "text-purple-500" : ""}
                  ${step.chainType === "ton" ? "text-blue-500" : ""}
                  ${step.chainType === "evm" ? "text-[var(--accent)]" : ""}
                  ${step.chainType === "solana" ? "text-green-500" : ""}
                `}>
                  ({step.chainType})
                </span>
              </div>
            ))}
          </div>

          {/* Fees & Gas */}
          {(route.fees.length > 0 || (gasPriceData && isEvmChain)) && (
            <div className="mt-2 space-y-1">
              {route.fees.length > 0 && (
                <div className="text-xs text-[var(--muted)]">
                  Bridge fees:{" "}
                  {route.fees.map((f) => `${f.amount} ${f.token}`).join(", ")}
                </div>
              )}
              {gasPriceData && isEvmChain && (
                <div className="text-xs text-[var(--muted)]">
                  Est. gas: {formatGasDisplay(gasPriceData.gasPrice, sourceChainId as number)}
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {route.warnings && route.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {route.warnings.map((w, i) => (
                <div key={i} className="text-xs text-[var(--warning)]">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected indicator */}
        <div
          className={`ml-3 h-5 w-5 shrink-0 rounded-full border-2 ${
            isSelected
              ? "border-[var(--primary)] bg-[var(--primary)]"
              : "border-[var(--card-border)]"
          }`}
        >
          {isSelected && (
            <svg
              viewBox="0 0 20 20"
              fill="white"
              className="h-full w-full p-0.5"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Format gas price for display
 */
function formatGasDisplay(gasPrice: { standard: string; unit: string }, chainId: number | string): string {
  const standardWei = BigInt(gasPrice.standard);
  const gwei = Number(standardWei) / 1e9;
  
  const symbols: Record<number | string, string> = {
    1: "ETH",
    10: "ETH",
    56: "BNB",
    137: "MATIC",
    42161: "ETH",
    8453: "ETH",
    43114: "AVAX",
    250: "FTM",
    324: "ETH",
    1101: "ETH",
    59144: "ETH",
    534352: "ETH",
    5000: "MNT",
    81457: "ETH",
    100: "xDAI",
    25: "CRO",
    42220: "CELO",
    1313161554: "ETH",
    1666600000: "ONE",
    1088: "METIS",
    169: "ETH",
    7777777: "ETH",
  };
  
  const symbol = symbols[chainId] ?? "ETH";
  
  // Estimate gas cost for a typical bridge (200k gas)
  const gasLimit = 200000;
  const costWei = standardWei * BigInt(gasLimit);
  const costEth = Number(costWei) / 1e18;
  
  return `${gwei.toFixed(1)} Gwei · ~${costEth.toFixed(4)} ${symbol}`;
}

/**
 * Format raw token amount to human readable
 */
function formatTokenAmount(amount: string): string {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  
  // If very large (wei), convert to readable
  if (num > 1e15) {
    const ether = num / 1e18;
    return ether.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  
  // If large (lamports), convert to SOL
  if (num > 1e8) {
    const sol = num / 1e9;
    return sol.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

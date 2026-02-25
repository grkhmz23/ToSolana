"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { NormalizedRoute } from "@/server/schema";

export type SortOption = "output" | "speed" | "fees";
export type ProviderFilter = "all" | string;

interface RouteFiltersProps {
  routes: NormalizedRoute[];
  onFilterChange: (filteredRoutes: NormalizedRoute[]) => void;
}

interface FilterState {
  sortBy: SortOption;
  providerFilter: ProviderFilter[];
  maxDuration: number | null; // in seconds
}

export function RouteFilters({ routes, onFilterChange }: RouteFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    sortBy: "output",
    providerFilter: ["all"],
    maxDuration: null,
  });

  // Apply filters and sorting
  const filteredAndSortedRoutes = useMemo(() => {
    let result = [...routes];

    // Filter by provider
    const providerFilters = filters.providerFilter.includes("all") ? [] : filters.providerFilter;
    if (providerFilters.length > 0) {
      result = result.filter((r) => providerFilters.includes(r.provider));
    }

    // Filter by max duration
    if (filters.maxDuration) {
      result = result.filter(
        (r) => !r.etaSeconds || r.etaSeconds <= filters.maxDuration!
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "output":
          // Higher output is better
          return compareOutput(b.estimatedOutput.amount, a.estimatedOutput.amount);
        case "speed":
          // Lower ETA is better
          const etaA = a.etaSeconds ?? Infinity;
          const etaB = b.etaSeconds ?? Infinity;
          return etaA - etaB;
        case "fees":
          // Lower total fees is better
          const feesA = a.fees.reduce((sum, f) => sum + parseFloat(f.amount || "0"), 0);
          const feesB = b.fees.reduce((sum, f) => sum + parseFloat(f.amount || "0"), 0);
          return feesA - feesB;
        default:
          return 0;
      }
    });

    return result;
  }, [routes, filters]);

  // Notify parent when filtered routes change
  useEffect(() => {
    onFilterChange(filteredAndSortedRoutes);
  }, [filteredAndSortedRoutes, onFilterChange]);

  const handleSortChange = useCallback((sortBy: SortOption) => {
    setFilters((f) => ({ ...f, sortBy }));
  }, []);

  const handleProviderToggle = useCallback((provider: ProviderFilter) => {
    setFilters((f) => {
      if (provider === "all") {
        return { ...f, providerFilter: ["all"] };
      }
      const current = f.providerFilter.includes("all") ? [] : f.providerFilter;
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return { ...f, providerFilter: next.length === 0 ? ["all"] : next };
    });
  }, []);

  const handleDurationChange = useCallback((maxDuration: number | null) => {
    setFilters((f) => ({ ...f, maxDuration }));
  }, []);

  const activeFiltersCount = [
    filters.sortBy !== "output",
    !filters.providerFilter.includes("all"),
    filters.maxDuration !== null,
  ].filter(Boolean).length;

  const providerOptions = useMemo(
    () => Array.from(new Set(routes.map((r) => r.provider))).sort(),
    [routes],
  );

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
          activeFiltersCount > 0
            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
            : "border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary)]/50"
        }`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span>Filter & Sort</span>
        {activeFiltersCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown Content */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-lg">
            {/* Sort By Section */}
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Sort By
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <SortOptionButton
                  label="Best Output"
                  description="Highest receive amount"
                  selected={filters.sortBy === "output"}
                  onClick={() => handleSortChange("output")}
                />
                <SortOptionButton
                  label="Fastest"
                  description="Shortest time"
                  selected={filters.sortBy === "speed"}
                  onClick={() => handleSortChange("speed")}
                />
                <SortOptionButton
                  label="Lowest Fees"
                  description="Minimize costs"
                  selected={filters.sortBy === "fees"}
                  onClick={() => handleSortChange("fees")}
                />
              </div>
            </div>

            {/* Provider Filter Section */}
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Provider
              </h4>
              <div className="flex flex-wrap gap-2">
                <ProviderButton
                  label="All"
                  selected={filters.providerFilter.includes("all")}
                  onClick={() => handleProviderToggle("all")}
                />
                {providerOptions.map((p) => (
                  <ProviderButton
                    key={p}
                    label={p.toUpperCase()}
                    selected={filters.providerFilter.includes(p)}
                    onClick={() => handleProviderToggle(p)}
                  />
                ))}
              </div>
            </div>

            {/* Duration Filter Section */}
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Max Duration
              </h4>
              <div className="flex flex-wrap gap-2">
                <DurationButton
                  label="Any"
                  selected={filters.maxDuration === null}
                  onClick={() => handleDurationChange(null)}
                />
                <DurationButton
                  label="< 1 min"
                  seconds={60}
                  selected={filters.maxDuration === 60}
                  onClick={() => handleDurationChange(60)}
                />
                <DurationButton
                  label="< 5 min"
                  seconds={300}
                  selected={filters.maxDuration === 300}
                  onClick={() => handleDurationChange(300)}
                />
                <DurationButton
                  label="< 15 min"
                  seconds={900}
                  selected={filters.maxDuration === 900}
                  onClick={() => handleDurationChange(900)}
                />
                <DurationButton
                  label="< 30 min"
                  seconds={1800}
                  selected={filters.maxDuration === 1800}
                  onClick={() => handleDurationChange(1800)}
                />
              </div>
            </div>

            {/* Results Count */}
            <div className="border-t border-[var(--card-border)] pt-3">
              <p className="text-center text-sm text-[var(--muted)]">
                Showing {filteredAndSortedRoutes.length} of {routes.length} routes
              </p>
            </div>

            {/* Reset Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setFilters({
                    sortBy: "output",
                    providerFilter: ["all"],
                    maxDuration: null,
                  });
                }}
                className="mt-3 w-full rounded-lg border border-[var(--card-border)] py-2 text-sm text-[var(--muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Reset Filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface SortOptionButtonProps {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function SortOptionButton({
  label,
  description,
  selected,
  onClick,
}: SortOptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-lg border p-2 text-center transition-colors ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/10"
          : "border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary)]/30"
      }`}
    >
      <span
        className={`text-xs font-medium ${
          selected ? "text-[var(--primary)]" : "text-[var(--foreground)]"
        }`}
      >
        {label}
      </span>
      <span className="mt-0.5 text-[10px] text-[var(--muted)]">{description}</span>
    </button>
  );
}

interface ProviderButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ProviderButton({ label, selected, onClick }: ProviderButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
          : "border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]"
      }`}
    >
      {label}
    </button>
  );
}

interface DurationButtonProps {
  label: string;
  seconds?: number;
  selected: boolean;
  onClick: () => void;
}

function DurationButton({ label, selected, onClick }: DurationButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Compare two output amounts safely using BigInt
 */
function compareOutput(a: string, b: string): number {
  try {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA < bigB) return -1;
    if (bigA > bigB) return 1;
    return 0;
  } catch {
    // Fallback to number comparison
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  }
}

// Hook for using route filters
export function useRouteFilters(routes: NormalizedRoute[]) {
  const [filteredRoutes, setFilteredRoutes] = useState<NormalizedRoute[]>(routes);

  const handleFilterChange = useCallback((newFilteredRoutes: NormalizedRoute[]) => {
    setFilteredRoutes(newFilteredRoutes);
  }, []);

  return {
    filteredRoutes,
    handleFilterChange,
    RouteFiltersComponent: useMemo(
      () => <RouteFilters routes={routes} onFilterChange={handleFilterChange} />,
      [routes, handleFilterChange]
    ),
  };
}

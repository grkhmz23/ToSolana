"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { HistoryList } from "@/components/HistoryList";
import { TokenAmountForm, type FormValues } from "@/components/TokenAmountForm";
import { RoutesList } from "@/components/RoutesList";
import { ProgressTracker } from "@/components/ProgressTracker";
import { RouteFilters } from "@/components/RouteFilters";
import type { NormalizedRoute } from "@/server/schema";

// Extended form values for re-execution
interface TransferFormState extends FormValues {
  sourceAddress?: string;
  solanaAddress?: string;
}

interface HistoryItem {
  id: string;
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
  provider: string;
}

export default function HistoryPage() {
  const { address: evmAddress } = useAccount();
  const { publicKey } = useWallet();

  // Re-execution state
  const [isReExecuting, setIsReExecuting] = useState(false);
  const [routes, setRoutes] = useState<NormalizedRoute[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<NormalizedRoute[]>([]);
  const [quoteErrors, setQuoteErrors] = useState<string[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<NormalizedRoute | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [formState, setFormState] = useState<TransferFormState | null>(null);

  const handleReExecute = useCallback((item: HistoryItem) => {
    // Pre-fill the form with the historical transfer details
    setFormState({
      sourceChainId: item.source.chainId,
      sourceToken: item.source.token,
      sourceAmount: item.source.amount,
      destToken: item.destination.token,
      sourceAddress: item.source.address,
      solanaAddress: item.destination.address,
      slippage: 3, // Default slippage for re-execution
    });
    setIsReExecuting(true);
    setRoutes([]);
    setFilteredRoutes([]);
    setSelectedRoute(null);
    setIsTransferring(false);
  }, []);

  const handleQuotesReceived = useCallback(
    (newRoutes: NormalizedRoute[], errors: string[] | undefined, values: FormValues) => {
      setRoutes(newRoutes);
      setFilteredRoutes(newRoutes);
      setQuoteErrors(errors ?? []);
      setSelectedRoute(null);
      setIsTransferring(false);
      setFormState((prev) => (prev ? { ...prev, ...values } : null));
    },
    []
  );

  const handleCancelReExecute = useCallback(() => {
    setIsReExecuting(false);
    setFormState(null);
    setRoutes([]);
    setFilteredRoutes([]);
    setSelectedRoute(null);
    setIsTransferring(false);
  }, []);

  // Use the selected route from either filtered or original list
  const displayedRoutes = filteredRoutes.length > 0 ? filteredRoutes : routes;

  // Find selected route in displayed routes
  const currentSelectedRoute = useMemo(() => {
    if (!selectedRoute) return null;
    return displayedRoutes.find((r) => r.routeId === selectedRoute.routeId) ?? selectedRoute;
  }, [selectedRoute, displayedRoutes]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          To<span className="text-[var(--primary)]">Solana</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Transfer History</p>
      </div>

      {/* Navigation */}
      <div className="mb-6 flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          Pro Mode
        </Link>
        <Link
          href="/universal"
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          Universal
        </Link>
        <span className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-2 text-sm font-medium text-[var(--primary)]">
          History
        </span>
      </div>

      {isReExecuting && formState ? (
        /* Re-execution Flow */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Repeat Transfer</h2>
            <button
              onClick={handleCancelReExecute}
              className="text-sm text-[var(--muted)] hover:text-[var(--primary)]"
            >
              Cancel
            </button>
          </div>

          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Transfer Details
            </h3>
            <TokenAmountForm
              initialValues={formState}
              onQuotesReceived={handleQuotesReceived}
            />
          </section>

          {/* Routes */}
          {(routes.length > 0 || quoteErrors.length > 0) && (
            <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Select Route
                </h3>
                <RouteFilters routes={routes} onFilterChange={setFilteredRoutes} />
              </div>

              <RoutesList
                routes={displayedRoutes}
                errors={quoteErrors}
                selectedRouteId={selectedRoute?.routeId ?? null}
                onSelectRoute={(route) => {
                  setSelectedRoute(route);
                  setIsTransferring(false);
                }}
                sourceChainId={formState.sourceChainId}
              />

              {currentSelectedRoute && !isTransferring && (
                <button
                  onClick={() => setIsTransferring(true)}
                  className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
                >
                  Proceed with {currentSelectedRoute.provider.toUpperCase()} route
                </button>
              )}
            </section>
          )}

          {/* Execution */}
          {currentSelectedRoute && isTransferring && evmAddress && publicKey && (
            <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                Transfer Progress
              </h3>
              <ProgressTracker
                route={currentSelectedRoute}
                sourceAddress={evmAddress}
                solanaAddress={publicKey.toBase58()}
                sourceChainId={formState.sourceChainId}
                sourceToken={formState.sourceToken}
                sourceAmount={formState.sourceAmount}
                destToken={formState.destToken}
              />
            </section>
          )}
        </div>
      ) : (
        /* History List */
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Past Transfers
          </h2>
          <HistoryList onReExecute={handleReExecute} />
        </section>
      )}

      {/* Footer info */}
      <footer className="mt-8 text-center text-xs text-[var(--muted)]">
        <p>Non-custodial. Your keys, your assets.</p>
        <p className="mt-1">
          Powered by LI.FI and Rango. ToSolana never holds or signs your transactions.
        </p>
      </footer>
    </main>
  );
}

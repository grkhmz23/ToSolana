"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectEvmWallet } from "@/components/ConnectEvmWallet";
import { ConnectSolanaWallet } from "@/components/ConnectSolanaWallet";
import { TokenAmountForm } from "@/components/TokenAmountForm";
import { RoutesList } from "@/components/RoutesList";
import { ProgressTracker } from "@/components/ProgressTracker";
import type { NormalizedRoute } from "@/server/schema";

export default function Home() {
  const { address: evmAddress } = useAccount();
  const { publicKey } = useWallet();

  const [routes, setRoutes] = useState<NormalizedRoute[]>([]);
  const [quoteErrors, setQuoteErrors] = useState<string[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<NormalizedRoute | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          To<span className="text-[var(--primary)]">Solana</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Bridge assets from EVM chains to Solana
        </p>
      </div>

      {/* Mode Navigation */}
      <div className="mb-6 flex justify-center gap-2">
        <span className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-2 text-sm font-medium text-[var(--primary)]">
          Pro Mode
        </span>
        <Link
          href="/universal"
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          Universal: Any chain → Solana
        </Link>
      </div>

      {/* Section A: Connect Wallets */}
      <section className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          1. Connect Wallets
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs text-[var(--muted)]">Source (EVM)</label>
            <ConnectEvmWallet />
          </div>
          <div>
            <label className="mb-2 block text-xs text-[var(--muted)]">
              Destination (Solana)
            </label>
            <ConnectSolanaWallet />
          </div>
        </div>
      </section>

      {/* Section B: Transfer Details */}
      <section className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          2. Transfer Details
        </h2>
        <TokenAmountForm
          onQuotesReceived={(newRoutes, errors) => {
            setRoutes(newRoutes);
            setQuoteErrors(errors ?? []);
            setSelectedRoute(null);
            setIsTransferring(false);
          }}
        />
      </section>

      {/* Section C: Quotes */}
      {(routes.length > 0 || quoteErrors.length > 0) && (
        <section className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            3. Select Route
          </h2>
          <RoutesList
            routes={routes}
            errors={quoteErrors}
            selectedRouteId={selectedRoute?.routeId ?? null}
            onSelectRoute={(route) => {
              setSelectedRoute(route);
              setIsTransferring(false);
            }}
          />

          {selectedRoute && !isTransferring && (
            <button
              onClick={() => setIsTransferring(true)}
              className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-90 transition-opacity"
            >
              Proceed with {selectedRoute.provider.toUpperCase()} route
            </button>
          )}
        </section>
      )}

      {/* Section D: Execution + Progress */}
      {selectedRoute && isTransferring && evmAddress && publicKey && (
        <section className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            4. Transfer Progress
          </h2>
          <ProgressTracker
            route={selectedRoute}
            sourceAddress={evmAddress}
            solanaAddress={publicKey.toBase58()}
          />
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

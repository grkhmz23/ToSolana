"use client";

import dynamic from "next/dynamic";
import type { WidgetConfig } from "@rango-dev/widget-embedded";
import Link from "next/link";

// Dynamically import the Rango widget with SSR disabled
const Widget = dynamic(
  () => import("@rango-dev/widget-embedded").then((mod) => mod.Widget),
  { ssr: false, loading: () => <WidgetSkeleton /> }
);

function WidgetSkeleton() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
    </div>
  );
}

export default function UniversalPage() {
  const apiKey = process.env.NEXT_PUBLIC_RANGO_API_KEY ?? "";
  const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

  // Widget configuration with ToSolana branding
  const config: WidgetConfig = {
    apiKey,
    ...(walletConnectProjectId && { walletConnectProjectId }),
    // Prefill destination to Solana
    to: {
      blockchain: "SOLANA",
    },
    // Dark theme with ToSolana primary color
    theme: {
      mode: "dark",
      colors: {
        dark: {
          primary: "#9945ff", // ToSolana purple
          background: "#0a0a0a", // Match app background
          foreground: "#ededed", // Match app foreground
          neutral: "#2a2a2a",
          secondary: "#14f195", // ToSolana accent
        },
      },
    },
  };

  // If no API key is set, show error message
  if (!apiKey) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h1 className="text-xl font-bold text-[var(--foreground)]">Universal Mode</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Bridge from any of 65+ chains to Solana
          </p>
        </div>

        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 p-4 text-[var(--danger)]">
          <p className="font-medium">Configuration Error</p>
          <p className="mt-1 text-sm">
            NEXT_PUBLIC_RANGO_API_KEY is not set. Please add it to your .env file.
          </p>
          <p className="mt-2 text-xs">
            Get your API key at{" "}
            <a
              href="https://app.rango.exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              app.rango.exchange
            </a>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            ← Back to Pro Mode
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          To<span className="text-[var(--primary)]">Solana</span> Universal
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Bridge from any chain to Solana
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-6 flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          Pro Mode
        </Link>
        <span className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-2 text-sm font-medium text-[var(--primary)]">
          Universal Mode
        </span>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-xl border border-[var(--card-border)] bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
            i
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Universal Mode supports 65+ blockchains
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Use Universal for any chain → Solana. For EVM → Solana with the best UX and
              aggregated quotes from multiple providers, try{" "}
              <Link href="/" className="text-[var(--primary)] underline hover:no-underline">
                Pro Mode
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Rango Widget */}
      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <Widget config={config} />
      </section>

      {/* Footer info */}
      <footer className="mt-8 text-center text-xs text-[var(--muted)]">
        <p>Powered by Rango Exchange. ToSolana never holds your assets.</p>
        <p className="mt-1">
          <a
            href="https://rango.exchange/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--primary)]"
          >
            Learn more about Rango →
          </a>
        </p>
      </footer>
    </main>
  );
}

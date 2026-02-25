"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { buildDashboardAuthMessage } from "@/lib/solana-auth";

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerWallet: string;
  tokens: Array<{
    id: string;
    symbol: string;
    sourceChainId: number;
    sourceTokenAddress: string;
    decimals: number;
    totalSupply: string;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    snapshotBlock: string;
  }>;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { publicKey, signMessage, connected } = useWallet();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [tokenForm, setTokenForm] = useState({
    sourceChainId: "1",
    sourceTokenAddress: "",
    symbol: "",
    decimals: "18",
    totalSupply: "",
  });

  const ownerWallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/migration/projects/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Failed to load project");
        setProject(data.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleCreateToken = async () => {
    if (!project || !publicKey || !signMessage) {
      setActionError("Wallet not connected or signing not supported.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const timestamp = Date.now();
      const message = buildDashboardAuthMessage({
        action: "create_token",
        wallet: ownerWallet,
        timestamp,
        resource: project.id,
      });
      const signature = await signMessage(new TextEncoder().encode(message));
      const res = await fetch("/api/migration/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          sourceChainId: Number(tokenForm.sourceChainId),
          sourceTokenAddress: tokenForm.sourceTokenAddress,
          symbol: tokenForm.symbol,
          decimals: Number(tokenForm.decimals),
          totalSupply: tokenForm.totalSupply,
          signature: bs58.encode(signature),
          timestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to register token");
      setActionSuccess("Token registered successfully.");
      setTokenForm({
        sourceChainId: "1",
        sourceTokenAddress: "",
        symbol: "",
        decimals: "18",
        totalSupply: "",
      });
      const refreshed = await fetch(`/api/migration/projects/${slug}`).then((r) => r.json());
      setProject(refreshed.data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project: {project?.name}</h1>
          <p className="text-sm text-slate-400">Slug: {slug}</p>
        </div>
        <WalletMultiButton className="!bg-white !text-black hover:!bg-slate-100" />
      </div>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {project && (
        <div className="space-y-6">
          {actionError && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="rounded border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              {actionSuccess}
            </div>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Registered Tokens</h2>
              <Link
                href="/dashboard/campaign/new"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100"
              >
                New Campaign
              </Link>
            </div>
            <div className="space-y-2">
              {project.tokens.length === 0 && (
                <p className="text-sm text-slate-400">No tokens registered yet.</p>
              )}
              {project.tokens.map((token) => (
                <div
                  key={token.id}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm bg-white/[0.02]"
                >
                  <div className="font-medium text-white">
                    {token.symbol} · Chain {token.sourceChainId}
                  </div>
                  <div className="text-xs text-slate-400">{token.sourceTokenAddress}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Register Token</h2>
            {!connected && (
              <div className="text-sm text-slate-400">Connect your wallet to register a token.</div>
            )}
            {connected && (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  placeholder="Source Chain ID"
                  value={tokenForm.sourceChainId}
                  onChange={(e) => setTokenForm({ ...tokenForm, sourceChainId: e.target.value })}
                />
                <input
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  placeholder="Token Address (EVM)"
                  value={tokenForm.sourceTokenAddress}
                  onChange={(e) => setTokenForm({ ...tokenForm, sourceTokenAddress: e.target.value })}
                />
                <input
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  placeholder="Symbol"
                  value={tokenForm.symbol}
                  onChange={(e) => setTokenForm({ ...tokenForm, symbol: e.target.value })}
                />
                <input
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  placeholder="Decimals"
                  value={tokenForm.decimals}
                  onChange={(e) => setTokenForm({ ...tokenForm, decimals: e.target.value })}
                />
                <input
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500 md:col-span-2"
                  placeholder="Total Supply (raw integer)"
                  value={tokenForm.totalSupply}
                  onChange={(e) => setTokenForm({ ...tokenForm, totalSupply: e.target.value })}
                />
                <button
                  onClick={handleCreateToken}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100 md:col-span-2"
                >
                  Register Token
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Campaigns</h2>
            {project.campaigns.length === 0 && (
              <p className="text-sm text-slate-400">No campaigns created yet.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {project.campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/dashboard/campaign/${campaign.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm transition-colors hover:border-white/20"
                >
                  <div className="font-medium text-white">{campaign.name}</div>
                  <div className="text-xs text-slate-400">Status: {campaign.status}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

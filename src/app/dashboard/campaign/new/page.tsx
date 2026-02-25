"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { buildDashboardAuthMessage } from "@/lib/solana-auth";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface Token {
  id: string;
  symbol: string;
  sourceChainId: number;
}

export default function NewCampaignPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const ownerWallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [name, setName] = useState("");
  const [snapshotBlock, setSnapshotBlock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ownerWallet) return;
    fetch(`/api/migration/projects?ownerWallet=${ownerWallet}`)
      .then((res) => res.json())
      .then((data) => setProjects(data.data ?? []))
      .catch(() => setProjects([]));
  }, [ownerWallet]);

  useEffect(() => {
    if (!projectId) {
      setTokens([]);
      return;
    }
    const selected = projects.find((p) => p.id === projectId);
    if (!selected) return;
    fetch(`/api/migration/projects/${selected.slug}`)
      .then((res) => res.json())
      .then((data) => setTokens(data.data?.tokens ?? []))
      .catch(() => setTokens([]));
  }, [projectId, projects]);

  const handleCreate = async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support signing.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const timestamp = Date.now();
      const message = buildDashboardAuthMessage({
        action: "create_campaign",
        wallet: ownerWallet,
        timestamp,
        resource: projectId,
      });
      const signature = await signMessage(new TextEncoder().encode(message));
      const res = await fetch("/api/migration/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          tokenId,
          name,
          snapshotBlock,
          signature: bs58.encode(signature),
          timestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }
      setSuccess("Campaign created.");
      setName("");
      setSnapshotBlock("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Campaign</h1>
          <p className="text-sm text-slate-400">Configure snapshot and claim campaign</p>
        </div>
        <WalletMultiButton className="!bg-white !text-black hover:!bg-slate-100" />
      </div>

      {!connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Connect your wallet to create a campaign.
        </div>
      )}

      {connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-slate-400">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Token</label>
            <select
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white"
            >
              <option value="">Select token</option>
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.symbol} (Chain {t.sourceChainId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Campaign Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Season 1 Migration"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Snapshot Block</label>
            <input
              value={snapshotBlock}
              onChange={(e) => setSnapshotBlock(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Block number"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Campaign"}
          </button>

          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
            ← Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

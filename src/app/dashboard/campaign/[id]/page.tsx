"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { buildDashboardAuthMessage } from "@/lib/solana-auth";

interface Campaign {
  id: string;
  name: string;
  status: string;
  snapshotBlock: string;
  merkleRoot: string | null;
  project: { id: string; name: string; ownerWallet: string };
  token: { symbol: string; sourceChainId: number; sourceTokenAddress: string };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { publicKey, signMessage, connected } = useWallet();
  const ownerWallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState<{ processedBlocks: number; totalBlocks: number; holders: number; status: string } | null>(null);

  const fetchCampaign = useCallback(() => {
    fetch(`/api/migration/campaigns/${id}`)
      .then((res) => res.json())
      .then((data) => setCampaign(data.data))
      .catch(() => setCampaign(null));
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    if (!campaign || campaign.status !== "snapshotting") return;
    const interval = setInterval(() => {
      fetch(`/api/snapshot/status?campaignId=${campaign.id}`)
        .then((res) => res.json())
        .then((data) => setSnapshotProgress(data))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [campaign]);

  const signAction = async (action: string): Promise<{ signature: string; timestamp: number } | null> => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or signing not supported.");
      return null;
    }
    const timestamp = Date.now();
    const message = buildDashboardAuthMessage({
      action,
      wallet: ownerWallet,
      timestamp,
      resource: id,
    });
    const signature = await signMessage(new TextEncoder().encode(message));
    return { signature: bs58.encode(signature), timestamp };
  };

  const startSnapshot = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const signed = await signAction("start_snapshot");
      if (!signed) return;
      const res = await fetch("/api/snapshot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, ...signed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Snapshot failed");
      setSuccess("Snapshot started.");
      fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const generateMerkle = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const signed = await signAction("generate_merkle");
      if (!signed) return;
      const res = await fetch("/api/merkle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, ...signed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Merkle generation failed");
      setSuccess("Merkle tree generated.");
      fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const signed = await signAction("update_campaign_status");
      if (!signed) return;
      const res = await fetch(`/api/migration/campaigns/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...signed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Status update failed");
      setSuccess(`Campaign moved to ${status}.`);
      fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign</h1>
          <p className="text-sm text-slate-400">{campaign?.name}</p>
        </div>
        <WalletMultiButton className="!bg-white !text-black hover:!bg-slate-100" />
      </div>

      {!connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Connect your wallet to manage this campaign.
        </div>
      )}

      {campaign && (
        <div className="space-y-6">
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-slate-400">Status</div>
            <div className="text-lg font-semibold text-white">{campaign.status}</div>
            <div className="mt-2 text-xs text-slate-400">
              Snapshot Block: {campaign.snapshotBlock}
            </div>
            {campaign.merkleRoot && (
              <div className="mt-2 text-xs text-slate-400">Merkle Root: {campaign.merkleRoot}</div>
            )}
            <div className="mt-3 text-xs text-slate-400">
              Token: {campaign.token.symbol} (Chain {campaign.token.sourceChainId})
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Actions</h2>
            <button
              onClick={startSnapshot}
              disabled={loading || !connected}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100 disabled:opacity-60"
            >
              Start Snapshot
            </button>
            <button
              onClick={generateMerkle}
              disabled={loading || !connected}
              className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
            >
              Generate Merkle Tree
            </button>
            <button
              onClick={() => updateStatus("live")}
              disabled={loading || !connected}
              className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
            >
              Activate Campaign
            </button>
            <button
              onClick={() => updateStatus("ended")}
              disabled={loading || !connected}
              className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
            >
              End Campaign
            </button>
          </section>

          {snapshotProgress && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-sm font-semibold text-white">Snapshot Progress</h3>
              <p className="text-xs text-slate-400">
                {snapshotProgress.processedBlocks} / {snapshotProgress.totalBlocks} blocks processed · {snapshotProgress.holders} holders
              </p>
            </section>
          )}

          <Link href={`/claim/${campaign.id}`} className="text-sm text-slate-200 hover:text-white">
            View public claim page →
          </Link>

          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
            ← Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

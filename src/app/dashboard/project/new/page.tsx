"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildDashboardAuthMessage } from "@/lib/solana-auth";
import bs58 from "bs58";

export default function NewProjectPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
        action: "create_project",
        wallet: publicKey.toBase58(),
        timestamp,
        resource: slug,
      });
      const signature = await signMessage(new TextEncoder().encode(message));
      const res = await fetch("/api/migration/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          ownerWallet: publicKey.toBase58(),
          signature: bs58.encode(signature),
          timestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create project");
      }
      setSuccess("Project created successfully.");
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Project</h1>
          <p className="text-sm text-slate-400">Register your token project</p>
        </div>
        <WalletMultiButton className="!bg-white !text-black hover:!bg-slate-100" />
      </div>

      {!connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Connect your wallet to create a project.
        </div>
      )}

      {connected && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
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
            <label className="mb-1 block text-sm text-slate-400">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Example Labs"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="example-labs"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>

          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
            ← Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

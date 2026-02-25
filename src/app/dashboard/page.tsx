"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerWallet: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const ownerWallet = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects", ownerWallet],
    queryFn: async () => {
      if (!ownerWallet) return [];
      const res = await fetch(`/api/migration/projects?ownerWallet=${ownerWallet}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load projects");
      }
      return json.data as Project[];
    },
    enabled: !!ownerWallet,
  });

  const projects = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project Migration Dashboard</h1>
          <p className="text-sm text-slate-400">Manage projects and migration campaigns</p>
        </div>
        <WalletMultiButton className="!bg-white !text-black hover:!bg-slate-100" />
      </div>

      {!connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-300">
          Connect your Solana wallet to view your projects.
        </div>
      )}

      {connected && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Projects</h2>
            <Link
              href="/dashboard/project/new"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-100"
            >
              New Project
            </Link>
          </div>

          {isLoading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && projects.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
              No projects yet. Create your first project to start a migration campaign.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/project/${project.slug}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
              >
                <div className="text-sm text-slate-400">{project.slug}</div>
                <div className="text-lg font-semibold text-white">{project.name}</div>
                <div className="mt-2 text-xs text-slate-400">
                  Owner: {project.ownerWallet.slice(0, 6)}...{project.ownerWallet.slice(-4)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

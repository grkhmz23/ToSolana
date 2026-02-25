// Admin dashboard
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminFetch, clearAdminKey } from "@/lib/admin-client";

interface Stats {
  totalTokens: number;
  activeTokens: number;
  draftTokens: number;
  disabledTokens: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/tokens");

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setError("Invalid admin key. Please sign in again.");
          router.replace("/admin");
          return;
        }
        throw new Error("Failed to fetch stats");
      }

      const data = await res.json();
      if (data.ok) {
        const tokens = data.data;
        setStats({
          totalTokens: tokens.length,
          activeTokens: tokens.filter((t: { status: string }) => t.status === "ACTIVE").length,
          draftTokens: tokens.filter((t: { status: string }) => t.status === "DRAFT").length,
          disabledTokens: tokens.filter((t: { status: string }) => t.status === "DISABLED").length,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Tokens</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.totalTokens}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{stats.activeTokens}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Draft</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{stats.draftTokens}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Disabled</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{stats.disabledTokens}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex space-x-4">
          <Link
            href="/admin/tokens"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Manage Tokens
          </Link>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900">About Official 1:1 Bridges</h4>
        <p className="mt-1 text-sm text-blue-700">
          Official 1:1 bridges use NTT (Native Token Transfer) or OFT (Omnichain Fungible Token) 
          standards for seamless cross-chain transfers without traditional bridging fees or slippage.
          These routes appear at the top of quote results for users.
        </p>
      </div>
    </div>
  );
}

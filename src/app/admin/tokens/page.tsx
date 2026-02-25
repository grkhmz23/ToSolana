// Admin tokens list
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminKey } from "@/lib/admin-client";

interface Token {
  id: string;
  symbol: string;
  name: string;
  sourceChainId: number;
  sourceTokenAddress: string;
  solanaMint: string;
  mode: string;
  status: string;
  verifiedAt: string | null;
  verificationCount: number;
}

export default function AdminTokensPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    sourceChainId: "1",
    sourceTokenAddress: "",
    solanaMint: "",
    mode: "NTT" as "WRAPPED" | "NTT" | "OFT",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      setActionError(null);
      const res = await adminFetch("/api/admin/tokens");

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setError("Invalid admin key. Please sign in again.");
          router.replace("/admin");
          return;
        }
        throw new Error("Failed to fetch tokens");
      }

      const data = await res.json();
      if (data.ok) {
        setTokens(data.data);
        setActionSuccess(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await adminFetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sourceChainId: parseInt(formData.sourceChainId),
        }),
      });

      if (res.status === 401) {
        clearAdminKey();
        setError("Invalid admin key. Please sign in again.");
        router.replace("/admin");
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setShowCreateForm(false);
        setFormData({
          sourceChainId: "1",
          sourceTokenAddress: "",
          solanaMint: "",
          mode: "NTT",
          notes: "",
        });
        fetchTokens();
        setActionSuccess("Token created successfully");
      } else {
        setActionError(data.error?.message || "Failed to create token");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      DRAFT: "bg-yellow-100 text-yellow-800",
      DISABLED: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  const getModeBadge = (mode: string) => {
    const colors: Record<string, string> = {
      NTT: "bg-purple-100 text-purple-800",
      OFT: "bg-blue-100 text-blue-800",
      WRAPPED: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[mode] || "bg-gray-100"}`}>
        {mode}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Project Tokens</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showCreateForm ? "Cancel" : "Add Token"}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Token</h3>
          {actionError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {actionSuccess}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Source Chain</label>
                <select
                  value={formData.sourceChainId}
                  onChange={(e) => setFormData({ ...formData, sourceChainId: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="1">Ethereum (1)</option>
                  <option value="56">BNB Chain (56)</option>
                  <option value="137">Polygon (137)</option>
                  <option value="42161">Arbitrum (42161)</option>
                  <option value="10">Optimism (10)</option>
                  <option value="8453">Base (8453)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mode</label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as "NTT" | "OFT" | "WRAPPED" })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="NTT">NTT (Native Token Transfer)</option>
                  <option value="OFT">OFT (Omnichain Fungible Token)</option>
                  <option value="WRAPPED">Wrapped</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">ERC20 Address</label>
              <input
                type="text"
                value={formData.sourceTokenAddress}
                onChange={(e) => setFormData({ ...formData, sourceTokenAddress: e.target.value })}
                placeholder="0x..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Solana Mint</label>
              <input
                type="text"
                value={formData.solanaMint}
                onChange={(e) => setFormData({ ...formData, solanaMint: e.target.value })}
                placeholder="Base58 address..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Token"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {!showCreateForm && actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {actionSuccess}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tokens.map((token) => (
              <tr key={token.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{token.symbol}</div>
                  <div className="text-sm text-gray-500">{token.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{token.sourceChainId}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[150px]">
                    {token.sourceTokenAddress}
                  </div>
                </td>
                <td className="px-6 py-4">{getModeBadge(token.mode)}</td>
                <td className="px-6 py-4">{getStatusBadge(token.status)}</td>
                <td className="px-6 py-4">
                  {token.verifiedAt ? (
                    <span className="text-green-600 text-sm">✓ Yes</span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <a
                    href={`/admin/tokens/${token.id}`}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Edit →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokens.length === 0 && (
          <div className="text-center py-8 text-gray-500">No tokens found</div>
        )}
      </div>
    </div>
  );
}

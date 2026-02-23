// Admin token detail/edit page
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Token {
  id: string;
  symbol: string;
  name: string;
  sourceChainId: number;
  sourceTokenAddress: string;
  solanaMint: string;
  decimals: number;
  mode: string;
  status: string;
  verifiedAt: string | null;
  notes: string | null;
  providerConfig: string | null;
  verificationLogs: Array<{
    id: string;
    createdAt: string;
    ok: boolean;
    details: string;
  }>;
}

export default function TokenDetailPage() {
  const params = useParams();
  const tokenId = params.id as string;

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Token>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tokenId) {
      fetchToken();
    }
  }, [tokenId]);

  const fetchToken = async () => {
    try {
      const adminKey = sessionStorage.getItem("adminKey");
      const res = await fetch(`/api/admin/tokens/${tokenId}`, {
        headers: { "x-admin-key": adminKey || "" },
      });

      if (!res.ok) throw new Error("Failed to fetch token");

      const data = await res.json();
      if (data.ok) {
        setToken(data.data);
        setEditForm(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const adminKey = sessionStorage.getItem("adminKey");
      const res = await fetch(`/api/admin/tokens/${tokenId}/verify`, {
        method: "POST",
        headers: { "x-admin-key": adminKey || "" },
      });

      const data = await res.json();
      if (data.ok) {
        alert(`Verification ${data.data.verified ? "successful" : "failed"}`);
        fetchToken();
      } else {
        alert(data.error?.message || "Verification failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVerifying(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const adminKey = sessionStorage.getItem("adminKey");
      const res = await fetch(`/api/admin/tokens/${tokenId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey || "",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.ok) {
        fetchToken();
      } else {
        alert(data.error?.message || "Status update failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const adminKey = sessionStorage.getItem("adminKey");
      const res = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey || "",
        },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (data.ok) {
        fetchToken();
        alert("Saved successfully");
      } else {
        alert(data.error?.message || "Save failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error || "Token not found"}
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      DRAFT: "bg-yellow-100 text-yellow-800",
      DISABLED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{token.symbol}</h2>
          <p className="text-gray-500">{token.name}</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(token.status)}`}>
            {token.status}
          </span>
          <a href="/admin/tokens" className="text-blue-600 hover:text-blue-800">
            ← Back to list
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
        <div className="flex space-x-4">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Verify On-Chain"}
          </button>

          {token.status === "DRAFT" && token.verifiedAt && (
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={updatingStatus}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Activate
            </button>
          )}

          {token.status === "ACTIVE" && (
            <button
              onClick={() => handleStatusChange("DISABLED")}
              disabled={updatingStatus}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Disable
            </button>
          )}

          {token.status === "DISABLED" && (
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={updatingStatus}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Re-enable
            </button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Token Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Symbol</label>
            <input
              type="text"
              value={editForm.symbol || ""}
              onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={editForm.name || ""}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Decimals</label>
            <input
              type="number"
              value={editForm.decimals || 0}
              onChange={(e) => setEditForm({ ...editForm, decimals: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mode</label>
            <select
              value={editForm.mode || "WRAPPED"}
              onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="NTT">NTT</option>
              <option value="OFT">OFT</option>
              <option value="WRAPPED">Wrapped</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">ERC20 Address</label>
            <input
              type="text"
              value={token.sourceTokenAddress}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Solana Mint</label>
            <input
              type="text"
              value={editForm.solanaMint || ""}
              onChange={(e) => setEditForm({ ...editForm, solanaMint: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              rows={3}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Verification Logs */}
      {token.verificationLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Verification History</h3>
          <div className="space-y-2">
            {token.verificationLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-md ${log.ok ? "bg-green-50" : "bg-red-50"}`}
              >
                <div className="flex justify-between">
                  <span className={log.ok ? "text-green-800" : "text-red-800"}>
                    {log.ok ? "✓ Success" : "✗ Failed"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

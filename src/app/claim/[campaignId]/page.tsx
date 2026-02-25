"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { buildClaimMessage } from "@/lib/solana-auth";
import { ConnectEvmWallet } from "@/components/ConnectEvmWallet";

type ClaimData = {
  campaignId: string;
  address: string;
  amount: string;
  proof: string[];
  claimed: boolean;
  merkleRoot: string;
  claimedAt: string | null;
};

export default function ClaimPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`/api/claim/${campaignId}/${address}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Failed to fetch claim");
        setClaim(data.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [campaignId, address]);

  const handleClaim = async () => {
    if (!claim || !address || !signMessageAsync) {
      setError("Wallet not connected or signing not supported.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const timestamp = Date.now();
      const message = buildClaimMessage({
        campaignId,
        wallet: address,
        amount: claim.amount,
        timestamp,
      });
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          address,
          amount: claim.amount,
          proof: claim.proof,
          signature,
          timestamp,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Claim failed");
      }
      setSuccess("Claim verified. Your allocation is now marked as claimed.");
      setClaim({ ...claim, claimed: true, claimedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Claim Tokens</h1>
          <p className="text-sm text-[var(--muted)]">Campaign: {campaignId}</p>
        </div>
        <ConnectEvmWallet />
      </div>

      {!isConnected && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
          Connect your EVM wallet to check eligibility.
        </div>
      )}

      {isConnected && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded border border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 p-3 text-sm text-[var(--accent)]">
              {success}
            </div>
          )}

          {!loading && claim === null && (
            <div className="text-sm text-[var(--muted)]">
              You are not eligible for this campaign.
            </div>
          )}

          {claim && (
            <>
              <div className="rounded-lg border border-[var(--card-border)] p-4 text-sm">
                <div className="text-[var(--muted)]">Claimable Amount</div>
                <div className="text-lg font-semibold text-[var(--foreground)]">
                  {claim.amount}
                </div>
              </div>
              <button
                onClick={handleClaim}
                disabled={loading || claim.claimed}
                className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
              >
                {claim.claimed ? "Already Claimed" : "Claim Now"}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

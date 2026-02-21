"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { shortenAddress } from "@/lib/format";
import { getChainName } from "@/lib/chains";

export function ConnectEvmWallet() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--accent)]">
            {shortenAddress(address)}
          </span>
          <span className="text-xs text-[var(--muted)]">{getChainName(chainId)}</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {isPending ? "Connecting..." : connector.name}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-[var(--danger)]">{error.message}</p>
      )}
    </div>
  );
}

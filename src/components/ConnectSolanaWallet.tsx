"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { shortenAddress } from "@/lib/format";

export function ConnectSolanaWallet() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="flex items-center gap-3">
      <WalletMultiButton />
      {connected && publicKey && (
        <span className="text-sm text-[var(--accent)]">
          {shortenAddress(publicKey.toBase58())}
        </span>
      )}
    </div>
  );
}

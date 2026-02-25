// Blockchain explorer URLs for different chains
// Supports EVM, Bitcoin, Cosmos, and TON

// EVM chain explorers
const EVM_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  56: "https://bscscan.com",
  137: "https://polygonscan.com",
  42161: "https://arbiscan.io",
  8453: "https://basescan.org",
  43114: "https://snowtrace.io",
  250: "https://ftmscan.com",
  100: "https://gnosisscan.io",
  25: "https://cronoscan.com",
  324: "https://explorer.zksync.io",
  1101: "https://zkevm.polygonscan.com",
  59144: "https://lineascan.build",
  534352: "https://scrollscan.com",
  5000: "https://mantlescan.xyz",
  81457: "https://blastscan.io",
  169: "https://pacific-explorer.manta.network",
  7777777: "https://explorer.zora.energy",
};

// Non-EVM chain explorers
const NON_EVM_EXPLORERS: Record<string, { tx: string; address: string; name: string }> = {
  bitcoin: {
    tx: "https://mempool.space/tx/{hash}",
    address: "https://mempool.space/address/{address}",
    name: "Mempool",
  },
  cosmos: {
    tx: "https://www.mintscan.io/cosmos/txs/{hash}",
    address: "https://www.mintscan.io/cosmos/address/{address}",
    name: "Mintscan",
  },
  osmosis: {
    tx: "https://www.mintscan.io/osmosis/txs/{hash}",
    address: "https://www.mintscan.io/osmosis/address/{address}",
    name: "Mintscan",
  },
  injective: {
    tx: "https://www.mintscan.io/injective/txs/{hash}",
    address: "https://www.mintscan.io/injective/address/{address}",
    name: "Mintscan",
  },
  evmos: {
    tx: "https://www.mintscan.io/evmos/txs/{hash}",
    address: "https://www.mintscan.io/evmos/address/{address}",
    name: "Mintscan",
  },
  juno: {
    tx: "https://www.mintscan.io/juno/txs/{hash}",
    address: "https://www.mintscan.io/juno/address/{address}",
    name: "Mintscan",
  },
  stargaze: {
    tx: "https://www.mintscan.io/stargaze/txs/{hash}",
    address: "https://www.mintscan.io/stargaze/address/{address}",
    name: "Mintscan",
  },
  ton: {
    tx: "https://tonscan.org/tx/{hash}",
    address: "https://tonscan.org/address/{address}",
    name: "TONScan",
  },
  solana: {
    tx: "https://solscan.io/tx/{hash}",
    address: "https://solscan.io/address/{address}",
    name: "Solscan",
  },
};

/**
 * Get transaction explorer URL
 */
export function getTxExplorerUrl(
  chainId: number | string,
  txHash: string
): string | null {
  if (typeof chainId === "number") {
    const base = EVM_EXPLORERS[chainId];
    return base ? `${base}/tx/${txHash}` : null;
  }

  const explorer = NON_EVM_EXPLORERS[chainId.toLowerCase()];
  return explorer ? explorer.tx.replace("{hash}", txHash) : null;
}

/**
 * Get address explorer URL
 */
export function getAddressExplorerUrl(
  chainId: number | string,
  address: string
): string | null {
  if (typeof chainId === "number") {
    const base = EVM_EXPLORERS[chainId];
    return base ? `${base}/address/${address}` : null;
  }

  const explorer = NON_EVM_EXPLORERS[chainId.toLowerCase()];
  return explorer ? explorer.address.replace("{address}", address) : null;
}

/**
 * Get explorer name for a chain
 */
export function getExplorerName(chainId: number | string): string {
  if (typeof chainId === "number") {
    return "Block Explorer";
  }

  const explorer = NON_EVM_EXPLORERS[chainId.toLowerCase()];
  return explorer?.name ?? "Explorer";
}

/**
 * Open explorer in new tab
 */
export function openTxExplorer(
  chainId: number | string,
  txHash: string
): void {
  const url = getTxExplorerUrl(chainId, txHash);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function openAddressExplorer(
  chainId: number | string,
  address: string
): void {
  const url = getAddressExplorerUrl(chainId, address);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

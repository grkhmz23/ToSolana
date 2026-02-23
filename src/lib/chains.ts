import {
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  bsc,
  avalanche,
  fantom,
  zkSync,
  polygonZkEvm,
  gnosis,
  cronos,
  linea,
  scroll,
  mantle,
  blast,
  celo,
  aurora,
  harmonyOne,
  metis,
} from "wagmi/chains";
import type { Chain } from "wagmi/chains";

// Define additional chains that may not be in wagmi yet
const mantaPacific: Chain = {
  id: 169,
  name: "Manta Pacific",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://pacific-rpc.manta.network/http"] },
    public: { http: ["https://pacific-rpc.manta.network/http"] },
  },
  blockExplorers: {
    default: { name: "Manta Explorer", url: "https://pacific-explorer.manta.network" },
  },
};

const zora: Chain = {
  id: 7777777,
  name: "Zora",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.zora.energy"] },
    public: { http: ["https://rpc.zora.energy"] },
  },
  blockExplorers: {
    default: { name: "Zora Explorer", url: "https://explorer.zora.energy" },
  },
};

export const SUPPORTED_CHAINS: Chain[] = [
  // Major L1s
  mainnet,          // Ethereum
  bsc,              // BNB Chain
  avalanche,        // Avalanche C-Chain
  
  // Major L2s
  arbitrum,         // Arbitrum One
  optimism,         // Optimism
  base,             // Base
  polygon,          // Polygon PoS
  zkSync,           // zkSync Era
  polygonZkEvm,     // Polygon zkEVM
  linea,            // Linea
  scroll,           // Scroll
  mantle,           // Mantle
  blast,            // Blast
  
  // Other EVM chains
  fantom,           // Fantom
  gnosis,           // Gnosis Chain
  cronos,           // Cronos
  celo,             // Celo
  aurora,           // Aurora (Near EVM)
  harmonyOne,       // Harmony
  metis,            // Metis
  mantaPacific,     // Manta Pacific
  zora,             // Zora
];

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

export const CHAIN_MAP: Record<number, Chain> = {};
for (const chain of SUPPORTED_CHAINS) {
  CHAIN_MAP[chain.id] = chain;
}

export function getChainName(chainId: number): string {
  return CHAIN_MAP[chainId]?.name ?? `Chain ${chainId}`;
}

export function isEvmChainSupported(chainId: number): boolean {
  return chainId in CHAIN_MAP;
}

// Get chain by ID
export function getChain(chainId: number): Chain | undefined {
  return CHAIN_MAP[chainId];
}

// Get RPC URL for a chain
export function getRpcUrl(chainId: number): string | undefined {
  const chain = CHAIN_MAP[chainId];
  return chain?.rpcUrls?.default?.http?.[0];
}

// Get explorer URL for a chain
export function getExplorerUrl(chainId: number): string | undefined {
  const chain = CHAIN_MAP[chainId];
  return chain?.blockExplorers?.default?.url;
}

// Native token symbol by chain
export function getNativeTokenSymbol(chainId: number): string {
  const symbols: Record<number, string> = {
    1: "ETH",
    56: "BNB",
    43114: "AVAX",
    42161: "ETH",
    10: "ETH",
    8453: "ETH",
    137: "MATIC",
    324: "ETH",
    1101: "ETH",
    59144: "ETH",
    534352: "ETH",
    5000: "MNT",
    81457: "ETH",
    250: "FTM",
    100: "xDAI",
    25: "CRO",
    42220: "CELO",
    1313161554: "ETH",
    1666600000: "ONE",
    1088: "METIS",
    169: "ETH",
    7777777: "ETH",
  };
  return symbols[chainId] ?? "ETH";
}

export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// ============================================
// Non-EVM Chain Support
// ============================================

export type ChainType = "evm" | "bitcoin" | "cosmos" | "ton";

export interface NonEvmChain {
  id: string;
  name: string;
  type: ChainType;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls?: { default: { http: string[] } };
  blockExplorers?: { default: { name: string; url: string } };
}

// Bitcoin
export const BITCOIN_CHAIN: NonEvmChain = {
  id: "bitcoin",
  name: "Bitcoin",
  type: "bitcoin",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 8 },
  rpcUrls: {
    default: { http: ["https://blockstream.info/api"] },
  },
  blockExplorers: {
    default: { name: "Mempool", url: "https://mempool.space" },
  },
};

// Cosmos Hub
export const COSMOS_HUB_CHAIN: NonEvmChain = {
  id: "cosmos",
  name: "Cosmos Hub",
  type: "cosmos",
  nativeCurrency: { name: "Cosmos", symbol: "ATOM", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.cosmos.network"] },
  },
  blockExplorers: {
    default: { name: "Mintscan", url: "https://www.mintscan.io/cosmos" },
  },
};

// TON (The Open Network)
export const TON_CHAIN: NonEvmChain = {
  id: "ton",
  name: "TON",
  type: "ton",
  nativeCurrency: { name: "Toncoin", symbol: "TON", decimals: 9 },
  rpcUrls: {
    default: { http: ["https://toncenter.com/api/v2/jsonRPC"] },
  },
  blockExplorers: {
    default: { name: "TON Explorer", url: "https://tonscan.org" },
  },
};

// All non-EVM chains
export const SUPPORTED_NON_EVM_CHAINS: NonEvmChain[] = [
  BITCOIN_CHAIN,
  COSMOS_HUB_CHAIN,
  TON_CHAIN,
];

// Combined chain lookup
export const NON_EVM_CHAIN_MAP: Record<string, NonEvmChain> = {};
for (const chain of SUPPORTED_NON_EVM_CHAINS) {
  NON_EVM_CHAIN_MAP[chain.id] = chain;
}

// Helper functions
export function isNonEvmChain(chainId: string | number): boolean {
  return typeof chainId === "string" && chainId in NON_EVM_CHAIN_MAP;
}

export function getNonEvmChain(chainId: string): NonEvmChain | undefined {
  return NON_EVM_CHAIN_MAP[chainId];
}

export function getChainType(chainId: string | number): ChainType {
  if (isNonEvmChain(chainId)) {
    return NON_EVM_CHAIN_MAP[chainId as string].type;
  }
  if (typeof chainId === "number" && isEvmChainSupported(chainId)) {
    return "evm";
  }
  return "evm"; // Default
}

export function isChainSupported(chainId: string | number): boolean {
  if (typeof chainId === "string") {
    return isNonEvmChain(chainId);
  }
  return isEvmChainSupported(chainId);
}

// Provider mappings for non-EVM chains
export function getRangoBlockchainName(chainId: string | number): string | null {
  const mappings: Record<string, string> = {
    bitcoin: "BTC",
    cosmos: "COSMOS",
    ton: "TON",
  };
  if (typeof chainId === "string") {
    return mappings[chainId] ?? null;
  }
  return null;
}

export function getLifiChainId(chainId: string | number): number | null {
  const mappings: Record<string, number> = {
    bitcoin: 20000000000001, // LI.FI internal ID for Bitcoin
  };
  if (typeof chainId === "string") {
    return mappings[chainId] ?? null;
  }
  return null;
}

// Gas price estimation utilities
// Fetches gas prices from various sources and calculates transaction costs

import { fetchWithTimeout } from "./fetch-utils";
import { CHAIN_MAP } from "./chains";
import { fetchTokenPrices } from "./prices";

// Gas price cache (30 second TTL)
interface GasPriceCache {
  price: GasPriceInfo;
  timestamp: number;
}
const gasPriceCache = new Map<number, GasPriceCache>();
const CACHE_TTL = 30 * 1000; // 30 seconds

// Standard gas limits for common operations
export const GAS_LIMITS = {
  // EVM operations
  ERC20_APPROVE: 50000,
  ERC20_TRANSFER: 65000,
  NATIVE_TRANSFER: 21000,
  BRIDGE_SWAP: 200000, // Cross-chain swaps are complex
  BRIDGE_DEPOSIT: 150000,
  // Add padding for safety
  PADDING_MULTIPLIER: 1.2,
};

export interface GasPriceInfo {
  // In wei/gwei
  slow: string;      // Low priority
  standard: string;  // Medium priority
  fast: string;      // High priority
  // Base fee for EIP-1559 chains
  baseFee?: string;
  // Units
  unit: "wei" | "gwei";
  // Chain info
  chainId: number;
  chainName: string;
}

export interface GasEstimate {
  // Native token cost
  nativeCost: string;      // In wei/smallest unit
  nativeCostFormatted: string;  // Human readable (e.g., "0.001 ETH")
  // USD cost
  usdCost: number;
  usdCostFormatted: string;  // e.g., "$1.23"
  // Gas limit used
  gasLimit: number;
  // Gas price used
  gasPrice: string;
  // Chain info
  chainId: number;
  chainName: string;
  nativeToken: string;
}

/**
 * Check if gas price is cached and not expired
 */
function getCachedGasPrice(chainId: number): GasPriceInfo | null {
  const cached = gasPriceCache.get(chainId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  return null;
}

/**
 * Cache gas price
 */
function setCachedGasPrice(chainId: number, price: GasPriceInfo): void {
  gasPriceCache.set(chainId, { price, timestamp: Date.now() });
}

/**
 * Fetch gas prices from Etherscan-compatible API
 * Falls back to public RPC if not available
 */
export async function fetchGasPrice(chainId: number): Promise<GasPriceInfo | null> {
  // Check cache first
  const cached = getCachedGasPrice(chainId);
  if (cached) return cached;

  const chain = CHAIN_MAP[chainId];
  if (!chain) return null;

  try {
    // Try to fetch from public RPC
    const rpcUrl = getRpcUrl(chainId);
    if (!rpcUrl) return getFallbackGasPrice(chainId);

    const response = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
      timeout: 10000,
    });

    if (!response.ok) {
      return getFallbackGasPrice(chainId);
    }

    const data = await response.json() as { result?: string };
    if (!data.result) {
      return getFallbackGasPrice(chainId);
    }

    const gasPrice = data.result; // In wei as hex
    const gasPriceWei = BigInt(gasPrice).toString();

    // Calculate different speeds (multiply by factors)
    const baseWei = BigInt(gasPriceWei);
    const slowWei = (baseWei * BigInt(80) / BigInt(100)).toString();     // 80% of current
    const standardWei = baseWei.toString();                 // Current
    const fastWei = (baseWei * BigInt(150) / BigInt(100)).toString();     // 150% of current

    const gasPriceInfo: GasPriceInfo = {
      slow: slowWei,
      standard: standardWei,
      fast: fastWei,
      unit: "wei",
      chainId,
      chainName: chain.name,
    };

    setCachedGasPrice(chainId, gasPriceInfo);
    return gasPriceInfo;
  } catch (error) {
    console.error("Failed to fetch gas price:", error);
    return getFallbackGasPrice(chainId);
  }
}

/**
 * Get RPC URL for a chain
 */
function getRpcUrl(chainId: number): string | null {
  const rpcs: Record<number, string> = {
    1: "https://eth.llamarpc.com",
    10: "https://optimism.llamarpc.com",
    56: "https://binance.llamarpc.com",
    137: "https://polygon.llamarpc.com",
    42161: "https://arbitrum.llamarpc.com",
    8453: "https://base.llamarpc.com",
    43114: "https://avalanche.llamarpc.com",
    250: "https://fantom.llamarpc.com",
    324: "https://zksync.llamarpc.com",
    1101: "https://polygon-zkevm.llamarpc.com",
    59144: "https://linea.llamarpc.com",
    534352: "https://scroll.llamarpc.com",
    5000: "https://mantle.llamarpc.com",
    81457: "https://blast.llamarpc.com",
    100: "https://gnosis.llamarpc.com",
    25: "https://cronos.llamarpc.com",
    42220: "https://celo.llamarpc.com",
    1313161554: "https://aurora.llamarpc.com",
    1666600000: "https://harmony.llamarpc.com",
    1088: "https://metis.llamarpc.com",
    169: "https://manta-pacific.llamarpc.com",
    7777777: "https://zora.llamarpc.com",
  };
  return rpcs[chainId] ?? null;
}

/**
 * Get fallback gas prices (reasonable defaults)
 */
function getFallbackGasPrice(chainId: number): GasPriceInfo | null {
  const chain = CHAIN_MAP[chainId];
  if (!chain) return null;

  // Reasonable defaults for different chains (in wei)
  const defaults: Record<number, { slow: string; standard: string; fast: string }> = {
    1: { slow: "20000000000", standard: "30000000000", fast: "50000000000" },      // 20-50 Gwei
    10: { slow: "100000000", standard: "200000000", fast: "500000000" },           // 0.1-0.5 Gwei
    56: { slow: "3000000000", standard: "5000000000", fast: "8000000000" },        // 3-8 Gwei
    137: { slow: "50000000000", standard: "80000000000", fast: "150000000000" },   // 50-150 Gwei
    42161: { slow: "100000000", standard: "200000000", fast: "500000000" },        // 0.1-0.5 Gwei
    8453: { slow: "100000000", standard: "200000000", fast: "500000000" },         // 0.1-0.5 Gwei
    43114: { slow: "1000000000", standard: "2500000000", fast: "5000000000" },     // 1-5 nAVAX
    250: { slow: "3000000000", standard: "5000000000", fast: "10000000000" },      // 3-10 Gwei
    324: { slow: "50000000", standard: "100000000", fast: "200000000" },           // 0.05-0.2 Gwei
    1101: { slow: "50000000", standard: "100000000", fast: "200000000" },          // 0.05-0.2 Gwei
    59144: { slow: "50000000", standard: "100000000", fast: "200000000" },         // 0.05-0.2 Gwei
    534352: { slow: "50000000", standard: "100000000", fast: "200000000" },        // 0.05-0.2 Gwei
    5000: { slow: "50000000", standard: "100000000", fast: "200000000" },          // 0.05-0.2 Gwei
    81457: { slow: "50000000", standard: "100000000", fast: "200000000" },         // 0.05-0.2 Gwei
    100: { slow: "3000000000", standard: "5000000000", fast: "10000000000" },      // 3-10 Gwei
    25: { slow: "3000000000000", standard: "5000000000000", fast: "10000000000000" }, // 3000-10000 Gwei
    42220: { slow: "1000000000", standard: "2000000000", fast: "5000000000" },     // 1-5 Gwei
    1313161554: { slow: "50000000", standard: "100000000", fast: "200000000" },    // 0.05-0.2 Gwei
    1666600000: { slow: "1000000000", standard: "2000000000", fast: "5000000000" }, // 1-5 Gwei
    1088: { slow: "1000000000", standard: "2000000000", fast: "5000000000" },      // 1-5 Gwei
    169: { slow: "50000000", standard: "100000000", fast: "200000000" },           // 0.05-0.2 Gwei
    7777777: { slow: "50000000", standard: "100000000", fast: "200000000" },       // 0.05-0.2 Gwei
  };

  const gasPrices = defaults[chainId];
  if (!gasPrices) return null;

  return {
    ...gasPrices,
    unit: "wei",
    chainId,
    chainName: chain.name,
  };
}

/**
 * Estimate gas cost for a bridge operation
 */
export async function estimateBridgeGas(
  chainId: number,
  gasLimit: number = GAS_LIMITS.BRIDGE_SWAP,
  priority: "slow" | "standard" | "fast" = "standard",
): Promise<GasEstimate | null> {
  const gasPriceInfo = await fetchGasPrice(chainId);
  if (!gasPriceInfo) return null;

  const chain = CHAIN_MAP[chainId];
  if (!chain) return null;

  const gasPrice = gasPriceInfo[priority];
  const gasPriceBigInt = BigInt(gasPrice);
  const gasLimitWithPadding = Math.ceil(gasLimit * GAS_LIMITS.PADDING_MULTIPLIER);
  
  // Calculate native cost
  const nativeCostWei = gasPriceBigInt * BigInt(gasLimitWithPadding);
  const nativeCost = nativeCostWei.toString();
  
  // Format native cost
  const nativeSymbol = getNativeTokenSymbol(chainId);
  const decimals = 18;
  const nativeCostFormatted = formatGasAmount(nativeCost, decimals, nativeSymbol);

  // Calculate USD cost
  const tokenPrice = await fetchTokenPrices([{ chainId, address: "native" }]);
  const priceKey = `${chainId}:native`;
  const nativePriceUsd = tokenPrice.get(priceKey) ?? 0;
  
  const nativeCostEther = Number(nativeCostWei) / Math.pow(10, decimals);
  const usdCost = nativeCostEther * nativePriceUsd;
  const usdCostFormatted = usdCost > 0 ? `$${usdCost.toFixed(2)}` : "$--";

  return {
    nativeCost,
    nativeCostFormatted,
    usdCost,
    usdCostFormatted,
    gasLimit: gasLimitWithPadding,
    gasPrice,
    chainId,
    chainName: chain.name,
    nativeToken: nativeSymbol,
  };
}

/**
 * Format gas amount to human readable
 */
function formatGasAmount(weiAmount: string, decimals: number, symbol: string): string {
  try {
    const amount = Number(weiAmount) / Math.pow(10, decimals);
    
    if (amount < 0.0001) {
      return `<0.0001 ${symbol}`;
    }
    if (amount < 1) {
      return `${amount.toFixed(6)} ${symbol}`;
    }
    if (amount < 1000) {
      return `${amount.toFixed(4)} ${symbol}`;
    }
    return `${amount.toFixed(2)} ${symbol}`;
  } catch {
    return `${weiAmount} wei`;
  }
}

/**
 * Get native token symbol for a chain
 */
function getNativeTokenSymbol(chainId: number): string {
  const symbols: Record<number, string> = {
    1: "ETH",
    10: "ETH",
    56: "BNB",
    137: "MATIC",
    42161: "ETH",
    8453: "ETH",
  };
  return symbols[chainId] ?? "ETH";
}

/**
 * Compare gas costs between routes
 */
export function compareGasCosts(
  estimates: (GasEstimate | null)[],
): { cheapest: GasEstimate | null; mostExpensive: GasEstimate | null } {
  const validEstimates = estimates.filter((e): e is GasEstimate => e !== null);
  
  if (validEstimates.length === 0) {
    return { cheapest: null, mostExpensive: null };
  }

  const sorted = [...validEstimates].sort((a, b) => a.usdCost - b.usdCost);
  
  return {
    cheapest: sorted[0],
    mostExpensive: sorted[sorted.length - 1],
  };
}

/**
 * Get gas price trend indicator
 */
export function getGasTrend(
  currentGasPrice: string,
  historicalAvg: string,
): "low" | "normal" | "high" {
  const current = BigInt(currentGasPrice);
  const avg = BigInt(historicalAvg);
  
  if (current < avg * BigInt(80) / BigInt(100)) return "low";
  if (current > avg * BigInt(150) / BigInt(100)) return "high";
  return "normal";
}

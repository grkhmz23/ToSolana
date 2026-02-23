// Token price utilities using CoinGecko API
// Free tier: 10-30 calls/minute, no API key required for basic endpoints

import { fetchWithTimeout } from "./fetch-utils";
import { NATIVE_TOKEN_ADDRESS } from "./chains";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// Cache for prices (5 minute TTL)
interface PriceCache {
  price: number;
  timestamp: number;
}
const priceCache = new Map<string, PriceCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// CoinGecko platform IDs for chain mapping
const CHAIN_TO_PLATFORM: Record<number, string> = {
  1: "ethereum",
  10: "optimistic-ethereum",
  56: "binance-smart-chain",
  137: "polygon-pos",
  42161: "arbitrum-one",
  8453: "base",
};

// Non-EVM chain CoinGecko IDs
const NON_EVM_TOKEN_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  cosmos: "cosmos",
  osmosis: "osmosis",
  injective: "injective-protocol",
  ton: "the-open-network",
  solana: "solana",
};

// Common token address mappings (lowercase) to CoinGecko IDs
// For native tokens and popular tokens
const TOKEN_OVERRIDES: Record<string, string> = {
  // Native tokens
  [NATIVE_TOKEN_ADDRESS.toLowerCase()]: "ethereum",
  "native": "ethereum",
  "sol": "solana",
  "0x0000000000000000000000000000000000000000": "ethereum",
  // Non-EVM native tokens
  "btc": "bitcoin",
  "bitcoin": "bitcoin",
  "atom": "cosmos",
  "osmo": "osmosis",
  "inj": "injective-protocol",
  "ton": "the-open-network",
  // Popular stablecoins
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "usd-coin", // USDC on Ethereum
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "tether", // USDT on Ethereum
  "0x6b175474e89094c44da98b954eedeac495271d0f": "dai", // DAI on Ethereum
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin", // WBTC
  "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0": "matic-network", // MATIC
  "0xb8c77482e45f1f44de1745f52c74426c631bdd52": "bnb", // BNB on Ethereum
};

export interface TokenPrice {
  usd: number;
  usd_24h_change?: number;
  last_updated_at?: number;
}

/**
 * Get a cache key for a token
 */
function getCacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

/**
 * Check if price is cached and not expired
 */
function getCachedPrice(chainId: number, tokenAddress: string): number | null {
  const key = getCacheKey(chainId, tokenAddress);
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  return null;
}

/**
 * Cache a price
 */
function setCachedPrice(chainId: number, tokenAddress: string, price: number): void {
  const key = getCacheKey(chainId, tokenAddress);
  priceCache.set(key, { price, timestamp: Date.now() });
}

/**
 * Get CoinGecko ID for a token
 */
function getTokenId(chainId: number, tokenAddress: string): string | null {
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Check overrides first
  if (TOKEN_OVERRIDES[normalizedAddress]) {
    return TOKEN_OVERRIDES[normalizedAddress];
  }
  
  // For native tokens on each chain
  if (normalizedAddress === NATIVE_TOKEN_ADDRESS.toLowerCase() || normalizedAddress === "native") {
    const platform = CHAIN_TO_PLATFORM[chainId];
    if (platform) {
      // Map platform to native token ID
      const nativeTokenIds: Record<string, string> = {
        "ethereum": "ethereum",
        "optimistic-ethereum": "ethereum",
        "binance-smart-chain": "bnb",
        "polygon-pos": "matic-network",
        "arbitrum-one": "ethereum",
        "base": "ethereum",
      };
      return nativeTokenIds[platform] ?? null;
    }
  }
  
  // For Solana tokens
  if (tokenAddress.length > 40 && !tokenAddress.startsWith("0x")) {
    // Assume it's a Solana mint address
    if (normalizedAddress === "sol" || normalizedAddress === "11111111111111111111111111111111") {
      return "solana";
    }
    // For other SPL tokens, we'd need a more comprehensive mapping
    // For now, return null and we'll skip price display
    return null;
  }
  
  return null;
}

/**
 * Fetch USD price for a single token
 */
export async function fetchTokenPrice(
  chainId: number,
  tokenAddress: string,
): Promise<number | null> {
  // Check cache first
  const cached = getCachedPrice(chainId, tokenAddress);
  if (cached !== null) {
    return cached;
  }
  
  const tokenId = getTokenId(chainId, tokenAddress);
  if (!tokenId) {
    return null;
  }
  
  try {
    const res = await fetchWithTimeout(
      `${COINGECKO_API_URL}/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`,
      { timeout: 10000 },
    );
    
    if (!res.ok) {
      if (res.status === 429) {
        console.warn("CoinGecko rate limit hit");
      }
      return null;
    }
    
    const data = (await res.json()) as Record<string, TokenPrice>;
    const price = data[tokenId]?.usd ?? null;
    
    if (price !== null) {
      setCachedPrice(chainId, tokenAddress, price);
    }
    
    return price;
  } catch (error) {
    console.error("Failed to fetch token price:", error);
    return null;
  }
}

/**
 * Fetch USD prices for multiple tokens at once (more efficient)
 */
export async function fetchTokenPrices(
  tokens: { chainId: number; address: string }[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const tokenIdsToFetch: { id: string; chainId: number; address: string }[] = [];
  
  // Check cache first
  for (const { chainId, address } of tokens) {
    const cached = getCachedPrice(chainId, address);
    if (cached !== null) {
      results.set(getCacheKey(chainId, address), cached);
    } else {
      const tokenId = getTokenId(chainId, address);
      if (tokenId) {
        tokenIdsToFetch.push({ id: tokenId, chainId, address });
      }
    }
  }
  
  if (tokenIdsToFetch.length === 0) {
    return results;
  }
  
  // Batch fetch - CoinGecko supports up to ~100 IDs per request
  const uniqueIds = [...new Set(tokenIdsToFetch.map((t) => t.id))];
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 50) {
    batches.push(uniqueIds.slice(i, i + 50));
  }
  
  try {
    for (const batch of batches) {
      const idsParam = batch.join(",");
      const res = await fetchWithTimeout(
        `${COINGECKO_API_URL}/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 15000 },
      );
      
      if (!res.ok) {
        if (res.status === 429) {
          console.warn("CoinGecko rate limit hit");
        }
        continue;
      }
      
      const data = (await res.json()) as Record<string, TokenPrice>;
      
      // Update cache for fetched prices
      for (const { id, chainId, address } of tokenIdsToFetch) {
        if (batch.includes(id)) {
          const price = data[id]?.usd ?? null;
          if (price !== null) {
            setCachedPrice(chainId, address, price);
            results.set(getCacheKey(chainId, address), price);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch token prices:", error);
  }
  
  return results;
}

/**
 * Format USD amount with proper decimals
 */
export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `<$0.01`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

/**
 * Calculate USD value of a token amount
 */
export function calculateUsdValue(
  tokenAmount: string,
  decimals: number,
  priceUsd: number,
): number {
  try {
    const amount = Number(tokenAmount) / Math.pow(10, decimals);
    return amount * priceUsd;
  } catch {
    return 0;
  }
}

/**
 * Get native token decimals for a chain
 */
export function getNativeTokenDecimals(_chainId: number): number {
  return 18; // Most EVM chains use 18 decimals
}

/**
 * Get Solana token decimals (SPL tokens typically use 6-9)
 * This is a simplified version - in production you'd fetch actual decimals
 */
export function getSolanaTokenDecimals(tokenAddress: string): number {
  if (tokenAddress === "SOL" || tokenAddress === "11111111111111111111111111111111") {
    return 9;
  }
  // Most SPL tokens use 6 decimals
  return 6;
}

/**
 * Get non-EVM token price by chain ID string (bitcoin, cosmos, ton, etc.)
 */
export async function fetchNonEvmTokenPrice(
  chainId: string,
): Promise<number | null> {
  const tokenId = NON_EVM_TOKEN_IDS[chainId.toLowerCase()];
  if (!tokenId) {
    return null;
  }

  const cacheKey = `non-evm:${chainId}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    const res = await fetchWithTimeout(
      `${COINGECKO_API_URL}/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`,
      { timeout: 10000 },
    );

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("CoinGecko rate limit hit");
      }
      return null;
    }

    const data = (await res.json()) as Record<string, TokenPrice>;
    const price = data[tokenId]?.usd ?? null;

    if (price !== null) {
      priceCache.set(cacheKey, { price, timestamp: Date.now() });
    }

    return price;
  } catch (error) {
    console.error("Failed to fetch non-EVM token price:", error);
    return null;
  }
}

/**
 * Get token decimals for non-EVM chains
 */
export function getNonEvmTokenDecimals(chainId: string): number {
  const decimals: Record<string, number> = {
    bitcoin: 8,    // BTC has 8 decimals (satoshis)
    cosmos: 6,     // ATOM has 6 decimals (uatom)
    osmosis: 6,    // OSMO has 6 decimals (uosmo)
    injective: 18, // INJ has 18 decimals
    ton: 9,        // TON has 9 decimals (nanotons)
  };
  return decimals[chainId.toLowerCase()] ?? 6;
}

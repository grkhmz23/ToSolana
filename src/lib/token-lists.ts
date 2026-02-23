// Token list utilities for fetching popular tokens per chain
// Uses CoinGecko API for token data and images

import { fetchWithTimeout } from "./fetch-utils";
import { NATIVE_TOKEN_ADDRESS } from "./chains";

// Token list cache (10 minute TTL)
interface TokenListCache {
  tokens: TokenInfo[];
  timestamp: number;
}
const tokenListCache = new Map<number, TokenListCache>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// CoinGecko platform IDs for EVM chains
const CHAIN_TO_PLATFORM: Record<number, string> = {
  1: "ethereum",
  10: "optimistic-ethereum",
  56: "binance-smart-chain",
  137: "polygon-pos",
  42161: "arbitrum-one",
  8453: "base",
  43114: "avalanche",
  250: "fantom",
  324: "zksync",
  1101: "polygon-zkevm",
  59144: "linea",
  534352: "scroll",
  5000: "mantle",
  81457: "blast",
  100: "xdai",
  25: "cronos",
  42220: "celo",
  1313161554: "aurora",
  1666600000: "harmony-shard-0",
  1088: "metis-andromeda",
};

// Native token info per chain
const NATIVE_TOKENS: Record<number, TokenInfo> = {
  1: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 1,
  },
  10: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 10,
  },
  56: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    chainId: 56,
  },
  137: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png",
    chainId: 137,
  },
  42161: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 42161,
  },
  8453: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 8453,
  },
  43114: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "AVAX",
    name: "Avalanche",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    chainId: 43114,
  },
  250: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "FTM",
    name: "Fantom",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/4001/large/Fantom_round.png",
    chainId: 250,
  },
  324: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 324,
  },
  1101: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 1101,
  },
  59144: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 59144,
  },
  534352: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 534352,
  },
  5000: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "MNT",
    name: "Mantle",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/30980/large/token-logo.png",
    chainId: 5000,
  },
  81457: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 81457,
  },
  100: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "xDAI",
    name: "Gnosis",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/14562/large/512_x_512_%281%29.png",
    chainId: 100,
  },
  25: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "CRO",
    name: "Cronos",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/7310/large/cro_token_logo.png",
    chainId: 25,
  },
  42220: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "CELO",
    name: "Celo",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/11090/large/InjXBNx9_400x400.jpg",
    chainId: 42220,
  },
  1313161554: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 1313161554,
  },
  1666600000: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ONE",
    name: "Harmony",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/4344/large/Y88JAze.png",
    chainId: 1666600000,
  },
  1088: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "METIS",
    name: "Metis",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/15595/large/metis.png",
    chainId: 1088,
  },
  169: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 169,
  },
  7777777: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 7777777,
  },
};

// Solana native token
export const SOLANA_NATIVE_TOKEN: TokenInfo = {
  address: "SOL",
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  logoURI: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  chainId: 101, // Solana chain ID
};

// Popular Solana tokens
export const POPULAR_SOLANA_TOKENS: TokenInfo[] = [
  SOLANA_NATIVE_TOKEN,
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    chainId: 101,
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    chainId: 101,
  },
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "wSOL",
    name: "Wrapped SOL",
    decimals: 9,
    logoURI: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    chainId: 101,
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
    chainId: 101,
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/34182/large/jup.png",
    chainId: 101,
  },
];

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

/**
 * Check if token list is cached and not expired
 */
function getCachedTokenList(chainId: number): TokenInfo[] | null {
  const cached = tokenListCache.get(chainId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tokens;
  }
  return null;
}

/**
 * Cache a token list
 */
function setCachedTokenList(chainId: number, tokens: TokenInfo[]): void {
  tokenListCache.set(chainId, { tokens, timestamp: Date.now() });
}

/**
 * Fetch popular tokens for an EVM chain from CoinGecko
 */
export async function fetchTokenList(chainId: number): Promise<TokenInfo[]> {
  // Check cache first
  const cached = getCachedTokenList(chainId);
  if (cached) {
    return cached;
  }

  // Return Solana tokens for Solana chain
  if (chainId === 101 || chainId === 102) {
    setCachedTokenList(chainId, POPULAR_SOLANA_TOKENS);
    return POPULAR_SOLANA_TOKENS;
  }

  const platform = CHAIN_TO_PLATFORM[chainId];
  if (!platform) {
    // Return just native token for unsupported chains
    const native = NATIVE_TOKENS[chainId];
    return native ? [native] : [];
  }

  try {
    // Fetch top tokens by market cap from CoinGecko
    const res = await fetchWithTimeout(
      `${COINGECKO_API_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`,
      { timeout: 15000 },
    );

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("CoinGecko rate limit hit for token list");
      }
      // Return native token as fallback
      const native = NATIVE_TOKENS[chainId];
      return native ? [native] : [];
    }

    const data = (await res.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      image: string;
      platforms?: Record<string, string>;
    }>;

    // Build token list with addresses for this chain
    const tokens: TokenInfo[] = [];

    // Add native token first
    const native = NATIVE_TOKENS[chainId];
    if (native) {
      tokens.push(native);
    }

    // Add popular ERC20 tokens
    for (const coin of data.slice(0, 30)) {
      const address = coin.platforms?.[platform];
      if (address && address !== "") {
        tokens.push({
          address: address.toLowerCase(),
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          decimals: 18, // Most ERC20 tokens use 18 decimals
          logoURI: coin.image,
          chainId,
        });
      }
    }

    // Hardcode some popular tokens that might be missing
    const popularTokens = getPopularTokensForChain(chainId);
    for (const token of popularTokens) {
      if (!tokens.find((t) => t.address.toLowerCase() === token.address.toLowerCase())) {
        tokens.push(token);
      }
    }

    setCachedTokenList(chainId, tokens);
    return tokens;
  } catch (error) {
    console.error("Failed to fetch token list:", error);
    // Return native token + hardcoded popular tokens as fallback
    const native = NATIVE_TOKENS[chainId];
    const popular = getPopularTokensForChain(chainId);
    return native ? [native, ...popular] : popular;
  }
}

/**
 * Get hardcoded popular tokens for a chain
 */
function getPopularTokensForChain(chainId: number): TokenInfo[] {
  const commonTokens: Record<number, TokenInfo[]> = {
    1: [
      {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
        chainId: 1,
      },
      {
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
        chainId: 1,
      },
      {
        address: "0x6b175474e89094c44da98b954eedeac495271d0f",
        symbol: "DAI",
        name: "Dai",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
        chainId: 1,
      },
      {
        address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        decimals: 8,
        logoURI: "https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png",
        chainId: 1,
      },
      {
        address: "0x514910771af9ca656af840dff83e8264ecf986ca",
        symbol: "LINK",
        name: "Chainlink",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
        chainId: 1,
      },
      {
        address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        symbol: "UNI",
        name: "Uniswap",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png",
        chainId: 1,
      },
    ],
    137: [
      {
        address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
        chainId: 137,
      },
      {
        address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
        chainId: 137,
      },
      {
        address: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
        symbol: "DAI",
        name: "Dai",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
        chainId: 137,
      },
      {
        address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        decimals: 8,
        logoURI: "https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png",
        chainId: 137,
      },
    ],
    42161: [
      {
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
        chainId: 42161,
      },
      {
        address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
        chainId: 42161,
      },
    ],
    8453: [
      {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
        chainId: 8453,
      },
    ],
    56: [
      {
        address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
        chainId: 56,
      },
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        symbol: "USDT",
        name: "Tether",
        decimals: 18,
        logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
        chainId: 56,
      },
    ],
  };

  return commonTokens[chainId] ?? [];
}

/**
 * Search tokens by symbol or name
 */
export function searchTokens(tokens: TokenInfo[], query: string): TokenInfo[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return tokens;

  return tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(normalizedQuery) ||
      token.name.toLowerCase().includes(normalizedQuery) ||
      token.address.toLowerCase().includes(normalizedQuery),
  );
}

/**
 * Get token by address
 */
export function getTokenByAddress(
  tokens: TokenInfo[],
  address: string,
): TokenInfo | undefined {
  return tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase() ||
      (t.address === NATIVE_TOKEN_ADDRESS && address === NATIVE_TOKEN_ADDRESS),
  );
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  try {
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return amount;
  }
}

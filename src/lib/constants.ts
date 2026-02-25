// Chain configurations with realistic SVG logos
import type { Chain, Token } from '@/types/bridge';
import { NATIVE_TOKEN_ADDRESS } from '@/lib/chains';

export const CHAINS: Chain[] = [
  { id: 'ethereum', name: 'Ethereum', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: 'text-blue-400', bg: 'from-blue-500/20 to-indigo-500/20' },
  { id: 'bsc', name: 'BNB Chain', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', color: 'text-yellow-400', bg: 'from-yellow-400/20 to-yellow-600/20' },
  { id: 'arbitrum', name: 'Arbitrum', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg', color: 'text-blue-500', bg: 'from-blue-400/20 to-blue-600/20' },
  { id: 'optimism', name: 'Optimism', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png', color: 'text-red-500', bg: 'from-red-500/20 to-red-600/20' },
  { id: 'base', name: 'Base', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/31110/large/base.jpeg', color: 'text-blue-600', bg: 'from-blue-600/20 to-blue-800/20' },
  { id: 'polygon', name: 'Polygon', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png', color: 'text-purple-500', bg: 'from-purple-600/20 to-purple-800/20' },
  { id: 'avalanche', name: 'Avalanche', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png', color: 'text-red-400', bg: 'from-red-500/20 to-orange-500/20' },
  { id: 'zksync', name: 'zkSync Era', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/38043/large/zkSync.jpg', color: 'text-slate-300', bg: 'from-slate-400/20 to-slate-600/20' },
  { id: 'linea', name: 'Linea', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/28600/large/linea.jpg', color: 'text-cyan-400', bg: 'from-cyan-400/20 to-cyan-600/20' },
  { id: 'scroll', name: 'Scroll', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/34188/large/scroll.jpeg', color: 'text-amber-200', bg: 'from-amber-200/20 to-amber-400/20' },
  { id: 'mantle', name: 'Mantle', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/30980/large/mantle.jpeg', color: 'text-cyan-300', bg: 'from-cyan-300/20 to-blue-500/20' },
  { id: 'blast', name: 'Blast', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/35494/large/blast.jpg', color: 'text-yellow-300', bg: 'from-yellow-300/20 to-yellow-500/20' },
  { id: 'fantom', name: 'Fantom', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/4001/large/Fantom.png', color: 'text-blue-300', bg: 'from-blue-300/20 to-blue-500/20' },
  { id: 'gnosis', name: 'Gnosis', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/11062/large/200x200.png', color: 'text-green-400', bg: 'from-green-500/20 to-teal-500/20' },
  { id: 'cronos', name: 'Cronos', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/7310/large/cro_token_logo.png', color: 'text-blue-500', bg: 'from-blue-500/20 to-indigo-500/20' },
  { id: 'celo', name: 'Celo', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/11090/large/InjXBNx9_400x400.jpg', color: 'text-yellow-300', bg: 'from-yellow-400/20 to-green-400/20' },
  { id: 'aurora', name: 'Aurora', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/20582/large/aurora.jpeg', color: 'text-green-400', bg: 'from-green-400/20 to-emerald-500/20' },
  { id: 'harmony', name: 'Harmony', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/4344/large/YJ3xJ8s.png', color: 'text-cyan-400', bg: 'from-cyan-400/20 to-blue-400/20' },
  { id: 'metis', name: 'Metis', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/15595/large/metis.jpeg', color: 'text-cyan-300', bg: 'from-cyan-300/20 to-blue-400/20' },
  { id: 'manta', name: 'Manta', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/30980/large/mantle.jpeg', color: 'text-cyan-400', bg: 'from-cyan-400/20 to-blue-500/20' },
  { id: 'zora', name: 'Zora', type: 'evm', icon: 'https://assets.coingecko.com/coins/images/35494/large/blast.jpg', color: 'text-purple-400', bg: 'from-purple-400/20 to-pink-400/20' },
  { id: 'bitcoin', name: 'Bitcoin', type: 'bitcoin', icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', color: 'text-orange-500', bg: 'from-orange-400/20 to-orange-600/20' },
  { id: 'cosmos', name: 'Cosmos Hub', type: 'cosmos', icon: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png', color: 'text-slate-400', bg: 'from-slate-500/20 to-slate-700/20' },
  { id: 'ton', name: 'TON', type: 'ton', icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png', color: 'text-blue-400', bg: 'from-blue-400/20 to-cyan-500/20' },
];

export const SOLANA_CHAIN: Chain = { 
  id: 'solana', 
  name: 'Solana', 
  type: 'solana', 
  icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', 
  color: 'text-purple-400', 
  bg: 'from-purple-500/20 to-green-500/20' 
};

// Token icons using emoji for now - can be replaced with SVGs later
export const TOKENS: Record<string, Token[]> = {
  ethereum: [
    { symbol: 'ETH', name: 'Ethereum', icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', address: NATIVE_TOKEN_ADDRESS, decimals: 18, balance: '1.24' },
    { symbol: 'USDC', name: 'USD Coin', icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, balance: '5240.00' },
    { symbol: 'WND', name: 'Wind (NTT)', icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', balance: '1000.00', isOfficial: true },
  ],
  solana: [
    { symbol: 'SOL', name: 'Solana', icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', address: 'SOL', decimals: 9, balance: '45.5' },
    { symbol: 'USDC', name: 'USD Coin', icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, balance: '120.50' },
    { symbol: 'WND', name: 'Wind (NTT)', icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', balance: '0.00', isOfficial: true },
  ],
  bitcoin: [
    { symbol: 'BTC', name: 'Bitcoin', icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', address: 'native', decimals: 8, balance: '0.5' },
  ],
  cosmos: [
    { symbol: 'ATOM', name: 'Cosmos', icon: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png', address: 'native', decimals: 6, balance: '100' },
  ],
  ton: [
    { symbol: 'TON', name: 'Toncoin', icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png', address: 'native', decimals: 9, balance: '500' },
  ],
};

// Default tokens for chains not in the list
export const DEFAULT_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', address: NATIVE_TOKEN_ADDRESS, decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
];

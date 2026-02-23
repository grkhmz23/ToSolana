// Mock data for bridge UI
import type { Chain, Token } from '@/types/bridge';

export const CHAINS: Chain[] = [
  { id: 'ethereum', name: 'Ethereum', type: 'evm', icon: 'Ξ', color: 'text-blue-400', bg: 'from-blue-500/20 to-indigo-500/20' },
  { id: 'bsc', name: 'BNB Chain', type: 'evm', icon: 'BNB', color: 'text-yellow-400', bg: 'from-yellow-400/20 to-yellow-600/20' },
  { id: 'arbitrum', name: 'Arbitrum', type: 'evm', icon: 'A', color: 'text-blue-500', bg: 'from-blue-400/20 to-blue-600/20' },
  { id: 'optimism', name: 'Optimism', type: 'evm', icon: 'O', color: 'text-red-500', bg: 'from-red-500/20 to-red-600/20' },
  { id: 'base', name: 'Base', type: 'evm', icon: 'B', color: 'text-blue-600', bg: 'from-blue-600/20 to-blue-800/20' },
  { id: 'polygon', name: 'Polygon', type: 'evm', icon: 'P', color: 'text-purple-500', bg: 'from-purple-600/20 to-purple-800/20' },
  { id: 'avalanche', name: 'Avalanche', type: 'evm', icon: 'AVAX', color: 'text-red-400', bg: 'from-red-500/20 to-orange-500/20' },
  { id: 'zksync', name: 'zkSync Era', type: 'evm', icon: 'Z', color: 'text-slate-300', bg: 'from-slate-400/20 to-slate-600/20' },
  { id: 'linea', name: 'Linea', type: 'evm', icon: 'L', color: 'text-cyan-400', bg: 'from-cyan-400/20 to-cyan-600/20' },
  { id: 'fantom', name: 'Fantom', type: 'evm', icon: 'F', color: 'text-blue-300', bg: 'from-blue-300/20 to-blue-500/20' },
  { id: 'bitcoin', name: 'Bitcoin', type: 'bitcoin', icon: '₿', color: 'text-orange-500', bg: 'from-orange-400/20 to-orange-600/20' },
  { id: 'cosmos', name: 'Cosmos Hub', type: 'cosmos', icon: '⚛', color: 'text-slate-400', bg: 'from-slate-500/20 to-slate-700/20' },
  { id: 'ton', name: 'TON', type: 'ton', icon: '💎', color: 'text-blue-400', bg: 'from-blue-400/20 to-cyan-500/20' },
];

export const SOLANA_CHAIN: Chain = { 
  id: 'solana', 
  name: 'Solana', 
  type: 'solana', 
  icon: '◎', 
  color: 'text-purple-400', 
  bg: 'from-purple-500/20 to-green-500/20' 
};

export const TOKENS: Record<string, Token[]> = {
  ethereum: [
    { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', price: 3450.20, balance: '1.24' },
    { symbol: 'USDC', name: 'USD Coin', icon: '$', price: 1.00, balance: '5240.00' },
    { symbol: 'WND', name: 'Wind (NTT)', icon: '💨', price: 2.45, balance: '1000.00', isOfficial: true },
  ],
  solana: [
    { symbol: 'SOL', name: 'Solana', icon: '◎', price: 145.80, balance: '45.5' },
    { symbol: 'USDC', name: 'USD Coin', icon: '$', price: 1.00, balance: '120.50' },
    { symbol: 'WND', name: 'Wind (NTT)', icon: '💨', price: 2.45, balance: '0.00', isOfficial: true },
  ],
  bitcoin: [
    { symbol: 'BTC', name: 'Bitcoin', icon: '₿', price: 67500.00, balance: '0.5' },
  ],
  cosmos: [
    { symbol: 'ATOM', name: 'Cosmos', icon: '⚛', price: 8.50, balance: '100' },
  ],
  ton: [
    { symbol: 'TON', name: 'Toncoin', icon: '💎', price: 6.20, balance: '500' },
  ],
};

// Default tokens for chains not in the list
export const DEFAULT_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', price: 3450.20 },
  { symbol: 'USDC', name: 'USD Coin', icon: '$', price: 1.00 },
];

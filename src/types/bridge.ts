// Bridge-related types for ToSolana

export type ChainType = 'evm' | 'solana' | 'bitcoin' | 'cosmos' | 'ton';

export interface Chain {
  id: string;
  name: string;
  type: ChainType;
  icon: string;
  color: string;
  bg: string;
}

export interface Token {
  symbol: string;
  name: string;
  icon: string;
  price?: number;
  address?: string;
  decimals?: number;
  balance?: string;
  isOfficial?: boolean;
}

export interface Route {
  id: string;
  provider: string;
  outputAmount: string;
  estimatedTime: string;
  feeUsd: string;
  gasUsd: string;
  tags: string[];
  impact: number;
}

// Wallet connection state
export interface WalletState {
  isSourceConnected: boolean;
  isDestConnected: boolean;
  sourceAddress?: string;
  destAddress?: string;
}

// Bridge form state
export interface BridgeFormState {
  amount: string;
  slippage: string;
  routeSort: 'output' | 'time' | 'gas';
}

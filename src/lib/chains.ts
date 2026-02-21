import { mainnet, arbitrum, optimism, base, polygon, bsc } from "wagmi/chains";

export const SUPPORTED_CHAINS = [mainnet, arbitrum, optimism, base, polygon, bsc] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

export const CHAIN_MAP: Record<number, (typeof SUPPORTED_CHAINS)[number]> = {};
for (const chain of SUPPORTED_CHAINS) {
  CHAIN_MAP[chain.id] = chain;
}

export function getChainName(chainId: number): string {
  return CHAIN_MAP[chainId]?.name ?? `Chain ${chainId}`;
}

export function isEvmChainSupported(chainId: number): boolean {
  return chainId in CHAIN_MAP;
}

export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

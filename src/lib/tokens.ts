import { createPublicClient, http, erc20Abi, type Address } from "viem";
import { mainnet, arbitrum, optimism, base, polygon, bsc } from "viem/chains";

const chainConfigs = { 1: mainnet, 42161: arbitrum, 10: optimism, 8453: base, 137: polygon, 56: bsc } as const;

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export async function fetchERC20Info(
  chainId: number,
  tokenAddress: string,
): Promise<TokenInfo> {
  const chain = chainConfigs[chainId as keyof typeof chainConfigs];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const client = createPublicClient({
    chain,
    transport: http(),
  });

  const address = tokenAddress as Address;

  const [symbol, decimals, name] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address, abi: erc20Abi, functionName: "name" }),
  ]);

  return { address: tokenAddress, symbol, decimals, name };
}

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaMint(address: string): boolean {
  if (address === "SOL") return true;
  return BASE58_REGEX.test(address);
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

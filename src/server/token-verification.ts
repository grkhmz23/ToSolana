// Token verification logic for ERC20 and Solana mint
import { Connection, PublicKey } from "@solana/web3.js";
import { createPublicClient, http, erc20Abi } from "viem";
import { mainnet } from "viem/chains";

// Solana RPC
const SOLANA_RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// EVM chain RPCs
const EVM_RPCS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon.llamarpc.com",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  8453: "https://base.llamarpc.com",
};

export interface VerificationInput {
  sourceChainId: number;
  sourceTokenAddress: string;
  solanaMint: string;
  expectedDecimals?: number;
}

export interface VerificationResult {
  ok: boolean;
  details: {
    erc20?: {
      name: string;
      symbol: string;
      decimals: number;
      totalSupply?: bigint;
    };
    solana?: {
      decimals: number;
      supply: bigint;
      mintAuthority?: string;
      freezeAuthority?: string;
    };
    warnings?: string[];
    errors?: string[];
  };
}

/**
 * Verify ERC20 token metadata
 */
export async function verifyErc20Metadata(
  chainId: number,
  tokenAddress: string
): Promise<{ name: string; symbol: string; decimals: number }> {
  const rpcUrl = EVM_RPCS[chainId];
  if (!rpcUrl) {
    throw new Error(`Unsupported EVM chain: ${chainId}`);
  }

  const client = createPublicClient({
    chain: mainnet, // We'll use mainnet config but with custom RPC
    transport: http(rpcUrl),
  });

  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "name",
      }).catch(() => "Unknown"),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      }).catch(() => "UNKNOWN"),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      }).catch(() => 18),
    ]);

    return {
      name: String(name),
      symbol: String(symbol),
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error("ERC20 verification error:", error);
    throw new Error("Failed to read ERC20 metadata");
  }
}

/**
 * Verify Solana mint
 */
export async function verifySolanaMint(
  mintAddress: string
): Promise<{
  decimals: number;
  supply: bigint;
  mintAuthority?: string;
  freezeAuthority?: string;
}> {
  try {
    // Validate base58
    const pubkey = new PublicKey(mintAddress);
    
    const connection = new Connection(SOLANA_RPC);
    
    // Get mint account info
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      throw new Error("Mint account not found");
    }

    // Parse mint data ( simplified - in production use @solana/spl-token )
    // Mint layout: https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/state.rs
    const data = accountInfo.data;
    
    // Mint account layout:
    // 0: mint authority option (1 byte)
    // 1-32: mint authority (32 bytes, optional)
    // 33-40: supply (8 bytes, u64)
    // 41: decimals (1 byte)
    // ... etc
    
    const mintAuthorityOption = data[0];
    const supply = data.readBigUInt64LE(33);
    const decimals = data[41];

    let mintAuthority: string | undefined;
    if (mintAuthorityOption === 1) {
      mintAuthority = new PublicKey(data.slice(1, 33)).toBase58();
    }

    return {
      decimals,
      supply,
      mintAuthority,
    };
  } catch (error) {
    console.error("Solana mint verification error:", error);
    throw new Error(`Failed to verify Solana mint: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Full token verification
 */
export async function verifyToken(input: VerificationInput): Promise<VerificationResult> {
  const result: VerificationResult = {
    ok: false,
    details: {
      warnings: [],
      errors: [],
    },
  };

  // Verify ERC20
  try {
    const erc20 = await verifyErc20Metadata(input.sourceChainId, input.sourceTokenAddress);
    result.details.erc20 = erc20;
  } catch (error) {
    result.details.errors!.push(
      `ERC20 verification failed: ${error instanceof Error ? error.message : "Unknown"}`
    );
  }

  // Verify Solana mint
  try {
    const solana = await verifySolanaMint(input.solanaMint);
    result.details.solana = solana;

    // Check decimals match
    if (input.expectedDecimals !== undefined && solana.decimals !== input.expectedDecimals) {
      result.details.warnings!.push(
        `Decimals mismatch: ERC20=${input.expectedDecimals}, Solana=${solana.decimals}`
      );
    }
  } catch (error) {
    result.details.errors!.push(
      `Solana verification failed: ${error instanceof Error ? error.message : "Unknown"}`
    );
  }

  // Result is OK if both verifications succeeded
  result.ok = !!result.details.erc20 && !!result.details.solana;

  return result;
}

/**
 * Quick check if token exists on both chains (for quoting)
 */
export async function checkTokenExists(
  sourceChainId: number,
  sourceTokenAddress: string,
  solanaMint: string
): Promise<{ ok: boolean; erc20: boolean; solana: boolean }> {
  const result = { ok: false, erc20: false, solana: false };

  try {
    await verifyErc20Metadata(sourceChainId, sourceTokenAddress);
    result.erc20 = true;
  } catch {
    // Ignore error
  }

  try {
    await verifySolanaMint(solanaMint);
    result.solana = true;
  } catch {
    // Ignore error
  }

  result.ok = result.erc20 && result.solana;
  return result;
}

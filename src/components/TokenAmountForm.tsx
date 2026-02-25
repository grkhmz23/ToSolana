"use client";

import { useState, useCallback, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation } from "@tanstack/react-query";
import { NATIVE_TOKEN_ADDRESS, getChainType, type ChainType } from "@/lib/chains";
import { parseTokenAmount } from "@/lib/format";
import { useTokenPrice, formatUsd } from "@/hooks/useTokenPrices";
import { useNonEvmTokenPrice } from "@/hooks/useNonEvmTokenPrices";
import { ChainSelector } from "./ChainSelector";
import { TokenSelector, SolanaTokenSelector } from "./TokenSelector";
import { NonEvmWalletConnector } from "./NonEvmWalletConnector";
import { SlippageSettings } from "./SlippageSettings";
import type { NormalizedRoute, QuoteResponse } from "@/server/schema";
import type { WalletType } from "@/lib/nonEvmWallets";

// Form values to pass back for history/re-execution
export interface FormValues {
  sourceChainId: number | string;
  sourceToken?: string;
  sourceAmount: string;
  sourceAmountDisplay?: string;
  destToken: string;
  slippage: number;
}

interface TokenAmountFormProps {
  onQuotesReceived: (routes: NormalizedRoute[], errors: string[] | undefined, formValues: FormValues) => void;
  // Optional: pre-fill form values (for re-execution)
  initialValues?: Partial<FormValues>;
}

export function TokenAmountForm({ onQuotesReceived, initialValues }: TokenAmountFormProps) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const chainId = useChainId();
  const { publicKey, connected: solConnected } = useWallet();

  const [sourceChainId, setSourceChainId] = useState<number | string>(
    initialValues?.sourceChainId ?? 1
  );
  const [sourceToken, setSourceToken] = useState<string>(
    initialValues?.sourceToken ?? NATIVE_TOKEN_ADDRESS
  );
  const [amount, setAmount] = useState<string>(initialValues?.sourceAmount ?? "");
  const [destToken, setDestToken] = useState<string>(initialValues?.destToken ?? "SOL");
  const [slippage, setSlippage] = useState<number>(3); // Default 3%
  
  // Non-EVM wallet state
  const [nonEvmAddress, setNonEvmAddress] = useState<string | null>(null);

  // Determine chain type
  const chainType = useMemo<ChainType>(() => {
    return getChainType(sourceChainId);
  }, [sourceChainId]);

  const isEvmChain = chainType === "evm";
  const isNonEvmChain = !isEvmChain;

  // Handle chain change - reset source token to native
  const handleChainChange = useCallback((newChainId: number | string) => {
    setSourceChainId(newChainId);
    setNonEvmAddress(null); // Reset non-EVM wallet on chain change
    if (!initialValues?.sourceToken) {
      setSourceToken(isEvmChain ? NATIVE_TOKEN_ADDRESS : "native");
    }
  }, [initialValues?.sourceToken, isEvmChain]);

  // Handle non-EVM wallet connection
  const handleNonEvmConnect = useCallback((address: string) => {
    setNonEvmAddress(address);
  }, []);

  const handleNonEvmDisconnect = useCallback(() => {
    setNonEvmAddress(null);
  }, []);

  const amountValid = !!amount && parseFloat(amount) > 0;

  // Determine if we can quote based on wallet connections
  const canQuote = useMemo(() => {
    if (!solConnected || !amountValid) return false;
    
    if (isEvmChain) {
      return evmConnected;
    } else {
      return !!nonEvmAddress;
    }
  }, [isEvmChain, evmConnected, solConnected, nonEvmAddress, amountValid]);

  // Get the appropriate source address
  const sourceAddress = useMemo(() => {
    if (isEvmChain) return evmAddress;
    return nonEvmAddress;
  }, [isEvmChain, evmAddress, nonEvmAddress]);

  // Parse amount to raw token units
  const rawAmount = useMemo(() => {
    if (isEvmChain) {
      const isNative = sourceToken === NATIVE_TOKEN_ADDRESS;
      return isNative 
        ? parseTokenAmount(amount, 18) 
        : amount;
    } else {
      // Non-EVM chains have different decimal handling
      const decimals = chainType === "bitcoin" ? 8 : chainType === "cosmos" ? 6 : 9;
      return parseTokenAmount(amount, decimals);
    }
  }, [amount, sourceToken, isEvmChain, chainType]);

  // Fetch source token price for USD display
  const { data: evmPriceData, isLoading: isLoadingEvmPrice } = useTokenPrice(
    amountValid && sourceToken && isEvmChain
      ? { chainId: sourceChainId as number, address: sourceToken }
      : null
  );

  // Fetch non-EVM token price
  const { data: nonEvmPriceData, isLoading: isLoadingNonEvmPrice } = useNonEvmTokenPrice(
    amountValid && isNonEvmChain ? (sourceChainId as string) : null
  );

  // Use appropriate price data
  const sourcePriceData = isEvmChain ? evmPriceData : nonEvmPriceData;
  const isLoadingSourcePrice = isEvmChain ? isLoadingEvmPrice : isLoadingNonEvmPrice;

  // Calculate USD value of input
  const inputUsdValue = useMemo(() => {
    if (!sourcePriceData?.priceUsd || !amountValid) return null;
    const parsedAmount = parseFloat(amount) || 0;
    return parsedAmount * sourcePriceData.priceUsd;
  }, [sourcePriceData?.priceUsd, amount, amountValid]);

  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!sourceAddress || !publicKey) {
        throw new Error("Wallets not connected");
      }

      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChainId,
          sourceTokenAddress: isEvmChain ? sourceToken : "native",
          sourceAmount: rawAmount,
          destinationTokenAddress: destToken,
          sourceAddress: sourceAddress,
          solanaAddress: publicKey.toBase58(),
          slippage,
          sourceChainType: chainType,
        }),
      });
      const data = (await res.json()) as QuoteResponse & { error?: string; details?: unknown };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      const formValues: FormValues = {
        sourceChainId,
        sourceToken,
        sourceAmount: rawAmount,
        sourceAmountDisplay: amount,
        destToken,
        slippage,
      };
      onQuotesReceived(data.routes, data.errors, formValues);
    },
  });

  const handleQuote = useCallback(() => {
    if (canQuote) quoteMutation.mutate();
  }, [canQuote, quoteMutation]);

  // Get button text based on state
  const buttonText = useMemo(() => {
    if (quoteMutation.isPending) return "Fetching quotes...";
    if (!solConnected) return "Connect Solana wallet first";
    if (isEvmChain) {
      if (!evmConnected) return "Connect EVM wallet first";
    } else {
      if (!nonEvmAddress) return `Connect ${chainType === "bitcoin" ? "Xverse" : chainType === "cosmos" ? "Keplr" : "TON"} wallet first`;
    }
    if (!amountValid) return "Enter an amount";
    return "Get Quotes";
  }, [quoteMutation.isPending, solConnected, isEvmChain, evmConnected, nonEvmAddress, amountValid, chainType]);

  return (
    <div className="space-y-4">
      {/* Source Chain */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Source Chain</label>
        <ChainSelector
          selectedChain={sourceChainId}
          onSelect={handleChainChange}
          label="Select source chain"
        />
        {isEvmChain && evmConnected && chainId !== sourceChainId && (
          <p className="mt-1 text-xs text-[var(--warning)]">
            Your wallet is on a different chain. You may need to switch networks.
          </p>
        )}
      </div>

      {/* Non-EVM Wallet Connector */}
      {isNonEvmChain && (
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">
            {chainType === "bitcoin" && "Bitcoin Wallet (Xverse)"}
            {chainType === "cosmos" && "Cosmos Wallet (Keplr)"}
            {chainType === "ton" && "TON Wallet"}
          </label>
          <NonEvmWalletConnector
            chainType={chainType as WalletType}
            onConnect={handleNonEvmConnect}
            onDisconnect={handleNonEvmDisconnect}
            connectedAddress={nonEvmAddress}
          />
        </div>
      )}

      {/* Source Token Selector (only for EVM chains) */}
      {isEvmChain && (
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">Source Token</label>
          <TokenSelector
            chainId={sourceChainId as number}
            selectedToken={sourceToken}
            onSelectToken={setSourceToken}
            label="Select source token"
          />
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">
          Amount {isNonEvmChain && `(${chainType === "bitcoin" ? "BTC" : chainType === "cosmos" ? "ATOM" : "TON"})`}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) setAmount(val);
            }}
            className={`w-full rounded-lg border bg-[var(--card)] px-3 py-2 pr-20 text-sm text-[var(--foreground)] outline-none ${
              amount && !amountValid
                ? "border-[var(--danger)]"
                : "border-[var(--card-border)] focus:border-[var(--primary)]"
            }`}
          />
          {inputUsdValue !== null && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
              {isLoadingSourcePrice ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--muted)] border-t-transparent" />
              ) : (
                <span className="text-[var(--accent)]">{formatUsd(inputUsdValue)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Destination Token Selector */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Destination Token (Solana)</label>
        <SolanaTokenSelector
          selectedToken={destToken}
          onSelectToken={setDestToken}
          label="Select destination token"
        />
      </div>

      {/* Slippage Settings */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--muted)]">Transaction Settings</span>
        <SlippageSettings value={slippage} onChange={setSlippage} />
      </div>

      {/* Quote Button */}
      <button
        onClick={handleQuote}
        disabled={!canQuote || quoteMutation.isPending}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {buttonText}
      </button>

      {/* Errors */}
      {quoteMutation.isError && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          {quoteMutation.error.message}
        </div>
      )}
    </div>
  );
}

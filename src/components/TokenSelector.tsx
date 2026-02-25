"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import type { TokenInfo } from "@/lib/token-lists";
import { searchTokens } from "@/lib/token-lists";
import { NATIVE_TOKEN_ADDRESS } from "@/lib/chains";
import { isValidEvmAddress } from "@/lib/tokens";

interface TokenSelectorProps {
  chainId: number;
  selectedToken: string;
  onSelectToken: (address: string) => void;
  label?: string;
  placeholder?: string;
}

interface TokenListResponse {
  chainId: number;
  tokens: TokenInfo[];
}

export function TokenSelector({
  chainId,
  selectedToken,
  onSelectToken,
  label = "Select Token",
  placeholder = "Search tokens...",
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch token list for this chain
  const { data, isLoading } = useQuery<TokenListResponse>({
    queryKey: ["token-list", chainId],
    queryFn: async () => {
      const res = await fetch(`/api/tokens?chainId=${chainId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error ?? "Failed to fetch token list");
      }
      return (await res.json()) as TokenListResponse;
    },
    enabled: isOpen,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowCustomInput(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter tokens by search query
  const filteredTokens = useMemo(() => {
    if (!data?.tokens) return [];
    return searchTokens(data.tokens, searchQuery);
  }, [data, searchQuery]);

  // Get selected token info
  const selectedTokenInfo = useMemo(() => {
    if (!data?.tokens) return null;
    return data.tokens.find(
      (t) =>
        t.address.toLowerCase() === selectedToken.toLowerCase() ||
        (selectedToken === NATIVE_TOKEN_ADDRESS && t.address === NATIVE_TOKEN_ADDRESS),
    );
  }, [data, selectedToken]);

  // Handle custom address submission
  const handleCustomAddressSubmit = useCallback(() => {
    if (isValidEvmAddress(customAddress)) {
      onSelectToken(customAddress);
      setIsOpen(false);
      setCustomAddress("");
      setShowCustomInput(false);
      setSearchQuery("");
    }
  }, [customAddress, onSelectToken]);

  // Handle token selection
  const handleSelect = useCallback(
    (address: string) => {
      onSelectToken(address);
      setIsOpen(false);
      setSearchQuery("");
      setShowCustomInput(false);
    },
    [onSelectToken],
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-left transition-colors hover:border-[var(--primary)]/50"
      >
        {selectedTokenInfo?.logoURI ? (
          <Image
            src={selectedTokenInfo.logoURI}
            alt={selectedTokenInfo.symbol}
            width={24}
            height={24}
            className="h-6 w-6 rounded-full"
            unoptimized
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
            ?
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--foreground)]">
            {selectedTokenInfo?.symbol ??
              (selectedToken === NATIVE_TOKEN_ADDRESS ? "Native Token" : "Custom Token")}
          </div>
          {selectedTokenInfo?.name && (
            <div className="text-xs text-[var(--muted)]">{selectedTokenInfo.name}</div>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-lg">
          {/* Header */}
          <div className="border-b border-[var(--card-border)] p-3">
            <div className="mb-2 text-xs font-medium text-[var(--muted)]">{label}</div>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowCustomInput(false);
                }}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 pl-9 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Token list */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </div>
            ) : filteredTokens.length === 0 && !showCustomInput ? (
              <div className="py-4 text-center">
                <p className="text-sm text-[var(--muted)]">No tokens found</p>
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="mt-2 text-xs text-[var(--primary)] hover:underline"
                >
                  Enter custom address
                </button>
              </div>
            ) : (
              <>
                {/* Popular / Native tokens first */}
                {filteredTokens.slice(0, 10).map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token.address)}
                    className={`flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--background)] ${
                      selectedToken.toLowerCase() === token.address.toLowerCase()
                        ? "bg-[var(--primary)]/10"
                        : ""
                    }`}
                  >
                    {token.logoURI ? (
                      <Image
                        src={token.logoURI}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                        unoptimized
                      />
                    ) : null}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)] ${
                        token.logoURI ? "hidden" : ""
                      }`}
                    >
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{token.name}</div>
                    </div>
                    {selectedToken.toLowerCase() === token.address.toLowerCase() && (
                      <svg
                        className="h-5 w-5 text-[var(--primary)]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}

                {/* Show more indicator */}
                {filteredTokens.length > 10 && (
                  <div className="px-3 py-2 text-center text-xs text-[var(--muted)]">
                    +{filteredTokens.length - 10} more tokens
                  </div>
                )}

                {/* Custom token option */}
                {!showCustomInput && (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="flex w-full items-center gap-3 border-t border-[var(--card-border)] px-3 py-2 text-left transition-colors hover:bg-[var(--background)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--muted)]/20 text-xs font-bold text-[var(--muted)]">
                      +
                    </div>
                    <div className="text-sm text-[var(--muted)]">Enter custom token address</div>
                  </button>
                )}
              </>
            )}

            {/* Custom address input */}
            {showCustomInput && (
              <div className="border-t border-[var(--card-border)] p-3">
                <label className="mb-1 block text-xs text-[var(--muted)]">
                  Custom Token Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className={`w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
                    customAddress && !isValidEvmAddress(customAddress)
                      ? "border-[var(--danger)]"
                      : "border-[var(--card-border)] focus:border-[var(--primary)]"
                  }`}
                />
                {customAddress && !isValidEvmAddress(customAddress) && (
                  <p className="mt-1 text-xs text-[var(--danger)]">Invalid address format</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="flex-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomAddressSubmit}
                    disabled={!isValidEvmAddress(customAddress)}
                    className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Token
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Solana Token Selector (similar but for Solana)
interface SolanaTokenSelectorProps {
  selectedToken: string;
  onSelectToken: (address: string) => void;
  label?: string;
}

const SOLANA_TOKENS: TokenInfo[] = [
  {
    address: "SOL",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    chainId: 101,
  },
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

export function SolanaTokenSelector({
  selectedToken,
  onSelectToken,
  label = "Select Token",
}: SolanaTokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowCustomInput(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter tokens by search query
  const filteredTokens = useMemo(() => {
    return searchTokens(SOLANA_TOKENS, searchQuery);
  }, [searchQuery]);

  // Get selected token info
  const selectedTokenInfo = useMemo(() => {
    return SOLANA_TOKENS.find(
      (t) => t.address.toLowerCase() === selectedToken.toLowerCase() ||
        (selectedToken === "SOL" && t.address === "SOL"),
    );
  }, [selectedToken]);

  // Handle custom address submission
  const handleCustomAddressSubmit = useCallback(() => {
    if (customAddress.length >= 32 && customAddress.length <= 44) {
      onSelectToken(customAddress);
      setIsOpen(false);
      setCustomAddress("");
      setShowCustomInput(false);
      setSearchQuery("");
    }
  }, [customAddress, onSelectToken]);

  // Handle token selection
  const handleSelect = useCallback(
    (address: string) => {
      onSelectToken(address);
      setIsOpen(false);
      setSearchQuery("");
      setShowCustomInput(false);
    },
    [onSelectToken],
  );

  // Validate Solana address (base58, 32-44 chars)
  const isValidSolanaAddress = (addr: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-left transition-colors hover:border-[var(--primary)]/50"
      >
        {selectedTokenInfo?.logoURI ? (
          <Image
            src={selectedTokenInfo.logoURI}
            alt={selectedTokenInfo.symbol}
            width={24}
            height={24}
            className="h-6 w-6 rounded-full"
            unoptimized
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
            ?
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--foreground)]">
            {selectedTokenInfo?.symbol ?? "Custom Token"}
          </div>
          {selectedTokenInfo?.name && (
            <div className="text-xs text-[var(--muted)]">{selectedTokenInfo.name}</div>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-lg">
          {/* Header */}
          <div className="border-b border-[var(--card-border)] p-3">
            <div className="mb-2 text-xs font-medium text-[var(--muted)]">{label}</div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowCustomInput(false);
                }}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 pl-9 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Token list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTokens.length === 0 && !showCustomInput ? (
              <div className="py-4 text-center">
                <p className="text-sm text-[var(--muted)]">No tokens found</p>
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="mt-2 text-xs text-[var(--primary)] hover:underline"
                >
                  Enter custom mint address
                </button>
              </div>
            ) : (
              <>
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token.address)}
                    className={`flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--background)] ${
                      selectedToken.toLowerCase() === token.address.toLowerCase()
                        ? "bg-[var(--primary)]/10"
                        : ""
                    }`}
                  >
                    {token.logoURI ? (
                      <Image
                        src={token.logoURI}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                        unoptimized
                      />
                    ) : null}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)] ${
                        token.logoURI ? "hidden" : ""
                      }`}
                    >
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{token.name}</div>
                    </div>
                    {selectedToken.toLowerCase() === token.address.toLowerCase() && (
                      <svg
                        className="h-5 w-5 text-[var(--primary)]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}

                {/* Custom token option */}
                {!showCustomInput && (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="flex w-full items-center gap-3 border-t border-[var(--card-border)] px-3 py-2 text-left transition-colors hover:bg-[var(--background)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--muted)]/20 text-xs font-bold text-[var(--muted)]">
                      +
                    </div>
                    <div className="text-sm text-[var(--muted)]">Enter custom mint address</div>
                  </button>
                )}
              </>
            )}

            {/* Custom address input */}
            {showCustomInput && (
              <div className="border-t border-[var(--card-border)] p-3">
                <label className="mb-1 block text-xs text-[var(--muted)]">
                  Custom Mint Address
                </label>
                <input
                  type="text"
                  placeholder="Base58 address..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className={`w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ${
                    customAddress && !isValidSolanaAddress(customAddress)
                      ? "border-[var(--danger)]"
                      : "border-[var(--card-border)] focus:border-[var(--primary)]"
                  }`}
                />
                {customAddress && !isValidSolanaAddress(customAddress) && (
                  <p className="mt-1 text-xs text-[var(--danger)]">Invalid Solana address</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="flex-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomAddressSubmit}
                    disabled={!isValidSolanaAddress(customAddress)}
                    className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Token
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

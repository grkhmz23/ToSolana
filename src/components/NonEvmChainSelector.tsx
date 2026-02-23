"use client";

import { useState } from "react";
import {
  SUPPORTED_NON_EVM_CHAINS,
  type NonEvmChain,
} from "@/lib/chains";

interface NonEvmChainSelectorProps {
  selectedChain: string | null;
  onSelect: (chainId: string) => void;
  disabled?: boolean;
}

const CHAIN_ICONS: Record<string, string> = {
  bitcoin:
    "https://assets.coingecko.com/coins/images/1/small/bitcoin.png?1547033579",
  cosmos:
    "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png?1555657960",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png?1674278137",
};

export function NonEvmChainSelector({
  selectedChain,
  onSelect,
  disabled = false,
}: NonEvmChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedChainData = selectedChain
    ? SUPPORTED_NON_EVM_CHAINS.find((c) => c.id === selectedChain)
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border
          ${disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white hover:border-blue-400 cursor-pointer"}
          border-gray-200 transition-colors min-w-[140px]
        `}
      >
        {selectedChainData ? (
          <>
            <img
              src={CHAIN_ICONS[selectedChainData.id]}
              alt={selectedChainData.name}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="font-medium text-gray-900">
              {selectedChainData.name}
            </span>
          </>
        ) : (
          <span className="text-gray-500">Select Chain</span>
        )}
        <svg
          className={`w-4 h-4 ml-auto text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Non-EVM Chains
              </div>
              {SUPPORTED_NON_EVM_CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => {
                    onSelect(chain.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                    transition-colors
                    ${selectedChain === chain.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100 text-gray-900"}
                  `}
                >
                  <img
                    src={CHAIN_ICONS[chain.id]}
                    alt={chain.name}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='12'%3E?%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{chain.name}</div>
                    <div className="text-sm text-gray-500">
                      {chain.nativeCurrency.symbol}
                    </div>
                  </div>
                  {selectedChain === chain.id && (
                    <svg
                      className="w-5 h-5 text-blue-600"
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { SUPPORTED_CHAINS, SUPPORTED_NON_EVM_CHAINS, type NonEvmChain } from "@/lib/chains";
import type { Chain } from "wagmi/chains";

interface ChainSelectorProps {
  selectedChain: string | number | null;
  onSelect: (chainId: string | number) => void;
  disabled?: boolean;
  label?: string;
}

const CHAIN_ICONS: Record<string | number, string> = {
  // EVM chains
  1: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  56: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  43114: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  42161: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
  10: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  8453: "https://assets.coingecko.com/coins/images/31110/small/base.jpeg",
  137: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  324: "https://assets.coingecko.com/coins/images/38043/small/zkSync.jpg",
  1101: "https://assets.coingecko.com/coins/images/25383/small/matic.jpg",
  59144: "https://assets.coingecko.com/coins/images/28600/small/linea.jpg",
  534352: "https://assets.coingecko.com/coins/images/34188/small/scroll.jpeg",
  5000: "https://assets.coingecko.com/coins/images/30980/small/mantle.jpeg",
  81457: "https://assets.coingecko.com/coins/images/35494/small/blast.jpg",
  250: "https://assets.coingecko.com/coins/images/4001/small/Fantom.png",
  100: "https://assets.coingecko.com/coins/images/11062/small/200x200.png",
  25: "https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png",
  42220: "https://assets.coingecko.com/coins/images/11090/small/InjXBNx9_400x400.jpg",
  1313161554: "https://assets.coingecko.com/coins/images/20582/small/aurora.jpeg",
  1666600000: "https://assets.coingecko.com/coins/images/4344/small/YJ3xJ8s.png",
  1088: "https://assets.coingecko.com/coins/images/15595/small/metis.jpeg",
  169: "https://assets.coingecko.com/coins/images/30980/small/mantle.jpeg",
  7777777: "https://assets.coingecko.com/coins/images/35494/small/blast.jpg",
  // Non-EVM chains
  bitcoin: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  cosmos: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  ton: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
};

function getChainIdentifier(chain: Chain | NonEvmChain): string | number {
  // Both Chain and NonEvmChain have an id property
  return chain.id as string | number;
}

function getChainName(chain: Chain | NonEvmChain): string {
  return chain.name;
}

function getChainSymbol(chain: Chain | NonEvmChain): string {
  return chain.nativeCurrency.symbol;
}

export function ChainSelector({
  selectedChain,
  onSelect,
  disabled = false,
  label = "Select Chain",
}: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"evm" | "non-evm">("evm");

  const selectedChainData = selectedChain
    ? activeTab === "evm" && typeof selectedChain === "number"
      ? SUPPORTED_CHAINS.find((c) => c.id === selectedChain)
      : typeof selectedChain === "string"
        ? SUPPORTED_NON_EVM_CHAINS.find((c) => c.id === selectedChain)
        : null
    : null;

  const handleSelect = (chainId: string | number) => {
    onSelect(chainId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border w-full
          ${disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white hover:border-blue-400 cursor-pointer"}
          border-gray-200 transition-colors
        `}
      >
        {selectedChainData ? (
          <>
            <Image
              src={CHAIN_ICONS[getChainIdentifier(selectedChainData)]}
              alt={getChainName(selectedChainData)}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
              unoptimized
            />
            <span className="font-medium text-gray-900 truncate">
              {getChainName(selectedChainData)}
            </span>
          </>
        ) : (
          <span className="text-gray-500">{label}</span>
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
          <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("evm")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "evm"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                EVM ({SUPPORTED_CHAINS.length})
              </button>
              <button
                onClick={() => setActiveTab("non-evm")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "non-evm"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Non-EVM ({SUPPORTED_NON_EVM_CHAINS.length})
              </button>
            </div>

            {/* Chain List */}
            <div className="max-h-72 overflow-y-auto p-2">
              {activeTab === "evm" ? (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                    Popular Chains
                  </div>
                  {SUPPORTED_CHAINS.slice(0, 6).map((chain) => (
                    <ChainOption
                      key={chain.id}
                      chain={chain}
                      isSelected={selectedChain === chain.id}
                      onSelect={() => handleSelect(chain.id)}
                    />
                  ))}
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 mt-2">
                    All EVM Chains
                  </div>
                  {SUPPORTED_CHAINS.slice(6).map((chain) => (
                    <ChainOption
                      key={chain.id}
                      chain={chain}
                      isSelected={selectedChain === chain.id}
                      onSelect={() => handleSelect(chain.id)}
                    />
                  ))}
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                    Bitcoin & Cosmos
                  </div>
                  {SUPPORTED_NON_EVM_CHAINS.map((chain) => (
                    <ChainOption
                      key={chain.id}
                      chain={chain}
                      isSelected={selectedChain === chain.id}
                      onSelect={() => handleSelect(chain.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ChainOptionProps {
  chain: Chain | NonEvmChain;
  isSelected: boolean;
  onSelect: () => void;
}

function ChainOption({ chain, isSelected, onSelect }: ChainOptionProps) {
  const chainId = getChainIdentifier(chain);
  const iconUrl = CHAIN_ICONS[chainId];

  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
        transition-colors
        ${isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100 text-gray-900"}
      `}
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={getChainName(chain)}
          width={32}
          height={32}
          className="w-8 h-8 rounded-full"
          unoptimized
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
          {getChainName(chain).slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium">{getChainName(chain)}</div>
        <div className="text-sm text-gray-500">{getChainSymbol(chain)}</div>
      </div>
      {isSelected && (
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
  );
}

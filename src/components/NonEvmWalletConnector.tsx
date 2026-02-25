"use client";

import { useState } from "react";
import Image from "next/image";
import { useBitcoinWallet, useCosmosWallet, useTonWallet } from "@/hooks/useNonEvmWallet";
import type { WalletType } from "@/lib/nonEvmWallets";

interface NonEvmWalletConnectorProps {
  chainType: WalletType | null;
  onConnect: (address: string, chainType: WalletType) => void;
  onDisconnect: () => void;
  connectedAddress?: string | null;
}

const WALLET_CONFIGS: Record<WalletType, { name: string; icon: string; installUrl: string; description: string }> = {
  bitcoin: {
    name: "Xverse",
    icon: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    installUrl: "https://www.xverse.app/",
    description: "Bitcoin wallet with support for Ordinals and BRC-20",
  },
  cosmos: {
    name: "Keplr",
    icon: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
    installUrl: "https://www.keplr.app/",
    description: "Leading Cosmos ecosystem wallet",
  },
  ton: {
    name: "TON Wallet",
    icon: "https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png",
    installUrl: "https://tonkeeper.com/",
    description: "Official TON blockchain wallet",
  },
};

export function NonEvmWalletConnector({
  chainType,
  onConnect,
  onDisconnect,
  connectedAddress,
}: NonEvmWalletConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const bitcoin = useBitcoinWallet();
  const cosmos = useCosmosWallet();
  const ton = useTonWallet();

  if (!chainType) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">Select a non-EVM chain to connect wallet</p>
      </div>
    );
  }

  const wallet = chainType === "bitcoin" ? bitcoin : chainType === "cosmos" ? cosmos : ton;
  const config = WALLET_CONFIGS[chainType];

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const address = await wallet.connect();
      if (address) {
        onConnect(address, chainType);
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await wallet.disconnect();
    onDisconnect();
  };

  if (wallet.wallet?.isConnected && connectedAddress) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <Image
              src={config.icon}
              alt={config.name}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-900">{config.name} Connected</p>
            <p className="text-sm text-green-700 truncate">
              {connectedAddress.slice(0, 8)}...{connectedAddress.slice(-6)}
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-sm font-medium text-green-700 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Image
            src={config.icon}
            alt={config.name}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900">{config.name}</h3>
          <p className="text-sm text-gray-500">{config.description}</p>
          
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
              {!wallet.isInstalled && (
                <a
                  href={config.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center text-sm font-medium text-red-700 hover:text-red-800"
                >
                  Install {config.name}
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {!wallet.isInstalled && !error && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                Not installed
              </span>
              <a
                href={config.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Get {config.name} →
              </a>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={isConnecting || !wallet.isInstalled}
        className={`
          mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium
          transition-colors
          ${!wallet.isInstalled 
            ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700"
          }
          ${isConnecting ? "opacity-70" : ""}
        `}
      >
        {isConnecting ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </>
        ) : !wallet.isInstalled ? (
          `${config.name} not installed`
        ) : (
          `Connect ${config.name}`
        )}
      </button>
    </div>
  );
}

// Chain-specific wallet status badges
export function WalletStatusBadge({ chainType }: { chainType: WalletType }) {
  const bitcoin = useBitcoinWallet();
  const cosmos = useCosmosWallet();
  const ton = useTonWallet();
  const wallet = chainType === "bitcoin" ? bitcoin : chainType === "cosmos" ? cosmos : ton;

  if (wallet.wallet?.isConnected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
        Connected
      </span>
    );
  }

  if (wallet.isConnecting) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Connecting...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
      Not connected
    </span>
  );
}

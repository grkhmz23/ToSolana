"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { WalletType, NonEvmWallet } from "@/lib/nonEvmWallets";
import {
  createXverseAdapter,
  createKeplrAdapter,
  createTonAdapter,
  detectWallet,
} from "@/lib/nonEvmWallets";

interface NonEvmWalletContextType {
  // Bitcoin
  bitcoinWallet: NonEvmWallet | null;
  connectBitcoin: () => Promise<string | null>;
  disconnectBitcoin: () => Promise<void>;
  
  // Cosmos
  cosmosWallet: NonEvmWallet | null;
  connectCosmos: () => Promise<string | null>;
  disconnectCosmos: () => Promise<void>;
  
  // TON
  tonWallet: NonEvmWallet | null;
  connectTon: () => Promise<string | null>;
  disconnectTon: () => Promise<void>;
  
  // Common
  isConnecting: boolean;
  error: string | null;
  installedWallets: Record<WalletType, boolean>;
  refreshInstalledWallets: () => void;
}

const NonEvmWalletContext = createContext<NonEvmWalletContextType | null>(null);

export function NonEvmWalletProvider({ children }: { children: ReactNode }) {
  // Wallet states
  const [bitcoinWallet, setBitcoinWallet] = useState<NonEvmWallet | null>(null);
  const [cosmosWallet, setCosmosWallet] = useState<NonEvmWallet | null>(null);
  const [tonWallet, setTonWallet] = useState<NonEvmWallet | null>(null);
  
  // UI states
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<Record<WalletType, boolean>>({
    bitcoin: false,
    cosmos: false,
    ton: false,
  });

  // Detect installed wallets on mount
  const refreshInstalledWallets = useCallback(() => {
    setInstalledWallets({
      bitcoin: detectWallet("bitcoin"),
      cosmos: detectWallet("cosmos"),
      ton: detectWallet("ton"),
    });
  }, []);

  useEffect(() => {
    refreshInstalledWallets();
  }, [refreshInstalledWallets]);

  // Bitcoin connection
  const connectBitcoin = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const adapter = createXverseAdapter();
      const address = await adapter.connect();
      setBitcoinWallet(adapter);
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Bitcoin wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectBitcoin = useCallback(async () => {
    if (bitcoinWallet) {
      await bitcoinWallet.disconnect();
      setBitcoinWallet(null);
    }
  }, [bitcoinWallet]);

  // Cosmos connection
  const connectCosmos = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const adapter = createKeplrAdapter();
      const address = await adapter.connect();
      setCosmosWallet(adapter);
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Cosmos wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectCosmos = useCallback(async () => {
    if (cosmosWallet) {
      await cosmosWallet.disconnect();
      setCosmosWallet(null);
    }
  }, [cosmosWallet]);

  // TON connection
  const connectTon = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const adapter = createTonAdapter();
      const address = await adapter.connect();
      setTonWallet(adapter);
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect TON wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectTon = useCallback(async () => {
    if (tonWallet) {
      await tonWallet.disconnect();
      setTonWallet(null);
    }
  }, [tonWallet]);

  // Auto-reconnect on mount (check localStorage)
  useEffect(() => {
    const autoReconnect = async () => {
      const lastWallet = localStorage.getItem("lastNonEvmWallet") as WalletType | null;
      if (!lastWallet) return;

      try {
        switch (lastWallet) {
          case "bitcoin":
            if (detectWallet("bitcoin")) {
              await connectBitcoin();
            }
            break;
          case "cosmos":
            if (detectWallet("cosmos")) {
              await connectCosmos();
            }
            break;
          case "ton":
            if (detectWallet("ton")) {
              await connectTon();
            }
            break;
        }
      } catch {
        // Ignore auto-reconnect errors
      }
    };

    autoReconnect();
  }, [connectBitcoin, connectCosmos, connectTon]);

  // Save wallet connection to localStorage
  useEffect(() => {
    if (bitcoinWallet?.isConnected) {
      localStorage.setItem("lastNonEvmWallet", "bitcoin");
    } else if (cosmosWallet?.isConnected) {
      localStorage.setItem("lastNonEvmWallet", "cosmos");
    } else if (tonWallet?.isConnected) {
      localStorage.setItem("lastNonEvmWallet", "ton");
    } else {
      localStorage.removeItem("lastNonEvmWallet");
    }
  }, [bitcoinWallet, cosmosWallet, tonWallet]);

  const value: NonEvmWalletContextType = {
    bitcoinWallet,
    connectBitcoin,
    disconnectBitcoin,
    cosmosWallet,
    connectCosmos,
    disconnectCosmos,
    tonWallet,
    connectTon,
    disconnectTon,
    isConnecting,
    error,
    installedWallets,
    refreshInstalledWallets,
  };

  return (
    <NonEvmWalletContext.Provider value={value}>
      {children}
    </NonEvmWalletContext.Provider>
  );
}

export function useNonEvmWallet(): NonEvmWalletContextType {
  const context = useContext(NonEvmWalletContext);
  if (!context) {
    throw new Error("useNonEvmWallet must be used within a NonEvmWalletProvider");
  }
  return context;
}

// Convenience hooks for specific wallet types
export function useBitcoinWallet() {
  const { bitcoinWallet, connectBitcoin, disconnectBitcoin, isConnecting, error } = useNonEvmWallet();
  return {
    wallet: bitcoinWallet,
    connect: connectBitcoin,
    disconnect: disconnectBitcoin,
    isConnecting,
    error,
    isInstalled: typeof window !== "undefined" && !!window.bitcoin,
  };
}

export function useCosmosWallet() {
  const { cosmosWallet, connectCosmos, disconnectCosmos, isConnecting, error } = useNonEvmWallet();
  return {
    wallet: cosmosWallet,
    connect: connectCosmos,
    disconnect: disconnectCosmos,
    isConnecting,
    error,
    isInstalled: typeof window !== "undefined" && !!window.keplr,
  };
}

export function useTonWallet() {
  const { tonWallet, connectTon, disconnectTon, isConnecting, error } = useNonEvmWallet();
  return {
    wallet: tonWallet,
    connect: connectTon,
    disconnect: disconnectTon,
    isConnecting,
    error,
    isInstalled: typeof window !== "undefined" && !!window.ton,
  };
}

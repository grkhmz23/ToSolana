"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { 
  NonEvmWallet, 
  WalletOption 
} from "@/lib/nonEvmWallets";
import {
  getAvailableWallets,
  getFirstDetectedWallet,
  detectAllWallets,
} from "@/lib/nonEvmWallets";

interface NonEvmWalletContextType {
  // Bitcoin
  bitcoinWallet: NonEvmWallet | null;
  bitcoinOptions: WalletOption[];
  connectBitcoin: (walletId?: string) => Promise<string | null>;
  disconnectBitcoin: () => Promise<void>;
  
  // Cosmos
  cosmosWallet: NonEvmWallet | null;
  cosmosOptions: WalletOption[];
  connectCosmos: (walletId?: string) => Promise<string | null>;
  disconnectCosmos: () => Promise<void>;
  
  // TON
  tonWallet: NonEvmWallet | null;
  tonOptions: WalletOption[];
  connectTon: (walletId?: string) => Promise<string | null>;
  disconnectTon: () => Promise<void>;
  
  // Common
  isConnecting: boolean;
  error: string | null;
  clearError: () => void;
  refreshWallets: () => void;
  detectedWallets: ReturnType<typeof detectAllWallets>;
}

const NonEvmWalletContext = createContext<NonEvmWalletContextType | null>(null);

export function NonEvmWalletProvider({ children }: { children: ReactNode }) {
  // Wallet states
  const [bitcoinWallet, setBitcoinWallet] = useState<NonEvmWallet | null>(null);
  const [cosmosWallet, setCosmosWallet] = useState<NonEvmWallet | null>(null);
  const [tonWallet, setTonWallet] = useState<NonEvmWallet | null>(null);
  
  // Available wallet options
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [detectedWallets, setDetectedWallets] = useState<ReturnType<typeof detectAllWallets>>({
    bitcoin: [],
    cosmos: [],
    ton: [],
  });
  
  // UI states
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh available wallets
  const refreshWallets = useCallback(() => {
    setWalletOptions(getAvailableWallets());
    setDetectedWallets(detectAllWallets());
  }, []);

  // Detect installed wallets on mount
  useEffect(() => {
    refreshWallets();
    
    // Refresh on window focus (user might have installed a wallet)
    const handleFocus = () => refreshWallets();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshWallets]);

  const clearError = useCallback(() => setError(null), []);

  // Bitcoin connection
  const connectBitcoin = useCallback(async (walletId?: string): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      let walletOption: WalletOption | undefined;
      
      if (walletId) {
        walletOption = walletOptions.find(w => w.id === walletId && w.type === 'bitcoin');
      } else {
        // Auto-select first detected wallet
        walletOption = getFirstDetectedWallet('bitcoin') || 
                       walletOptions.find(w => w.type === 'bitcoin');
      }
      
      if (!walletOption) {
        throw new Error("No Bitcoin wallet available. Please install Xverse, Unisat, or OKX Wallet.");
      }
      
      const adapter = walletOption.create();
      const address = await adapter.connect();
      
      setBitcoinWallet(adapter);
      
      // Save to localStorage
      localStorage.setItem("lastBitcoinWallet", walletOption.id);
      
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Bitcoin wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [walletOptions]);

  const disconnectBitcoin = useCallback(async () => {
    if (bitcoinWallet) {
      await bitcoinWallet.disconnect();
      setBitcoinWallet(null);
      localStorage.removeItem("lastBitcoinWallet");
    }
  }, [bitcoinWallet]);

  // Cosmos connection
  const connectCosmos = useCallback(async (walletId?: string): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      let walletOption: WalletOption | undefined;
      
      if (walletId) {
        walletOption = walletOptions.find(w => w.id === walletId && w.type === 'cosmos');
      } else {
        walletOption = getFirstDetectedWallet('cosmos') || 
                       walletOptions.find(w => w.type === 'cosmos');
      }
      
      if (!walletOption) {
        throw new Error("No Cosmos wallet available. Please install Keplr or Leap.");
      }
      
      const adapter = walletOption.create();
      const address = await adapter.connect();
      
      setCosmosWallet(adapter);
      localStorage.setItem("lastCosmosWallet", walletOption.id);
      
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Cosmos wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [walletOptions]);

  const disconnectCosmos = useCallback(async () => {
    if (cosmosWallet) {
      await cosmosWallet.disconnect();
      setCosmosWallet(null);
      localStorage.removeItem("lastCosmosWallet");
    }
  }, [cosmosWallet]);

  // TON connection
  const connectTon = useCallback(async (walletId?: string): Promise<string | null> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      let walletOption: WalletOption | undefined;
      
      if (walletId) {
        walletOption = walletOptions.find(w => w.id === walletId && w.type === 'ton');
      } else {
        walletOption = getFirstDetectedWallet('ton') || 
                       walletOptions.find(w => w.type === 'ton');
      }
      
      if (!walletOption) {
        throw new Error("No TON wallet available. Please install Tonkeeper or MyTonWallet.");
      }
      
      const adapter = walletOption.create();
      const address = await adapter.connect();
      
      setTonWallet(adapter);
      localStorage.setItem("lastTonWallet", walletOption.id);
      
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect TON wallet";
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [walletOptions]);

  const disconnectTon = useCallback(async () => {
    if (tonWallet) {
      await tonWallet.disconnect();
      setTonWallet(null);
      localStorage.removeItem("lastTonWallet");
    }
  }, [tonWallet]);

  // Auto-reconnect on mount
  useEffect(() => {
    const autoReconnect = async () => {
      const lastBitcoin = localStorage.getItem("lastBitcoinWallet");
      const lastCosmos = localStorage.getItem("lastCosmosWallet");
      const lastTon = localStorage.getItem("lastTonWallet");
      
      // Small delay to let wallets inject themselves
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (lastBitcoin && detectedWallets.bitcoin.length > 0) {
        try {
          await connectBitcoin(lastBitcoin);
        } catch {
          // Ignore auto-reconnect errors
        }
      }
      
      if (lastCosmos && detectedWallets.cosmos.length > 0) {
        try {
          await connectCosmos(lastCosmos);
        } catch {
          // Ignore
        }
      }
      
      if (lastTon && detectedWallets.ton.length > 0) {
        try {
          await connectTon(lastTon);
        } catch {
          // Ignore
        }
      }
    };

    // Only run if we have detected wallets
    if (detectedWallets.bitcoin.length > 0 || 
        detectedWallets.cosmos.length > 0 || 
        detectedWallets.ton.length > 0) {
      autoReconnect();
    }
  }, [detectedWallets, connectBitcoin, connectCosmos, connectTon]);

  const value: NonEvmWalletContextType = {
    bitcoinWallet,
    bitcoinOptions: walletOptions.filter(w => w.type === 'bitcoin'),
    connectBitcoin,
    disconnectBitcoin,
    cosmosWallet,
    cosmosOptions: walletOptions.filter(w => w.type === 'cosmos'),
    connectCosmos,
    disconnectCosmos,
    tonWallet,
    tonOptions: walletOptions.filter(w => w.type === 'ton'),
    connectTon,
    disconnectTon,
    isConnecting,
    error,
    clearError,
    refreshWallets,
    detectedWallets,
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
  const { 
    bitcoinWallet, 
    bitcoinOptions,
    connectBitcoin, 
    disconnectBitcoin, 
    isConnecting, 
    error,
    detectedWallets,
  } = useNonEvmWallet();
  
  return {
    wallet: bitcoinWallet,
    options: bitcoinOptions,
    connect: connectBitcoin,
    disconnect: disconnectBitcoin,
    isConnecting,
    error,
    isInstalled: detectedWallets.bitcoin.length > 0,
    detected: detectedWallets.bitcoin,
  };
}

export function useCosmosWallet() {
  const { 
    cosmosWallet, 
    cosmosOptions,
    connectCosmos, 
    disconnectCosmos, 
    isConnecting, 
    error,
    detectedWallets,
  } = useNonEvmWallet();
  
  return {
    wallet: cosmosWallet,
    options: cosmosOptions,
    connect: connectCosmos,
    disconnect: disconnectCosmos,
    isConnecting,
    error,
    isInstalled: detectedWallets.cosmos.length > 0,
    detected: detectedWallets.cosmos,
  };
}

export function useTonWallet() {
  const { 
    tonWallet, 
    tonOptions,
    connectTon, 
    disconnectTon, 
    isConnecting, 
    error,
    detectedWallets,
  } = useNonEvmWallet();
  
  return {
    wallet: tonWallet,
    options: tonOptions,
    connect: connectTon,
    disconnect: disconnectTon,
    isConnecting,
    error,
    isInstalled: detectedWallets.ton.length > 0,
    detected: detectedWallets.ton,
  };
}

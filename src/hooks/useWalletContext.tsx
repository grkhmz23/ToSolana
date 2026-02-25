"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Chain } from "@/types/bridge";
import {
  useBitcoinWallet,
  useCosmosWallet,
  useTonWallet,
} from "./useNonEvmWallet";

type WalletChainType = "evm" | "solana" | "bitcoin" | "cosmos" | "ton";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId?: string | number;
  chainType: WalletChainType;
}

interface WalletContextType {
  // Source wallet (varies by selected chain)
  sourceWallet: WalletState;
  sourceChain: Chain | null;
  setSourceChain: (chain: Chain) => void;
  connectSource: () => Promise<void>;
  disconnectSource: () => Promise<void>;
  
  // Destination wallet (always Solana)
  destWallet: WalletState;
  connectDest: () => void;
  disconnectDest: () => void;
  
  // Combined state
  isSourceConnected: boolean;
  isDestConnected: boolean;
  isFullyConnected: boolean;
  
  // Loading states
  isConnecting: boolean;
  error: string | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletContextProvider({ 
  children,
  initialSourceChain 
}: { 
  children: ReactNode;
  initialSourceChain?: Chain;
}) {
  // EVM wallet hooks
  const evmAccount = useAccount();
  const evmChainId = useChainId();
  const { connectAsync: evmConnect, connectors: evmConnectors } = useConnect();
  const { disconnectAsync: evmDisconnect } = useDisconnect();
  
  // Solana wallet hooks
  const solanaWallet = useSolanaWallet();
  const { setVisible: setSolanaModalVisible } = useWalletModal();
  
  // Non-EVM wallet hooks
  const bitcoinWallet = useBitcoinWallet();
  const cosmosWallet = useCosmosWallet();
  const tonWallet = useTonWallet();
  
  // Local state
  const [sourceChain, setSourceChainState] = useState<Chain | null>(initialSourceChain || null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Clear error helper
  const clearError = useCallback(() => setError(null), []);
  
  // Get source wallet state based on chain type
  const getSourceWalletState = useCallback((): WalletState => {
    if (!sourceChain) {
      return { address: null, isConnected: false, chainType: "evm" };
    }
    
    switch (sourceChain.type) {
      case "evm":
        return {
          address: evmAccount.address || null,
          isConnected: evmAccount.isConnected,
          chainId: evmChainId,
          chainType: "evm",
        };
      case "bitcoin":
        return {
          address: bitcoinWallet.wallet?.address || null,
          isConnected: bitcoinWallet.wallet?.isConnected || false,
          chainType: "bitcoin",
        };
      case "cosmos":
        return {
          address: cosmosWallet.wallet?.address || null,
          isConnected: cosmosWallet.wallet?.isConnected || false,
          chainType: "cosmos",
        };
      case "ton":
        return {
          address: tonWallet.wallet?.address || null,
          isConnected: tonWallet.wallet?.isConnected || false,
          chainType: "ton",
        };
      default:
        return { address: null, isConnected: false, chainType: "evm" };
    }
  }, [sourceChain, evmAccount, evmChainId, bitcoinWallet.wallet, cosmosWallet.wallet, tonWallet.wallet]);
  
  // Get destination wallet state (always Solana)
  const destWallet: WalletState = {
    address: solanaWallet.publicKey?.toBase58() || null,
    isConnected: solanaWallet.connected,
    chainType: "solana",
  };
  
  const sourceWallet = getSourceWalletState();
  
  // Set source chain with persistence
  const setSourceChain = useCallback((chain: Chain) => {
    setSourceChainState(chain);
    if (typeof window !== "undefined") {
      localStorage.setItem("lastSourceChain", chain.id);
    }
  }, []);
  
  // Connect source wallet based on chain type
  const connectSource = useCallback(async () => {
    if (!sourceChain) {
      setError("Please select a source chain first");
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      switch (sourceChain.type) {
        case "evm": {
          // Find injected connector (MetaMask) or use first available
          const connector = evmConnectors.find(c => c.id === "injected") 
            || evmConnectors.find(c => c.id.includes("metaMask"))
            || evmConnectors[0];
          
          if (!connector) {
            throw new Error("No EVM wallet connector available. Please install MetaMask or another wallet.");
          }
          
          await evmConnect({ connector });
          break;
        }
        case "bitcoin": {
          const address = await bitcoinWallet.connect();
          if (!address) {
            throw new Error("Failed to connect Bitcoin wallet");
          }
          break;
        }
        case "cosmos": {
          const address = await cosmosWallet.connect();
          if (!address) {
            throw new Error("Failed to connect Cosmos wallet");
          }
          break;
        }
        case "ton": {
          const address = await tonWallet.connect();
          if (!address) {
            throw new Error("Failed to connect TON wallet");
          }
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [sourceChain, evmConnectors, evmConnect, bitcoinWallet, cosmosWallet, tonWallet]);
  
  // Disconnect source wallet
  const disconnectSource = useCallback(async () => {
    if (!sourceChain) return;
    
    try {
      switch (sourceChain.type) {
        case "evm":
          await evmDisconnect();
          break;
        case "bitcoin":
          await bitcoinWallet.disconnect();
          break;
        case "cosmos":
          await cosmosWallet.disconnect();
          break;
        case "ton":
          await tonWallet.disconnect();
          break;
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }, [sourceChain, evmDisconnect, bitcoinWallet, cosmosWallet, tonWallet]);
  
  // Connect destination wallet (Solana)
  const connectDest = useCallback(() => {
    setSolanaModalVisible(true);
  }, [setSolanaModalVisible]);
  
  // Disconnect destination wallet
  const disconnectDest = useCallback(() => {
    solanaWallet.disconnect();
  }, [solanaWallet]);
  
  // Load saved chain on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !sourceChain) {
      const savedChain = localStorage.getItem("lastSourceChain");
      if (savedChain) {
        // Import CHAINS and find the saved one
        import("@/lib/constants").then(({ CHAINS }) => {
          const chain = CHAINS.find(c => c.id === savedChain);
          if (chain) setSourceChainState(chain);
        });
      }
    }
  }, [sourceChain]);
  
  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  const value: WalletContextType = {
    sourceWallet,
    sourceChain,
    setSourceChain,
    connectSource,
    disconnectSource,
    destWallet,
    connectDest,
    disconnectDest,
    isSourceConnected: sourceWallet.isConnected,
    isDestConnected: destWallet.isConnected,
    isFullyConnected: sourceWallet.isConnected && destWallet.isConnected,
    isConnecting,
    error,
    clearError,
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used within WalletContextProvider");
  }
  return context;
}

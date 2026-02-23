"use client";

import { type ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  bsc,
  avalanche,
  fantom,
  zkSync,
  polygonZkEvm,
  gnosis,
  cronos,
  linea,
  scroll,
  mantle,
  blast,
  celo,
  aurora,
  harmonyOne,
  metis,
} from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { ToastProvider } from "@/hooks/useToast";
import { NonEvmWalletProvider } from "@/hooks/useNonEvmWallet";

import "@solana/wallet-adapter-react-ui/styles.css";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Define custom chains
const mantaPacific = {
  id: 169,
  name: "Manta Pacific",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://pacific-rpc.manta.network/http"] },
    public: { http: ["https://pacific-rpc.manta.network/http"] },
  },
  blockExplorers: {
    default: { name: "Manta Explorer", url: "https://pacific-explorer.manta.network" },
  },
} as const;

const zora = {
  id: 7777777,
  name: "Zora",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.zora.energy"] },
    public: { http: ["https://rpc.zora.energy"] },
  },
  blockExplorers: {
    default: { name: "Zora Explorer", url: "https://explorer.zora.energy" },
  },
} as const;

// All supported chains
const chains = [
  // Major L1s
  mainnet,
  bsc,
  avalanche,
  
  // Major L2s
  arbitrum,
  optimism,
  base,
  polygon,
  zkSync,
  polygonZkEvm,
  linea,
  scroll,
  mantle,
  blast,
  
  // Other EVM chains
  fantom,
  gnosis,
  cronos,
  celo,
  aurora,
  harmonyOne,
  metis,
  mantaPacific,
  zora,
] as const;

const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    // Major chains
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
    
    // L2s
    [zkSync.id]: http(),
    [polygonZkEvm.id]: http(),
    [linea.id]: http(),
    [scroll.id]: http(),
    [mantle.id]: http(),
    [blast.id]: http(),
    
    // Other chains
    [fantom.id]: http(),
    [gnosis.id]: http(),
    [cronos.id]: http(),
    [celo.id]: http(),
    [aurora.id]: http(),
    [harmonyOne.id]: http(),
    [metis.id]: http(),
    [mantaPacific.id]: http(),
    [zora.id]: http(),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const solanaRpc =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  const wallets = useMemo(() => [], []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ConnectionProvider endpoint={solanaRpc}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <NonEvmWalletProvider>
                <ToastProvider>{children}</ToastProvider>
              </NonEvmWalletProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

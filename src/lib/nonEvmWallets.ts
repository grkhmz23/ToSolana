// Non-EVM wallet adapter system
// Supports Bitcoin, Cosmos, TON, and other non-EVM chains

// Supported non-EVM chain types
export type WalletType = "bitcoin" | "cosmos" | "ton";

// Chain configuration for non-EVM chains (standalone, doesn't extend wagmi Chain)
export interface NonEvmChain {
  id: string;
  name: string;
  type: WalletType;
  bech32Prefix?: string; // For Cosmos chains
  hdPath?: string;       // Derivation path
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls?: {
    default: { http: string[] };
    public?: { http: string[] };
  };
  blockExplorers?: {
    default: { name: string; url: string };
  };
}

// Wallet interface for non-EVM wallets
export interface NonEvmWallet {
  type: WalletType;
  name: string;
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<string>; // Returns address
  disconnect: () => Promise<void>;
  signMessage?: (message: string) => Promise<string>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  getBalance?: (address: string) => Promise<string>;
}

// Bitcoin chains
export const BITCOIN_CHAINS: NonEvmChain[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    type: "bitcoin",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 8 },
    rpcUrls: {
      default: { http: ["https://blockstream.info/api"] },
      public: { http: ["https://blockstream.info/api"] },
    },
    blockExplorers: {
      default: { name: "Mempool", url: "https://mempool.space" },
    },
  },
];

// Cosmos chains
export const COSMOS_CHAINS: NonEvmChain[] = [
  {
    id: "cosmos",
    name: "Cosmos Hub",
    type: "cosmos",
    bech32Prefix: "cosmos",
    nativeCurrency: { name: "Cosmos", symbol: "ATOM", decimals: 6 },
    rpcUrls: {
      default: { http: ["https://rpc.cosmos.directory/cosmoshub"] },
      public: { http: ["https://rpc.cosmos.directory/cosmoshub"] },
    },
    blockExplorers: {
      default: { name: "Mintscan", url: "https://www.mintscan.io/cosmos" },
    },
  },
  {
    id: "osmosis",
    name: "Osmosis",
    type: "cosmos",
    bech32Prefix: "osmo",
    nativeCurrency: { name: "Osmosis", symbol: "OSMO", decimals: 6 },
    rpcUrls: {
      default: { http: ["https://rpc.osmosis.zone"] },
      public: { http: ["https://rpc.osmosis.zone"] },
    },
    blockExplorers: {
      default: { name: "Mintscan", url: "https://www.mintscan.io/osmosis" },
    },
  },
  {
    id: "injective",
    name: "Injective",
    type: "cosmos",
    bech32Prefix: "inj",
    nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.injective.network"] },
      public: { http: ["https://rpc.injective.network"] },
    },
    blockExplorers: {
      default: { name: "Mintscan", url: "https://www.mintscan.io/injective" },
    },
  },
];

// TON chains
export const TON_CHAINS: NonEvmChain[] = [
  {
    id: "ton",
    name: "TON",
    type: "ton",
    nativeCurrency: { name: "Toncoin", symbol: "TON", decimals: 9 },
    rpcUrls: {
      default: { http: ["https://toncenter.com/api/v2/jsonRPC"] },
      public: { http: ["https://toncenter.com/api/v2/jsonRPC"] },
    },
    blockExplorers: {
      default: { name: "TONScan", url: "https://tonscan.org" },
    },
  },
];

// Combined non-EVM chains
export const NON_EVM_CHAINS: NonEvmChain[] = [
  ...BITCOIN_CHAINS,
  ...COSMOS_CHAINS,
  ...TON_CHAINS,
];

// Get chain by ID
export function getNonEvmChain(chainId: string): NonEvmChain | undefined {
  return NON_EVM_CHAINS.find((c) => c.id === chainId);
}

// Get chain by type
export function getChainsByType(type: WalletType): NonEvmChain[] {
  return NON_EVM_CHAINS.filter((c) => c.type === type);
}

// Check if chain is non-EVM
export function isNonEvmChain(chainId: string): boolean {
  return NON_EVM_CHAINS.some((c) => c.id === chainId);
}

// Validate address based on chain type
export function validateNonEvmAddress(
  address: string,
  chainType: WalletType
): boolean {
  switch (chainType) {
    case "bitcoin":
      // Bitcoin: 1..., 3..., bc1...
      return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
    case "cosmos":
      // Cosmos bech32 addresses
      return /^[a-z]+1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,58}$/.test(address);
    case "ton":
      // TON: EQ..., UQ..., or raw format
      return /^(EQ|UQ)[a-zA-Z0-9_-]{43,48}$/.test(address) ||
        /^[0-9a-fA-F]{64}$/.test(address);
    default:
      return false;
  }
}

// Get native token symbol for non-EVM chain
export function getNonEvmNativeSymbol(chainId: string): string {
  const chain = getNonEvmChain(chainId);
  return chain?.nativeCurrency.symbol ?? "";
}

// Format amount for non-EVM chains
export function formatNonEvmAmount(
  amount: string,
  chainId: string
): string {
  const chain = getNonEvmChain(chainId);
  if (!chain) return amount;

  const decimals = chain.nativeCurrency.decimals;
  const value = Number(amount) / Math.pow(10, decimals);
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

// ============================================
// Wallet Adapter Implementations
// ============================================

// Window type extensions for wallet detection
declare global {
  interface Window {
    bitcoin?: unknown;
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => {
        getAccounts: () => Promise<{ address: string }[]>;
      };
      signArbitrary?: (chainId: string, signer: string, data: string) => Promise<unknown>;
    };
    ton?: {
      connect: () => Promise<{ address: string }>;
      disconnect?: () => Promise<void>;
      send?: (tx: unknown) => Promise<unknown>;
    };
  }
}

// Detect if a wallet is installed
export function detectWallet(type: WalletType): boolean {
  if (typeof window === "undefined") return false;
  
  switch (type) {
    case "bitcoin":
      return !!window.bitcoin;
    case "cosmos":
      return !!window.keplr;
    case "ton":
      return !!window.ton;
    default:
      return false;
  }
}

// Xverse Bitcoin Wallet Adapter
export function createXverseAdapter(): NonEvmWallet {
  return {
    type: "bitcoin",
    name: "Xverse",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (!detectWallet("bitcoin")) {
        throw new Error("Xverse wallet not installed. Please install Xverse extension.");
      }
      
      // Xverse injects into window.bitcoin
      const provider = window.bitcoin as {
        requestAccounts: () => Promise<string[]>;
      };
      
      if (!provider?.requestAccounts) {
        throw new Error("Xverse provider not available");
      }
      
      const accounts = await provider.requestAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }
      
      this.address = accounts[0];
      this.isConnected = true;
      return accounts[0];
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
    
    async signMessage(message: string): Promise<string> {
      if (!this.isConnected || !this.address) {
        throw new Error("Wallet not connected");
      }
      
      const provider = window.bitcoin as {
        signMessage: (message: string, address: string) => Promise<string>;
      };
      
      if (!provider?.signMessage) {
        throw new Error("Signing not supported");
      }
      
      return provider.signMessage(message, this.address);
    },
  };
}

// Keplr Cosmos Wallet Adapter
export function createKeplrAdapter(chainId = "cosmoshub-4"): NonEvmWallet {
  return {
    type: "cosmos",
    name: "Keplr",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (!detectWallet("cosmos")) {
        throw new Error("Keplr wallet not installed. Please install Keplr extension.");
      }
      
      const keplr = window.keplr!;
      
      // Enable the chain
      await keplr.enable(chainId);
      
      // Get the offline signer
      const offlineSigner = keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }
      
      this.address = accounts[0].address;
      this.isConnected = true;
      return accounts[0].address;
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
    
    async signMessage(message: string): Promise<string> {
      if (!this.isConnected || !this.address) {
        throw new Error("Wallet not connected");
      }
      
      const keplr = window.keplr!;
      if (!keplr.signArbitrary) {
        throw new Error("Message signing not supported");
      }
      
      const result = await keplr.signArbitrary(chainId, this.address, message);
      return JSON.stringify(result);
    },
  };
}

// TON Wallet Adapter (TonConnect)
export function createTonAdapter(): NonEvmWallet {
  return {
    type: "ton",
    name: "TON Wallet",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (!detectWallet("ton")) {
        throw new Error("TON wallet not installed. Please install TON extension.");
      }
      
      const provider = window.ton!;
      
      if (!provider.connect) {
        throw new Error("TON connect not available");
      }
      
      const result = await provider.connect();
      
      if (!result?.address) {
        throw new Error("No address returned from TON wallet");
      }
      
      this.address = result.address;
      this.isConnected = true;
      return result.address;
    },
    
    async disconnect(): Promise<void> {
      if (window.ton?.disconnect) {
        await window.ton.disconnect();
      }
      this.address = null;
      this.isConnected = false;
    },
    
    async signTransaction(tx: unknown): Promise<unknown> {
      if (!this.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const provider = window.ton!;
      if (!provider.send) {
        throw new Error("Transaction sending not available");
      }
      
      return provider.send(tx);
    },
  };
}

// ============================================
// Wallet Registry
// ============================================

class NonEvmWalletRegistry {
  private wallets: Map<string, NonEvmWallet> = new Map();

  register(wallet: NonEvmWallet) {
    this.wallets.set(wallet.name, wallet);
  }

  get(name: string): NonEvmWallet | undefined {
    return this.wallets.get(name);
  }

  getAll(): NonEvmWallet[] {
    return Array.from(this.wallets.values());
  }

  getByType(type: WalletType): NonEvmWallet[] {
    return this.getAll().filter((w) => w.type === type);
  }

  getInstalled(): NonEvmWallet[] {
    return this.getAll().filter((w) => {
      if (w.name === "Xverse") return detectWallet("bitcoin");
      if (w.name === "Keplr") return detectWallet("cosmos");
      if (w.name === "TON Wallet") return detectWallet("ton");
      return false;
    });
  }
}

export const nonEvmWalletRegistry = new NonEvmWalletRegistry();

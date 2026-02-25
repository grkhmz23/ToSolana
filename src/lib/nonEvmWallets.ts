// Non-EVM wallet adapter system - Production Ready
// Supports Bitcoin, Cosmos, TON, and other non-EVM chains

// Supported non-EVM chain types
export type WalletType = "bitcoin" | "cosmos" | "ton";

// Chain configuration for non-EVM chains
export interface NonEvmChain {
  id: string;
  name: string;
  type: WalletType;
  bech32Prefix?: string;
  hdPath?: string;
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
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
  signMessage?: (message: string) => Promise<string>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  getBalance?: (address: string) => Promise<string>;
}

// ============================================
// Chain Definitions
// ============================================

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
];

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

export const NON_EVM_CHAINS: NonEvmChain[] = [
  ...BITCOIN_CHAINS,
  ...COSMOS_CHAINS,
  ...TON_CHAINS,
];

// ============================================
// Utility Functions
// ============================================

export function getNonEvmChain(chainId: string): NonEvmChain | undefined {
  return NON_EVM_CHAINS.find((c) => c.id === chainId);
}

export function getChainsByType(type: WalletType): NonEvmChain[] {
  return NON_EVM_CHAINS.filter((c) => c.type === type);
}

export function isNonEvmChain(chainId: string): boolean {
  return NON_EVM_CHAINS.some((c) => c.id === chainId);
}

export function validateNonEvmAddress(
  address: string,
  chainType: WalletType
): boolean {
  switch (chainType) {
    case "bitcoin":
      // Bitcoin: 1..., 3..., bc1... (mainnet), tb1..., bcrt1... (testnet)
      return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address) ||
             /^(tb1|bcrt1)[a-zA-Z0-9]{25,62}$/.test(address);
    case "cosmos":
      // Cosmos bech32 addresses (cosmos1..., osmo1..., etc.)
      return /^[a-z]+1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,58}$/.test(address);
    case "ton":
      // TON: EQ..., UQ..., or raw format (64 hex chars)
      return /^(EQ|UQ)[a-zA-Z0-9_-]{43,48}$/.test(address) ||
        /^[0-9a-fA-F]{64}$/.test(address);
    default:
      return false;
  }
}

export function getNonEvmNativeSymbol(chainId: string): string {
  const chain = getNonEvmChain(chainId);
  return chain?.nativeCurrency.symbol ?? "";
}

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
// Window Type Extensions
// ============================================

declare global {
  interface Window {
    // Bitcoin wallets
    bitcoin?: {
      requestAccounts: () => Promise<string[]>;
      signMessage?: (message: string, address: string) => Promise<string>;
      signPsbt?: (psbt: string) => Promise<string>;
      getPublicKey?: () => Promise<string>;
    };
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      signMessage: (message: string, type?: string) => Promise<string>;
      signPsbt: (psbt: string) => Promise<string>;
      getPublicKey: () => Promise<string>;
      getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
    };
    okxwallet?: {
      bitcoin?: {
        connect: () => Promise<string[]>;
        signMessage: (message: string, address: string) => Promise<string>;
      };
    };
    
    // Cosmos wallets
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => {
        getAccounts: () => Promise<{ address: string; pubkey: Uint8Array }[]>;
        signDirect: (signerAddress: string, signDoc: unknown) => Promise<unknown>;
      };
      signArbitrary?: (chainId: string, signer: string, data: string) => Promise<{
        pub_key: { type: string; value: string };
        signature: string;
      }>;
      getKey?: (chainId: string) => Promise<{
        name: string;
        algo: string;
        pubKey: Uint8Array;
        address: Uint8Array;
        bech32Address: string;
      }>;
    };
    leap?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => {
        getAccounts: () => Promise<{ address: string }[]>;
      };
    };
    
    // TON wallets
    ton?: {
      connect: () => Promise<{ address: string; publicKey?: string }>;
      disconnect?: () => Promise<void>;
      send?: (tx: {
        to: string;
        amount: string;
        payload?: string;
        stateInit?: string;
      }) => Promise<{
        address: string;
        txHash: string;
      }>;
      account?: { address: string };
    };
    tonconnect?: {
      connect: () => Promise<{ address: string }>;
    };
  }
}

// ============================================
// Wallet Detection
// ============================================

type BitcoinWalletType = 'xverse' | 'unisat' | 'okx';
type CosmosWalletType = 'keplr' | 'leap';
type TonWalletType = 'ton' | 'tonconnect';

export interface DetectedWallets {
  bitcoin: BitcoinWalletType[];
  cosmos: CosmosWalletType[];
  ton: TonWalletType[];
}

export function detectAllWallets(): DetectedWallets {
  if (typeof window === "undefined") {
    return { bitcoin: [], cosmos: [], ton: [] };
  }
  
  const detected: DetectedWallets = {
    bitcoin: [],
    cosmos: [],
    ton: [],
  };
  
  // Bitcoin wallets
  if (window.bitcoin) detected.bitcoin.push('xverse');
  if (window.unisat) detected.bitcoin.push('unisat');
  if (window.okxwallet?.bitcoin) detected.bitcoin.push('okx');
  
  // Cosmos wallets
  if (window.keplr) detected.cosmos.push('keplr');
  if (window.leap) detected.cosmos.push('leap');
  
  // TON wallets
  if (window.ton) detected.ton.push('ton');
  if (window.tonconnect) detected.ton.push('tonconnect');
  
  return detected;
}

export function detectWallet(type: WalletType): boolean {
  const detected = detectAllWallets();
  return detected[type].length > 0;
}

// ============================================
// Bitcoin Wallet Adapters
// ============================================

export function createXverseAdapter(): NonEvmWallet {
  return {
    type: "bitcoin",
    name: "Xverse",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      if (!window.bitcoin) {
        throw new Error(
          "Xverse wallet not installed. Please install Xverse extension from https://www.xverse.app/"
        );
      }
      
      try {
        const accounts = await window.bitcoin.requestAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found in wallet");
        }
        
        this.address = accounts[0];
        this.isConnected = true;
        return accounts[0];
      } catch (err) {
        if (err instanceof Error && err.message.includes("User rejected")) {
          throw new Error("Connection rejected by user");
        }
        throw err;
      }
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
    
    async signMessage(message: string): Promise<string> {
      if (!this.isConnected || !this.address) {
        throw new Error("Wallet not connected");
      }
      
      if (!window.bitcoin?.signMessage) {
        throw new Error("Message signing not supported by this wallet");
      }
      
      return window.bitcoin.signMessage(message, this.address);
    },
  };
}

export function createUnisatAdapter(): NonEvmWallet {
  return {
    type: "bitcoin",
    name: "Unisat",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      if (!window.unisat) {
        throw new Error(
          "Unisat wallet not installed. Please install Unisat extension from https://unisat.io/"
        );
      }
      
      try {
        const accounts = await window.unisat.requestAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found in wallet");
        }
        
        this.address = accounts[0];
        this.isConnected = true;
        return accounts[0];
      } catch (err) {
        if (err instanceof Error && err.message.includes("User rejected")) {
          throw new Error("Connection rejected by user");
        }
        throw err;
      }
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
    
    async signMessage(message: string): Promise<string> {
      if (!this.isConnected || !this.address) {
        throw new Error("Wallet not connected");
      }
      
      return window.unisat!.signMessage(message);
    },
    
    async getBalance(_address: string): Promise<string> {
      if (!window.unisat) throw new Error("Wallet not available");
      const balance = await window.unisat.getBalance();
      return balance.total.toString();
    },
  };
}

export function createOKXBitcoinAdapter(): NonEvmWallet {
  return {
    type: "bitcoin",
    name: "OKX Wallet",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      if (!window.okxwallet?.bitcoin) {
        throw new Error(
          "OKX Wallet not installed. Please install OKX Wallet extension"
        );
      }
      
      const accounts = await window.okxwallet.bitcoin.connect();
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
      
      if (!window.okxwallet?.bitcoin?.signMessage) {
        throw new Error("Signing not supported");
      }
      
      return window.okxwallet.bitcoin.signMessage(message, this.address);
    },
  };
}

// ============================================
// Cosmos Wallet Adapters
// ============================================

export function createKeplrAdapter(chainId = "cosmoshub-4"): NonEvmWallet {
  return {
    type: "cosmos",
    name: "Keplr",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      if (!window.keplr) {
        throw new Error(
          "Keplr wallet not installed. Please install Keplr extension from https://www.keplr.app/"
        );
      }
      
      try {
        // Enable the chain
        await window.keplr.enable(chainId);
        
        // Get the offline signer
        const offlineSigner = window.keplr.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found in wallet");
        }
        
        this.address = accounts[0].address;
        this.isConnected = true;
        return accounts[0].address;
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes("User rejected") || err.message.includes("denied")) {
            throw new Error("Connection rejected by user");
          }
        }
        throw err;
      }
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
    
    async signMessage(message: string): Promise<string> {
      if (!this.isConnected || !this.address) {
        throw new Error("Wallet not connected");
      }
      
      if (!window.keplr?.signArbitrary) {
        throw new Error("Message signing not supported by this Keplr version");
      }
      
      const result = await window.keplr.signArbitrary(chainId, this.address, message);
      return JSON.stringify(result);
    },
  };
}

export function createLeapAdapter(chainId = "cosmoshub-4"): NonEvmWallet {
  return {
    type: "cosmos",
    name: "Leap",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      if (!window.leap) {
        throw new Error(
          "Leap wallet not installed. Please install Leap extension from https://www.leapwallet.io/"
        );
      }
      
      try {
        await window.leap.enable(chainId);
        
        const offlineSigner = window.leap.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found");
        }
        
        this.address = accounts[0].address;
        this.isConnected = true;
        return accounts[0].address;
      } catch (err) {
        if (err instanceof Error && err.message.includes("rejected")) {
          throw new Error("Connection rejected by user");
        }
        throw err;
      }
    },
    
    async disconnect(): Promise<void> {
      this.address = null;
      this.isConnected = false;
    },
  };
}

// ============================================
// TON Wallet Adapters
// ============================================

export function createTonAdapter(): NonEvmWallet {
  return {
    type: "ton",
    name: "TON Wallet",
    address: null,
    isConnected: false,
    
    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error("Cannot connect in server environment");
      }
      
      // Try different TON wallet providers
      const provider = window.ton;
      
      if (!provider?.connect) {
        throw new Error(
          "TON wallet not installed. Please install Tonkeeper or MyTonWallet extension"
        );
      }
      
      try {
        const result = await provider.connect();
        
        if (!result?.address) {
          throw new Error("No address returned from wallet");
        }
        
        this.address = result.address;
        this.isConnected = true;
        return result.address;
      } catch (err) {
        if (err instanceof Error && err.message.includes("rejected")) {
          throw new Error("Connection rejected by user");
        }
        throw err;
      }
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
      
      if (!window.ton?.send) {
        throw new Error("Transaction sending not available");
      }
      
      return window.ton.send(tx as Parameters<typeof window.ton.send>[0]);
    },
  };
}

// ============================================
// Wallet Registry
// ============================================

export interface WalletOption {
  id: string;
  name: string;
  type: WalletType;
  create: () => NonEvmWallet;
  detected: boolean;
  installUrl: string;
}

export function getAvailableWallets(): WalletOption[] {
  const detected = detectAllWallets();
  
  return [
    // Bitcoin wallets
    {
      id: 'xverse',
      name: 'Xverse',
      type: 'bitcoin',
      create: createXverseAdapter,
      detected: detected.bitcoin.includes('xverse'),
      installUrl: 'https://www.xverse.app/',
    },
    {
      id: 'unisat',
      name: 'Unisat',
      type: 'bitcoin',
      create: createUnisatAdapter,
      detected: detected.bitcoin.includes('unisat'),
      installUrl: 'https://unisat.io/',
    },
    {
      id: 'okx-bitcoin',
      name: 'OKX Wallet',
      type: 'bitcoin',
      create: createOKXBitcoinAdapter,
      detected: detected.bitcoin.includes('okx'),
      installUrl: 'https://www.okx.com/web3',
    },
    // Cosmos wallets
    {
      id: 'keplr',
      name: 'Keplr',
      type: 'cosmos',
      create: createKeplrAdapter,
      detected: detected.cosmos.includes('keplr'),
      installUrl: 'https://www.keplr.app/',
    },
    {
      id: 'leap',
      name: 'Leap',
      type: 'cosmos',
      create: createLeapAdapter,
      detected: detected.cosmos.includes('leap'),
      installUrl: 'https://www.leapwallet.io/',
    },
    // TON wallets
    {
      id: 'ton',
      name: 'TON Wallet',
      type: 'ton',
      create: createTonAdapter,
      detected: detected.ton.includes('ton'),
      installUrl: 'https://tonkeeper.com/',
    },
  ];
}

export function getWalletsByType(type: WalletType): WalletOption[] {
  return getAvailableWallets().filter(w => w.type === type);
}

export function getFirstDetectedWallet(type: WalletType): WalletOption | undefined {
  return getAvailableWallets().find(w => w.type === type && w.detected);
}

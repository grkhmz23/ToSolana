'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Loader2, Wallet } from 'lucide-react';
import { useWalletContext } from '@/hooks/useWalletContext';
import { shortenAddress } from '@/lib/format';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wallet icons as SVG components for reliability
const WalletIcons = {
  metamask: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  walletconnect: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#3B99FC">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  ),
  coinbase: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0052FF">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v12M6 12h12" stroke="white" strokeWidth="2"/>
    </svg>
  ),
  phantom: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#AB9FF2">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  ),
  solflare: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FC4C4C">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  backpack: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#E59F40">
      <rect x="4" y="6" width="16" height="14" rx="2"/>
    </svg>
  ),
  xverse: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#F7931A">
      <circle cx="12" cy="12" r="10"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">₿</text>
    </svg>
  ),
  keplr: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#2F80ED">
      <circle cx="12" cy="12" r="10"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10">K</text>
    </svg>
  ),
  ton: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0088CC">
      <circle cx="12" cy="12" r="10"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10">T</text>
    </svg>
  ),
};

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const {
    sourceChain,
    sourceWallet,
    destWallet,
    isSourceConnected,
    isDestConnected,
    isFullyConnected,
    isConnecting,
    error,
    clearError,
    connectSource,
    disconnectSource,
    connectDest,
    disconnectDest,
  } = useWalletContext();

  const handleConnectSource = async () => {
    try {
      clearError();
      await connectSource();
    } catch {
      // Error is handled in context
    }
  };

  const handleConnectDest = () => {
    clearError();
    connectDest();
  };

  // Close modal when both wallets are connected
  const handleReady = () => {
    if (isFullyConnected) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="wallet-modal-wrapper"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={!isConnecting ? onClose : undefined} 
          />
          <motion.div 
            initial={{ y: 20, opacity: 0, scale: 0.95 }} 
            animate={{ y: 0, opacity: 1, scale: 1 }} 
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-[#0a0a0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="font-bold text-xl text-white">Connect Wallets</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Connect your source and destination wallets
                </p>
              </div>
              <button 
                onClick={onClose} 
                disabled={isConnecting}
                className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-red-500/10 border-b border-red-500/20"
                >
                  <div className="p-4 flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-6 space-y-6">
              {/* Source Network */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-400">
                    1. Source Network
                    {sourceChain && (
                      <span className="text-slate-300 ml-1">({sourceChain.name})</span>
                    )}
                  </span>
                  {isSourceConnected && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>

                {!isSourceConnected ? (
                  <div className="space-y-2">
                    {!sourceChain ? (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-slate-400">
                        Select a source chain in the bridge widget first
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectSource}
                        disabled={isConnecting}
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 
                                   flex items-center gap-3 font-medium text-white transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center 
                                          group-hover:scale-110 transition-transform">
                              <Wallet className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="text-left">
                              <div className="font-semibold">
                                {sourceChain.type === 'evm' && 'Connect EVM Wallet'}
                                {sourceChain.type === 'bitcoin' && 'Connect Bitcoin Wallet'}
                                {sourceChain.type === 'cosmos' && 'Connect Cosmos Wallet'}
                                {sourceChain.type === 'ton' && 'Connect TON Wallet'}
                              </div>
                              <div className="text-xs text-slate-400">
                                MetaMask, Phantom, etc.
                              </div>
                            </div>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-emerald-400">
                            Connected
                          </div>
                          <div className="text-xs text-emerald-400/70 font-mono">
                            {sourceWallet.address && shortenAddress(sourceWallet.address)}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={disconnectSource}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[#0a0a0f] text-xs text-slate-500">TO</span>
                </div>
              </div>

              {/* Destination Network */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-400">
                    2. Destination (Solana)
                  </span>
                  {isDestConnected && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>

                {!isDestConnected ? (
                  <button
                    onClick={handleConnectDest}
                    className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 
                               flex items-center gap-3 font-medium text-white transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center 
                                  group-hover:scale-110 transition-transform">
                      <WalletIcons.phantom />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Connect Solana Wallet</div>
                      <div className="text-xs text-slate-400">
                        Phantom, Solflare, Backpack
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-emerald-400">
                            Connected
                          </div>
                          <div className="text-xs text-emerald-400/70 font-mono">
                            {destWallet.address && shortenAddress(destWallet.address)}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={disconnectDest}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Ready Button */}
              {isFullyConnected && (
                <motion.button 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleReady}
                  className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 
                             text-white hover:from-indigo-400 hover:to-purple-400 transition-all
                             shadow-lg shadow-indigo-500/25"
                >
                  Ready to Bridge ✓
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

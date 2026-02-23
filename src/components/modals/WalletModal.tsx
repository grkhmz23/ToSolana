'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';
import type { Chain } from '@/types/bridge';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChain: Chain;
  isSourceConnected: boolean;
  isDestConnected: boolean;
  onConnectSource: () => void;
  onConnectDest: () => void;
  onDisconnectSource: () => void;
  onDisconnectDest: () => void;
}

export function WalletModal({
  isOpen,
  onClose,
  sourceChain,
  isSourceConnected,
  isDestConnected,
  onConnectSource,
  onConnectDest,
  onDisconnectSource,
  onDisconnectDest
}: WalletModalProps) {
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 20, opacity: 0 }}
            className="w-full max-w-md bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-xl text-white">Connect Wallets</h3>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Source Network */}
              <div>
                <div className="text-sm font-bold text-slate-400 mb-3 flex items-center justify-between">
                  <span>1. Source Network ({sourceChain.name})</span>
                  {isSourceConnected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                {!isSourceConnected ? (
                  <div className="grid gap-2">
                    {sourceChain.type === 'evm' && ['MetaMask', 'WalletConnect', 'Coinbase'].map(w => (
                      <button 
                        key={w} 
                        onClick={onConnectSource} 
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 font-semibold text-slate-200 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center">🦊</div> 
                        {w}
                      </button>
                    ))}
                    {sourceChain.type === 'bitcoin' && (
                      <button 
                        onClick={onConnectSource} 
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 font-semibold text-slate-200 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center">✖</div> 
                        Xverse Wallet
                      </button>
                    )}
                    {sourceChain.type === 'cosmos' && (
                      <button 
                        onClick={onConnectSource} 
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 font-semibold text-slate-200 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center">⚛</div> 
                        Keplr
                      </button>
                    )}
                    {sourceChain.type === 'ton' && (
                      <button 
                        onClick={onConnectSource} 
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 font-semibold text-slate-200 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center">💎</div> 
                        TON Wallet
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center justify-between">
                    <span>0x71C...9B23</span>
                    <button onClick={onDisconnectSource} className="text-xs underline">Disconnect</button>
                  </div>
                )}
              </div>

              {/* Destination Network */}
              <div>
                <div className="text-sm font-bold text-slate-400 mb-3 flex items-center justify-between">
                  <span>2. Destination (Solana)</span>
                  {isDestConnected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                {!isDestConnected ? (
                  <div className="grid gap-2">
                    {['Phantom', 'Solflare', 'Backpack'].map(w => (
                      <button 
                        key={w} 
                        onClick={onConnectDest} 
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 font-semibold text-slate-200 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex items-center justify-center text-purple-400">👻</div> 
                        {w}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center justify-between">
                    <span>E1vD...z9Po</span>
                    <button onClick={onDisconnectDest} className="text-xs underline">Disconnect</button>
                  </div>
                )}
              </div>
              
              {/* Ready Button */}
              {isSourceConnected && isDestConnected && (
                <button 
                  onClick={onClose} 
                  className="w-full py-4 rounded-xl font-bold bg-white text-black hover:bg-slate-200 transition-colors"
                >
                  Ready to Bridge
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

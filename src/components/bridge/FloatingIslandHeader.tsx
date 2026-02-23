'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface FloatingIslandHeaderProps {
  onConnect: () => void;
  isSourceConnected: boolean;
  isDestConnected: boolean;
}

export function FloatingIslandHeader({ 
  onConnect, 
  isSourceConnected, 
  isDestConnected 
}: FloatingIslandHeaderProps) {
  const isFullyConnected = isSourceConnected && isDestConnected;
  
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl"
    >
      <div className="bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 rounded-full p-2 pl-6 shadow-2xl shadow-indigo-500/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="text-white w-4 h-4" />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
            ToSolana
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onConnect}
            className={`relative overflow-hidden px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              isFullyConnected 
                ? 'bg-white/5 border border-white/10 text-white' 
                : 'bg-white text-black hover:scale-105 active:scale-95'
            }`}
          >
            {isFullyConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Linked
              </span>
            ) : (
              <span>Connect Wallets</span>
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

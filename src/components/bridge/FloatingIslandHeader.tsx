'use client';

import { motion } from 'framer-motion';
import Link from "next/link";
import Image from "next/image";
import { Wallet, X } from 'lucide-react';
import { useWalletContext } from '@/hooks/useWalletContext';
import { shortenAddress } from '@/lib/format';

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
  const { sourceWallet, destWallet, sourceChain, disconnectSource, disconnectDest } = useWalletContext();
  const isFullyConnected = isSourceConnected && isDestConnected;
  
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl"
    >
      <div className="bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-indigo-500/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-0.5">
            <Image
              src="/tosolana-logo.svg"
              alt="ToSolana"
              width={60}
              height={60}
              className="w-[60px] h-[60px] object-contain"
              priority
            />
          </div>
          <div className="hidden sm:block">
            <div className="text-lg font-bold text-white tracking-tight">ToSolana</div>
            <div className="text-xs text-slate-400">Bridge + Migration</div>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-white transition-colors"
          >
            Migration Dashboard
          </Link>

          {sourceWallet.address && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-slate-400">{sourceChain?.name ?? "Source"}</span>
              <span className="text-xs font-mono text-emerald-400">
                {shortenAddress(sourceWallet.address)}
              </span>
              <button
                onClick={disconnectSource}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Disconnect source wallet"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {destWallet.address && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-slate-400">Solana</span>
              <span className="text-xs font-mono text-purple-400">
                {shortenAddress(destWallet.address)}
              </span>
              <button
                onClick={disconnectDest}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Disconnect destination wallet"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={onConnect}
            className={`relative overflow-hidden px-5 py-2 rounded-full text-sm font-bold transition-all ${
              isFullyConnected
                ? "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                : "bg-white text-black hover:scale-105 active:scale-95"
            }`}
          >
            {isFullyConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Linked
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Connect
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { FloatingIslandHeader } from '@/components/bridge/FloatingIslandHeader';
import { BridgeWidget } from '@/components/bridge/BridgeWidget';
import { WalletModal } from '@/components/modals/WalletModal';
import { useWalletContext } from '@/hooks/useWalletContext';
import Link from "next/link";

export default function Home() {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { isSourceConnected, isDestConnected } = useWalletContext();

  return (
    <div className="min-h-screen bg-[#05050A] text-slate-50 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      <NoiseOverlay />
      
      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15), transparent 50%),
              radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.15), transparent 50%),
              radial-gradient(circle at 50% 80%, rgba(139, 92, 246, 0.1), transparent 50%)
            `,
            filter: 'blur(60px)',
            animation: 'meshPulse 10s ease-in-out infinite alternate'
          }}
        />
      </div>

      {/* Floating Header */}
      <FloatingIslandHeader 
        onConnect={() => setWalletModalOpen(true)} 
        isSourceConnected={isSourceConnected} 
        isDestConnected={isDestConnected} 
      />

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-20 px-4 min-h-screen flex flex-col items-center justify-center">
        
        {/* Hero Title */}
        <div className="text-center mb-10 z-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
              Bridge to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400">Solana.</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto font-medium">
              Direct liquidity from 25+ ecosystems. Zero friction, non-custodial.
            </p>
          </motion.div>
        </div>

        {/* Bridge Widget */}
        <BridgeWidget
          onConnectWallets={() => setWalletModalOpen(true)}
        />

        {/* Migration CTA */}
        <div className="mt-12 w-full max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-white">
                  Migration Dashboard
                </h2>
                <p className="text-sm md:text-base text-slate-400 mt-2">
                  Register your token, generate snapshots, build merkle claims, and launch a self-serve
                  Solana migration campaign.
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:scale-[1.02] transition"
                >
                  Open Dashboard
                </Link>
                <Link
                  href="/dashboard/project/new"
                  className="px-4 py-2 rounded-full border border-white/20 text-white text-sm font-semibold hover:border-white/40 transition"
                >
                  Create Project
                </Link>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={walletModalOpen} 
        onClose={() => setWalletModalOpen(false)} 
      />

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes meshPulse {
          0% { transform: scale(1) rotate(0deg); }
          100% { transform: scale(1.1) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}

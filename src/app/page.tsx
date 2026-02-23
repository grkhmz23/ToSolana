'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { FloatingIslandHeader } from '@/components/bridge/FloatingIslandHeader';
import { BridgeWidget } from '@/components/bridge/BridgeWidget';

export default function Home() {
  const [isSourceConnected, setIsSourceConnected] = useState(false);
  const [isDestConnected, setIsDestConnected] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

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
          isSourceConnected={isSourceConnected}
          isDestConnected={isDestConnected}
          setIsSourceConnected={setIsSourceConnected}
          setIsDestConnected={setIsDestConnected}
        />

      </main>

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

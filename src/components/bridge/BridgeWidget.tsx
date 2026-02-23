'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, History, ChevronDown, ArrowRight, Activity, ShieldCheck, Lock } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { HoldToBridgeButton } from './HoldToBridgeButton';
import { RouteVisualizer } from './RouteVisualizer';
import { WalletModal, SettingsModal, ChainModal } from '@/components/modals';
import { CHAINS, SOLANA_CHAIN, TOKENS, DEFAULT_TOKENS } from '@/lib/constants';
import type { Chain, Token, Route } from '@/types/bridge';

interface BridgeWidgetProps {
  onConnectWallets: () => void;
  isSourceConnected: boolean;
  isDestConnected: boolean;
  setIsSourceConnected: (value: boolean) => void;
  setIsDestConnected: (value: boolean) => void;
}

export function BridgeWidget({
  onConnectWallets,
  isSourceConnected,
  isDestConnected,
  setIsSourceConnected,
  setIsDestConnected
}: BridgeWidgetProps) {
  // Form states
  const [sourceChain, setSourceChain] = useState<Chain>(CHAINS[0]); 
  const destChain = SOLANA_CHAIN;
  
  const [sourceToken, setSourceToken] = useState<Token>(TOKENS['ethereum'][0]);
  const [destToken, setDestToken] = useState<Token>(TOKENS['solana'][0]);
  const [amount, setAmount] = useState<string>('1.5');
  
  // Settings & Routing states
  const [slippage, setSlippage] = useState('3.0');
  const [routeSort, setRouteSort] = useState<'output' | 'time' | 'gas'>('output');
  const [isCalculating, setIsCalculating] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  
  // Modals
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [chainModalOpen, setChainModalOpen] = useState(false);

  // 3D card effect
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5
    });
  };
  
  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

  // Calculate 3D transforms
  const rotateX = mousePos.y * -10; 
  const rotateY = mousePos.x * 10;
  const cx = (mousePos.x + 0.5) * 100;
  const cy = (mousePos.y + 0.5) * 100;
  const cardBackground = `radial-gradient(600px circle at ${cx}% ${cy}%, rgba(255,255,255,0.06), transparent 40%)`;

  // Update tokens when chain changes
  useEffect(() => {
    const chainTokens = TOKENS[sourceChain.id] || DEFAULT_TOKENS;
    setSourceToken(chainTokens[0]);
  }, [sourceChain]);

  // Mock route calculation
  useEffect(() => {
    if (parseFloat(amount) > 0) {
      setIsCalculating(true);
      setRoutes([]);
      const timer = setTimeout(() => {
        let newRoutes: Route[] = [];
        
        if (sourceToken.isOfficial) {
          newRoutes.push({ 
            id: '1', 
            provider: 'Wormhole (NTT)', 
            outputAmount: amount, 
            estimatedTime: '~15m', 
            feeUsd: '$0.50', 
            gasUsd: '$1.20', 
            tags: ['Official 1:1', 'Zero Slippage'], 
            impact: 0 
          });
        } else {
          const baseOutput = (parseFloat(amount) * sourceToken.price / destToken.price) * 0.99;
          newRoutes = [
            { id: '2', provider: 'LI.FI Aggregator', outputAmount: baseOutput.toFixed(4), estimatedTime: '~2m', feeUsd: '$4.50', gasUsd: '$1.80', tags: ['Best Return'], impact: 0.1 },
            { id: '3', provider: 'Rango Exchange', outputAmount: (baseOutput * 0.98).toFixed(4), estimatedTime: '~1m', feeUsd: '$5.20', gasUsd: '$2.50', tags: ['Fastest'], impact: 0.2 },
            { id: '4', provider: 'Symbiosis', outputAmount: (baseOutput * 0.95).toFixed(4), estimatedTime: '~5m', feeUsd: '$2.20', gasUsd: '$1.00', tags: [], impact: 1.5 }
          ];
          
          if (sourceChain.type === 'bitcoin') {
            newRoutes = [{ id: 'btc1', provider: 'THORChain', outputAmount: baseOutput.toFixed(4), estimatedTime: '~45m', feeUsd: '$15.00', gasUsd: '$8.00', tags: ['Native BTC'], impact: 0.5 }];
          } else if (sourceChain.type === 'cosmos') {
            newRoutes = [{ id: 'cos1', provider: 'Wormhole (IBC)', outputAmount: baseOutput.toFixed(4), estimatedTime: '~5m', feeUsd: '$1.00', gasUsd: '$0.50', tags: ['Best Return'], impact: 0.1 }];
          }

          if (routeSort === 'time') newRoutes.sort((a, b) => parseInt(a.estimatedTime.replace(/\D/g, '')) - parseInt(b.estimatedTime.replace(/\D/g, '')));
          if (routeSort === 'gas') newRoutes.sort((a, b) => parseFloat(a.gasUsd.replace('$', '')) - parseFloat(b.gasUsd.replace('$', '')));
        }
        
        setRoutes(newRoutes);
        setIsCalculating(false);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setRoutes([]);
    }
  }, [amount, sourceChain, sourceToken, destToken, routeSort]);

  const bestRoute = routes.length > 0 ? routes[0] : null;
  const isHighImpact = bestRoute ? bestRoute.impact > 1.0 : false;

  return (
    <>
      <motion.div 
        ref={cardRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave}
        animate={{ rotateX, rotateY }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        style={{ perspective: 1200 }}
        className="w-full max-w-[520px] z-20 relative"
        initial={{ opacity: 0, scale: 0.9 }} 
      >
        <div className="glass-panel rounded-[2rem] p-2 md:p-3 border border-white/10 relative overflow-hidden group">
          
          <div 
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: cardBackground }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex gap-6">
              <button className="text-white font-bold relative">
                Bridge
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-white rounded-full" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setSettingsModalOpen(true)} 
                className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors">
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Container */}
          <div className="mt-2 space-y-1 relative bg-[#0a0a0f]/40 p-2 rounded-3xl border border-white/5">
            
            {/* Source Section */}
            <div className="bg-white/[0.02] rounded-2xl p-4 md:p-5 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.05]">
              <div className="flex justify-between text-sm text-slate-500 font-medium mb-3">
                <span>Pay with</span>
                {isSourceConnected && <span className="text-slate-400">Bal: {sourceToken.balance}</span>}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0"
                    className="w-full bg-transparent text-4xl md:text-5xl font-bold text-white focus:outline-none placeholder:text-slate-700"
                  />
                  <div className="text-sm text-slate-500 font-medium mt-1 pl-1">
                    ${(parseFloat(amount || '0') * sourceToken.price).toFixed(2)}
                  </div>
                </div>

                <button 
                  onClick={() => setChainModalOpen(true)}
                  className="shrink-0 flex items-center gap-2 bg-[#12121a] hover:bg-white/10 border border-white/10 rounded-2xl p-2 pr-4 transition-all"
                >
                  <div className="relative flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center text-2xl z-10 shadow-lg border border-white/5">
                      {sourceToken.icon}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#2a2a35] flex items-center justify-center text-sm -ml-3 z-20 border border-[#12121a]">
                      {sourceChain.icon}
                    </div>
                  </div>
                  <div className="text-left ml-1 max-w-[80px]">
                    <div className="font-bold text-white leading-tight truncate">{sourceToken.symbol}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{sourceChain.name}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                </button>
              </div>
            </div>

            {/* Direction Indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <div className="bg-[#12121a] p-3 rounded-xl border-4 border-[#0a0a0f] text-indigo-400 shadow-xl shadow-black/50">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>
            </div>

            {/* Destination Section */}
            <div className="bg-white/[0.02] rounded-2xl p-4 md:p-5 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.05]">
              <div className="flex justify-between text-sm text-slate-500 font-medium mb-3">
                <span>Receive on Solana</span>
                {isDestConnected && <span className="text-slate-400">Bal: {destToken.balance}</span>}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 overflow-hidden">
                  <div className={`text-4xl md:text-5xl font-bold truncate ${isHighImpact ? 'text-amber-400' : 'text-slate-300'}`}>
                    {isCalculating ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <AnimatedNumber value={bestRoute?.outputAmount || '0'} />
                    )}
                  </div>
                  <div className="text-sm font-medium mt-1 pl-1 flex items-center gap-2">
                    <span className="text-slate-500">
                      ${bestRoute ? (parseFloat(bestRoute.outputAmount) * destToken.price).toFixed(2) : '0.00'}
                    </span>
                    {bestRoute && bestRoute.impact > 0 && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isHighImpact ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                        -{bestRoute.impact}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 bg-[#12121a] border border-white/10 rounded-2xl p-2 pr-4">
                  <div className="relative flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center text-2xl z-10 shadow-lg border border-white/5">
                      {destToken.icon}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#2a2a35] flex items-center justify-center text-sm -ml-3 z-20 border border-[#12121a]">
                      {destChain.icon}
                    </div>
                  </div>
                  <div className="text-left ml-1 max-w-[80px]">
                    <div className="font-bold text-white leading-tight truncate">{destToken.symbol}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">Solana</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Route Visualizer */}
          <RouteVisualizer
            isCalculating={isCalculating}
            routes={routes}
            sourceChain={sourceChain}
            destChain={destChain}
            destToken={destToken}
            amount={amount}
          />

          {/* Action Area */}
          <div className="mt-4 px-1 pb-1">
            {(!isSourceConnected || !isDestConnected) ? (
              <button 
                onClick={() => setWalletModalOpen(true)}
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white text-black hover:bg-slate-200 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                Connect Wallets
              </button>
            ) : (
              <HoldToBridgeButton 
                disabled={!routes.length || parseFloat(amount) <= 0} 
                onComplete={() => alert("Transaction sent to validation!")} 
              />
            )}
          </div>

        </div>

        {/* Security Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-1.5"><Lock className="w-4 h-4" /> Non-custodial</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Audited</span>
          <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> Live Quotes</span>
        </div>
      </motion.div>

      {/* Modals */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        sourceChain={sourceChain}
        isSourceConnected={isSourceConnected}
        isDestConnected={isDestConnected}
        onConnectSource={() => setIsSourceConnected(true)}
        onConnectDest={() => setIsDestConnected(true)}
        onDisconnectSource={() => setIsSourceConnected(false)}
        onDisconnectDest={() => setIsDestConnected(false)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
        routeSort={routeSort}
        onRouteSortChange={setRouteSort}
      />

      <ChainModal
        isOpen={chainModalOpen}
        onClose={() => setChainModalOpen(false)}
        onSelect={setSourceChain}
      />
    </>
  );
}

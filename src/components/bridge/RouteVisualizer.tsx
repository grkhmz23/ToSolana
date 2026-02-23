'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { Route, Chain, Token } from '@/types/bridge';

interface RouteVisualizerProps {
  isCalculating: boolean;
  routes: Route[];
  sourceChain: Chain;
  destChain: Chain;
  destToken: Token;
  amount: string;
}

export function RouteVisualizer({
  isCalculating,
  routes,
  sourceChain,
  destChain,
  destToken,
  amount
}: RouteVisualizerProps) {
  const bestRoute = routes.length > 0 ? routes[0] : null;
  const isHighImpact = bestRoute ? bestRoute.impact > 1.0 : false;

  return (
    <AnimatePresence mode="popLayout">
      {isCalculating ? (
        <motion.div 
          key="calculating"
          layout 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }}
          className="mt-3 py-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-3"
        >
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-400">Scanning providers for best route...</span>
        </motion.div>
      ) : bestRoute ? (
        <motion.div 
          key="route-result"
          layout 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-4 rounded-2xl bg-indigo-500/[0.03] border border-indigo-500/10"
        >
          {isHighImpact && (
            <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-400 font-medium">
              <AlertTriangle className="w-4 h-4" />
              High price impact ({bestRoute.impact}%). Proceed with caution.
            </div>
          )}

          <div className="flex items-center justify-between mb-4 relative">
            <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-gradient-to-r from-white/10 via-indigo-500/50 to-white/10 -translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-[#0a0a0f] text-[10px] font-bold text-indigo-400 border border-indigo-500/20 rounded-full flex items-center gap-1">
              {bestRoute.provider}
            </div>

            <div className="w-8 h-8 rounded-full bg-[#12121a] border border-white/10 flex items-center justify-center z-10 text-lg">
              {sourceChain.icon}
            </div>
            <div className="w-8 h-8 rounded-full bg-[#12121a] border border-white/10 flex items-center justify-center z-10 text-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              {destChain.icon}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500"/> 
                {bestRoute.estimatedTime}
              </span>
              <span className="text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-slate-500"/> 
                {bestRoute.gasUsd}
              </span>
            </div>
            <div className="flex gap-2">
              {bestRoute.tags.map(tag => (
                <span 
                  key={tag} 
                  className={`px-2 py-1 rounded border ${
                    tag.includes('Official') 
                      ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' 
                      : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

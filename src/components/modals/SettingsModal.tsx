'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Info } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: string;
  onSlippageChange: (value: string) => void;
  routeSort: 'output' | 'time' | 'gas';
  onRouteSortChange: (value: 'output' | 'time' | 'gas') => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  routeSort,
  onRouteSortChange
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="settings-modal-wrapper"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-[#12121a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5"/> 
                Settings
              </h3>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-6">
              
              {/* Slippage */}
              <div>
                <div className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                  Max Slippage <Info className="w-3 h-3 cursor-help" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['0.1', '1.0', '3.0'].map(val => (
                    <button 
                      key={val} 
                      onClick={() => onSlippageChange(val)} 
                      className={`p-2 rounded-lg text-sm font-medium border transition-colors ${
                        slippage === val 
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                          : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                  <div className="relative">
                    <input 
                      type="number" 
                      value={slippage} 
                      onChange={(e) => onSlippageChange(e.target.value)} 
                      className="w-full h-full bg-white/5 border border-transparent focus:border-indigo-500 rounded-lg text-center text-sm text-white focus:outline-none pr-3" 
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                </div>
              </div>

              {/* Route Preference */}
              <div>
                <div className="text-sm font-bold text-slate-400 mb-3">Route Preference</div>
                <div className="space-y-2">
                  {[
                    { id: 'output', label: 'Maximum Return', desc: 'Finds the route with the most output tokens' },
                    { id: 'time', label: 'Fastest Route', desc: 'Prioritizes bridge speed over return' },
                    { id: 'gas', label: 'Lowest Gas', desc: 'Minimizes source chain gas fees' }
                  ].map(opt => (
                    <button 
                      key={opt.id} 
                      onClick={() => onRouteSortChange(opt.id as 'output' | 'time' | 'gas')} 
                      className={`w-full p-3 rounded-xl border text-left transition-colors flex flex-col gap-1 ${
                        routeSort === opt.id 
                          ? 'bg-indigo-500/10 border-indigo-500/50' 
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className={`text-sm font-bold ${routeSort === opt.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

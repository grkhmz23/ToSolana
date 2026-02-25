'use client';

import { useState } from 'react';
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { CHAINS } from '@/lib/constants';
import type { Chain } from '@/types/bridge';

interface ChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (chain: Chain) => void;
}

export function ChainModal({ isOpen, onClose, onSelect }: ChainModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const filteredChains = CHAINS.filter(chain => {
    const matchesSearch = chain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          chain.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || 
                       (activeTab === 'EVM' && chain.type === 'evm') ||
                       (activeTab === 'Non-EVM' && chain.type !== 'evm');
    return matchesSearch && matchesTab;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="chain-modal-wrapper"
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: "100%", opacity: 0 }} 
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="w-full max-w-lg bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden relative z-10 flex flex-col h-[80vh] sm:h-auto sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-xl text-white">Select Origin Network</h3>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 border-b border-white/5">
              <div className="relative mb-3">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search 25+ chains or paste token address..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 font-medium"
                />
              </div>
              <div className="flex gap-2">
                {['All', 'EVM', 'Non-EVM'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                      tab === activeTab 
                        ? 'bg-white/10 text-white' 
                        : 'text-slate-500 hover:bg-white/5'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-2 p-2">
                {filteredChains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => { onSelect(chain); onClose(); }}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-inner border border-white/5 overflow-hidden">
                      <Image
                        src={chain.icon}
                        alt={chain.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 object-contain"
                        unoptimized
                      />
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">{chain.name}</div>
                      <div className={`text-[10px] font-bold uppercase ${chain.color}`}>{chain.type}</div>
                    </div>
                  </button>
                ))}
              </div>
              {filteredChains.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No chains found
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

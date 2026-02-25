'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from "next/image";
import { Settings, History, ChevronDown, ArrowRight, Activity, ShieldCheck, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { HoldToBridgeButton } from './HoldToBridgeButton';
import { SettingsModal, ChainModal } from '@/components/modals';
import { SOLANA_CHAIN, TOKENS, DEFAULT_TOKENS } from '@/lib/constants';
import { useWalletContext } from '@/hooks/useWalletContext';
import { useBridgeExecution } from '@/hooks/useBridgeExecution';
import { useRouteFilters } from '@/components/RouteFilters';
import { RoutesList } from '@/components/RoutesList';
import { useTokenPrice, formatUsd } from '@/hooks/useTokenPrices';
import { useNonEvmTokenPrice } from '@/hooks/useNonEvmTokenPrices';
import type { Token } from '@/types/bridge';
import type { NormalizedRoute } from '@/server/schema';
import { getChainIdByName } from '@/lib/chains';
import { parseTokenAmount } from '@/lib/format';

interface BridgeWidgetProps {
  onConnectWallets: () => void;
}

// Quote API response type
interface QuoteResponse {
  routes: NormalizedRoute[];
  errors?: string[];
}

const SOLANA_PRICE_CHAIN_ID = 1151111081099710;

export function BridgeWidget({ onConnectWallets }: BridgeWidgetProps) {
  // Wallet context
  const { 
    sourceChain, 
    setSourceChain, 
    sourceWallet, 
    destWallet,
    isSourceConnected, 
    isDestConnected,
    isFullyConnected 
  } = useWalletContext();
  const { executeBridge, isExecuting: isBridgeExecuting } = useBridgeExecution();
  
  // Form states
  const [sourceToken, setSourceToken] = useState<Token>(TOKENS['ethereum'][0]);
  const [destToken] = useState<Token>(TOKENS['solana'][0]);
  const [amount, setAmount] = useState<string>('');
  
  // Settings & Routing states
  const [slippage, setSlippage] = useState('3.0');
  const [isCalculating, setIsCalculating] = useState(false);
  const [routes, setRoutes] = useState<NormalizedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<NormalizedRoute | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // Modals
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
    if (sourceChain) {
      const chainTokens = TOKENS[sourceChain.id] || DEFAULT_TOKENS;
      setSourceToken(chainTokens[0]);
    }
  }, [sourceChain]);

  const { filteredRoutes, RouteFiltersComponent } = useRouteFilters(routes);
  const displayedRoutes = filteredRoutes.length > 0 ? filteredRoutes : routes;

  // Fetch real quotes from API
  const fetchQuotes = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setRoutes([]);
      setSelectedRoute(null);
      return;
    }

    if (!sourceChain) {
      setQuoteError('Please select a source chain');
      return;
    }

    setIsCalculating(true);
    setQuoteError(null);
    setRoutes([]);

    try {
      // Get chain ID
      const chainId = sourceChain.type === 'evm' 
        ? getChainIdByName(sourceChain.id)
        : sourceChain.id;

      if (!chainId) {
        throw new Error('Invalid chain selected');
      }

      // Build request
      const sourceTokenAddress = sourceToken.address;
      const destinationTokenAddress = destToken.address;
      const sourceTokenDecimals = sourceToken.decimals;

      if (!sourceTokenAddress) {
        throw new Error(`Token address unavailable for ${sourceToken.symbol} on ${sourceChain.name}`);
      }
      if (!destinationTokenAddress) {
        throw new Error(`Destination token address unavailable for ${destToken.symbol}`);
      }
      if (sourceTokenDecimals === undefined) {
        throw new Error(`Token decimals unavailable for ${sourceToken.symbol}`);
      }

      // Use placeholder addresses if wallets not connected
      const placeholderSourceAddress = sourceChain.type === 'evm' 
        ? '0x0000000000000000000000000000000000000000'
        : sourceChain.type === 'bitcoin'
        ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        : sourceChain.type === 'cosmos'
        ? 'cosmos1vqn75qrv7cp74d63xa4492wn3uzzl6g9k'
        : sourceChain.type === 'ton'
        ? 'EQD...'
        : '0x0000000000000000000000000000000000000000';
      
      const requestBody = {
        sourceChainId: chainId,
        sourceTokenAddress,
        sourceAmount: parseTokenAmount(amount, sourceTokenDecimals),
        destinationTokenAddress,
        sourceAddress: sourceWallet.address || placeholderSourceAddress,
        solanaAddress: destWallet.address || 'H3TgN7c7H9o6D6i3npydq8gqVPSYwJm1g7y1uK8bS5mP',
        slippage: parseFloat(slippage),
        sourceChainType: sourceChain.type,
      };

      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data: QuoteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0] || 'Failed to fetch quotes');
      }

      if (data.routes.length === 0) {
        setQuoteError('No routes found for this transfer');
      } else {
        setRoutes(data.routes);
        setSelectedRoute(data.routes[0]);
      }

      // Show warnings if any
      if (data.errors && data.errors.length > 0) {
        console.warn('Quote warnings:', data.errors);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch quotes';
      setQuoteError(message);
      setRoutes([]);
      console.error('Quote error:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [amount, sourceChain, sourceToken, destToken, sourceWallet.address, destWallet.address, slippage]);

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        fetchQuotes();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, sourceChain, sourceToken, destToken, slippage, fetchQuotes]);

  // Calculate output amount and price impact
  const bestRoute = selectedRoute;
  const outputDecimals = destToken.decimals ?? 9;
  const outputAmount = bestRoute 
    ? (parseFloat(bestRoute.estimatedOutput.amount) / Math.pow(10, outputDecimals)).toFixed(6)
    : '0';

  const sourceEvmChainId = sourceChain?.type === 'evm'
    ? getChainIdByName(sourceChain.id)
    : null;

  const { data: sourceEvmPriceData } = useTokenPrice(
    sourceChain?.type === 'evm' && sourceEvmChainId && sourceToken.address
      ? { chainId: sourceEvmChainId, address: sourceToken.address }
      : null,
  );
  const { data: sourceNonEvmPriceData } = useNonEvmTokenPrice(
    sourceChain && sourceChain.type !== 'evm' && sourceChain.type !== 'solana'
      ? sourceChain.id
      : null,
  );
  const { data: destPriceData } = useTokenPrice(
    destToken.address
      ? { chainId: SOLANA_PRICE_CHAIN_ID, address: destToken.address }
      : null,
  );

  const sourceTokenPriceUsd = sourceChain?.type === 'evm'
    ? (sourceEvmPriceData?.priceUsd ?? null)
    : (sourceNonEvmPriceData?.priceUsd ?? null);
  const destTokenPriceUsd = destPriceData?.priceUsd ?? null;

  const inputAmountNumber = parseFloat(amount || '0') || 0;
  const outputAmountNumber = parseFloat(outputAmount) || 0;
  const inputUsd = sourceTokenPriceUsd !== null ? inputAmountNumber * sourceTokenPriceUsd : null;
  const outputUsd = destTokenPriceUsd !== null ? outputAmountNumber * destTokenPriceUsd : null;
  const priceImpact =
    inputUsd !== null && outputUsd !== null && inputUsd > 0
      ? ((inputUsd - outputUsd) / inputUsd) * 100
      : null;
  const isHighImpact = (priceImpact ?? 0) > 1.0;

  const inputUsdDisplay = inputAmountNumber === 0 ? '$0.00' : formatUsd(inputUsd);
  const outputUsdDisplay = outputAmountNumber === 0 ? '$0.00' : formatUsd(outputUsd);

  // Handle bridge execution
  const handleBridge = useCallback(async () => {
    if (!bestRoute || !isFullyConnected || !amount) return;
    if (!sourceChain) return;
    if (sourceChain.type === 'solana') {
      setQuoteError('Solana cannot be used as the source chain in this flow.');
      return;
    }

    const chainId = sourceChain.type === 'evm'
      ? getChainIdByName(sourceChain.id)
      : sourceChain.id;

    if (!chainId) {
      setQuoteError('Invalid chain selected');
      return;
    }

    if (!sourceToken.address || sourceToken.decimals === undefined || !destToken.address) {
      setQuoteError('Selected token metadata is incomplete. Please choose a supported token.');
      return;
    }

    const rawAmount = parseTokenAmount(amount, sourceToken.decimals);

    const success = await executeBridge(
      bestRoute,
      {
        sourceChainId: chainId,
        sourceChainType: sourceChain.type,
        sourceAmountDisplay: amount,
        sourceAmountRaw: rawAmount,
        sourceTokenSymbol: sourceToken.symbol,
        sourceTokenAddress: sourceToken.address,
        destTokenSymbol: destToken.symbol,
        destTokenAddress: destToken.address,
        slippage: parseFloat(slippage),
      }
    );

    if (success) {
      // Clear amount after successful bridge
      setAmount('');
      setRoutes([]);
      setSelectedRoute(null);
    }
  }, [bestRoute, isFullyConnected, amount, executeBridge, sourceChain, sourceToken, destToken, slippage]);

  useEffect(() => {
    if (!selectedRoute || displayedRoutes.length === 0) return;
    const stillExists = displayedRoutes.some((r) => r.routeId === selectedRoute.routeId);
    if (!stillExists) {
      setSelectedRoute(displayedRoutes[0]);
    }
  }, [displayedRoutes, selectedRoute]);

  // Format estimated time
  const formatEta = (seconds?: number): string => {
    if (!seconds) return '~2 min';
    if (seconds < 60) return `~${seconds}s`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
    return `~${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  return (
    <>
      <motion.div 
        ref={cardRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave}
        animate={{ rotateX, rotateY, opacity: 1, scale: 1 }}
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
                {isSourceConnected && sourceWallet.address && (
                  <span className="text-slate-400 font-mono text-xs">
                    {sourceWallet.address.slice(0, 6)}...{sourceWallet.address.slice(-4)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0"
                    min="0"
                    step="0.000001"
                    className="w-full bg-transparent text-4xl md:text-5xl font-bold text-white focus:outline-none placeholder:text-slate-700 hide-arrows"
                  />
                  <div className="text-sm text-slate-500 font-medium mt-1 pl-1">
                    {inputUsdDisplay}
                  </div>
                </div>

                <button 
                  onClick={() => setChainModalOpen(true)}
                  className="shrink-0 flex items-center gap-2 bg-[#12121a] hover:bg-white/10 border border-white/10 rounded-2xl p-2 pr-4 transition-all"
                >
                  <div className="relative flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center z-10 shadow-lg border border-white/5 overflow-hidden">
                      <Image
                        src={sourceToken.icon}
                        alt={sourceToken.symbol}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#2a2a35] flex items-center justify-center -ml-3 z-20 border border-[#12121a] overflow-hidden">
                      {sourceChain?.icon ? (
                        <Image
                          src={sourceChain.icon}
                          alt={sourceChain.name}
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain"
                          unoptimized
                        />
                      ) : '?'}
                    </div>
                  </div>
                  <div className="text-left ml-1 max-w-[80px]">
                    <div className="font-bold text-white leading-tight truncate">{sourceToken.symbol}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{sourceChain?.name || 'Select'}</div>
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
                {isDestConnected && destWallet.address && (
                  <span className="text-slate-400 font-mono text-xs">
                    {destWallet.address.slice(0, 6)}...{destWallet.address.slice(-4)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 overflow-hidden">
                  <div className={`text-4xl md:text-5xl font-bold truncate ${isHighImpact ? 'text-amber-400' : 'text-slate-300'}`}>
                    {isCalculating ? (
                      <span className="animate-pulse">...</span>
                    ) : bestRoute ? (
                      <AnimatedNumber value={outputAmount} />
                    ) : (
                      <span className="text-xl text-slate-500">-</span>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-1 pl-1 flex items-center gap-2">
                    <span className="text-slate-500">
                      {outputUsdDisplay}
                    </span>
                    {priceImpact !== null && priceImpact > 0.1 && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isHighImpact ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                        -{priceImpact.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 bg-[#12121a] border border-white/10 rounded-2xl p-2 pr-4">
                  <div className="relative flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e24] flex items-center justify-center z-10 shadow-lg border border-white/5 overflow-hidden">
                      <Image
                        src={destToken.icon}
                        alt={destToken.symbol}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#2a2a35] flex items-center justify-center -ml-3 z-20 border border-[#12121a] overflow-hidden">
                      <Image
                        src={SOLANA_CHAIN.icon}
                        alt="Solana"
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                        unoptimized
                      />
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

          {/* Error Message */}
          <AnimatePresence>
            {quoteError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 mx-1"
              >
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quoteError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Route Info */}
          <AnimatePresence mode="wait">
            {bestRoute && !isCalculating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 mx-1"
              >
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Best Route</span>
                    <span className="text-white font-medium">{bestRoute.provider}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-slate-500">
                      {formatEta(bestRoute.etaSeconds)}
                    </span>
                    <span className="text-slate-500">
                      {bestRoute.fees.length} fee{bestRoute.fees.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Routes List */}
          {routes.length > 0 && (
            <div className="mt-4 mx-1">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-200">All Routes</div>
                {RouteFiltersComponent}
              </div>
              <RoutesList
                routes={displayedRoutes}
                errors={quoteError ? [quoteError] : undefined}
                selectedRouteId={selectedRoute?.routeId ?? null}
                onSelectRoute={(route) => setSelectedRoute(route)}
                sourceChainId={sourceChain?.type === "evm" && sourceChain ? getChainIdByName(sourceChain.id) ?? sourceChain.id : (sourceChain?.id ?? "")}
                recommendedRouteId={displayedRoutes[0]?.routeId ?? null}
              />
            </div>
          )}

          {/* Action Area */}
          <div className="mt-4 px-1 pb-1">
            {!isFullyConnected ? (
              <button 
                onClick={onConnectWallets}
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white text-black hover:bg-slate-200 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                Connect Wallets
              </button>
            ) : isBridgeExecuting ? (
              <button 
                disabled
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white/10 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Executing Bridge...
              </button>
            ) : isCalculating ? (
              <button 
                disabled
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white/10 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Getting Quotes...
              </button>
            ) : !amount || parseFloat(amount) <= 0 ? (
              <button 
                disabled
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white/10 text-slate-400 cursor-not-allowed"
              >
                Enter Amount
              </button>
            ) : routes.length === 0 ? (
              <button 
                disabled
                className="w-full py-5 rounded-2xl font-bold text-lg bg-white/10 text-slate-400 cursor-not-allowed"
              >
                No Routes Available
              </button>
            ) : (
              <HoldToBridgeButton 
                disabled={false}
                onComplete={handleBridge}
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
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
      />

      <ChainModal
        isOpen={chainModalOpen}
        onClose={() => setChainModalOpen(false)}
        onSelect={setSourceChain}
      />
    </>
  );
}

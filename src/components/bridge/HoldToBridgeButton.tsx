'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface HoldToBridgeButtonProps {
  onComplete: () => void;
  disabled: boolean;
  isHoldingState?: boolean;
  setIsHoldingState?: (value: boolean) => void;
}

export function HoldToBridgeButton({ 
  onComplete, 
  disabled,
  isHoldingState,
  setIsHoldingState 
}: HoldToBridgeButtonProps) {
  const [internalIsHolding, setInternalIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  // Use external state if provided, otherwise use internal
  const isHolding = isHoldingState !== undefined ? isHoldingState : internalIsHolding;
  const setIsHolding = setIsHoldingState || setInternalIsHolding;

  useEffect(() => {
    let animationFrame: number;
    let start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / 1500) * 100, 100);
      setProgress(p);

      if (p < 100 && isHolding && !disabled) {
        animationFrame = requestAnimationFrame(animate);
      } else if (p >= 100) {
        setIsHolding(false);
        onComplete();
      }
    };

    if (isHolding && !disabled) {
      start = Date.now();
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = requestAnimationFrame(() => setProgress(0));
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isHolding, disabled, onComplete, setIsHolding]);

  return (
    <motion.button
      onPointerDown={() => !disabled && setIsHolding(true)}
      onPointerUp={() => setIsHolding(false)}
      onPointerLeave={() => setIsHolding(false)}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`relative w-full py-5 rounded-2xl font-bold text-lg overflow-hidden transition-all ${
        disabled 
          ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5' 
          : 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-white hover:border-indigo-500/60'
      }`}
    >
      <div 
        className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-cyan-500 z-0 origin-left" 
        style={{ 
          transform: `scaleX(${progress / 100})`, 
          transition: isHolding ? 'none' : 'transform 0.2s' 
        }} 
      />
      {isHolding && (
        <div 
          className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-md z-10" 
          style={{ left: `${(progress / 100) * 120 - 20}%` }} 
        />
      )}
      <div className="relative z-20 flex items-center justify-center gap-2">
        {disabled ? 'Enter Amount' : isHolding ? 'Hold to Confirm...' : 'Hold to Bridge'}
      </div>
    </motion.button>
  );
}

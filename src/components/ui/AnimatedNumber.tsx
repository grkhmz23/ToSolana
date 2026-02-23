'use client';

import { motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: string;
  className?: string;
}

export function AnimatedNumber({ value, className = '' }: AnimatedNumberProps) {
  return (
    <motion.span 
      key={value} 
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} 
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }} 
      className={`inline-block ${className}`}
    >
      {value}
    </motion.span>
  );
}

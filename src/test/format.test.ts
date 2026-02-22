import { describe, it, expect } from 'vitest';
import { formatTokenAmount, parseTokenAmount, shortenAddress, formatDuration } from '@/lib/format';

describe('Format Utilities', () => {
  describe('formatTokenAmount', () => {
    it('should format wei to ETH', () => {
      expect(formatTokenAmount('1000000000000000000', 18)).toBe('1.0');
    });

    it('should format small amounts correctly', () => {
      expect(formatTokenAmount('1', 18)).toBe('0.000000000000000001');
    });

    it('should handle zero', () => {
      expect(formatTokenAmount('0', 18)).toBe('0');
      expect(formatTokenAmount('', 18)).toBe('0');
    });

    it('should handle decimals = 0', () => {
      expect(formatTokenAmount('1000000', 0)).toBe('1000000');
    });

    it('should trim trailing zeros', () => {
      expect(formatTokenAmount('1500000000000000000', 18)).toBe('1.5');
    });

    it('should handle negative numbers', () => {
      expect(formatTokenAmount('-1000000000000000000', 18)).toBe('-1.0');
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse ETH to wei', () => {
      expect(parseTokenAmount('1.0', 18)).toBe('1000000000000000000');
    });

    it('should parse integer amounts', () => {
      expect(parseTokenAmount('1', 18)).toBe('1000000000000000000');
    });

    it('should handle zero', () => {
      expect(parseTokenAmount('0', 18)).toBe('0');
      expect(parseTokenAmount('', 18)).toBe('0');
    });

    it('should truncate excess decimals', () => {
      expect(parseTokenAmount('1.12345678901234567890', 18)).toBe('1123456789012345678');
    });

    it('should pad insufficient decimals', () => {
      expect(parseTokenAmount('1.5', 18)).toBe('1500000000000000000');
    });
  });

  describe('shortenAddress', () => {
    it('should shorten EVM address', () => {
      const addr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(shortenAddress(addr)).toBe('0x742d...0bEb');
    });

    it('should shorten Solana address', () => {
      const addr = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
      expect(shortenAddress(addr)).toBe('HN7cAB...YWrH');
    });

    it('should handle custom char count', () => {
      const addr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(shortenAddress(addr, 6)).toBe('0x742d35...5f0bEb');
    });

    it('should return short addresses unchanged', () => {
      expect(shortenAddress('0x1234')).toBe('0x1234');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes', () => {
      expect(formatDuration(300)).toBe('5m');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(305)).toBe('5m 5s');
    });

    it('should format hours', () => {
      expect(formatDuration(7200)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(7500)).toBe('2h 5m');
    });
  });
});

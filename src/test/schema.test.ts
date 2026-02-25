import { describe, it, expect } from 'vitest';
import {
  quoteRequestSchema,
  executeStepRequestSchema,
  createSessionRequestSchema,
  updateStepRequestSchema,
  statusQuerySchema,
  normalizedRouteSchema,
  providerEnum,
} from '@/server/schema';

const mockSessionAuth = {
  scheme: 'evm' as const,
  challenge: 'mock.challenge',
  message: 'Authorize this session',
  signature: '0xabc123',
};

describe('Schema Validation', () => {
  describe('quoteRequestSchema', () => {
    it('should validate valid quote request', () => {
      const valid = {
        sourceChainId: 1,
        sourceTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        sourceAmount: '1000000000000000000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        slippage: 3,
      };
      const result = quoteRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should use default slippage when not provided', () => {
      const valid = {
        sourceChainId: 1,
        sourceTokenAddress: 'native',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      };
      const result = quoteRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(result.data?.slippage).toBe(3); // Default 3%
    });

    it('should reject slippage below 0.1%', () => {
      const invalid = {
        sourceChainId: 1,
        sourceTokenAddress: 'native',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        slippage: 0.05,
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject slippage above 50%', () => {
      const invalid = {
        sourceChainId: 1,
        sourceTokenAddress: 'native',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        slippage: 60,
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative chain ID', () => {
      const invalid = {
        sourceChainId: -1,
        sourceTokenAddress: 'native',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject zero chain ID', () => {
      const invalid = {
        sourceChainId: 0,
        sourceTokenAddress: 'native',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty addresses', () => {
      const invalid = {
        sourceChainId: 1,
        sourceTokenAddress: '',
        sourceAmount: '1000',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty amount', () => {
      const invalid = {
        sourceChainId: 1,
        sourceTokenAddress: 'native',
        sourceAmount: '',
        destinationTokenAddress: 'SOL',
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      };
      const result = quoteRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('executeStepRequestSchema', () => {
    it('should validate valid execute step request', () => {
      const valid = {
        sessionId: 'sess_123',
        provider: 'lifi',
        routeId: 'route_abc',
        stepIndex: 0,
        sessionAuth: mockSessionAuth,
      };
      const result = executeStepRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject negative stepIndex', () => {
      const invalid = {
        sessionId: 'sess_123',
        provider: 'rango',
        routeId: 'route_abc',
        stepIndex: -1,
        sessionAuth: mockSessionAuth,
      };
      const result = executeStepRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer stepIndex', () => {
      const invalid = {
        sessionId: 'sess_123',
        provider: 'lifi',
        routeId: 'route_abc',
        stepIndex: 1.5,
        sessionAuth: mockSessionAuth,
      };
      const result = executeStepRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid provider', () => {
      const invalid = {
        sessionId: 'sess_123',
        provider: 'invalid',
        routeId: 'route_abc',
        stepIndex: 0,
        sessionAuth: mockSessionAuth,
      };
      const result = executeStepRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty sessionId', () => {
      const invalid = {
        sessionId: '',
        provider: 'lifi',
        routeId: 'route_abc',
        stepIndex: 0,
        sessionAuth: mockSessionAuth,
      };
      const result = executeStepRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createSessionRequestSchema', () => {
    it('should validate valid create session request', () => {
      const valid = {
        sourceAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        solanaAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        provider: 'lifi',
        routeId: 'route_abc',
        route: {
          provider: 'lifi',
          routeId: 'route_abc',
          steps: [
            {
              chainType: 'evm',
              chainId: 1,
              description: 'Swap ETH to SOL',
            },
          ],
          estimatedOutput: {
            token: 'SOL',
            amount: '1000000000',
          },
          fees: [],
        },
        // History fields
        sourceChainId: 1,
        sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        sourceAmount: '1000000000000000000',
        destToken: 'SOL',
      };
      const result = createSessionRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('updateStepRequestSchema', () => {
    it('should validate valid update step request', () => {
      const valid = {
        sessionId: 'sess_123',
        provider: 'lifi',
        routeId: 'route_123',
        stepIndex: 0,
        status: 'submitted',
        txHashOrSig: '0xabc123',
        sessionAuth: mockSessionAuth,
      };
      const result = updateStepRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept update without txHashOrSig', () => {
      const valid = {
        sessionId: 'sess_123',
        provider: 'lifi',
        routeId: 'route_123',
        stepIndex: 0,
        status: 'failed',
        sessionAuth: mockSessionAuth,
      };
      const result = updateStepRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalid = {
        sessionId: 'sess_123',
        provider: 'lifi',
        routeId: 'route_123',
        stepIndex: 0,
        status: 'confirmed',
        sessionAuth: mockSessionAuth,
      };
      const result = updateStepRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('statusQuerySchema', () => {
    it('should validate valid status query', () => {
      const valid = { sessionId: 'sess_123' };
      const result = statusQuerySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject empty sessionId', () => {
      const invalid = { sessionId: '' };
      const result = statusQuerySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('providerEnum', () => {
    it('should accept valid providers', () => {
      expect(providerEnum.safeParse('lifi').success).toBe(true);
      expect(providerEnum.safeParse('rango').success).toBe(true);
    });

    it('should reject invalid providers', () => {
      expect(providerEnum.safeParse('unknown').success).toBe(false);
      expect(providerEnum.safeParse('').success).toBe(false);
    });
  });

  describe('normalizedRouteSchema', () => {
    it('should validate complete route', () => {
      const valid = {
        provider: 'lifi',
        routeId: 'route_123',
        steps: [
          {
            chainType: 'evm',
            chainId: 1,
            description: 'Step 1',
          },
        ],
        estimatedOutput: {
          token: 'SOL',
          amount: '1000000000',
        },
        fees: [
          { token: 'ETH', amount: '1000000000000000' },
        ],
        etaSeconds: 300,
        warnings: ['High slippage'],
      };
      const result = normalizedRouteSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});

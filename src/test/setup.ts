// Test setup file
import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
process.env.RANGO_API_KEY = 'test-rango-key';
process.env.LIFI_API_KEY = 'test-lifi-key';
process.env.LIFI_INTEGRATOR = 'tosolana-test';

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

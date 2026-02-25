// Test setup file
import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
process.env.RANGO_API_KEY = 'test-rango-key';
process.env.LIFI_API_KEY = 'test-lifi-key';
process.env.LIFI_INTEGRATOR = 'tosolana-test';

// Mock fetch globally - returns empty routes by default for provider tests
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ routes: [] }),
  text: async () => '{"routes":[]}',
} as unknown as Response);

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

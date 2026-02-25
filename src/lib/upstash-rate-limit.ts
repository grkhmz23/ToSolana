/**
 * Distributed Rate Limiting with Upstash Redis
 * 
 * This module provides rate limiting that works across multiple server instances.
 * It uses Upstash Redis when configured, falling back to in-memory rate limiting
 * for development or when Upstash is not available.
 * 
 * To enable distributed rate limiting in production:
 * 1. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your .env
 * 2. Install @upstash/redis: `pnpm add @upstash/redis`
 */

import { checkRateLimit as checkMemoryRateLimit, getClientIp } from "./rate-limit";

// Type for Upstash Redis client (dynamically imported)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpstashRedisClient = any;

let upstashClient: UpstashRedisClient | null = null;
let upstashAvailable = false;

// Lazy initialization of Upstash client
async function getUpstashClient(): Promise<UpstashRedisClient | null> {
  if (upstashClient) return upstashClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  try {
    // Dynamic import to avoid requiring the package when not used
    const { Redis } = await import("@upstash/redis");
    upstashClient = new Redis({ url, token });
    upstashAvailable = true;
    return upstashClient;
  } catch {
    console.warn("@upstash/redis not installed. Using in-memory rate limiting.");
    console.warn("Install with: pnpm add @upstash/redis");
    return null;
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  windowMs: number;
}

/**
 * Check rate limit using Upstash Redis or fallback to memory
 * 
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param windowMs - Time window in milliseconds
 * @param max - Maximum requests allowed in the window
 * @param prefix - Key prefix for namespacing (e.g., 'quote', 'execute')
 */
export async function checkDistributedRateLimit(
  identifier: string,
  windowMs: number,
  max: number,
  prefix: string = "ratelimit",
): Promise<RateLimitResult> {
  const client = await getUpstashClient();
  
  if (!client) {
    // Fallback to in-memory rate limiting
    const result = checkMemoryRateLimit(identifier, windowMs, max);
    return {
      ...result,
      limit: max,
      windowMs,
    };
  }
  
  const key = `${prefix}:${identifier}`;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const now = Date.now();
  const resetAt = now + windowMs;
  
  try {
    // Use Redis INCR for atomic counter increment
    const count = await client.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    
    // Check if over limit
    if (count > max) {
      // Get TTL to calculate reset time
      return {
        ok: false,
        remaining: 0,
        resetAt,
        limit: max,
        windowMs,
      };
    }
    
    return {
      ok: true,
      remaining: max - count,
      resetAt,
      limit: max,
      windowMs,
    };
  } catch (error) {
    console.error("Upstash rate limit error:", error);
    // Fallback to memory on error
    const result = checkMemoryRateLimit(identifier, windowMs, max);
    return {
      ...result,
      limit: max,
      windowMs,
    };
  }
}

/**
 * Get client IP from request headers
 * Re-exported from rate-limit.ts for convenience
 */
export { getClientIp };

/**
 * Check if Upstash Redis is available
 */
export function isUpstashAvailable(): boolean {
  return upstashAvailable;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Quote endpoint - higher limit since it's called frequently
  quote: {
    windowMs: 60_000, // 1 minute
    max: 30,
  },
  // Execute endpoint - lower limit since it involves transactions
  execute: {
    windowMs: 60_000, // 1 minute
    max: 10,
  },
  // Status polling - higher limit
  status: {
    windowMs: 60_000,
    max: 60,
  },
  // Default for other endpoints
  default: {
    windowMs: 60_000,
    max: 30,
  },
} as const;

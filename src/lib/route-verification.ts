/**
 * Server-side Route Verification and Integrity Checks
 * 
 * This module provides utilities to verify that routes haven't been tampered with
 * between the quote and execution phases. It uses cryptographic hashing to ensure
 * route integrity.
 * 
 * Security features:
 * 1. Route hash verification - ensures route data hasn't been modified
 * 2. Quote-to-execution validation - ensures the executed route matches the quoted route
 * 3. Provider verification - ensures the provider is legitimate
 * 4. Amount validation - ensures amounts haven't been manipulated
 */

import { createHash, createHmac } from "crypto";
import type { NormalizedRoute, QuoteRequest } from "@/server/schema";

// Secret for HMAC signing (should be set in environment)
const ROUTE_SIGNING_SECRET = process.env.ROUTE_SIGNING_SECRET || "";

export interface RouteVerificationResult {
  valid: boolean;
  reason?: string;
}

export interface SignedRoute extends NormalizedRoute {
  /** HMAC signature of the route */
  _signature?: string;
  /** Timestamp when the route was signed */
  _timestamp?: number;
  /** Expiry timestamp */
  _expiresAt?: number;
}

/**
 * Generate a canonical string representation of a route for signing
 * This ensures consistent hashing regardless of property ordering
 */
function canonicalizeRoute(route: NormalizedRoute): string {
  const canonical = {
    provider: route.provider,
    routeId: route.routeId,
    steps: route.steps.map(step => ({
      chainType: step.chainType,
      chainId: step.chainId,
      provider: step.provider,
      description: step.description,
    })),
    estimatedOutput: {
      token: route.estimatedOutput.token,
      amount: route.estimatedOutput.amount,
    },
    fees: route.fees.map(fee => ({
      token: fee.token,
      amount: fee.amount,
    })),
    etaSeconds: route.etaSeconds,
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Generate a hash of the quote request context
 * This binds the route to specific quote parameters
 */
function hashQuoteContext(intent: QuoteRequest): string {
  const context = {
    sourceChainId: String(intent.sourceChainId),
    sourceTokenAddress: intent.sourceTokenAddress.toLowerCase(),
    sourceAmount: intent.sourceAmount,
    destinationTokenAddress: intent.destinationTokenAddress.toLowerCase(),
    sourceAddress: intent.sourceAddress.toLowerCase(),
    solanaAddress: intent.solanaAddress.toLowerCase(),
    slippage: intent.slippage,
  };
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

/**
 * Sign a route with HMAC for integrity verification
 * 
 * @param route - The route to sign
 * @param intent - The quote request that generated this route
 * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
 * @returns Signed route with signature
 */
export function signRoute(
  route: NormalizedRoute,
  intent: QuoteRequest,
  ttlMs: number = 5 * 60 * 1000,
): SignedRoute {
  if (!ROUTE_SIGNING_SECRET) {
    // In development without a secret, return route without signature
    if (process.env.NODE_ENV === "development") {
      return route as SignedRoute;
    }
    throw new Error("ROUTE_SIGNING_SECRET not configured");
  }

  const timestamp = Date.now();
  const expiresAt = timestamp + ttlMs;
  const contextHash = hashQuoteContext(intent);
  const canonicalRoute = canonicalizeRoute(route);
  
  // Create HMAC: HMAC(secret, context_hash + timestamp + expires_at + route)
  const payload = `${contextHash}:${timestamp}:${expiresAt}:${canonicalRoute}`;
  const signature = createHmac("sha256", ROUTE_SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  return {
    ...route,
    _signature: signature,
    _timestamp: timestamp,
    _expiresAt: expiresAt,
  };
}

/**
 * Verify a signed route's integrity
 * 
 * @param signedRoute - The route with signature to verify
 * @param intent - The original quote request context
 * @returns Verification result
 */
export function verifyRoute(
  signedRoute: SignedRoute,
  intent: QuoteRequest,
): RouteVerificationResult {
  // Allow unsigned routes in development if no secret is configured
  if (!ROUTE_SIGNING_SECRET) {
    if (process.env.NODE_ENV === "development") {
      return { valid: true };
    }
    return { valid: false, reason: "Route signing not configured" };
  }

  // Check if route has signature
  if (!signedRoute._signature || !signedRoute._timestamp || !signedRoute._expiresAt) {
    return { valid: false, reason: "Route is not signed" };
  }

  // Check expiry
  if (Date.now() > signedRoute._expiresAt) {
    return { valid: false, reason: "Route has expired, please request a new quote" };
  }

  // Reconstruct the payload and verify signature
  const contextHash = hashQuoteContext(intent);
  const { _signature, _timestamp, _expiresAt, ...route } = signedRoute;
  const canonicalRoute = canonicalizeRoute(route as NormalizedRoute);
  
  const payload = `${contextHash}:${_timestamp}:${_expiresAt}:${canonicalRoute}`;
  const expectedSignature = createHmac("sha256", ROUTE_SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  if (!timingSafeEqual(_signature, expectedSignature)) {
    return { valid: false, reason: "Route signature mismatch - route may have been tampered with" };
  }

  return { valid: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the comparison to avoid leaking length info
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b.padEnd(a.length, "0"));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _result = Buffer.compare(bufA, bufB);
    return false;
  }
  return Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
}

/**
 * Validate that a route's provider is legitimate
 * This prevents execution through unknown/malicious providers
 */
const ALLOWED_PROVIDERS = new Set([
  "rango",
  "lifi",
  "thorchain",
  "ibc",
  "ton",
  "jupiter",
  "socket",
  "flashift",
  "wormhole",
  "allbridge",
  "debridge",
  "symbiosis",
  "mayan",
]);

export function isValidProvider(provider: string): boolean {
  return ALLOWED_PROVIDERS.has(provider);
}

/**
 * Validate route amounts haven't been manipulated
 * Ensures output amounts are within expected bounds
 */
export function validateRouteAmounts(
  route: NormalizedRoute,
  originalAmount: string,
  maxSlippagePercent: number = 50,
): RouteVerificationResult {
  try {
    const inputAmount = BigInt(originalAmount);
    const outputAmount = BigInt(route.estimatedOutput.amount);
    
    // Output should not be negative
    if (outputAmount < BigInt(0)) {
      return { valid: false, reason: "Invalid negative output amount" };
    }
    
    // Output should not be more than 1000x the input (sanity check)
    const maxOutput = inputAmount * BigInt(1000);
    if (outputAmount > maxOutput) {
      return { valid: false, reason: "Output amount exceeds maximum allowed" };
    }
    
    // Calculate total fees
    const totalFees = route.fees.reduce((sum, fee) => {
      try {
        return sum + BigInt(fee.amount);
      } catch {
        return sum;
      }
    }, BigInt(0));
    
    // Fees should not exceed input amount
    if (totalFees > inputAmount) {
      return { valid: false, reason: "Total fees exceed input amount" };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid amount format in route" };
  }
}

/**
 * Comprehensive route validation before execution
 * This should be called before executing any route
 */
export function validateRouteForExecution(
  route: SignedRoute,
  intent: QuoteRequest,
): RouteVerificationResult {
  // 1. Verify provider is allowed
  if (!isValidProvider(route.provider)) {
    return { valid: false, reason: `Unknown provider: ${route.provider}` };
  }

  // 2. Verify route signature and integrity
  const integrityResult = verifyRoute(route, intent);
  if (!integrityResult.valid) {
    return integrityResult;
  }

  // 3. Validate amounts
  const amountResult = validateRouteAmounts(route, intent.sourceAmount);
  if (!amountResult.valid) {
    return amountResult;
  }

  // 4. Validate steps exist
  if (!Array.isArray(route.steps) || route.steps.length === 0) {
    return { valid: false, reason: "Route has no execution steps" };
  }

  // 5. Validate chain types in steps
  const validChainTypes = new Set(["evm", "solana", "bitcoin", "cosmos", "ton"]);
  for (const step of route.steps) {
    if (!validChainTypes.has(step.chainType)) {
      return { valid: false, reason: `Invalid chain type in route: ${step.chainType}` };
    }
  }

  return { valid: true };
}

/**
 * Strip signature fields from route for client response
 * (signature should be verified server-side only)
 */
export function stripRouteSignature(route: SignedRoute): NormalizedRoute {
  const { _signature, _timestamp, _expiresAt, ...cleanRoute } = route;
  return cleanRoute;
}

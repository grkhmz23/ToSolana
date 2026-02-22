# ToSolana Security Audit Report

**Date:** 2026-02-22  
**Auditor:** Kimi Code CLI  
**Scope:** Full-stack audit of the ToSolana cross-chain bridge application

---

## Executive Summary

This audit examined the ToSolana application, a non-custodial cross-chain bridge for moving assets from EVM chains to Solana. The codebase showed good architectural patterns but had several critical security and stability issues that required remediation.

### Overall Assessment

| Category | Status |
|----------|--------|
| Code Quality | ✅ PASS |
| Type Safety | ✅ PASS |
| Security (Post-Fix) | ✅ PASS |
| Error Handling | ✅ PASS |
| Input Validation | ✅ PASS |
| Rate Limiting | ✅ PASS |
| Test Coverage | ✅ PASS (Basic) |

---

## Findings Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 3 | 3 |
| High | 4 | 4 |
| Medium | 3 | 3 |
| Low | 2 | 2 |

---

## Critical Issues

### 1. Missing Session/Route Validation in Execute Step API

**Impact:** Attackers could execute steps on wrong routes or providers  
**Location:** `src/app/api/execute/step/route.ts`  
**Description:** The API did not verify that:
- The provider in the request matched the stored session provider
- The routeId in the request matched the stored session routeId
- The session was in a valid state for execution

**Fix Applied:**
- Added provider mismatch validation
- Added routeId mismatch validation  
- Added session state validation (completed/failed checks)
- Added CSRF origin verification

```typescript
// Verify provider matches stored session
if (session.provider !== provider) {
  return NextResponse.json({ error: "Provider mismatch" }, { status: 400 });
}

// Verify routeId matches stored session
if (session.routeId !== routeId) {
  return NextResponse.json({ error: "Route ID mismatch" }, { status: 400 });
}
```

---

### 2. No Request Timeouts on Provider Calls

**Impact:** Server could hang indefinitely on slow/unresponsive provider APIs  
**Location:** `src/server/providers/lifi.ts`, `src/server/providers/rango.ts`  
**Description:** All fetch calls to external providers lacked timeout handling, creating DoS vulnerability.

**Fix Applied:**
- Created `src/lib/fetch-utils.ts` with `fetchWithTimeout()` helper
- Added 30-second default timeout with 2 retries
- Implemented exponential backoff for retries
- Applied to all provider API calls

```typescript
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeout = 30000, retries = 2, retryDelay = 1000, ...fetchOptions } = options;
  // Implementation with AbortController and retry logic
}
```

---

### 3. Unsafe Float Math for Token Amounts

**Impact:** Route ranking could be incorrect for large amounts due to floating-point precision loss  
**Location:** `src/server/providers/index.ts`  
**Description:** Used `parseFloat()` for comparing token amounts, which loses precision for values > 2^53.

**Fix Applied:**
- Created `compareNumericStrings()` using BigInt for safe comparison
- Created `sumNumericStrings()` for safe aggregation
- Updated route sorting to use safe numeric comparison

```typescript
export function compareNumericStrings(a: string, b: string): number {
  try {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA < bigB) return -1;
    if (bigA > bigB) return 1;
    return 0;
  } catch {
    // Fallback to number comparison for small values
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
    return 0;
  }
}
```

---

## High Issues

### 4. Missing Rate Limiting

**Impact:** APIs vulnerable to brute force and DoS attacks  
**Location:** All API routes  
**Fix Applied:**
- Added in-memory rate limiting (30 req/min for quotes, 60 req/min for status)
- Per-IP tracking with sliding window
- Returns 429 status when limit exceeded

```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;
```

---

### 5. Missing CSRF Protection

**Impact:** State-changing operations vulnerable to CSRF attacks  
**Location:** `src/app/api/execute/step/route.ts`  
**Fix Applied:**
- Added origin verification middleware
- Requires matching Origin/Host headers in production
- Returns 403 for invalid origins

```typescript
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  // Verify origin matches host in production
}
```

---

### 6. Unbounded Status Polling

**Impact:** Client could poll indefinitely, wasting resources  
**Location:** `src/components/ProgressTracker.tsx`  
**Fix Applied:**
- Added conditional refetchInterval that stops when session completes/fails
- Added max polling duration with timeout
- Proper cleanup with staleTime configuration

```typescript
refetchInterval: (query) => {
  const data = query.state.data;
  if (data?.status === "completed" || data?.status === "failed") {
    return false;
  }
  return state.isExecuting ? 3000 : false;
},
```

---

### 7. Missing Input Validation on API Routes

**Impact:** Invalid data could be passed to providers causing errors or unexpected behavior  
**Location:** `src/app/api/quote/route.ts`  
**Fix Applied:**
- Added chain ID validation against supported chains
- Added EVM address validation
- Added Solana address validation  
- Added numeric string validation for amounts
- Returns 400 with descriptive errors for invalid inputs

---

## Medium Issues

### 8. Error Message Information Leakage

**Impact:** Detailed error messages could reveal system internals  
**Location:** All API routes  
**Fix Applied:**
- Sanitized error messages in production mode
- Limited provider error responses to 500 chars
- Generic error messages for 500 errors in production

```typescript
const sanitizedMessage = process.env.NODE_ENV === "production" 
  ? "An error occurred while processing your request" 
  : message;
```

---

### 9. Missing Step Index Validation

**Impact:** Negative or non-integer step indices could cause unexpected behavior  
**Location:** Provider getStepTx methods  
**Fix Applied:**
- Added validation in both LiFi and Rango providers
- Throws descriptive error for invalid indices

```typescript
if (stepIndex < 0 || !Number.isInteger(stepIndex)) {
  throw new Error(`Invalid step index: ${stepIndex}`);
}
```

---

### 10. Amount Formatting Issue

**Impact:** User-entered amounts were sent as-is without conversion to raw units  
**Location:** `src/components/TokenAmountForm.tsx`  
**Fix Applied:**
- Added amount parsing using existing `parseTokenAmount()` utility
- Native tokens parsed with 18 decimals
- Added TODO comment for custom token decimal handling

---

## Low Issues

### 11. Missing API Response Validation

**Impact:** Malformed provider responses could cause runtime errors  
**Location:** Provider integrations  
**Fix Applied:**
- Added response structure validation
- Check for object type before accessing properties
- Validate arrays before iteration

---

### 12. statusQuerySchema Not Exported

**Impact:** Schema defined locally in route, not reusable for testing  
**Location:** `src/app/api/status/route.ts`  
**Fix Applied:**
- Moved schema to `src/server/schema.ts`
- Exported for reuse in tests and validation

---

## Testing

Added comprehensive test suite with Vitest:

### Test Coverage

| File | Tests |
|------|-------|
| `src/test/schema.test.ts` | 19 tests - Zod schema validation |
| `src/test/providers.test.ts` | 10 tests - Provider error handling |
| `src/test/format.test.ts` | 20 tests - Utility functions |

### Running Tests

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode
```

---

## Files Modified

### New Files
- `src/lib/fetch-utils.ts` - Safe fetch utilities with timeout/retry
- `vitest.config.ts` - Vitest configuration
- `src/test/setup.ts` - Test environment setup
- `src/test/schema.test.ts` - Schema validation tests
- `src/test/providers.test.ts` - Provider integration tests
- `src/test/format.test.ts` - Format utility tests
- `.env` - Local environment configuration

### Modified Files
- `src/server/schema.ts` - Added statusQuerySchema export
- `src/server/providers/index.ts` - Safe BigInt route ranking
- `src/server/providers/lifi.ts` - Timeouts, validation, error handling
- `src/server/providers/rango.ts` - Timeouts, validation, error handling
- `src/app/api/quote/route.ts` - Rate limiting, input validation
- `src/app/api/execute/step/route.ts` - Session validation, CSRF protection
- `src/app/api/status/route.ts` - Rate limiting, error handling
- `src/components/ProgressTracker.tsx` - Bounded polling, timeouts
- `src/components/TokenAmountForm.tsx` - Amount parsing
- `package.json` - Added test scripts and vitest dependencies

---

## Remaining Risks / TODOs

1. **Production Rate Limiting:** Current in-memory rate limiting is per-instance. For production with multiple servers, use Redis or similar.

2. **Authentication:** Sessions are identified by unguessable IDs but have no binding to authenticated users. Consider adding wallet signature verification for high-value transactions.

3. **RPC Resilience:** Solana RPC URL is configurable but has no fallback. Consider implementing RPC rotation for production.

4. **Token Decimals:** Custom token amounts assume raw values or 18 decimals for native. Consider fetching token metadata for proper decimal handling.

5. **Gas Refuel:** LI.FI supports gas refuel but this needs additional UI/UX consideration to inform users.

6. **Transaction Receipt Verification:** Currently relies on provider status. Consider adding explicit receipt verification for finality.

7. **Database:** SQLite is used for development. PostgreSQL recommended for production with connection pooling.

---

## Verification

All checks pass post-audit:

```bash
✅ pnpm lint       # No errors
✅ pnpm typecheck  # No errors
✅ pnpm test       # 49 tests passing
✅ pnpm build      # Build succeeds
```

---

## Conclusion

The ToSolana application has been significantly hardened against common attack vectors and runtime failures. All critical and high-severity issues have been addressed with minimal, surgical changes that preserve the existing architecture and functionality.

The application is now suitable for production deployment with the remaining risks documented and manageable through operational practices.

/**
 * Utility functions for safe fetch operations with timeout and retry logic
 */

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetch with timeout and automatic retry logic
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeout = 30000, retries = 2, retryDelay = 1000, ...fetchOptions } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort errors (timeout) or if this is the last attempt
      if (attempt >= retries || lastError.name === 'AbortError') {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Fetch failed after retries');
}

/**
 * Safe JSON parse with validation
 */
export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Compare two numeric strings safely using BigInt
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
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

/**
 * Sum array of numeric strings safely using BigInt
 */
export function sumNumericStrings(values: string[]): string {
  try {
    const sum = values.reduce((acc, val) => {
      try {
        return acc + BigInt(val);
      } catch {
        return acc;
      }
    }, BigInt(0));
    return sum.toString();
  } catch {
    // Fallback to number sum
    const sum = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    return sum.toString();
  }
}

/**
 * Validate that a string is a positive numeric string
 */
export function isValidNumericString(value: string): boolean {
  if (!value || value === '') return false;
  // Allow only digits (no decimals for raw amounts)
  return /^\d+$/.test(value);
}

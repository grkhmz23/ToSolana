/**
 * Format a raw token amount (string of smallest unit) to human-readable form.
 * E.g. formatTokenAmount("1000000000000000000", 18) => "1.0"
 */
export function formatTokenAmount(raw: string, decimals: number): string {
  if (!raw || raw === "0") return "0";

  const isNegative = raw.startsWith("-");
  const abs = isNegative ? raw.slice(1) : raw;

  if (decimals === 0) return isNegative ? `-${abs}` : abs;

  const padded = abs.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals);

  // Trim trailing zeros but keep at least one decimal
  const trimmed = fracPart.replace(/0+$/, "") || "0";
  const result = `${intPart}.${trimmed}`;

  return isNegative ? `-${result}` : result;
}

/**
 * Parse a human-readable amount to smallest unit string.
 * E.g. parseTokenAmount("1.5", 18) => "1500000000000000000"
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  if (!amount || amount === "0") return "0";

  const [intPart, fracPart = ""] = amount.split(".");
  const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const raw = (intPart + paddedFrac).replace(/^0+/, "") || "0";

  return raw;
}

/**
 * Shorten an address for display: 0x1234...abcd
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format seconds to human-readable duration.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

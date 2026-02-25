type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  key: string,
  windowMs: number,
  max: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = buckets.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }

  if (record.count >= max) {
    return { ok: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { ok: true, remaining: max - record.count, resetAt: record.resetAt };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

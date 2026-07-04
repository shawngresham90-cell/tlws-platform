import { log } from './logger';

/**
 * Lightweight in-memory rate limiter — fixed window per key (IP + route).
 * Good enough to blunt burst abuse on serverless warm instances. For durable
 * cross-instance limiting, swap this for Upstash Redis later (interface stays
 * the same). Fails OPEN on error so a limiter bug never blocks real users.
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export function rateLimit(key: string, limit = 5, windowMs = 60_000): RateLimitResult {
  try {
    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || now > bucket.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      log.warn('rate_limited', { key });
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
  } catch (err) {
    log.error('rate_limit_error', { message: (err as Error).message });
    return { allowed: true, remaining: 0, resetAt: Date.now() };
  }
}

/** Best-effort client IP from proxy headers (Netlify/Cloudflare). */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-nf-client-connection-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

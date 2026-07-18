/**
 * Token-bucket rate limiter for the trip-planner API (Phase 4). In-memory,
 * per-key (client IP), injectable clock so tests never wait. KNOWN
 * LIMITATION, by design: on serverless each instance keeps its own buckets,
 * so the cap is per-instance, not global — adequate abuse protection for a
 * public read-only planning API (no writes exist behind it). A shared store
 * can replace `MemoryBuckets` without touching call sites.
 */

export type RateLimitOptions = {
  /** Max requests in a full bucket. */
  capacity: number;
  /** Tokens restored per second. */
  refillPerSecond: number;
  /** Injected clock (ms). */
  nowMs: () => number;
};

type Bucket = { tokens: number; lastRefillMs: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private opts: RateLimitOptions) {}

  /** True = allowed (a token was consumed); false = rate-limited. */
  allow(key: string): boolean {
    const now = this.opts.nowMs();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.opts.capacity, lastRefillMs: now };
      this.buckets.set(key, b);
    }
    const elapsedSec = Math.max(0, (now - b.lastRefillMs) / 1000);
    b.tokens = Math.min(this.opts.capacity, b.tokens + elapsedSec * this.opts.refillPerSecond);
    b.lastRefillMs = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    // Bound memory: prefer dropping idle buckets, but under a many-IP flood
    // every bucket is fresh — so fall back to evicting oldest-inserted
    // entries unconditionally until back under the floor. A dropped bucket
    // just refills to full on next sight, which only ever errs permissive.
    if (this.buckets.size > 10_000) {
      for (const [k, v] of this.buckets) {
        if (now - v.lastRefillMs > 3_600_000) this.buckets.delete(k);
        if (this.buckets.size <= 5_000) break;
      }
      for (const k of this.buckets.keys()) {
        if (this.buckets.size <= 5_000) break;
        this.buckets.delete(k);
      }
    }
    return true;
  }
}

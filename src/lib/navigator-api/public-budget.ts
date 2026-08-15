/**
 * The rail the per-IP limiters cannot be: a ceiling that does not care how
 * many addresses the traffic arrives from.
 *
 * WHAT THE EXISTING LIMITERS DO AND DO NOT DO
 *
 * The route endpoint allows 6 requests an hour per IP; destination search
 * allows 30 a minute per IP. Both are correct and both are useless against
 * the thing public access actually invites: a caller with a thousand
 * addresses gets a thousand separate buckets, and every one of them is full.
 * Per-IP limiting bounds a rude visitor. It does not bound a script.
 *
 * Under the pilot passcode that gap was theoretical — you had to know the
 * password to reach the endpoint at all, and the two or three people who did
 * were drivers. Take the password away and the gap is the whole exposure:
 * every request past it spends a metered provider transaction against a
 * documented allowance of 5,000 truck transactions a month.
 *
 * So public mode adds a second gate that counts EVERY caller together. Not
 * per IP, not per session — per process, across both endpoints.
 *
 * WHAT THIS IS HONESTLY WORTH
 *
 * The store is in-memory, so the ceiling is per warm instance, exactly like
 * every other limiter in this repository. On a serverless host the effective
 * global ceiling is this number multiplied by however many instances the
 * platform decided to run, which is not a number this code can read or cap.
 * That is a real limitation and it is the reason `docs/operations/
 * navigator-public-beta-cost-audit.md` does not describe public mode as
 * safe to switch on. What this module buys is the difference between
 * "unbounded per address" and "bounded per process regardless of address" —
 * a large improvement, and not a complete defence.
 *
 * It is deliberately INERT outside public mode: in `pilot` and `closed` the
 * caller never consults it, so the pilot's behaviour is unchanged.
 */

/** Ceilings per warm instance per hour, across all callers combined. */
export const PUBLIC_HOURLY_ROUTE_BUDGET = 40;
export const PUBLIC_HOURLY_SEARCH_BUDGET = 400;

export type PublicBudgetKind = 'route' | 'search';

const CEILINGS: Record<PublicBudgetKind, number> = {
  route: PUBLIC_HOURLY_ROUTE_BUDGET,
  search: PUBLIC_HOURLY_SEARCH_BUDGET,
};

const WINDOW_MS = 60 * 60 * 1000;

/**
 * A sliding-window counter, kept as a plain object so a test can build one
 * with an injected clock and never wait an hour.
 */
export type PublicBudget = {
  /** Consume one unit. False = the ceiling is spent for this window. */
  spend(kind: PublicBudgetKind): boolean;
  /** How many units remain — diagnostics and tests only. */
  remaining(kind: PublicBudgetKind): number;
};

export function createPublicBudget(
  nowMs: () => number,
  ceilings: Record<PublicBudgetKind, number> = CEILINGS,
): PublicBudget {
  // Timestamps of the calls inside the current window, oldest first. Bounded
  // by the ceiling itself, so this cannot grow: once the array is full the
  // next spend is refused rather than pushed.
  const calls: Record<PublicBudgetKind, number[]> = { route: [], search: [] };

  const prune = (kind: PublicBudgetKind, now: number) => {
    const cutoff = now - WINDOW_MS;
    const list = calls[kind];
    let drop = 0;
    while (drop < list.length && list[drop] <= cutoff) drop++;
    if (drop > 0) list.splice(0, drop);
  };

  return {
    spend(kind) {
      const now = nowMs();
      prune(kind, now);
      if (calls[kind].length >= ceilings[kind]) return false;
      calls[kind].push(now);
      return true;
    },
    remaining(kind) {
      prune(kind, nowMs());
      return Math.max(0, ceilings[kind] - calls[kind].length);
    },
  };
}

/**
 * The process-wide budget the endpoints share. Module-level so it survives
 * across requests within a warm instance — the same discipline as the
 * routing adapter's free-tier guard, which it sits beside rather than
 * replaces: that one caps live provider calls per instance, this one caps
 * requests that could become live provider calls, before any of the
 * per-request work happens.
 */
export const publicBudget = createPublicBudget(() => Date.now());

/** The message a caller who hit the ceiling gets. Same wording both ends. */
export const PUBLIC_BUDGET_MESSAGE =
  'The Navigator public beta has reached its hourly limit for this server. ' +
  'Nothing is wrong with your truck or your route — try again shortly.';

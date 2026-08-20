/**
 * Destination-search coordination (pilot round 3).
 *
 * The live pilot saw the search area flash and re-request while a correct
 * result was already on screen. Round 2 fixed the two causes in the
 * component (a re-created `origin` object retriggering the effect, and
 * selection not ending the search). What stayed untestable was the part
 * that actually bounds PROVIDER SPEND: which queries earn a request at
 * all, and which answers are still current when they land.
 *
 * That decision-making lives here, as a small piece of pure state, so it
 * can be exercised offline and the provider-call count can be asserted
 * rather than assumed.
 *
 * No I/O: the caller performs the request and reports the answer back.
 *
 * ─────────────────────────────────────────────────────────────────────
 * NAV-SEARCH-1 (2026-08-20): AN ANSWER AND AN ATTEMPT ARE NOT THE SAME
 * THING.
 *
 * There used to be one settlement method, `accept(seq, places)`, and the
 * component reported a failed request through it as `accept(seq, [])`.
 * That put an empty list into the cache under the query's own key, so the
 * next time the driver typed the same place the coordinator answered
 * `cached` with zero places and the screen said "No places found. Try a
 * different search."
 *
 * That sentence was false. One network error, one 503, one expired pilot
 * session, and the app started telling a driver a truck stop does not
 * exist — without asking anyone, and without spending the request that
 * would have found it. The failure was durable: nothing evicted it until
 * eleven other queries pushed it out of a twelve-slot cache.
 *
 * So the two outcomes are now two methods, and the ambiguous one is
 * GONE rather than deprecated:
 *
 *   acceptSuccess(seq, places)  a provider ANSWER. May be cached — including
 *                               a genuinely empty one, which is real
 *                               knowledge and worth remembering.
 *   settleFailure(seq)          a failed ATTEMPT. Never cached, never
 *                               counted as knowledge; the query stays
 *                               eligible for another request.
 *
 * `settleFailure` takes no places, and `acceptSuccess` requires them, so
 * a caller cannot express "it failed" as "it succeeded with nothing"
 * without deliberately fabricating an empty array. Deleting `accept`
 * is the part that makes that a guarantee instead of a convention.
 *
 * ─────────────────────────────────────────────────────────────────────
 * AND A CACHE SLOT IS NOT THE QUERY ALONE.
 *
 * The provider's answer depends on more than the words typed: `country`
 * scopes the search to one nation, `endpoint` decides which door (and
 * therefore which access rule) it goes through, and the origin biases
 * both the ranking and the straight-line distances the driver reads off
 * the cards. All three are live props on a mounted search box — the
 * Navigator's border control sits directly under the search field and
 * flips `country` on the same component — so a key of "normalized query"
 * alone let a USA answer be served for a Canadian search, and let
 * distances measured from a hundred miles back stay on screen.
 *
 * The key therefore carries the whole context. It can only cause MORE
 * requests, never fewer, and only ones whose answers genuinely differ.
 * The origin component is the caller's own coarse bucket (see
 * `SearchContext.originKey`), so a parked truck's GPS jitter still shares
 * one slot — the property that stopped the 1 Hz re-request storm.
 */

import type { DestinationCandidate, SearchCountry } from './destination-search';
import { MIN_SEARCH_LENGTH } from './destination-search';

/**
 * Everything besides the typed words that changes what the provider
 * answers. Required, not optional: a caller that could omit it would be
 * back to keying on the query alone.
 */
export type SearchContext = {
  /** Which nation the search is scoped to (`in=countryCode:…`). */
  country: SearchCountry;
  /** Which first-party door the request goes through. */
  endpoint: string;
  /**
   * The caller's COARSE origin bucket, or null when the search is
   * unbiased. Deliberately a pre-bucketed string rather than a LatLng:
   * the component already derives one (~110 m) to keep a moving truck
   * from retriggering its effect every GPS tick, and cache identity must
   * be the same identity — two different notions of "the truck moved"
   * would drift apart and one of them would be wrong.
   */
  originKey: string | null;
};

export type SearchDecision =
  /** Nothing to search: too short, or a destination is already chosen. */
  | { kind: 'idle' }
  /** This exact query, in this exact context, was already answered. */
  | { kind: 'cached'; places: DestinationCandidate[] }
  /** Issue a provider request; quote `seq` back when it lands. */
  | { kind: 'request'; query: string; seq: number };

export type SearchCoordinator = {
  /** Decide what this query, in this context, deserves right now. */
  next(rawQuery: string, ctx: SearchContext, opts?: { settled?: boolean }): SearchDecision;
  /**
   * Report a provider ANSWER — the request completed and this is what it
   * said, even if that was nothing. Cached under the query's context.
   *
   * Returns false when it is STALE (a slower earlier request landing
   * after a newer one), in which case the caller must not let it touch
   * anything the driver can see.
   */
  acceptSuccess(seq: number, places: DestinationCandidate[]): boolean;
  /**
   * Report a failed ATTEMPT — network error, non-2xx, refusal, timeout,
   * malformed payload. NOTHING is cached: the only thing known is that
   * this try did not work, so the same query stays eligible for another
   * request.
   *
   * Returns false when the failure is stale, so an old failure can never
   * clear a newer search's results, status, or in-flight state.
   */
  settleFailure(seq: number): boolean;
  /** Abandon any in-flight request (selection, unmount, cleared box). */
  cancel(): void;
  /** Provider requests issued by this coordinator — bounded, and tested. */
  callCount(): number;
};

/** Answers to remember, so retyping a query costs nothing. */
export const SEARCH_CACHE_MAX = 12;

/** Collapse whitespace and case so equivalent typing shares a slot. */
function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * One cache slot. Every component is percent-encoded before joining, so
 * no value can impersonate a separator and collapse two distinct
 * contexts into one slot.
 */
export function searchCacheKey(ctx: SearchContext, normalizedQuery: string): string {
  return [ctx.country, ctx.endpoint, ctx.originKey ?? '', normalizedQuery]
    .map(encodeURIComponent)
    .join('|');
}

export function createSearchCoordinator(): SearchCoordinator {
  const cache = new Map<string, DestinationCandidate[]>();
  const pendingKeyBySeq = new Map<number, string>();
  let seq = 0;
  let currentSeq: number | null = null;
  let calls = 0;

  function next(
    rawQuery: string,
    ctx: SearchContext,
    opts: { settled?: boolean } = {},
  ): SearchDecision {
    const q = rawQuery.trim();
    if (opts.settled === true || q.length < MIN_SEARCH_LENGTH) {
      currentSeq = null;
      return { kind: 'idle' };
    }
    const key = searchCacheKey(ctx, normalizeQuery(q));
    const hit = cache.get(key);
    if (hit !== undefined) {
      // A cached answer is current by definition; nothing in flight may
      // overwrite it afterwards.
      currentSeq = null;
      return { kind: 'cached', places: hit.slice() };
    }
    seq += 1;
    calls += 1;
    currentSeq = seq;
    pendingKeyBySeq.set(seq, key);
    return { kind: 'request', query: q, seq };
  }

  function acceptSuccess(answeredSeq: number, places: DestinationCandidate[]): boolean {
    const key = pendingKeyBySeq.get(answeredSeq);
    pendingKeyBySeq.delete(answeredSeq);
    if (key !== undefined) {
      // A successful EMPTY answer is cached too. "The provider looked and
      // there is nothing there" is real knowledge, and re-asking spends a
      // transaction to be told the same thing.
      cache.set(key, places.slice());
      // Bound the cache; oldest out first.
      while (cache.size > SEARCH_CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
    }
    return answeredSeq === currentSeq;
  }

  function settleFailure(answeredSeq: number): boolean {
    // Retire the sequence so the map cannot grow without bound — but the
    // cache is not touched. A failed attempt teaches nothing about the
    // query, so the query keeps its right to another request.
    pendingKeyBySeq.delete(answeredSeq);
    return answeredSeq === currentSeq;
  }

  function cancel(): void {
    currentSeq = null;
  }

  return { next, acceptSuccess, settleFailure, cancel, callCount: () => calls };
}

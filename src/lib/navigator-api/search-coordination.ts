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
 */

import type { DestinationCandidate } from './destination-search';
import { MIN_SEARCH_LENGTH } from './destination-search';

export type SearchDecision =
  /** Nothing to search: too short, or a destination is already chosen. */
  | { kind: 'idle' }
  /** This exact query was already answered — reuse it, spend nothing. */
  | { kind: 'cached'; places: DestinationCandidate[] }
  /** Issue a provider request; quote `seq` back when it lands. */
  | { kind: 'request'; query: string; seq: number };

export type SearchCoordinator = {
  /** Decide what this query deserves right now. */
  next(rawQuery: string, opts?: { settled?: boolean }): SearchDecision;
  /**
   * Report a provider answer. Returns false when it is STALE — a slower
   * earlier request landing after a newer one — in which case the caller
   * must drop it rather than let it overwrite fresher results.
   */
  accept(seq: number, places: DestinationCandidate[]): boolean;
  /** Abandon any in-flight request (selection, unmount, cleared box). */
  cancel(): void;
  /** Provider requests issued by this coordinator — bounded, and tested. */
  callCount(): number;
};

/** Answers to remember, so retyping a query costs nothing. */
export const SEARCH_CACHE_MAX = 12;

export function createSearchCoordinator(): SearchCoordinator {
  const cache = new Map<string, DestinationCandidate[]>();
  const pendingQueryBySeq = new Map<number, string>();
  let seq = 0;
  let currentSeq: number | null = null;
  let calls = 0;

  /** Collapse whitespace and case so equivalent typing shares a slot. */
  const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

  function next(rawQuery: string, opts: { settled?: boolean } = {}): SearchDecision {
    const q = rawQuery.trim();
    if (opts.settled === true || q.length < MIN_SEARCH_LENGTH) {
      currentSeq = null;
      return { kind: 'idle' };
    }
    const key = normalize(q);
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
    pendingQueryBySeq.set(seq, key);
    return { kind: 'request', query: q, seq };
  }

  function accept(answeredSeq: number, places: DestinationCandidate[]): boolean {
    const key = pendingQueryBySeq.get(answeredSeq);
    pendingQueryBySeq.delete(answeredSeq);
    if (key !== undefined) {
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

  function cancel(): void {
    currentSeq = null;
  }

  return { next, accept, cancel, callCount: () => calls };
}

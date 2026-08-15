/**
 * Destination-search port (pilot round 1). The Navigator's architecture
 * keeps components fetch-free: every network call lives in a `*-port.ts`
 * module so the surface that can transmit anything is small, named, and
 * reviewable. `route-port.ts` is the routing path; this is the search
 * path, and both talk ONLY to first-party, flag-gated /api/navigator
 * endpoints.
 *
 * What crosses the wire: the driver's typed query and — when the truck
 * HAS a position — that position, so results are biased to where the
 * truck is. In the simplified startup flow the search can run before
 * location exists (permission is requested by the Start tap); then the
 * query travels ALONE and the server answers in its documented unbiased
 * mode. Nothing is stored, logged, or sent anywhere else — the same
 * discipline the route request already follows for origin/destination.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';

export type SearchFetchLike = (input: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export type SearchOutcome =
  | { kind: 'places'; places: DestinationCandidate[] }
  | { kind: 'failure'; reason: string };

/**
 * One search. Fail-soft by contract: a refusal or a malformed answer is a
 * reason string, never a throw, so the driving screen can never be broken
 * by a search.
 */
/**
 * The Navigator's own search door. Pilot-gated, because it fronts a pilot
 * surface and spends provider budget.
 */
export const NAVIGATOR_SEARCH_ENDPOINT = '/api/navigator/destination-search';

/**
 * Plan My Day's door onto the SAME search.
 *
 * The endpoint is a parameter rather than a fork because the search
 * itself is identical — same provider call, same region handling, same
 * candidate model, same parser. Only the access rule differs: Plan My Day
 * is a free public screen and its visitors hold no pilot cookie, so they
 * cannot be sent to the Navigator's door.
 */
export const TRIP_PLANNER_SEARCH_ENDPOINT = '/api/trip-planner/destination-search';

export async function searchDestinations(
  query: string,
  at: LatLng | null,
  fetchFn: SearchFetchLike = (input) => fetch(input),
  country: 'USA' | 'CAN' = 'USA',
  endpoint: string = NAVIGATOR_SEARCH_ENDPOINT,
): Promise<SearchOutcome> {
  const url =
    `${endpoint}?q=${encodeURIComponent(query)}` +
    (at === null ? '' : `&lat=${at.lat}&lng=${at.lng}`) +
    // The country the driver is searching. One country per request:
    // crossing the border is deliberate, never a side effect of typing.
    `&country=${country}`;
  let payload: unknown;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return { kind: 'failure', reason: 'search-unavailable' };
    payload = await res.json();
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
  const data = payload as { ok?: unknown; places?: unknown } | null;
  if (
    data === null ||
    typeof data !== 'object' ||
    data.ok !== true ||
    !Array.isArray(data.places)
  ) {
    return { kind: 'failure', reason: 'malformed-response' };
  }
  return { kind: 'places', places: data.places as DestinationCandidate[] };
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clientKey, errorJson } from '@/lib/trip-planner/api-util';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import {
  buildDiscoverUrl,
  parseDiscoverResponse,
  stripDistances,
  MIN_SEARCH_LENGTH,
  MAX_SEARCH_LENGTH,
  type SearchCountry,
} from '@/lib/navigator-api/destination-search';

/**
 * GET /api/trip-planner/destination-search — the same destination search
 * the Navigator uses, behind the door Plan My Day is allowed through.
 *
 * WHY THIS EXISTS RATHER THAN CALLING THE NAVIGATOR'S ENDPOINT.
 * `/api/navigator/destination-search` requires a signed pilot cookie, and
 * deliberately so: it spends provider budget and fronts a pilot surface
 * being road-tested. Plan My Day is a FREE, public screen. A driver on
 * /trip-planner has no pilot cookie, so pointing the search there would
 * 401 on every keystroke.
 *
 * The two honest ways out were a second doorway or widening the pilot
 * gate. Widening it would expose a pilot-budgeted endpoint to the open
 * internet as a side effect of a planner feature, which is a security
 * decision this milestone has no business making quietly.
 *
 * SO THIS IS A DOOR, NOT A SEARCH ENGINE. Every piece of actual search
 * behaviour is imported from `@/lib/navigator-api/destination-search` —
 * the same URL builder, the same `in=countryCode:` region handling that
 * gives accents, provinces and postal codes, the same response parser,
 * the same candidate model, the same unbiased-distance stripping, the
 * same length bounds. Nothing about places is decided here. If the
 * Navigator's search improves, this improves with it.
 *
 * What differs, and only this:
 *   - no pilot cookie is required;
 *   - the rate limiter is this route's own bucket, so public typing can
 *     never drain the pilot's allowance (or the reverse).
 *
 * The HERE key stays server-side. The response carries places only —
 * never the key, never an upstream URL.
 */

export const dynamic = 'force-dynamic';

/**
 * A separate bucket from the Navigator's, on purpose.
 *
 * Same 30/min/IP shape — typeahead is chattier than planning and the
 * client debounces on top — but a public screen and a pilot screen must
 * not be able to exhaust each other's budget.
 */
const searchLimiter = new RateLimiter({
  capacity: 30,
  refillPerSecond: 30 / 60,
  nowMs: () => Date.now(),
});

export async function GET(req: NextRequest) {
  /*
   * Configuration honesty before anything else a caller controls: no key
   * gets a distinct 503, never a silent empty list that a driver would
   * read as "there is no such place".
   */
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return errorJson(
      503,
      'provider-not-configured',
      'Destination search is unavailable: the provider key is not configured for this deploy context.',
    );
  }
  if (!searchLimiter.allow(clientKey(req))) {
    return errorJson(429, 'rate-limited', 'Too many searches — slow down.');
  }

  const params = req.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim();
  if (q.length < MIN_SEARCH_LENGTH) {
    return errorJson(422, 'query-too-short', `Enter at least ${MIN_SEARCH_LENGTH} characters.`);
  }
  if (q.length > MAX_SEARCH_LENGTH) {
    return errorJson(422, 'query-too-long', 'Search text is too long.');
  }

  /*
   * The origin is optional and biases results. Plan My Day has no GPS fix
   * — it is planned at a desk or in a bunk — so it normally searches
   * unbiased, and the shared module's documented unbiased mode strips the
   * straight-line distances that would otherwise describe the fallback
   * centre rather than the driver. A MALFORMED origin is still refused:
   * half an origin is a bug, not a request for the unbiased mode.
   */
  const rawLat = params.get('lat');
  const rawLng = params.get('lng');
  let at: { lat: number; lng: number } | null = null;
  if (rawLat !== null || rawLng !== null) {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return errorJson(422, 'origin-invalid', 'The search origin is not a real coordinate.');
    }
    at = { lat, lng };
  }

  /*
   * Validated against the two codes this app supports rather than
   * forwarded: `in=countryCode:…` is a provider parameter and an
   * arbitrary query-string value must never reach it.
   */
  const rawCountry = (params.get('country') ?? '').toUpperCase();
  const country: SearchCountry = rawCountry === 'CAN' ? 'CAN' : 'USA';

  try {
    const res = await fetch(buildDiscoverUrl(q, at, apiKey, undefined, country), {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) {
      // Honest and sanitized: the status only, never the body or the URL.
      return errorJson(502, `provider-http:${res.status}`, 'The search provider refused.');
    }
    const places = parseDiscoverResponse(await res.json());
    return NextResponse.json({ ok: true, places: at === null ? stripDistances(places) : places });
  } catch {
    return errorJson(504, 'provider-timeout', 'The search provider did not answer in time.');
  }
}

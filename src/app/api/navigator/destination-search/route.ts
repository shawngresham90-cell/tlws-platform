import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clientKey, errorJson } from '@/lib/trip-planner/api-util';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import { requestHasPilotAccess } from '@/lib/navigator-api/pilot-access';
import {
  buildDiscoverUrl,
  parseDiscoverResponse,
  stripDistances,
  MIN_SEARCH_LENGTH,
  MAX_SEARCH_LENGTH,
} from '@/lib/navigator-api/destination-search';

/**
 * GET /api/navigator/destination-search?q=…&lat=…&lng=… — the driver's
 * destination search (pilot round 1). Replaces coordinate entry: a driver
 * types an address, business, truck stop, warehouse, or city and picks a
 * real place. HERE `discover` answers businesses and addresses together,
 * biased around the truck's current position.
 *
 * Rails, in the same order as the route endpoint:
 * 1. FLAG-GATED: 404 while NEXT_PUBLIC_NAVIGATOR_ENABLED is unset, so
 *    merged code spends nothing in production.
 * 2. Configuration honesty: no key → a distinct 503, never a silent empty
 *    list that reads as "no such place".
 * 3. Rate limit: 30/min/IP — typeahead is chattier than planning, and the
 *    client debounces on top.
 * 4. Bounded input: query length capped, origin must be a real coordinate.
 *
 * The HERE key stays server-side; the response carries places only — never
 * the key, never an upstream URL.
 */

export const dynamic = 'force-dynamic';

const searchLimiter = new RateLimiter({
  capacity: 30,
  refillPerSecond: 30 / 60,
  nowMs: () => Date.now(),
});

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true') {
    return errorJson(404, 'not-enabled', 'Navigator is not enabled.');
  }
  // Rail 1c — pilot gate. Ordered AFTER the flag so a disabled deploy keeps
  // answering 404 (the route does not exist) rather than 401 (it exists,
  // guess the password). Before the limiter and the key check so an
  // unauthorized caller can neither spend a token nor probe configuration.
  if (!(await requestHasPilotAccess(req))) {
    return errorJson(401, 'pilot-access-required', 'Navigator pilot access is required.');
  }
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
   * The origin is OPTIONAL (startup simplification): the simplified flow
   * searches before location exists, because permission is requested by
   * the Start tap after the destination is chosen. Omitting BOTH params
   * selects the unbiased mode — the documented CONUS center stands in as
   * the spatial context (same parameter shape as every biased search)
   * and the straight-line distances are stripped, because a distance
   * from the unbiased center is not a distance from the truck. A
   * MALFORMED origin is still refused: half an origin is a bug, not a
   * request for the unbiased mode.
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

  try {
    const res = await fetch(buildDiscoverUrl(q, at, apiKey), {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) {
      // Honest, sanitized: the status only, never the body or the URL.
      return errorJson(502, `provider-http:${res.status}`, 'The search provider refused.');
    }
    const places = parseDiscoverResponse(await res.json());
    return NextResponse.json({ ok: true, places: at === null ? stripDistances(places) : places });
  } catch {
    return errorJson(504, 'provider-timeout', 'The search provider did not answer in time.');
  }
}

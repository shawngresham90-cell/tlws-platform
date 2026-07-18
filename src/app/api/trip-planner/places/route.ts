import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHereGeocodePort, MIN_QUERY_LENGTH } from '@/lib/trip-planner/here-geocode';
import { hereMatchesToPlaces } from '@/lib/trip-planner/place-search';
import { clientKey, errorJson } from '@/lib/trip-planner/api-util';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';

/**
 * GET /api/trip-planner/places?q=... — server-side free-text geocoding for
 * origin/destination search. Returns HERE matches only (the client merges in
 * its already-loaded directory anchors offline). The HERE key stays
 * server-side; responses carry processed coordinates only, never the key or
 * any upstream URL. Fail-soft: any HERE problem yields an empty list so the
 * directory picker still works.
 */

export const dynamic = 'force-dynamic';

// Search-specific limiter: typeahead is chattier than planning, but the
// client debounces and the adapter's hourly cap is the hard $0 backstop.
const searchLimiter = new RateLimiter({
  capacity: 30,
  refillPerSecond: 30 / 60, // 30 requests/minute per IP, per instance
  nowMs: () => Date.now(),
});

// Module-level so the geocode cache and free-tier counter survive warm
// serverless instances.
const geocode = createHereGeocodePort(async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  return { status: res.status, json: () => res.json() };
}, process.env.HERE_API_KEY);

const MAX_QUERY_LENGTH = 120;

export async function GET(req: NextRequest) {
  if (!searchLimiter.allow(clientKey(req))) {
    return errorJson(429, 'rate-limited', 'Too many searches — slow down.');
  }
  const raw = req.nextUrl.searchParams.get('q') ?? '';
  const q = raw.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return errorJson(422, 'query-too-short', `Enter at least ${MIN_QUERY_LENGTH} characters.`);
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return errorJson(422, 'query-too-long', 'Search text is too long.');
  }
  const matches = await geocode.search(q);
  return NextResponse.json({ ok: true, places: hereMatchesToPlaces(matches) });
}

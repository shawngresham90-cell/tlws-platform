import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadPlannerAnchors } from '@/lib/trip-planner/directory-loader';
import { clientKey } from '@/lib/trip-planner/api-util';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';

// Always live: this endpoint is the client-side FALLBACK for when the
// server-rendered anchor list came up empty — caching an empty response
// here would defeat exactly that recovery path.
export const dynamic = 'force-dynamic';

// Own bucket, not the shared POST limiter: the legitimate call pattern is at
// most one request per page load (and only when the SSR list was empty), so
// 10/minute is generous for drivers and stingy for scrapers. This was the
// one planner endpoint with no limiter at all — an unauthenticated GET whose
// handler runs a full directory scan is the cheapest amplification target in
// the subsystem without it.
const limiter = new RateLimiter({
  capacity: 10,
  refillPerSecond: 10 / 60,
  nowMs: () => Date.now(),
});

/** GET /api/trip-planner/anchors — geocoded origin/destination options. */
export async function GET(req: NextRequest) {
  if (!limiter.allow(clientKey(req))) {
    return NextResponse.json(
      { ok: false, error: { code: 'rate-limited', message: 'Too many requests' } },
      { status: 429 },
    );
  }
  const anchors = await loadPlannerAnchors();
  return NextResponse.json({ ok: true, anchors });
}

import { NextResponse } from 'next/server';
import { loadPlannerAnchors } from '@/lib/trip-planner/directory-loader';

// Always live: this endpoint is the client-side FALLBACK for when the
// server-rendered anchor list came up empty — caching an empty response
// here would defeat exactly that recovery path.
export const dynamic = 'force-dynamic';

/** GET /api/trip-planner/anchors — geocoded origin/destination options. */
export async function GET() {
  const anchors = await loadPlannerAnchors();
  return NextResponse.json({ ok: true, anchors });
}

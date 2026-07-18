import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routeQuoteRequestSchema } from '@/lib/trip-planner/api-contracts';
import { validateClockState } from '@/lib/trip-planner/hos-engine';
import { quickEta } from '@/lib/trip-planner/optimizer';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';

/** POST /api/trip-planner/route — HOS-correct quick ETA, no stop selection. */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, routeQuoteRequestSchema);
  if ('response' in guarded) return guarded.response;
  const data = guarded.data;
  const problems = validateClockState(data.clocks);
  if (problems.length > 0) return errorJson(422, 'bad-clocks', 'Clock state invalid.', problems);
  const eta = quickEta(data);
  return NextResponse.json({ ok: true, ...eta });
}

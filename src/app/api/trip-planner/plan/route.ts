import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { planTripRequestSchema } from '@/lib/trip-planner/api-contracts';
import { validateClockState } from '@/lib/trip-planner/hos-engine';
import { planTrip } from '@/lib/trip-planner/optimizer';
import { estimateTripCost } from '@/lib/trip-planner/cost-engine';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';

/** POST /api/trip-planner/plan — full itinerary + cost from a complete request. */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, planTripRequestSchema);
  if ('response' in guarded) return guarded.response;
  const data = guarded.data;
  const problems = validateClockState(data.clocks);
  if (problems.length > 0) return errorJson(422, 'bad-clocks', 'Clock state invalid.', problems);
  const itinerary = planTrip(data);
  const cost = estimateTripCost(data.route, itinerary, data.truck, data.cost);
  return NextResponse.json({ ok: true, itinerary, cost, warnings: itinerary.warnings });
}

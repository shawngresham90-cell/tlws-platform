import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { costEstimateRequestSchema } from '@/lib/trip-planner/api-contracts';
import { estimateTripCost, validateCostInputs } from '@/lib/trip-planner/cost-engine';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';

/** POST /api/trip-planner/cost — cost estimate for a route + itinerary shape. */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, costEstimateRequestSchema);
  if ('response' in guarded) return guarded.response;
  const { route, totalMinutes, overnightStops, truck, inputs } = guarded.data;
  const problems = validateCostInputs(inputs);
  if (problems.length > 0)
    return errorJson(422, 'bad-cost-inputs', 'Cost inputs invalid.', problems);
  const itinerary = {
    totalMinutes,
    stops: Array.from({ length: overnightStops }, () => ({ kind: 'overnight' as const })),
  };
  const estimate = estimateTripCost(route, itinerary as never, truck, inputs);
  return NextResponse.json({ ok: true, estimate });
}

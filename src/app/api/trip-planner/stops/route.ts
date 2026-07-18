import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { stopSearchRequestSchema } from '@/lib/trip-planner/api-contracts';
import { rankCandidates } from '@/lib/trip-planner/directory-layer';
import { guardedParse } from '@/lib/trip-planner/api-util';

/** POST /api/trip-planner/stops — ranked candidates for a need in a window. */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, stopSearchRequestSchema);
  if ('response' in guarded) return guarded.response;
  const { need, candidates, window, preferredFuelBrands, limit } = guarded.data;
  const results = rankCandidates(candidates, need, window, { preferredFuelBrands }).slice(0, limit);
  return NextResponse.json({ ok: true, results });
}

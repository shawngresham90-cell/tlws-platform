import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hosSimulateRequestSchema } from '@/lib/trip-planner/api-contracts';
import { advance, remainingClocks, validateClockState } from '@/lib/trip-planner/hos-engine';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';
import type { HosViolation } from '@/lib/trip-planner/types';

/** POST /api/trip-planner/hos — clock simulation over duty segments. */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, hosSimulateRequestSchema);
  if ('response' in guarded) return guarded.response;
  const { clocks, segments } = guarded.data;
  const problems = validateClockState(clocks);
  if (problems.length > 0) return errorJson(422, 'bad-clocks', 'Clock state invalid.', problems);
  let state = clocks;
  const violations: HosViolation[] = [];
  for (const seg of segments) {
    const step = advance(state, seg.status, seg.minutes);
    state = step.state;
    violations.push(...step.violations);
  }
  return NextResponse.json({
    ok: true,
    finalState: state,
    remaining: remainingClocks(state),
    violations,
  });
}

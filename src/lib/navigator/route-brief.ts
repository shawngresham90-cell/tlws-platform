/**
 * Route briefing summarizer (Design Blueprint Phase 3).
 *
 * The flight-briefing screen wants "what major roads does this route
 * use?" answered in one glance. The answer here is built ONLY from what
 * the provider itself said: each maneuver's instruction names the road
 * the truck ends up on (extracted by the same `roadNameFromInstruction`
 * parser the driving banner already trusts), and consecutive maneuvers'
 * exact route miles — resolved from the provider's own geometry when the
 * session was created — say how far the truck stays on it. Nothing is
 * inferred from raw geometry, and a maneuver whose instruction names no
 * road contributes nothing.
 *
 * Roads are reported in the order the driver will MEET them, not by
 * size: "US-41, then I-75 N, then GA-120" is the story of the drive,
 * and a magnitude sort would shuffle it. Minor connectors below the
 * mileage floor stay out so the summary reads as corridors, not as
 * turn-by-turn instructions before driving.
 *
 * Pure: values in, values out. No clock, no I/O, no globals.
 */

import { roadNameFromInstruction } from './maneuver-text';

export type RouteRoad = Readonly<{
  /** The provider's own road name, exactly as its instruction stated it. */
  name: string;
  /** Miles the route stays on it (summed across revisits), one decimal. */
  miles: number;
}>;

/** A road must carry at least this much of the drive to be a "major" road. */
export const MIN_CORRIDOR_MILES = 1;

/** The summary is a glance, not a log. */
export const MAX_CORRIDOR_ROADS = 4;

export function summarizeRouteRoads(
  maneuvers: readonly { instruction: string; mileMi: number }[],
  totalMiles: number | null,
): RouteRoad[] {
  if (maneuvers.length === 0) return [];
  const total =
    totalMiles !== null && Number.isFinite(totalMiles) && totalMiles > 0 ? totalMiles : null;

  // Accumulate miles per road name, remembering first-appearance order.
  const miles = new Map<string, number>();
  const order: string[] = [];
  for (let i = 0; i < maneuvers.length; i++) {
    const m = maneuvers[i];
    if (!Number.isFinite(m.mileMi) || m.mileMi < 0) continue;
    const name = roadNameFromInstruction(m.instruction);
    if (name === null) continue;
    const endMi = i + 1 < maneuvers.length ? maneuvers[i + 1].mileMi : (total ?? m.mileMi);
    const span = endMi - m.mileMi;
    if (!Number.isFinite(span) || span <= 0) continue;
    if (!miles.has(name)) order.push(name);
    miles.set(name, (miles.get(name) ?? 0) + span);
  }

  const majors = order
    .map((name) => ({ name, miles: Math.round((miles.get(name) ?? 0) * 10) / 10 }))
    .filter((r) => r.miles >= MIN_CORRIDOR_MILES);
  return majors.slice(0, MAX_CORRIDOR_ROADS);
}

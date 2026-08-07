/**
 * Display helpers for the driving HUD (map-first milestone): the arrival
 * estimate and the road name shown on the maneuver card.
 *
 * Both are deliberately conservative. An ETA that jitters every second is
 * worse than no ETA, and a road name guessed wrong is worse than a blank
 * line — so each returns null rather than something the driver would have
 * to double-check.
 *
 * Pure: values in, strings out. The caller supplies the clock.
 */

/** ETA rounds to this, so the minute digit does not flicker while driving. */
export const ETA_ROUNDING_MIN = 5;

/**
 * Remaining seconds from route progress. Uses the PROVIDER's planned
 * duration scaled by the fraction of the route still ahead, rather than
 * live speed — live speed swings wildly at lights and in traffic, and the
 * provider's number already accounts for the road types on the way.
 */
export function remainingSeconds(
  remainingMi: number | null,
  totalMi: number | null,
  durationSeconds: number | null,
): number | null {
  if (remainingMi === null || totalMi === null || durationSeconds === null) return null;
  if (!Number.isFinite(remainingMi) || !Number.isFinite(totalMi) || totalMi <= 0) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const fraction = Math.min(1, Math.max(0, remainingMi / totalMi));
  return durationSeconds * fraction;
}

/**
 * Epoch ms of arrival, rounded to the ETA granularity. Null when the trip
 * has no usable estimate.
 */
export function etaEpochMs(
  remainingMi: number | null,
  totalMi: number | null,
  durationSeconds: number | null,
  nowMs: number,
): number | null {
  const secs = remainingSeconds(remainingMi, totalMi, durationSeconds);
  if (secs === null || !Number.isFinite(nowMs)) return null;
  const roundMs = ETA_ROUNDING_MIN * 60_000;
  return Math.round((nowMs + secs * 1000) / roundMs) * roundMs;
}

/**
 * 12-hour clock text for an epoch time, e.g. "3:45 PM".
 *
 * The caller supplies the zone offset (what `Date.prototype.getTimezoneOffset`
 * returns: minutes BEHIND UTC, positive west) rather than this module
 * reading the platform clock — the navigator core stays pure, and the
 * output is deterministic in tests.
 */
export function formatClockTime(epochMs: number, tzOffsetMinutes: number): string {
  const localMs = epochMs - tzOffsetMinutes * 60_000;
  const minutesOfDay = ((Math.floor(localMs / 60_000) % 1440) + 1440) % 1440;
  let hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * Clock-time arrival, e.g. "3:45 PM". Rounded to the nearest 5 minutes so
 * the minute digit does not flicker. Null when there is nothing to
 * estimate — the caller shows a dash.
 */
export function formatEta(
  remainingMi: number | null,
  totalMi: number | null,
  durationSeconds: number | null,
  nowMs: number,
  tzOffsetMinutes: number,
): string | null {
  const arriveMs = etaEpochMs(remainingMi, totalMi, durationSeconds, nowMs);
  if (arriveMs === null) return null;
  return formatClockTime(arriveMs, tzOffsetMinutes);
}

/** Longest road name worth putting on the card. */
const MAX_ROAD_NAME = 40;

/**
 * Best-effort road name out of a provider instruction.
 *
 * HERE's turn-by-turn text names the road the maneuver puts you on
 * ("Turn right onto Battlefield Parkway"), so the name is genuinely IN the
 * data — it is read here, never invented. A dedicated field would be
 * better (it needs `return=spans` with road names, a provider-request
 * change that is out of scope for a UI milestone), so anything that does
 * not match an explicit "onto"/"toward" phrasing returns null and the card
 * simply shows no road line.
 */
export function roadNameFromInstruction(instruction: string | null | undefined): string | null {
  if (typeof instruction !== 'string' || instruction.trim() === '') return null;
  // "…onto Battlefield Pkwy." / "…toward I-75 South." — stop at sentence
  // end or a trailing clause so the name never swallows the rest.
  const match = /\b(?:onto|toward|towards|on)\s+([^.,;]+)/i.exec(instruction);
  if (!match) return null;
  const name = match[1].trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > MAX_ROAD_NAME) return null;
  // A "road name" that is really a direction word is not a road name.
  if (/^(the|left|right|ramp|exit|highway|freeway|street|road)$/i.test(name)) return null;
  return name;
}

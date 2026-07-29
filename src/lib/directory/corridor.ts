import type { DirectoryEntry } from './types';

/**
 * Corridor flow engine — the Parking → State → Interstate → Direction →
 * ordered-list navigation (driver-first redesign, 2026-07-28).
 *
 * Honesty rules, non-negotiable:
 * - A position is labeled "MM" ONLY when the record carries a separately
 *   verified mile-marker value (`entry.mileMarker`, from `locations.
 *   mile_marker` — migration 047). No row carries one yet, so in practice
 *   every position is still an exit. An exit number is NEVER relabeled as a
 *   mile marker — not in the label, the sort, the query, or the tests.
 * - Overnight truth comes from `overnight_status` only; the unevidenced
 *   legacy boolean never produces a confirmed claim (see overnightLabel).
 * - Without a verified mile marker, position comes ONLY from a strictly
 *   parseable exit number ("41", "41A") and is labeled "EXIT". Compound or
 *   free-text values ("11/I-49, Exit 39", "Third St") are NEVER guessed —
 *   those listings go to the separate "Route position not verified" section.
 * - Exit-number ordering is APPROXIMATE route order (exit numbers follow
 *   mile markers in most states); the UI says so in plain words.
 * - "Direction" selects the ORDER OF TRAVEL (route positions ascend
 *   south→north and west→east on U.S. interstates), not a claim about which
 *   side of the highway a facility sits on. Most exits serve both
 *   directions; the UI says so.
 */

/** Categories a driver can actually park a truck in. */
export const PARKING_CATEGORIES = ['parking', 'truck-stops', 'rest-areas', 'hotels-truck-parking'];

/**
 * Strict exit-number parser. Accepts "41", "41A", "41b", with surrounding
 * whitespace. Anything else — compounds, ranges, street names — returns
 * null (unverified position, never guessed).
 */
export function parseExitPosition(exitNumber: string | null | undefined): number | null {
  if (!exitNumber) return null;
  const m = /^\s*(\d{1,4})\s*[A-Za-z]?\s*$/.exec(exitNumber);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export type CorridorDirection = 'northbound' | 'southbound' | 'eastbound' | 'westbound';

/**
 * The two travel directions for an interstate designation. Odd route
 * numbers run north–south, even run east–west (US interstate convention;
 * three-digit auxiliaries inherit their parent's last digit).
 */
export function directionsForInterstate(
  designation: string,
): [CorridorDirection, CorridorDirection] {
  const m = /^I-(\d+)$/i.exec(designation.trim());
  const num = m ? parseInt(m[1], 10) : NaN;
  const odd = Number.isFinite(num) ? num % 2 === 1 : false;
  return odd ? ['northbound', 'southbound'] : ['eastbound', 'westbound'];
}

/** Ascending exits = increasing mileage = north/east travel. */
export function sortOrderForDirection(direction: CorridorDirection): 'asc' | 'desc' {
  return direction === 'northbound' || direction === 'eastbound' ? 'asc' : 'desc';
}

export function isCorridorDirection(value: string): value is CorridorDirection {
  return (
    value === 'northbound' ||
    value === 'southbound' ||
    value === 'eastbound' ||
    value === 'westbound'
  );
}

/** URL segment ("i-75") ↔ designation ("I-75"). */
export function interstateFromSlug(slug: string): string | null {
  const m = /^i-(\d{1,3})$/.exec(slug.toLowerCase().trim());
  return m ? `I-${m[1]}` : null;
}
export function interstateToSlug(designation: string): string {
  return designation.toLowerCase();
}

export type RoutePositionKind = 'mile-marker' | 'exit';

export type CorridorListing = {
  entry: DirectoryEntry;
  /** Numeric route position (verified MM value, else exit number), or null. */
  position: number | null;
  /** What the position IS: a verified mile marker or an exit number. */
  positionKind: RoutePositionKind | null;
  /** Card label, e.g. "MM 71.5" or "EXIT 41A". Null when unverified. */
  positionLabel: string | null;
};

export type CorridorList = {
  /** Position-verified listings, ascending by route position then name. */
  positioned: CorridorListing[];
  /** Listings with no verified route position — never mixed in. */
  unpositioned: CorridorListing[];
};

/** "71.5" → "MM 71.5", "72" → "MM 72" — decimals kept, no padding. */
function mileMarkerLabel(value: number): string {
  return `MM ${Number(value.toFixed(1))}`;
}

/**
 * Resolve a listing's route position. Verified mile marker wins and is
 * labeled "MM"; otherwise a strictly-parseable exit number is used for
 * approximate ordering and labeled "EXIT" — never "MM". Anything else is
 * null (Route position not verified).
 */
export function resolveRoutePosition(
  entry: Pick<DirectoryEntry, 'mileMarker' | 'exitNumber'>,
): { position: number; positionKind: RoutePositionKind; positionLabel: string } | null {
  const mm = entry.mileMarker;
  if (typeof mm === 'number' && Number.isFinite(mm) && mm >= 0) {
    return { position: mm, positionKind: 'mile-marker', positionLabel: mileMarkerLabel(mm) };
  }
  const exit = parseExitPosition(entry.exitNumber ?? null);
  if (exit !== null) {
    return {
      position: exit,
      positionKind: 'exit',
      positionLabel: `EXIT ${entry.exitNumber!.trim().toUpperCase()}`,
    };
  }
  return null;
}

/**
 * Split + order a corridor's entries. `positioned` is returned ascending
 * by route position (verified mile markers and exit numbers share the
 * mileage scale — exit numbers follow mile markers in most states, which
 * the UI states in plain words); the UI flips it for the LOW↔HIGH toggle /
 * travel direction.
 */
export function buildCorridorList(entries: DirectoryEntry[]): CorridorList {
  const positioned: CorridorListing[] = [];
  const unpositioned: CorridorListing[] = [];
  for (const entry of entries) {
    const resolved = resolveRoutePosition(entry);
    if (resolved === null) {
      unpositioned.push({ entry, position: null, positionKind: null, positionLabel: null });
    } else {
      positioned.push({ entry, ...resolved });
    }
  }
  positioned.sort((a, b) => a.position! - b.position! || a.entry.name.localeCompare(b.entry.name));
  unpositioned.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  return { positioned, unpositioned };
}

/** "42 truck spaces" · "Truck spaces unknown" · zero → operator-reported none. */
export function spacesLabel(parkingSpaces: number | undefined): string {
  if (typeof parkingSpaces !== 'number' || !Number.isFinite(parkingSpaces)) {
    return 'Truck spaces unknown';
  }
  if (parkingSpaces === 0) return 'No truck parking (operator-reported)';
  return `${parkingSpaces} truck spaces`;
}

/** Free / Paid / Reserved chips from the entry's amenity chips. */
export function costChips(entry: DirectoryEntry): string[] {
  const chips: string[] = [];
  const set = new Set((entry.amenities ?? []).map((a) => a.toLowerCase()));
  if (set.has('free parking')) chips.push('FREE');
  if (set.has('paid parking')) chips.push('PAID');
  if (set.has('reserved')) chips.push('RESERVED');
  return chips;
}

export type OvernightLabel = 'Overnight confirmed' | 'Overnight prohibited' | 'Overnight unknown';

/**
 * Overnight truth comes from `overnight_status` (migration 047) — the
 * evidence-backed three-way column — and from nothing else.
 *
 * The legacy `overnight_parking` boolean (surfaced as the "Overnight OK"
 * amenity chip) is deliberately NOT consulted: it was set by imports that
 * carried no evidence, so reading it here would relabel 330 unreviewed
 * legacy rows as a confirmed driver-facing claim. Those rows read
 * "unknown" until a reviewed source upgrades them (Option A). A row is
 * only ever "prohibited" when explicit statute or policy wording was
 * recorded with a provenance source.
 */
export function overnightLabel(entry: DirectoryEntry): OvernightLabel {
  if (entry.overnightStatus === 'confirmed') return 'Overnight confirmed';
  if (entry.overnightStatus === 'prohibited') return 'Overnight prohibited';
  return 'Overnight unknown';
}

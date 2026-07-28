import type { DirectoryEntry } from './types';

/**
 * Corridor flow engine — the Parking → State → Interstate → Direction →
 * ordered-list navigation (driver-first redesign, 2026-07-28).
 *
 * Honesty rules, non-negotiable:
 * - A listing's position comes ONLY from a strictly parseable exit number
 *   ("41", "41A"). Compound or free-text values ("11/I-49, Exit 39",
 *   "Third St") are NEVER guessed — those listings go to the separate
 *   "position not verified" section.
 * - "Direction" selects the ORDER OF TRAVEL (exit numbers ascend south→north
 *   and west→east on U.S. interstates), not a claim about which side of the
 *   highway a facility sits on. Most exits serve both directions; the UI
 *   says so.
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

export type CorridorListing = {
  entry: DirectoryEntry;
  /** Verified numeric exit position, or null (unverified section). */
  position: number | null;
  /** Card label for the big number, e.g. "EXIT 41A". Null when unverified. */
  positionLabel: string | null;
};

export type CorridorList = {
  /** Position-verified listings, ascending by exit then name. */
  positioned: CorridorListing[];
  /** Listings without a strictly-parseable exit — never mixed in. */
  unpositioned: CorridorListing[];
};

/**
 * Split + order a corridor's entries. `positioned` is returned ascending;
 * the UI flips it for the LOW↔HIGH toggle / travel direction.
 */
export function buildCorridorList(entries: DirectoryEntry[]): CorridorList {
  const positioned: CorridorListing[] = [];
  const unpositioned: CorridorListing[] = [];
  for (const entry of entries) {
    const position = parseExitPosition(entry.exitNumber ?? null);
    if (position === null) {
      unpositioned.push({ entry, position: null, positionLabel: null });
    } else {
      positioned.push({
        entry,
        position,
        positionLabel: `EXIT ${entry.exitNumber!.trim().toUpperCase()}`,
      });
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

/** Overnight is CONFIRMED only when the row says so; everything else is unknown. */
export function overnightLabel(entry: DirectoryEntry): 'Overnight confirmed' | 'Overnight unknown' {
  const set = new Set((entry.amenities ?? []).map((a) => a.toLowerCase()));
  return set.has('overnight ok') ? 'Overnight confirmed' : 'Overnight unknown';
}

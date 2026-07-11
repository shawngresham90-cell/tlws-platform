import type { DirectoryEntry } from './types';

/**
 * Related-content helpers (Milestone 18 SEO): pure functions that turn a
 * page's entry set into "nearby by category" groups and adjacent-exit hops.
 * Everything derives from state/interstate/exit data — no coordinates or map
 * required, so it works for every listing today.
 */

/** The four categories surfaced as "Nearby X" sections. */
export const NEARBY_CATEGORIES = [
  { slug: 'truck-stops', heading: 'Nearby Truck Stops' },
  { slug: 'parking', heading: 'Nearby Truck Parking' },
  { slug: 'cat-scales', heading: 'Nearby CAT Scales' },
  { slug: 'truck-washes', heading: 'Nearby Truck Washes' },
] as const;

export function groupByCategory(entries: DirectoryEntry[]): Record<string, DirectoryEntry[]> {
  const groups: Record<string, DirectoryEntry[]> = {};
  for (const e of entries) (groups[e.category] ??= []).push(e);
  return groups;
}

const exitNumberOf = (e: DirectoryEntry): number | null => {
  const n = parseFloat((e.exitNumber ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Entries "near" an exit: same corridor, same state(s) as the exit, within
 * `windowMiles` exit numbers (interstate exits are mile-based), excluding the
 * exit itself. Sorted by how close their exit is.
 */
export function entriesNearExit(
  corridorEntries: DirectoryEntry[],
  exit: string,
  statesAtExit: string[],
  windowMiles = 25,
): DirectoryEntry[] {
  const target = parseFloat(exit.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(target)) return [];
  const states = new Set(statesAtExit.map((s) => s.toUpperCase()));
  return corridorEntries
    .filter((e) => {
      if (e.exitNumber === exit) return false;
      if (!states.has(e.state.toUpperCase())) return false;
      const n = exitNumberOf(e);
      return n != null && Math.abs(n - target) <= windowMiles;
    })
    .sort((a, b) => {
      const da = Math.abs((exitNumberOf(a) ?? 0) - target);
      const db = Math.abs((exitNumberOf(b) ?? 0) - target);
      return da - db;
    });
}

/** Previous/next exits with coverage on a corridor (numeric order). */
export function adjacentExits(
  exits: string[],
  current: string,
  span = 2,
): { previous: string[]; next: string[] } {
  const sorted = [...exits].sort(
    (a, b) => parseFloat(a.replace(/[^\d.]/g, '')) - parseFloat(b.replace(/[^\d.]/g, '')),
  );
  const i = sorted.indexOf(current);
  if (i === -1) return { previous: [], next: [] };
  return {
    previous: sorted.slice(Math.max(0, i - span), i),
    next: sorted.slice(i + 1, i + 1 + span),
  };
}

/** Distinct interstates present in a set of entries, sorted. */
export function interstatesIn(entries: DirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.interstate).filter((i): i is string => Boolean(i)))].sort();
}

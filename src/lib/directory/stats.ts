import type { DirectoryEntry } from './types';
import { getCategory } from './categories';
import { stateByCode } from './states';

/**
 * Location statistics (Search & Revenue Optimization): pure derivations over
 * the published listing set for the /directory/stats page. Every number is
 * computed from real data — nothing is estimated or invented, and listings
 * without the relevant field simply don't participate in that ranking.
 */

export type StatEntry = { entry: DirectoryEntry; value: number };
export type StateCount = { state: string; stateName: string; count: number };

/** Largest truck stops by verified parking-space count (unknown counts excluded). */
export function largestTruckStops(entries: DirectoryEntry[], limit = 10): StatEntry[] {
  return entries
    .filter((e) => e.category === 'truck-stops' && (e.parkingSpaces ?? 0) > 0)
    .map((entry) => ({ entry, value: entry.parkingSpaces as number }))
    .sort((a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
}

/** States ranked by how many listings of one category they have. */
export function statesByCategory(
  entries: DirectoryEntry[],
  categorySlug: string,
  limit = 5,
): StateCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.category !== categorySlug) continue;
    counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, stateName: stateByCode(state)?.name ?? state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
    .slice(0, limit);
}

export type CategoryTotal = { slug: string; title: string; count: number };

/** Overall listing counts per category, biggest first. */
export function categoryTotals(entries: DirectoryEntry[]): CategoryTotal[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, title: getCategory(slug)?.title ?? slug, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

/** Total verified truck-parking spaces across listings that publish a count. */
export function totalKnownParkingSpaces(entries: DirectoryEntry[]): {
  spaces: number;
  listings: number;
} {
  let spaces = 0;
  let listings = 0;
  for (const e of entries) {
    if ((e.parkingSpaces ?? 0) > 0) {
      spaces += e.parkingSpaces as number;
      listings += 1;
    }
  }
  return { spaces, listings };
}

/** Interstates ranked by listing coverage. */
export function interstatesByCoverage(
  entries: DirectoryEntry[],
  limit = 10,
): { interstate: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.interstate) continue;
    counts.set(e.interstate, (counts.get(e.interstate) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([interstate, count]) => ({ interstate, count }))
    .sort((a, b) => b.count - a.count || a.interstate.localeCompare(b.interstate))
    .slice(0, limit);
}

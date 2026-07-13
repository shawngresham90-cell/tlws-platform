import type { DirectoryEntry } from './types';

/**
 * Brand derivation for Browse-by-Brand (Search & Revenue Optimization).
 * Brands are NOT a database column — they are derived, purely and
 * deterministically, from the business name each listing already carries.
 * Only chains that actually appear in the directory are registered; a
 * listing that matches no pattern simply has no brand (independents).
 */

export type DirectoryBrand = {
  /** URL segment under /directory/browse/brands/. */
  slug: string;
  name: string;
  /** Lowercased name prefixes/tokens that identify the brand. */
  patterns: string[];
};

export const DIRECTORY_BRANDS: DirectoryBrand[] = [
  { slug: 'pilot', name: 'Pilot', patterns: ['pilot travel center', 'pilot #', 'pilot truck care'] },
  { slug: 'flying-j', name: 'Flying J', patterns: ['flying j'] },
  { slug: 'loves', name: "Love's", patterns: ["love's"] },
  { slug: 'ta', name: 'TA · TravelCenters of America', patterns: ['ta ', 'ta express', 'ta truck service', 'travelcenters of america', 'ta caryville', 'petro'] },
  { slug: 'one9', name: 'ONE9', patterns: ['one9'] },
  { slug: 'speedco', name: 'Speedco', patterns: ['speedco'] },
  { slug: 'cat-scale', name: 'CAT Scale', patterns: ['cat scale'] },
  { slug: 'blue-beacon', name: 'Blue Beacon', patterns: ['blue beacon'] },
  { slug: 'southern-tire-mart', name: 'Southern Tire Mart', patterns: ['southern tire mart'] },
  { slug: 'road-ranger', name: 'Road Ranger', patterns: ['road ranger'] },
  { slug: 'quiktrip', name: 'QuikTrip', patterns: ['quiktrip'] },
  { slug: 'weigels', name: "Weigel's", patterns: ["weigel's"] },
  { slug: 'speedway', name: 'Speedway', patterns: ['speedway'] },
  { slug: 'circle-k', name: 'Circle K', patterns: ['circle k'] },
  { slug: 'mapco', name: 'MAPCO', patterns: ['mapco'] },
  { slug: 'truck-parking-club', name: 'Truck Parking Club', patterns: ['truck parking club'] },
];

const BY_SLUG = new Map(DIRECTORY_BRANDS.map((b) => [b.slug, b]));

export function brandBySlug(slug: string): DirectoryBrand | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

/**
 * The brand a listing belongs to, by name match — longest pattern wins so
 * "TA Truck Service at Petro" style names resolve deterministically.
 */
export function brandOf(e: Pick<DirectoryEntry, 'name'>): DirectoryBrand | undefined {
  const n = e.name.toLowerCase();
  let winner: DirectoryBrand | undefined;
  let winnerLen = 0;
  for (const brand of DIRECTORY_BRANDS) {
    for (const p of brand.patterns) {
      // Prefix or word-boundary containment ("CAT Scale at ONE9 …" belongs
      // to CAT Scale only when it *starts* the name; interior mentions are
      // host references).
      if (n.startsWith(p) && p.length > winnerLen) {
        winner = brand;
        winnerLen = p.length;
      }
    }
  }
  return winner;
}

export type BrandGroup = { brand: DirectoryBrand; entries: DirectoryEntry[] };

/** Group entries by derived brand (unbranded/independent entries omitted). */
export function groupByBrand(entries: DirectoryEntry[]): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();
  for (const e of entries) {
    const brand = brandOf(e);
    if (!brand) continue;
    const g = groups.get(brand.slug) ?? { brand, entries: [] };
    g.entries.push(e);
    groups.set(brand.slug, g);
  }
  return [...groups.values()].sort((a, b) => b.entries.length - a.entries.length);
}

/** URL segment for a city page: "West Memphis" + "AR" → "west-memphis-ar". */
export function citySlug(city: string, state: string): string {
  return `${city} ${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export type CityGroup = { city: string; state: string; slug: string; entries: DirectoryEntry[] };

/** Group entries by city+state, biggest cities first. */
export function groupByCity(entries: DirectoryEntry[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();
  for (const e of entries) {
    const slug = citySlug(e.city, e.state);
    const g = groups.get(slug) ?? { city: e.city, state: e.state, slug, entries: [] };
    g.entries.push(e);
    groups.set(slug, g);
  }
  return [...groups.values()].sort(
    (a, b) => b.entries.length - a.entries.length || a.city.localeCompare(b.city),
  );
}

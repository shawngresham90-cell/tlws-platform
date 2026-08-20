import type { DirectoryEntry } from './types';
import { buildSearchText } from './browse';

/**
 * What crosses the server/client boundary on the directory's interactive
 * surfaces (DIR-PAYLOAD-1).
 *
 * `DirectoryEntry` mirrors the `locations` row and is the right shape for
 * SERVER work — the indexability gate reads `storedAmenities`, the FAQ builder
 * reads `overnightStatus`, the sitemap reads `updatedAt`. None of that is
 * needed in a browser, and shipping it is not free: on /directory/truck-stops
 * the 1,882 serialized rows were 1,667 kB raw / 122 kB Brotli, of which three
 * fields (`indexable`, `mileMarkerSource`, `overnightStatusSource`) had no
 * reader ANYWHERE in the repository and six more were read only on the server.
 *
 * So the data layer keeps returning whole rows and these projections are
 * applied at the boundary, by the server component, on the way into a client
 * island. Nothing about eligibility, completeness or RLS changes — this is a
 * narrowing of what gets serialized, not of what gets read.
 *
 * Three shapes, because the surfaces genuinely need different things:
 *
 *   DirectoryCardEntry       what a rendered listing card shows, plus what
 *                            browse search/sort reads. Used by EntryCard and
 *                            by MultiCategoryBrowser's local filtering.
 *   DirectoryBrowseIndexEntry a COMPLETE, compact index for one category's
 *                            search/filter/sort. Card fields are not in it;
 *                            they are fetched for the visible window only.
 *   DirectoryMapEntry        markers, map filters, map result cards,
 *                            directions and deep links.
 */

/* ------------------------------------------------------------------ card */

/**
 * One listing as a card renders it, plus the fields local browse search and
 * sorting read (zip / interstate / exit / category / amenities / description
 * feed the haystack; featured / createdAt / lat / lng feed the sorts).
 *
 * Absent values are OMITTED rather than set to undefined. React's flight
 * encoding writes an explicit `undefined` as the 12-byte string
 * `"$undefined"`, so a row with eight empty columns paid ~160 bytes to say
 * nothing eight times — 300 kB across a 1,882-row category page.
 */
export type DirectoryCardEntry = {
  id: string;
  category: string;
  name: string;
  city: string;
  state: string;
  address?: string;
  zip?: string;
  phone?: string;
  website?: string;
  amenities?: string[];
  parkingSpaces?: number;
  description?: string;
  tpcUrl?: string;
  featured?: boolean;
  lat?: number;
  lng?: number;
  interstate?: string;
  exitNumber?: string;
  createdAt?: string;
  detailSlug?: string;
};

/** Drop a key entirely when the value is absent (see the note above). */
function put<T extends object, K extends string, V>(
  target: T,
  key: K,
  value: V | null | undefined,
): void {
  if (value !== undefined && value !== null) (target as Record<string, unknown>)[key] = value;
}

export function toCardEntry(entry: DirectoryEntry): DirectoryCardEntry {
  const card: DirectoryCardEntry = {
    id: entry.id,
    category: entry.category,
    name: entry.name,
    city: entry.city,
    state: entry.state,
  };
  put(card, 'address', entry.address);
  put(card, 'zip', entry.zip);
  put(card, 'phone', entry.phone);
  put(card, 'website', entry.website);
  if (entry.amenities && entry.amenities.length > 0) card.amenities = entry.amenities;
  put(card, 'parkingSpaces', entry.parkingSpaces);
  put(card, 'description', entry.description);
  put(card, 'tpcUrl', entry.tpcUrl);
  if (entry.featured) card.featured = true;
  put(card, 'lat', entry.lat);
  put(card, 'lng', entry.lng);
  put(card, 'interstate', entry.interstate);
  put(card, 'exitNumber', entry.exitNumber);
  put(card, 'createdAt', entry.createdAt);
  put(card, 'detailSlug', entry.detailSlug);
  return card;
}

/* ----------------------------------------------------------------- index */

/**
 * COORDINATE PRECISION. Six decimal places is ~11 cm at any latitude.
 *
 * A deliberate, bounded reduction, and worth stating plainly because it is
 * the only place this milestone changes a value rather than dropping one. A
 * JavaScript float serializes every digit it carries, and 34% of the live
 * geocoded rows carry 11-13 decimal places — incompressible digits costing
 * ~12 kB Brotli on the map page to express sub-micron positions no geocoder
 * measured and no driver could use. 40% of live rows already store exactly
 * six places, so for them this is a no-op.
 *
 * What reads these: distance SORTING (a comparison between listings that are
 * never centimetres apart), radius filtering (bucketed in whole miles),
 * marker placement (11 cm is a fraction of a pixel at Leaflet's deepest
 * zoom), and the directions link (which hands the coordinate to a maps app
 * that will route to the parking lot, not the pixel). No listing moves more
 * than 11 cm on any surface.
 */
const COORD_DP = 6;
const roundCoord = (v: number) => Number(v.toFixed(COORD_DP));

/**
 * One row of the COMPLETE browse index: what search, the state/city filters,
 * every sort and the result count read — and nothing a card renders.
 *
 * The field names are the ordinary ones on purpose. Single-letter keys were
 * measured (`{i,n,c,s,f,d,y,x,q}`) and saved 1.1 kB Brotli out of 60.8 on the
 * largest category — not worth a wire format that needs decoding before the
 * shared filter can read it. Keeping the names means an index row IS a
 * `BrowsableEntry`, so filtering runs straight over it with no per-keystroke
 * remapping of 1,882 rows.
 *
 * Two encodings ARE narrowed, because those paid for themselves:
 *
 *   createdAt  epoch milliseconds instead of the row's ISO string (-4.9 kB).
 *              ISO 8601 sorts lexicographically in the same order as the
 *              instants it names, so "Newest" is unchanged — a narrower
 *              encoding of the same ordering, not a different one.
 *   lat / lng  rounded to 6 decimal places (see COORD_DP above).
 */
export type DirectoryBrowseIndexEntry = {
  id: string;
  name: string;
  city: string;
  state: string;
  featured?: boolean;
  /** Epoch milliseconds — see the note above. */
  createdAt?: number;
  lat?: number;
  lng?: number;
  /** Pre-joined, lowercased haystack tail (ZIP, corridor, exit, amenities…). */
  searchText?: string;
};

export function toBrowseIndexEntry(entry: DirectoryEntry): DirectoryBrowseIndexEntry {
  const row: DirectoryBrowseIndexEntry = {
    id: entry.id,
    name: entry.name,
    city: entry.city,
    state: entry.state,
  };
  if (entry.featured) row.featured = true;
  if (entry.createdAt) {
    const at = Date.parse(entry.createdAt);
    if (Number.isFinite(at)) row.createdAt = at;
  }
  if (entry.lat != null) row.lat = roundCoord(entry.lat);
  if (entry.lng != null) row.lng = roundCoord(entry.lng);
  // The SAME builder the client falls back to for card entries, so the index
  // and a card cannot disagree about what a listing matches.
  const text = buildSearchText(entry);
  if (text) row.searchText = text;
  return row;
}

/* ------------------------------------------------------------------- map */

/**
 * One listing on /directory/map: enough for a marker, every map filter, a
 * result card, a directions link and a ?listing= deep link.
 *
 * Deliberately absent: `description` and `parkingSpaces` (the map card shows
 * neither), and every server-only field.
 */
export type DirectoryMapEntry = {
  id: string;
  category: string;
  name: string;
  city: string;
  state: string;
  address?: string;
  zip?: string;
  phone?: string;
  website?: string;
  amenities?: string[];
  tpcUrl?: string;
  featured?: boolean;
  lat?: number;
  lng?: number;
  interstate?: string;
  exitNumber?: string;
  detailSlug?: string;
};

export function toMapEntry(entry: DirectoryEntry): DirectoryMapEntry {
  const row: DirectoryMapEntry = {
    id: entry.id,
    category: entry.category,
    name: entry.name,
    city: entry.city,
    state: entry.state,
  };
  put(row, 'address', entry.address);
  put(row, 'zip', entry.zip);
  put(row, 'phone', entry.phone);
  put(row, 'website', entry.website);
  if (entry.amenities && entry.amenities.length > 0) row.amenities = entry.amenities;
  put(row, 'tpcUrl', entry.tpcUrl);
  if (entry.featured) row.featured = true;
  if (entry.lat != null) row.lat = roundCoord(entry.lat);
  if (entry.lng != null) row.lng = roundCoord(entry.lng);
  put(row, 'interstate', entry.interstate);
  put(row, 'exitNumber', entry.exitNumber);
  put(row, 'detailSlug', entry.detailSlug);
  return row;
}

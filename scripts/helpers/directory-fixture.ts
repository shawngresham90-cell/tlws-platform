/**
 * Deterministic wide `public.locations` fixture for the directory payload
 * work (DIR-PAYLOAD-1).
 *
 * DIR-COMPLETE-2's fixture carries the five slim columns the community
 * pickers read. This one carries every column the directory surfaces read, so
 * the harness can drive the REAL data layer, the REAL browse predicate, the
 * REAL card and the REAL map filters over one pool — and so a field that is
 * dropped from a DTO is dropped in the presence of rows that actually have a
 * value for it.
 *
 * Shaped from the live table (2,454 published, non-deleted rows, read
 * 2026-08-20), not invented:
 *
 *   truck-stops              1,882      description present      49.2%, 167 ch
 *   coordinate-ready         1,940      phone present            41.2%
 *   largest state (TX)         235      website present          30.0%
 *   largest corridor (I-75)    407      tpc_url present           2.3%
 *   featured                     0      parking_spaces present   75.7%
 *
 * Two shapes the live table does NOT currently contain are added on top,
 * because the code has to survive them: a row with no coordinates inside the
 * map-eligible scope's state, and rows whose name/city/state collide.
 *
 * IDS ASCEND WITH INSERTION, PRESENTATION DOES NOT. The keyset scan pages by
 * id while every surface displays by featured/name or state/city/name. Names
 * are therefore assigned from a fixed permutation of the id order, so a scan
 * that silently dropped its last page would produce a visibly wrong ORDER as
 * well as a short list — the harness can tell the two failures apart.
 */

export type DirectoryFixtureRow = {
  id: string;
  name: string;
  category_slug: string | null;
  state: string;
  city: string;
  slug: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  parking_spaces: number | null;
  amenities: string[] | null;
  free_parking: boolean | null;
  paid_parking: boolean | null;
  reserved_parking: boolean | null;
  overnight_parking: boolean | null;
  tpc_url: string | null;
  is_featured: boolean | null;
  is_indexable: boolean | null;
  lat: number | null;
  lng: number | null;
  interstate: string | null;
  exit_number: string | null;
  mile_marker: number | null;
  mile_marker_source: string | null;
  overnight_status: string | null;
  overnight_status_source: string | null;
  created_at: string | null;
  detail_slug: string | null;
  updated_at: string | null;
  verified_at: string | null;
  is_published: boolean;
  deleted_at: string | null;
};

export type DirectoryFixture = {
  /** Every row, published and not. */
  rows: DirectoryFixtureRow[];
  /** Published, not soft-deleted — what an anon reader may see. */
  eligible: DirectoryFixtureRow[];
  /** Eligible rows in the truck-stops category. */
  truckStops: DirectoryFixtureRow[];
  /** Eligible rows carrying coordinates — the map pool. */
  geocoded: DirectoryFixtureRow[];
  /** A truck-stop whose featured-then-name rank is past 1,000. */
  beyond1000: DirectoryFixtureRow | null;
  /** A truck-stop whose featured-then-name rank is past 1,800. */
  beyond1800: DirectoryFixtureRow | null;
  /** A geocoded listing whose map rank is past 1,800. */
  mapTail: DirectoryFixtureRow | null;
  /** Measured 1-based ranks, read back after ordering. */
  ranks: { beyond1000: number; beyond1800: number; mapTail: number };
  /** Rows sharing a name, in different cities. */
  twins: DirectoryFixtureRow[];
  /** An eligible row with no coordinates (must never reach the map). */
  noCoordinates: DirectoryFixtureRow | null;
  /** An unpublished row and a soft-deleted row — neither may ever surface. */
  unpublished: DirectoryFixtureRow | null;
  softDeleted: DirectoryFixtureRow | null;
};

/** mulberry32 — the fixed seed is the contract. */
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAINS = [
  'Pilot Travel Center',
  'Love’s Travel Stop',
  'TA Travel Center',
  'Petro Stopping Center',
  'Flying J Travel Plaza',
  'Bosselman Pump & Pantry',
  'Sapp Bros Travel Center',
  'Roady’s Truck Stop',
];
const CITIES = [
  'Dalton',
  'Chattanooga',
  'Knoxville',
  'Cartersville',
  'Ringgold',
  'Calhoun',
  'Effingham',
  'Sweetwater',
  'Bowling Green',
  'Amarillo',
  'Laramie',
  'Walcott',
  'North Platte',
  'Baytown',
  'Wytheville',
];
const STATES = (
  'AL AZ AR CA CO CT DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV ' +
  'NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'
).split(' ');
const INTERSTATES = ['I-5', 'I-10', 'I-20', 'I-40', 'I-55', 'I-65', 'I-70', 'I-75', 'I-80', 'I-95'];
const STORED_AMENITIES = ['Showers', 'Diesel', 'DEF', 'Scales', 'Laundry', 'WiFi', 'Restaurant'];
const OTHER_CATEGORIES = ['parking', 'cat-scales', 'rest-areas', 'weigh-stations', 'truck-washes'];

const idFor = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

/** Live-shaped description: present on 49.2% of rows, ~167 characters. */
function descriptionFor(i: number, name: string, city: string, state: string): string | null {
  if ((Math.imul(i + 11, 2654435761) >>> 0) % 1000 >= 492) return null;
  return (
    `${name} is a driver stop in ${city}, ${state}, with truck parking and ` +
    `fuel lanes on site. Amenities and hours are verified against the operator listing.`
  );
}

const at = (i: number, salt: number) => (Math.imul(i + salt, 2654435761) >>> 0) % 1000;

export function buildDirectoryFixture(
  published = 2454,
  truckStopCount = 1882,
  geocodedCount = 1940,
): DirectoryFixture {
  const rand = rng(0x9e37);
  const rows: DirectoryFixtureRow[] = [];

  // Names come from a permutation of the id order, so id order and every
  // presentation order are unrelated (see the header).
  const order = Array.from({ length: published }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (let i = 0; i < published + 40; i++) {
    const nameSeed = i < published ? order[i] : i;
    const isTruckStop = i < truckStopCount;
    const category = isTruckStop
      ? 'truck-stops'
      : OTHER_CATEGORIES[nameSeed % OTHER_CATEGORIES.length];
    const state = STATES[nameSeed % STATES.length];
    const city = CITIES[nameSeed % CITIES.length];
    const name = `${CHAINS[nameSeed % CHAINS.length]} #${String(1000 + nameSeed).padStart(4, '0')}`;
    const interstate = at(i, 5) < 874 ? INTERSTATES[nameSeed % INTERSTATES.length] : null;
    const created = new Date(Date.UTC(2025, 0, 1) + (nameSeed % 500) * 864e5).toISOString();
    const amenities = STORED_AMENITIES.filter((_, k) => at(i, 90 + k) < 221);
    // Published, then 20 unpublished, then 20 soft-deleted.
    const isPublished = i < published || i >= published + 20;
    const deleted = i >= published + 20 ? created : null;

    rows.push({
      id: idFor(i),
      name,
      category_slug: category,
      state,
      city,
      slug: `fixture-${i}`,
      address: at(i, 3) < 995 ? `${100 + (nameSeed % 900)} Benchmark Rd` : null,
      zip: at(i, 7) < 977 ? String(10000 + (nameSeed % 89999)) : null,
      phone: at(i, 23) < 412 ? `423-555-${String(1000 + (nameSeed % 9000))}` : null,
      website: at(i, 37) < 300 ? `https://www.example-truckstop.com/${slugify(city)}/${i}` : null,
      description: descriptionFor(i, name, city, state),
      parking_spaces: at(i, 41) < 757 ? 20 + (nameSeed % 230) : null,
      amenities,
      free_parking: at(i, 43) < 78,
      paid_parking: at(i, 47) < 62,
      reserved_parking: at(i, 59) < 62,
      overnight_parking: at(i, 61) < 500,
      tpc_url: at(i, 53) < 23 ? `https://truckparkingclub.com/l/fixture-${i}?ref=tlws` : null,
      is_featured: false,
      is_indexable: true,
      lat: null, // assigned below so the geocoded count is exact
      lng: null,
      interstate,
      exit_number: interstate && at(i, 67) < 800 ? String(1 + (nameSeed % 400)) : null,
      mile_marker: null,
      mile_marker_source: null,
      overnight_status: ['confirmed', 'prohibited', 'unknown'][nameSeed % 3],
      overnight_status_source: null,
      created_at: created,
      detail_slug: `${slugify(name)}-${slugify(city)}-${state.toLowerCase()}-${i}`,
      updated_at: created,
      verified_at: null,
      is_published: isPublished,
      deleted_at: deleted,
    });
  }

  // EXACT coordinate count, deterministically: the first `geocodedCount`
  // published rows get coordinates and the rest keep null, so "the map pool
  // is 1,940" is a fact about the fixture rather than a probability.
  let placed = 0;
  for (const row of rows) {
    if (!row.is_published || row.deleted_at !== null) continue;
    if (placed >= geocodedCount) break;
    const n = placed;
    // Live precision distribution: a third of rows carry 11-13 places.
    const dp = at(n, 71) < 340 ? 13 : at(n, 71) < 740 ? 6 : 4;
    row.lat = Number((25 + (n % 2000) * 0.0115 + rand() * 0.0001).toFixed(dp));
    row.lng = Number((-124 + (n % 3000) * 0.019 + rand() * 0.0001).toFixed(dp));
    placed++;
  }

  const eligible = rows.filter((r) => r.is_published && r.deleted_at === null);
  const truckStops = eligible.filter((r) => r.category_slug === 'truck-stops');
  const geocoded = eligible.filter((r) => r.lat != null && r.lng != null);

  // Twins: same name in different cities, so a search must still tell them
  // apart by the city the card shows.
  const twins: DirectoryFixtureRow[] = [];
  if (truckStops.length >= 3) {
    for (const k of [7, 700, 1400]) {
      const row = truckStops[k % truckStops.length];
      if (row && !twins.includes(row)) {
        row.name = 'Twin Pines Truck Plaza';
        twins.push(row);
      }
    }
    // Guarantee different cities so the label disambiguates.
    twins.forEach((row, k) => {
      row.city = CITIES[k % CITIES.length];
    });
  }

  const byName = (a: DirectoryFixtureRow, b: DirectoryFixtureRow) => a.name.localeCompare(b.name);
  const tsOrdered = [...truckStops].sort(byName);
  const mapOrdered = [...geocoded].sort(byName);

  const pick = (list: DirectoryFixtureRow[], rank: number) =>
    list.length > rank ? list[rank] : null;
  const beyond1000 = pick(tsOrdered, 1200);
  const beyond1800 = pick(tsOrdered, 1830);
  const mapTail = pick(mapOrdered, 1850);

  const noCoordinates = eligible.find((r) => r.lat == null) ?? null;

  return {
    rows,
    eligible,
    truckStops,
    geocoded,
    beyond1000,
    beyond1800,
    mapTail,
    ranks: {
      beyond1000: beyond1000 ? tsOrdered.indexOf(beyond1000) + 1 : 0,
      beyond1800: beyond1800 ? tsOrdered.indexOf(beyond1800) + 1 : 0,
      mapTail: mapTail ? mapOrdered.indexOf(mapTail) + 1 : 0,
    },
    twins,
    noCoordinates,
    unpublished: rows.find((r) => !r.is_published) ?? null,
    softDeleted: rows.find((r) => r.deleted_at !== null) ?? null,
  };
}

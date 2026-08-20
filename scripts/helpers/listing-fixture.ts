/**
 * Deterministic `public.locations` fixture for the community listing pickers
 * (DIR-COMPLETE-2). Shared by the offline harness and the browser bench so
 * both measure the same pool.
 *
 * Sized and shaped from the LIVE table, not invented: production holds 2,454
 * published, non-deleted rows across 46 states, every one carrying a
 * detail_slug, plus 376 unpublished rows. The generator reproduces that scale
 * and, on top of it, the awkward cases the real table does not currently
 * contain but the code must survive — a null category_slug, a null
 * detail_slug, and rows whose state/city/name are byte-identical.
 *
 * WHY IDS ARE SHUFFLED AGAINST PRESENTATION ORDER. A keyset scan pages by id;
 * the picker displays state/city/name. If the fixture's ids happened to
 * ascend in presentation order, a scan that dropped its final page would
 * still look correctly ordered, and the final sort would be untested. Ids are
 * therefore assigned by a fixed Fisher-Yates permutation: id order and
 * presentation order are unrelated, deterministically.
 *
 * WHY RANKS ARE MEASURED, NOT ASSUMED. Every awkward shape is applied by
 * mutating a row that has ALREADY been placed in presentation order, and each
 * mutation changes only `name`/`detail_slug`/`category_slug` — never `state`
 * or `city` — so a row cannot leave its own city block. The resulting ranks
 * are then read back off the re-sorted array and asserted, rather than
 * predicted from the generator's arithmetic.
 */

export type LocationFixtureRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  category_slug: string | null;
  detail_slug: string | null;
  is_published: boolean;
  deleted_at: string | null;
};

export type ListingFixture = {
  /** Every row, published and not, in arbitrary storage order. */
  rows: LocationFixtureRow[];
  /** Rows an anon reader may see: published and not soft-deleted. */
  eligible: LocationFixtureRow[];
  /** Presentation order (state, city, name, id) over `eligible`. */
  ordered: LocationFixtureRow[];
  /**
   * A listing whose presentation rank is past 1,000 — lost to a 1,000-row
   * cap. `null` when the pool is too small to have one; the boundary-size
   * fixtures exist to prove the scan, not to carry every shape.
   */
  beyond1000: LocationFixtureRow | null;
  /** A listing whose presentation rank is past 2,000 — lost to `.limit(2000)`. */
  beyond2000: LocationFixtureRow | null;
  /** 1-based presentation ranks of the two targets, measured after mutation. */
  ranks: { beyond1000: number; beyond2000: number };
  /** The three byte-identical state/city/name rows; empty in a small pool. */
  twins: LocationFixtureRow[];
  /** The row whose category_slug is null, if the pool reaches that rank. */
  nullCategory: LocationFixtureRow | null;
  /** The row whose detail_slug is null, if the pool reaches that rank. */
  nullDetailSlug: LocationFixtureRow | null;
  /** The unpublished row; must never reach a picker. */
  unpublished: LocationFixtureRow;
  /** The soft-deleted row; must never reach a picker. */
  softDeleted: LocationFixtureRow;
};

/**
 * 46 state codes, matching the live distinct-state count. Alphabetical order
 * matters: presentation order is state-first, so the tail of the pool — the
 * part a cap silently removes — is the end of this list. In production that
 * tail is TN/TX/UT/VA/WA/WI/WV/WY, and those states are exactly the ones a
 * driver currently cannot find.
 */
const STATES = [
  'AL',
  'AR',
  'AZ',
  'CA',
  'CO',
  'CT',
  'FL',
  'GA',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'WA',
  'WI',
  'WV',
  'WY',
];

const CATEGORIES = ['truck-stops', 'truck-parking', 'cat-scales', 'truck-washes', 'repair'];

/** Names deliberately repeated across cities and states, as chains really are. */
const CHAINS = [
  'Pilot Travel Center',
  'Love’s Travel Stop',
  'TA Travel Center',
  'Petro Stopping Center',
  'Flying J',
  'Bosselman Pump & Pantry',
  'Sapp Bros',
  'Roady’s Truck Stop',
];

/** Deterministic permutation source — no Math.random, so runs are comparable. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** UUID-shaped id, so payload measurements carry the real 36-byte cost. */
function idFor(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

/** Mirrors location_detail_slug_base() / detailSlugBase(). */
function slugify(name: string, city: string, state: string): string {
  return (
    `${name}-${city}-${state}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 100)
      .replace(/(^-|-$)+/g, '') || 'listing'
  );
}

/** Presentation comparator under test: state, then city, then name, then id. */
export function comparePresentation(
  a: { state: string; city: string; name: string; id: string },
  b: { state: string; city: string; name: string; id: string },
): number {
  return (
    a.state.localeCompare(b.state) ||
    a.city.localeCompare(b.city) ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * First index i where rows i, i+1, i+2 share a state and city, at or past
 * `from`; -1 when the pool is too small to hold one. Identical-triple rows
 * are a shape to test, not a precondition — a 1-row pool has no triple and
 * still has a scan worth proving.
 */
function findTripleAt(ordered: LocationFixtureRow[], from: number): number {
  for (let i = Math.max(0, from); i + 2 < ordered.length; i++) {
    const [a, b, c] = [ordered[i], ordered[i + 1], ordered[i + 2]];
    if (a.state === b.state && b.state === c.state && a.city === b.city && b.city === c.city) {
      return i;
    }
  }
  return -1;
}

/**
 * Build a fixture with `eligibleCount` published, non-deleted rows plus one
 * unpublished and one soft-deleted row that must never be visible.
 */
export function buildListingFixture(eligibleCount = 2454): ListingFixture {
  const rand = lcg(0x5eed1234);

  // 1. Generic rows first: unique names, three listings per city, spread
  //    evenly across the states.
  const drafts: Omit<LocationFixtureRow, 'id'>[] = [];
  const perState = Math.ceil(eligibleCount / STATES.length);
  for (const state of STATES) {
    for (let i = 0; i < perState && drafts.length < eligibleCount; i++) {
      const city = `City ${String(Math.floor(i / 3)).padStart(3, '0')}`;
      const name = `${CHAINS[drafts.length % CHAINS.length]} #${String(1000 + drafts.length).padStart(4, '0')}`;
      drafts.push({
        name,
        city,
        state,
        category_slug: CATEGORIES[drafts.length % CATEGORIES.length],
        detail_slug: slugify(name, city, state),
        is_published: true,
        deleted_at: null,
      });
    }
  }

  // 2. Ids by a deterministic permutation — id order shares nothing with
  //    presentation order.
  const permuted = shuffle(
    drafts.map((_, i) => i),
    rand,
  );
  const eligible: LocationFixtureRow[] = drafts.map((d, i) => ({
    id: idFor(permuted[i] + 1),
    ...d,
  }));

  // 3. Place the awkward shapes ON THE SORTED ARRAY, by rank. Only name,
  //    detail_slug and category_slug are ever touched, so no row leaves its
  //    city block and every rank below survives the mutation.
  const ordered = [...eligible].sort(comparePresentation);

  // A pool smaller than a given rank simply does not have that row. The
  // boundary sizes (0, 1, 499 …) exist to prove the SCAN, so each shape is
  // skipped rather than forced onto a row that does not exist.
  const at = (rank: number): LocationFixtureRow | null => ordered[rank - 1] ?? null;

  const setName = (row: LocationFixtureRow | null, name: string) => {
    if (!row) return null;
    row.name = name;
    row.detail_slug = slugify(name, row.city, row.state);
    return row;
  };

  // The two targets get a unique name AND a unique city, so a picker query on
  // either field can only match them. The city is deliberately Z-initial: it
  // sorts to the END of its own state block, so the row can only move LATER
  // in presentation order, never earlier past the cap it is meant to sit
  // beyond. The rank assertion at the bottom is what actually proves it.
  const setPlace = (row: LocationFixtureRow | null, name: string, city: string) => {
    if (!row) return null;
    row.name = name;
    row.city = city;
    row.detail_slug = slugify(name, city, row.state);
    return row;
  };
  const t1 = setPlace(at(1400), 'Tailwatch Beyond One Thousand', 'Zephyr Cursorville');
  const t2 = setPlace(at(2400), 'Tailwatch Beyond Two Thousand', 'Zephyr Keysetport');

  // Three byte-identical state/city/name rows past the 1,000 mark: only a
  // final tie-breaker orders these stably, and only the id keeps them apart.
  const tripleAt = findTripleAt(ordered, 1500);
  const twins = tripleAt < 0 ? [] : ordered.slice(tripleAt, tripleAt + 3);
  twins.forEach((row, k) => {
    row.name = 'Twin Pines Truck Plaza';
    // The database's own collision suffix — NOT derivable from name/city/state.
    row.detail_slug = `${slugify(row.name, row.city, row.state)}${k === 0 ? '' : `-${k + 1}`}`;
  });

  // Punctuation and mixed case, inside one city block, to pin the collation.
  setName(at(1050), 'ACME Truck & Trailer');
  setName(at(1051), 'acme truck and trailer');

  // Rows the backfills never reached.
  const nullCategory = at(1200);
  if (nullCategory) nullCategory.category_slug = null;
  const nullDetailSlug = at(2200);
  if (nullDetailSlug) nullDetailSlug.detail_slug = null;

  // 4. Rows RLS and the query filters must both exclude. Named so a picker
  //    search would find them if they ever escaped.
  const unpublished: LocationFixtureRow = {
    id: idFor(900001),
    name: 'Tailwatch Unpublished Draft',
    city: 'Keysetport',
    state: 'WY',
    category_slug: 'truck-stops',
    detail_slug: 'tailwatch-unpublished-draft-keysetport-wy',
    is_published: false,
    deleted_at: null,
  };
  const softDeleted: LocationFixtureRow = {
    id: idFor(900002),
    name: 'Tailwatch Closed Forever',
    city: 'Keysetport',
    state: 'WY',
    category_slug: 'truck-stops',
    detail_slug: 'tailwatch-closed-forever-keysetport-wy',
    is_published: true,
    deleted_at: '2026-01-01T00:00:00.000Z',
  };

  // 5. Re-sort after mutation and read the ranks back off the result.
  const finalOrder = [...eligible].sort(comparePresentation);
  const rankIn = (row: LocationFixtureRow | null) =>
    row === null ? 0 : finalOrder.findIndex((r) => r.id === row.id) + 1;
  const ranks = { beyond1000: rankIn(t1), beyond2000: rankIn(t2) };
  // The whole point of a target is the rank it sits at. If a rename moved one
  // out of the range it was placed for, say so loudly rather than testing a
  // row that a cap would never have dropped.
  if (t1 && ranks.beyond1000 <= 1000) {
    throw new Error(`listing fixture: beyond1000 landed at rank ${ranks.beyond1000}`);
  }
  if (t2 && ranks.beyond2000 <= 2000) {
    throw new Error(`listing fixture: beyond2000 landed at rank ${ranks.beyond2000}`);
  }

  // Storage order is neither presentation order nor id order: a database
  // returns rows however it likes unless asked otherwise.
  const rows = shuffle([...eligible, unpublished, softDeleted], rand);

  return {
    rows,
    eligible,
    ordered: finalOrder,
    beyond1000: t1,
    beyond2000: t2,
    ranks,
    twins,
    nullCategory,
    nullDetailSlug,
    unpublished,
    softDeleted,
  };
}

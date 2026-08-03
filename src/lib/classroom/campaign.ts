/**
 * Supply the Classroom — campaign constants and pure countdown logic.
 *
 * Everything here is pure and side-effect free so the countdown can be tested
 * offline without a DOM or a clock. The route, the homepage CTA and the tests
 * all read these constants; no campaign URL or date is written at a call site.
 */

/**
 * Campaign opening instant, written as an ISO string with an EXPLICIT offset
 * rather than a hand-computed UTC timestamp.
 *
 * October 18, 2026 at 8:00 AM America/New_York. US daylight time in 2026 runs
 * March 8 → November 1, so October 18 is EDT (UTC−4) — stating `-04:00` in the
 * literal means the offset is checked by `Date.parse` instead of trusted to a
 * comment, and a future edit that gets the zone wrong fails the test that pins
 * the resulting instant.
 */
export const CAMPAIGN_OPENS_ISO = '2026-10-18T08:00:00-04:00';

/** The opening instant in epoch milliseconds. */
export const CAMPAIGN_OPENS_AT_MS = Date.parse(CAMPAIGN_OPENS_ISO);

/** Human-facing opening date, used in copy and metadata. */
export const CAMPAIGN_OPENS_LABEL = 'October 18, 2026';

/** Manifest-style date stamp (10.18.2026) for the bill-of-lading strip. */
export const CAMPAIGN_OPENS_STAMP = '10.18.2026';

/** Where the classroom is being built. City/region only — never a street address. */
export const CAMPAIGN_CITY = 'Dalton, Georgia';

/** Manifest-strip form of the destination. */
export const CAMPAIGN_DESTINATION = 'Dalton, GA';

/** Load number for the manifest strip — the campaign's shipment identity. */
export const CAMPAIGN_LOAD_NUMBER = 'TLA-001';

/**
 * The bill-of-lading strip. Field/value pairs exactly as approved, kept here
 * so the page renders them from one source and the tests can pin them.
 */
export const MANIFEST_ROWS: readonly { field: string; value: string }[] = [
  { field: 'Load', value: CAMPAIGN_LOAD_NUMBER },
  { field: 'Origin', value: 'Anywhere' },
  { field: 'Destination', value: CAMPAIGN_DESTINATION },
  { field: 'Deliver by', value: CAMPAIGN_OPENS_STAMP },
  { field: 'Status', value: 'Loading' },
] as const;

/** Primary CTA: the Amazon wishlist that fulfils the supplies. */
export const AMAZON_WISHLIST_URL = 'https://www.amazon.com/hz/wishlist/ls/1VNA3OIBPOYEB';

/** Secondary CTA: cash contributions toward supplies not on the list. */
export const CASH_APP_URL = 'https://cash.app/$ShawnDavidGresham';

/** Campaign route (internal). The homepage CTA points here, never to Amazon. */
export const CAMPAIGN_PATH = '/supply-the-classroom';

/**
 * Supply bands. Deliberately price RANGES with a role, not named products:
 * the Amazon list is the only current source of what is actually needed and
 * what it costs, so this page describes the shape of the help rather than
 * promising a specific item is available at a specific price.
 */
export type SupplyTier = {
  /** Stable id for tests and keys. */
  id: string;
  range: string;
  title: string;
  blurb: string;
};

export const SUPPLY_TIERS: readonly SupplyTier[] = [
  {
    id: 'consumables',
    range: 'Under $25',
    title: 'The stuff that runs out',
    blurb:
      'Markers, paper, folders, printer ink — the quiet consumables a working classroom burns through every single week.',
  },
  {
    id: 'everyday',
    range: '$25 – $75',
    title: 'Everyday classroom gear',
    blurb:
      'The things a student touches on day one: desk supplies, storage, boards, and the small tools that make a lesson run.',
  },
  {
    id: 'shared',
    range: '$75 – $150',
    title: 'Shared equipment',
    blurb:
      'Gear the whole class uses at once. One person covers it, and every driver who comes through that room gets the benefit.',
  },
  {
    id: 'build',
    range: '$150+',
    title: 'Big-ticket build items',
    blurb:
      'The anchor pieces of the room. These are the items that decide whether the classroom opens finished or half-built.',
  },
] as const;

/* ------------------------------------------------------------- countdown */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the opening instant has passed. */
  complete: boolean;
};

/**
 * Remaining time between two instants, floored at zero.
 *
 * Pure: both instants are arguments, so the countdown's behaviour at, before
 * and after the opening date is testable without mocking a clock.
 */
export function countdownParts(
  nowMs: number,
  targetMs: number = CAMPAIGN_OPENS_AT_MS,
): CountdownParts {
  const remaining = targetMs - nowMs;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, complete: true };
  }
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    complete: false,
  };
}

/**
 * How often the countdown re-renders.
 *
 * A once-per-second text change is motion. When the visitor has asked for
 * reduced motion the countdown still works — it just settles down to a
 * once-a-minute update instead of ticking in their peripheral vision.
 */
export function tickIntervalMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 60_000 : 1_000;
}

/** Two-digit padding for the clock segments. */
export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/**
 * The single source of truth for Trucking Life Academy program facts.
 *
 * Before this module the same handful of facts — tuition, start dates, the
 * address — were written out longhand on /academy, /academy/faq,
 * /academy/financing, /academy/curriculum, /academy/facility, the homepage
 * Academy band, and the JSON-LD builders. They disagreed: the homepage claimed
 * a "Full 160-hour curriculum" while the curriculum page said ELDT sets no
 * fixed national hour count, and four separate surfaces said tuition was
 * "being finalized" after it had been set.
 *
 * Every one of those now reads from here, so a price or a start date can only
 * be changed in one place. `scripts/test-academy-program-facts.ts` scans the
 * repository for the old literals and fails if any of them come back.
 *
 * HONESTY RULES ENCODED HERE (these are not stylistic — they are the claims
 * the school is legally and ethically on the hook for):
 *   - job-placement ASSISTANCE only. Never "guaranteed job" or "guaranteed
 *     placement". `PLACEMENT.disclaimer` carries the qualifier and is rendered
 *     wherever placement is mentioned.
 *   - the weekday program is NOT open yet. `WEEKDAY.startsLabel` states when it
 *     begins; nothing may describe it as currently available.
 *   - no ZIP, daily class hours, financing terms, payment plans, lodging,
 *     testing arrangements, licensing guarantees, refunds, class capacity or
 *     included fees appear here, because none of those are confirmed.
 *   - manual training is described as practical experience only. It is NOT
 *     claimed to remove any CDL restriction — the site has no verified
 *     language supporting that, so the claim is not made.
 */
import { SITE } from '@/lib/seo/site';

/**
 * Street address, visible as real text on the page — not metadata-only.
 *
 * `city` and `region` are READ FROM `SITE`, not re-declared. Both files
 * previously carried their own 'Dalton' / 'GA' literals, which is two
 * authorities for one fact: correcting the school's city in one place would
 * have left the other quietly serving the old value to metadata and schema.
 * The street lives here because it is the school's, not the site's.
 */
export const ACADEMY_ADDRESS = {
  street: '1821 Wendell Street',
  city: SITE.city,
  region: SITE.region,
  /** "1821 Wendell Street, Dalton, GA" — the one-line form used in copy. */
  get oneLine() {
    return `${this.street}, ${this.city}, ${this.region}`;
  },
  /**
   * Google Maps search link, DERIVED from the fields above rather than pasted
   * as a second copy of the address — a hand-written map URL is the classic
   * way a corrected address stays wrong in exactly one place. Uses the
   * documented `search/?api=1&query=` form, which needs no API key and hands
   * off cleanly to the native maps app on both mobile platforms. No ZIP is
   * appended: the postcode is not confirmed, and a wrong one here would drop a
   * pin on the wrong street.
   */
  get mapsUrl() {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.oneLine)}`;
  },
} as const;

/**
 * Tuition, identical for both programs. Held as whole dollars with a single
 * formatter so the string can never drift between "$3,995", "$3995" and
 * "3,995" across surfaces.
 */
export const TUITION_USD = 3995;

/** `3995` → `"$3,995"`. The only approved rendering of the price. */
export function formatTuition(usd: number = TUITION_USD): string {
  return `$${usd.toLocaleString('en-US')}`;
}

/** The approved price string, precomputed for copy. */
export const TUITION = formatTuition();

export type ProgramFacts = {
  key: 'weekend' | 'weekday';
  name: string;
  /** When the program begins. The weekday program is not open yet. */
  startsLabel: string;
  /** Machine-readable start for JSON-LD (ISO 8601, month precision). */
  startIso: string;
  /** Meeting pattern, or null when the program has no fixed weekly pattern. */
  meets: string | null;
  /** How long the program runs. */
  length: string;
  /** Whether enrolment is open today. */
  open: boolean;
  bullets: string[];
};

export const WEEKEND: ProgramFacts = {
  key: 'weekend',
  name: 'Weekend CDL Program',
  startsLabel: 'Begins October 2026',
  startIso: '2026-10',
  meets: 'Saturdays and Sundays',
  length: 'Eight weekends',
  open: true,
  bullets: [
    'Begins October 2026',
    'Saturdays and Sundays',
    'Eight weekends',
    TUITION,
    'Manual 10-speed training',
    'Job-placement assistance',
  ],
};

export const WEEKDAY: ProgramFacts = {
  key: 'weekday',
  name: 'Weekday CDL Program',
  startsLabel: 'Begins January 2027',
  startIso: '2027-01',
  meets: null,
  length: 'Approximately three to four weeks',
  open: false,
  bullets: [
    'Begins January 2027',
    'Approximately three to four weeks',
    TUITION,
    'Manual 10-speed training',
    'Job-placement assistance',
  ],
};

export const PROGRAMS: ProgramFacts[] = [WEEKEND, WEEKDAY];

/**
 * Equipment. Deliberately says what the trucks ARE and what that gives a
 * student — practical experience — and stops there. It does NOT say manual
 * training removes the automatic-restriction endorsement, because the site
 * carries no verified language supporting that claim.
 */
export const EQUIPMENT = {
  transmission: 'Manual 10-speed',
  summary:
    'Students train in manual 10-speed trucks, giving them practical experience with equipment used throughout the trucking industry.',
} as const;

/**
 * Placement. The qualifier travels with the offer everywhere it is rendered —
 * an assistance claim without the disclaimer beside it is the exact thing this
 * shape exists to prevent.
 */
export const PLACEMENT = {
  headline: 'Job-placement assistance is available to graduates.',
  detail:
    'We help students connect with trucking companies and employment opportunities, but employment is not guaranteed.',
  /** Short form for cards and lists. */
  short: 'Job-placement assistance',
  disclaimer: 'Employment is not guaranteed.',
} as const;

/** The one-line program summary used in high-visibility positions. */
export const PROGRAM_SUMMARY = `Tuition ${TUITION}. Weekend classes begin October 2026 — Saturdays and Sundays for eight weekends. A weekday program of approximately three to four weeks begins January 2027.`;

/** The enrolment call used near application CTAs. */
export const ENROLL_CTA_LINE =
  'Weekend classes begin October 2026. Apply now to reserve your place.';

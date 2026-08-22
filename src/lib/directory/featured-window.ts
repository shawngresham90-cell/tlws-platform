/**
 * Featured-placement window — the single authority on whether a listing may
 * currently receive paid featured treatment.
 *
 * THE DEFECT THIS EXISTS TO FIX
 *
 * A paid featured listing was controlled by `locations.is_featured` alone: a
 * bare boolean with no end date. The paid term lived in the CRM notes and the
 * renewal queue, so the row itself could not tell anyone when the money ran
 * out. A placement therefore kept its Sponsored badge, its featured-first
 * position, its map treatment and its slot against the three-per-page capacity
 * for exactly as long as it took a human to remember to switch it off.
 *
 * Migration 057 adds `locations.featured_until`, and this module is the only
 * place that reads it. Every public surface, every capacity count and every
 * admin state calls in here rather than comparing timestamps of its own —
 * because the failure mode of a scattered rule is that one surface keeps
 * showing Sponsored after the others have stopped, which is the same defect
 * again in a smaller box.
 *
 * MODEL B: ACTIVATION MEANS START NOW
 *
 * There is deliberately no `featured_starts_at`. Reproduced against the real
 * action on `main` (`9d339fb`): `activateFeaturedAction` writes
 * `.update({ is_featured: true })` and never reads its own `starts_on` field
 * for anything but window validation and the audit note, while the public path
 * derives `featured` straight from `is_featured`. So a placement dated to start
 * next week went public the instant ACTIVATE was pressed — the CRM said one
 * thing and 2,454 listing pages said another.
 *
 * Two ways to close that gap: teach the public path about a start date
 * (`featured_starts_at`), or refuse to record a start the public path will not
 * honour. This takes the second. Scheduled featured starts are not a workflow
 * the owner sales kit offers, adopting them would require inventing a
 * capacity-reservation policy nobody has agreed, and one column is a smaller
 * thing to get right than two. Activation derives the window from the moment
 * of activation; a future start date is refused with a message rather than
 * silently ignored.
 *
 * Corridor sponsors keep their real `starts_at`/`ends_at` window — that is a
 * different product on a different table, and it already works. The asymmetry
 * is deliberate and documented rather than accidental.
 */

import { isHeldBrand } from './placements';

/**
 * Whether the `featured_until` column is actually readable.
 *
 * The application is deployed by Netlify on merge; the migration is applied
 * separately afterwards. So there is a real window in which the code knows
 * about a column the database does not have, and during that window the
 * Directory has to keep working exactly as it does today.
 */
export type FeaturedSchema = 'ready' | 'unavailable';

export type FeaturedWindowStatus =
  /** The term column cannot be read yet. Legacy `is_featured` governs. */
  | 'schema-unavailable'
  /** Not a paid placement at all. */
  | 'inactive'
  /** Paid, in term, and publicly featured right now. */
  | 'active'
  /** The paid term has ended. Public featured treatment is over. */
  | 'expired'
  /** A term value exists but is not a usable timestamp. Fails closed. */
  | 'malformed'
  /** Schema is ready, the row is flagged, but no term was recorded. Fails closed. */
  | 'missing-expiry';

/** The row fields the window rule needs. Nothing commercial, nothing private. */
export type FeaturedRow = {
  isFeatured: boolean;
  isPublished: boolean;
  deletedAt: string | null;
  /** Used only for the held-brand rule. */
  name: string | null;
  /**
   * `undefined` means the column was not read — the schema is not ready, or
   * this projection did not ask for it. `null` means the column exists and is
   * empty, which after migration is a fault rather than "forever".
   */
  featuredUntil?: string | null;
};

/**
 * Where a listing sits against its paid term.
 *
 * Ordering matters. `is_featured = false` is checked first and returns before
 * any string work, because this runs against every row of every directory read
 * and almost none of them are paid placements.
 *
 * The boundary is `now >= featuredUntil` → expired, so a term ending at
 * midnight is over at midnight rather than lasting one more millisecond.
 */
export function featuredWindowStatus(
  row: FeaturedRow,
  now: Date,
  schema: FeaturedSchema = 'ready',
): FeaturedWindowStatus {
  if (!row.isFeatured) return 'inactive';

  // Before the migration lands, the column is not there to consult and the
  // honest answer is "the old rule still applies". Returning `expired` here
  // would silently un-feature every paid placement the moment this code
  // deployed and before anyone could add a term.
  if (schema === 'unavailable') return 'schema-unavailable';

  // Neither an unpublished nor a deleted listing has a public surface to be
  // featured on, whatever its term says.
  if (!row.isPublished || row.deletedAt) return 'inactive';

  // Held brands are never promoted. Activation already refuses them; this is
  // the second lock, so a row flagged by any other path still cannot show.
  if (isHeldBrand(row.name)) return 'inactive';

  if (row.featuredUntil === undefined || row.featuredUntil === null) return 'missing-expiry';

  const until = Date.parse(row.featuredUntil);
  if (Number.isNaN(until)) return 'malformed';

  return now.getTime() >= until ? 'expired' : 'active';
}

/**
 * May this listing show paid featured treatment right now?
 *
 * `schema-unavailable` falls back to the legacy boolean deliberately — see the
 * module note. Every other non-active status is false, so a missing or
 * malformed term fails closed rather than reading as "runs forever".
 */
export function isFeaturedActive(
  row: FeaturedRow,
  now: Date,
  schema: FeaturedSchema = 'ready',
): boolean {
  const status = featuredWindowStatus(row, now, schema);
  if (status === 'active') return true;
  if (status === 'schema-unavailable') {
    // Pre-057, with ONE deliberate tightening.
    //
    // The rule on main was `is_featured` alone — the published/not-deleted
    // conditions came from the query, and `isHeldBrand` never touched the
    // public read path at all (it lived only in the admin placement and
    // prospect code). So this is NOT a byte-for-byte replay of the old
    // behaviour, and saying so would be the kind of quiet inaccuracy this
    // milestone exists to remove: a held brand carrying `is_featured = true`
    // was badged before and is withheld here.
    //
    // Kept, rather than reverted to the exact legacy rule, because a held
    // brand must never wear a Sponsored badge — that is the one case where
    // matching yesterday would mean shipping a known defect — and because the
    // post-057 path already refuses it, so reverting would make the bridge
    // disagree with the thing it is bridging to.
    //
    // Blast radius today: none. Production carries ZERO rows with
    // `is_featured = true` (verified read-only against the live database), so
    // no visitor sees a difference on merge.
    return row.isPublished && !row.deletedAt && !isHeldBrand(row.name);
  }
  return false;
}

/** Human wording for an admin. Never used to decide anything. */
export const FEATURED_STATUS_LABEL: Record<FeaturedWindowStatus, string> = {
  'schema-unavailable': 'Featured-expiry schema is not active yet',
  inactive: 'Not a paid placement',
  active: 'Active',
  expired: 'Term expired · public placement ended',
  malformed: 'Term is unreadable · placement withheld',
  'missing-expiry': 'No term recorded · placement withheld',
};

/**
 * Whether the row still carries `is_featured = true` after its public
 * placement has ended. This is a CLEANUP signal, not a visibility one: the
 * placement is already gone from every public surface, and the boolean is left
 * behind only so the admin can see what happened and tidy it deliberately.
 *
 * The distinction is the whole point of REVENUE-2. Before it, "term expired"
 * and "still showing publicly" were the same event and the admin had to say so
 * in red. After it, an expired placement is already invisible and the only
 * thing outstanding is housekeeping.
 */
export function needsFeaturedCleanup(status: FeaturedWindowStatus): boolean {
  return status === 'expired' || status === 'malformed' || status === 'missing-expiry';
}

/* ------------------------------------------------------- activation input */

/** How long a term runs. Mirrors the offer authority's billing periods. */
export type FeaturedTerm = 'monthly' | 'annual';

/**
 * The expiry a term implies from a given instant. Calendar arithmetic, not
 * 30/365-day arithmetic, so a monthly term bought on the 31st lands where a
 * human would expect and a leap year does not shorten an annual one.
 */
export function featuredExpiryFrom(start: Date, term: FeaturedTerm): Date {
  const end = new Date(start.getTime());
  if (term === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

/**
 * Why a proposed featured window cannot be written, or `[]` when it can.
 *
 * This is the WINDOW half only. Whether the deal was paid for is
 * `saleActivationBlockers` in `revenue.ts`, and whether the page has room is
 * `canActivateFeatured` in `placements.ts`. An activation clears all three.
 */
export function featuredWindowBlockers(
  proposedStartDay: string | null,
  now: Date,
  schema: FeaturedSchema,
): string[] {
  const out: string[] = [];

  if (schema === 'unavailable')
    out.push(
      'Featured-expiry schema is not active yet, so a placement cannot be given a term. Apply migration 057 before activating a featured listing.',
    );

  // Model B: the window starts now. A future start is refused rather than
  // recorded-and-ignored, because a recorded start the public path does not
  // honour is exactly the disagreement this milestone exists to remove.
  if (proposedStartDay && /^\d{4}-\d{2}-\d{2}$/.test(proposedStartDay)) {
    const start = Date.parse(`${proposedStartDay}T00:00:00Z`);
    const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(start) && start > today)
      out.push(
        'A featured listing starts when you activate it. Scheduling a future start is not supported — the public pages would show it immediately and the recorded date would be a fiction. Activate on the day the term starts.',
      );
  }
  return out;
}

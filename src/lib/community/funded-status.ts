/**
 * OWNER-APPROVED PUBLIC FUNDED STATUS — the single authority for what the
 * public site says about the campaign's financial state.
 *
 * The owner has declared the school funded (2026-08-20). Every public
 * founder-related surface reads this module and shows FUNDED_HEADLINE.
 *
 * DELIBERATELY STATIC. These are compile-time constants, never a database
 * read. That is the whole point: a Supabase outage used to make the public
 * thermometer fall back to `raised_cents: 0`, which rendered "$0 raised",
 * "0% funded" and "$12,000 left to open the school" — telling visitors the
 * school was unfunded precisely when the database was down. A constant cannot
 * fail, time out, or fall back, so the funded message survives any outage.
 *
 * PRIVACY: no aggregate money is exported here and none belongs on a public
 * surface. Raised/goal/remaining/percentage remain in the database and stay
 * visible to admin-only surfaces (see components/admin/AdminCampaignThermometer).
 */

/** Owner-declared: the school's build is funded. */
export const SCHOOL_IS_FUNDED = true;

/**
 * The exact public funded headline. Every public founder surface must render
 * this string verbatim — scripts/test-funded-status.ts enforces it.
 */
export const FUNDED_HEADLINE = 'SCHOOL IS FUNDED';

/** Short recognition line under the headline. */
export const FUNDED_SUBHEAD = 'Built founder by founder.';

/** Thank-you shown with the funded status. Recognition only — no money, no new ask. */
export const FUNDED_THANKS = 'Thank you to the drivers and businesses who made it possible.';

/**
 * Accessible sentence for the funded status region. Carries NO monetary
 * figure — the old aria-valuetext read "$X raised of $Y goal — Z% funded",
 * which leaked the totals to screen readers after they were removed visually.
 */
export function fundedStatusLabel(founderCount?: number | null): string {
  const n = Number(founderCount) || 0;
  if (n <= 0) return `${FUNDED_HEADLINE}. ${FUNDED_SUBHEAD}`;
  return `${FUNDED_HEADLINE}. ${FUNDED_SUBHEAD} ${n} founder${n === 1 ? '' : 's'} on the wall.`;
}

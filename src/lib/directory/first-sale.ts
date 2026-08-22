/**
 * The first featured sale, as an operator actually performs it.
 *
 * WHAT THIS EXISTS TO FIX
 *
 * REVENUE-2 made a featured listing expire correctly. It did not make the sale
 * SAFE TO PERFORM. Reproduced on `main` at 7e98f60, the owner workflow for the
 * first paid placement is:
 *
 *   1. Record the quote and the payment on /admin/directory/revenue.
 *   2. Read, from that page, the sentence "Copy this CRM row id into the
 *      placements console: 33333333-3333-4333-8333-333333333333".
 *   3. Copy that UUID.
 *   4. Navigate to /admin/directory/placements.
 *   5. Search the listing by name.
 *   6. Paste the UUID into a free-text box labelled "CRM row id (required)".
 *   7. Choose a billing period from a select.
 *   8. Type ACTIVATE.
 *   9. Press the button, and only THEN discover whether the deal was paid,
 *      whether the term matches what was sold, or whether the page is full —
 *      because every one of those checks runs in the server action and comes
 *      back as `?err=` on a redirect.
 *
 * Two things are wrong with that, and they are the same thing twice. A UUID
 * carried by hand between two consoles is a fact the application already holds
 * and asked a human to remember. And a gate that only speaks after the operator
 * has committed is not a gate, it is a receipt.
 *
 * So this module computes, BEFORE the button exists, every state the operator
 * would otherwise have to know: whether the money arrived, what term will be
 * written, which pages the placement lands on and whether they have room,
 * whether the listing is even eligible, and what the row already says. The
 * console renders it as a checklist and offers ACTIVATE only when every line
 * passes.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * It is not a second authority. Every answer here is delegated:
 * `saleActivationBlockers` for the money, `promotionBlockers` and
 * `featuredUsage` for the listing and the capacity, `featuredWindowBlockers`
 * and `featuredExpiryFrom` for the term. A checklist that decided anything for
 * itself could pass a state the write then refused — which is the failure this
 * milestone exists to remove, wearing a nicer coat. The invariant is stated
 * once and tested directly: if `canActivate` is true, the server action's own
 * gates all pass on the same inputs.
 *
 * Nothing here writes, and nothing here takes payment.
 */

import {
  featuredExpiryFrom,
  featuredWindowBlockers,
  isFeaturedActive,
  type FeaturedSchema,
  type FeaturedTerm,
} from './featured-window';
import {
  featuredUsage,
  isHeldBrand,
  promotionBlockers,
  type FeaturedUsage,
  type PromotableListing,
} from './placements';
import { saleActivationBlockers, type SaleState } from './revenue';

/* ------------------------------------------------------------ the checklist */

/**
 * `blocked` refuses the activation. `attention` is a true statement the owner
 * should read before committing but which does not make the write unsafe —
 * the renewal-shortening note is the one that matters commercially.
 */
export type GateState = 'pass' | 'attention' | 'blocked';

/**
 * One line of the checklist. Stable ids so the tests and the browser bench can
 * name a line without matching prose that is meant to be edited freely.
 */
export type GateId =
  | 'payment'
  | 'billing'
  | 'term'
  | 'starts-now'
  | 'listing'
  | 'placement-pages'
  | 'published'
  | 'eligible'
  | 'brand'
  | 'not-already-featured'
  | 'capacity'
  | 'schema';

export type ActivationGate = {
  id: GateId;
  /** What the owner reads. Operational wording, never a column name. */
  label: string;
  state: GateState;
  /** The concrete fact behind the state. Never empty — a bare tick explains nothing. */
  detail: string;
};

/** Every line, in the order the owner works through them. */
export const GATE_ORDER: readonly GateId[] = [
  'payment',
  'billing',
  'term',
  'starts-now',
  'listing',
  'placement-pages',
  'published',
  'eligible',
  'brand',
  'not-already-featured',
  'capacity',
  'schema',
];

export type ActivationChecklist = {
  gates: ActivationGate[];
  /** True only when no line is `blocked`. The console shows ACTIVATE on this. */
  canActivate: boolean;
  /** The instant that will be written to `featured_until`, or null. */
  expiryAt: string | null;
  /** That instant as a day, for display. */
  expiryDay: string | null;
  usage: FeaturedUsage;
  /** Every blocked line's detail, in order. Used for the refusal summary. */
  blockers: string[];
};

/**
 * The listing under review. `city` is presentational only — it is on the row
 * the console already loaded, and naming the town is how an operator confirms
 * they are about to sponsor the right one of two businesses with the same name.
 */
export type ChecklistListing = PromotableListing & { city?: string | null };

export type ChecklistInput = {
  listing: ChecklistListing;
  /** The opportunity the placement is being sold to. Null when none is chosen. */
  sale: SaleState | null;
  /** Null until the operator picks one. */
  billing: FeaturedTerm | null;
  /** Every currently-flagged listing, for the capacity count. */
  existing: PromotableListing[];
  now: Date;
  schema: FeaturedSchema;
  /**
   * A renewal re-sells a placement that already exists, so two lines change
   * meaning: "already sponsored" stops being a blocker, and the capacity count
   * excludes the target from itself.
   */
  mode: 'activate' | 'renew';
};

const DAY_MS = 86_400_000;

function day(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/** Whole days from `now` to `iso`, rounded up. Negative once passed. */
export function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / DAY_MS);
}

const TERM_LABEL: Record<FeaturedTerm, string> = { monthly: 'Monthly', annual: 'Annual' };

/**
 * Every state the operator would otherwise have to hold in their head, decided
 * against live data and expressed in words.
 *
 * Read the delegation carefully — it is the whole design. The `payment` line is
 * not a re-implementation of the sale rules; it is `saleActivationBlockers`
 * called with the exact window the write will use, so the checklist cannot
 * approve a sale the write refuses. Same for `capacity` (`featuredUsage`) and
 * the listing lines (`promotionBlockers`).
 */
export function featuredActivationChecklist(input: ChecklistInput): ActivationChecklist {
  const { listing, sale, billing, existing, now, schema, mode } = input;

  const startsAt = now.toISOString();
  const expiryAt = billing ? featuredExpiryFrom(now, billing).toISOString() : null;
  const usage = featuredUsage(listing, existing, now, schema);
  const gates: ActivationGate[] = [];
  const push = (id: GateId, label: string, state: GateState, detail: string) =>
    gates.push({ id, label, state, detail });

  /* ---------------------------------------------------------------- money */

  const saleBlockers = saleActivationBlockers('featured-listing', sale, {
    startsAt,
    endsAt: expiryAt,
  });
  if (saleBlockers.length)
    push(
      'payment',
      'Payment confirmed',
      'blocked',
      // The sale rules already phrase their own refusals for an operator; the
      // checklist repeats them verbatim rather than paraphrasing, so the line
      // the console shows and the line the write would show are one string.
      saleBlockers.join(' '),
    );
  else
    push(
      'payment',
      'Payment confirmed',
      'pass',
      `${formatCents(sale?.paidCents ?? 0)} received${sale?.paidOn ? ` ${sale.paidOn}` : ''}, confirmed against an agreed ${formatCents(sale?.quotedCents ?? 0)}.`,
    );

  /* ----------------------------------------------------------- the term */

  if (!billing) push('billing', 'Billing period chosen', 'blocked', 'Choose monthly or annual.');
  else if (sale?.term && sale.term !== billing)
    push(
      'billing',
      'Billing period chosen',
      'blocked',
      `${TERM_LABEL[billing]} is selected but the opportunity was sold ${sale.term}. Activate the term that was paid for.`,
    );
  else
    push(
      'billing',
      'Billing period chosen',
      'pass',
      `${TERM_LABEL[billing]}${sale?.term === billing ? ', matching the agreed term.' : '.'}`,
    );

  if (!expiryAt)
    push('term', 'End date that will be written', 'blocked', 'No term to calculate yet.');
  else
    push(
      'term',
      'End date that will be written',
      'pass',
      // The exact value, not a description of one. "One month later" is what
      // the console said before, and it is not something an owner can check
      // against an invoice.
      `${day(expiryAt)} — the placement stops showing on its own that day. Nothing to remember and nothing to switch off.`,
    );

  const windowBlockers = featuredWindowBlockers(null, now, schema);
  const futureStart = windowBlockers.filter((b) => b.includes('starts when you activate'));
  push(
    'starts-now',
    'Starts now',
    futureStart.length ? 'blocked' : 'pass',
    futureStart.length
      ? futureStart.join(' ')
      : `The term begins the moment you press activate — ${day(startsAt)}. A featured listing cannot be booked to start later.`,
  );

  /* -------------------------------------------------------- the listing */

  push(
    'listing',
    'Listing',
    listing.name ? 'pass' : 'blocked',
    listing.name ?? 'This row has no name, so nothing can be shown as sponsored.',
  );

  const where = [listing.city, listing.state].filter(Boolean).join(', ');
  const pages = [
    listing.categorySlug ? `the ${listing.categorySlug} page` : null,
    listing.interstate ? `the ${listing.interstate} page` : null,
  ].filter(Boolean);
  push(
    'placement-pages',
    'Where it will appear',
    listing.categorySlug ? 'pass' : 'blocked',
    listing.categorySlug
      ? `${pages.join(' and ')}${where ? ` · ${where}` : ''}.`
      : 'This listing has no category, so it has no category page to be sponsored on.',
  );

  const listingBlockers = promotionBlockers(listing);
  const has = (fragment: string) => listingBlockers.some((b) => b.includes(fragment));

  push(
    'published',
    'Listing is published',
    has('not published') ? 'blocked' : 'pass',
    has('not published')
      ? 'This listing is not published, so a driver would never see the sponsorship you sold.'
      : 'Live on the public directory.',
  );

  push(
    'eligible',
    'Listing is not deleted or hidden',
    has('deleted') ? 'blocked' : 'pass',
    has('deleted') ? 'This listing is deleted. It has no public page to sponsor.' : 'Not deleted.',
  );

  push(
    'brand',
    'Brand can be sponsored',
    isHeldBrand(listing.name) ? 'blocked' : 'pass',
    isHeldBrand(listing.name)
      ? 'This is a held national brand. Nobody at its local site can sell us a placement, so it is never promoted.'
      : 'Not a held national brand.',
  );

  /* ------------------------------------------- what the row already says */

  const alreadyLive = isFeaturedActive(
    {
      isFeatured: listing.isFeatured,
      isPublished: listing.isPublished,
      deletedAt: listing.deletedAt,
      name: listing.name,
      featuredUntil: listing.featuredUntil,
    },
    now,
    schema,
  );

  if (mode === 'renew')
    push(
      'not-already-featured',
      'Already sponsored',
      'pass',
      alreadyLive
        ? `Yes — this is a renewal of a placement that is live now, ending ${day(listing.featuredUntil ?? null) ?? 'on an unrecorded date'}.`
        : 'The previous term has ended. Renewing brings the placement back.',
    );
  else if (listing.isFeatured)
    push(
      'not-already-featured',
      'Not already sponsored',
      'blocked',
      alreadyLive
        ? `This listing is already sponsored until ${day(listing.featuredUntil ?? null) ?? 'an unrecorded date'}. Use Renew rather than activating a second time.`
        : 'This listing still carries a sponsorship flag from a term that has ended. Use Renew, which replaces the term, rather than activating over it.',
    );
  else
    push('not-already-featured', 'Not already sponsored', 'pass', 'No placement on this listing.');

  /* -------------------------------------------------------- the capacity */

  const catFull = Boolean(usage.category.slug) && usage.category.used >= usage.category.limit;
  const corFull = usage.corridor !== null && usage.corridor.used >= usage.corridor.limit;
  const counts = [
    usage.category.slug
      ? `${usage.category.slug} ${usage.category.used}/${usage.category.limit}`
      : null,
    usage.corridor
      ? `${usage.corridor.corridor} ${usage.corridor.used}/${usage.corridor.limit}`
      : null,
  ].filter(Boolean);
  push(
    'capacity',
    'Room on every page it appears on',
    catFull || corFull ? 'blocked' : 'pass',
    catFull || corFull
      ? `Full: ${counts.join(' · ')}. A listing appears on both its category page and its corridor page, so either being full blocks the sale.`
      : `${counts.join(' · ')}${mode === 'renew' ? ' (this placement is not counted against itself).' : '.'} Sponsorships whose term has ended do not take up a slot.`,
  );

  /* ---------------------------------------------------------- the system */

  push(
    'schema',
    'Expiry tracking is live',
    schema === 'ready' ? 'pass' : 'blocked',
    schema === 'ready'
      ? 'The listing can be given a real end date, so the placement ends itself.'
      : 'The end-date column cannot be read, so a placement switched on now would have no expiry. Activation is blocked until that is fixed.',
  );

  const ordered = GATE_ORDER.map((id) => gates.find((g) => g.id === id)).filter(
    (g): g is ActivationGate => g !== undefined,
  );
  const blockers = ordered.filter((g) => g.state === 'blocked').map((g) => g.detail);

  return {
    gates: ordered,
    canActivate: blockers.length === 0,
    expiryAt,
    expiryDay: day(expiryAt),
    usage,
    blockers,
  };
}

/** `$99.00` from cents. Money is never floated. */
function formatCents(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const part = String(Math.abs(cents) % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${whole.toLocaleString('en-US')}.${part}`;
}

/* ------------------------------------------------ after it has been sold */

/** What the owner is shown about a placement that already exists. */
export type PlacementLiveView = {
  /** The owner's word for the state. Never a status code. */
  headline: 'ACTIVATED' | 'ENDED' | 'WITHHELD' | 'NOT SPONSORED';
  /** The exact end date on the row, or null when none was recorded. */
  expiryDay: string | null;
  /** Whole days until the term ends. Negative once it has passed. */
  daysRemaining: number | null;
  /** What a driver sees right now, in plain words. */
  publicState: string;
  /** The agreed term, when a CRM opportunity records one. */
  term: FeaturedTerm | null;
  termLabel: string;
  canRenew: boolean;
  canStop: boolean;
};

export function placementLiveView(
  listing: PromotableListing,
  term: FeaturedTerm | null,
  now: Date,
  schema: FeaturedSchema,
): PlacementLiveView {
  const live = isFeaturedActive(
    {
      isFeatured: listing.isFeatured,
      isPublished: listing.isPublished,
      deletedAt: listing.deletedAt,
      name: listing.name,
      featuredUntil: listing.featuredUntil,
    },
    now,
    schema,
  );
  const expiryDay = day(listing.featuredUntil ?? null);
  const remaining = daysUntil(listing.featuredUntil ?? null, now);

  let headline: PlacementLiveView['headline'];
  let publicState: string;
  if (!listing.isFeatured) {
    headline = 'NOT SPONSORED';
    publicState = 'This listing shows as an ordinary business, with no Sponsored label.';
  } else if (live) {
    headline = 'ACTIVATED';
    publicState =
      'Labelled Sponsored, sorted first on its pages, and marked on the map. Its hours, services and reviews are unchanged.';
  } else if (expiryDay && remaining !== null && remaining <= 0) {
    headline = 'ENDED';
    publicState =
      'The Sponsored label, the first position and the map treatment are already gone. The business is still published and still listed — only the sponsorship ended.';
  } else {
    // Flagged, but the window rule withheld it: no term, an unreadable term, or
    // a listing that is unpublished, deleted or a held brand.
    headline = 'WITHHELD';
    publicState =
      'Nothing sponsored is showing. The listing carries a sponsorship flag the rules refuse to honour — stop it, or renew it to write a proper term.';
  }

  return {
    headline,
    expiryDay,
    daysRemaining: remaining,
    publicState,
    term,
    termLabel: term ? TERM_LABEL[term] : 'Term length is recorded on the CRM opportunity',
    // A placement can always be stopped, and a renewal is a fresh sale that the
    // checklist gates on its own — neither is withheld by the current state.
    canRenew: schema === 'ready',
    canStop: listing.isFeatured,
  };
}

/* ------------------------------------------------- linking row to opportunity */

/**
 * The audit line `recordAudit` writes into `sponsors.notes` when a featured
 * placement goes live. `locations` has no column pointing at the CRM, so this
 * line IS the link — matching it is reading the audit trail as intended, not
 * inventing a relationship.
 */
const ACTIVATION_NOTE_RE =
  /^Placement activated: Featured listing — (.+?) · billing (monthly|annual) ·/gim;

export type OpportunityNote = { id: string; notes: string | null };

export type FeaturedOpportunityMatch = { id: string; term: FeaturedTerm };

/**
 * Which opportunity paid for the placement on this listing, and on what term.
 *
 * Notes are append-only, so the LAST activation line for a listing is the
 * current one — a renewal writes a new line above nothing and below everything.
 * Reading the first match would report the term of the original sale forever,
 * which is the same last-match bug `readSaleState` documents.
 *
 * Returns null rather than guessing. A placement with no matching opportunity
 * is a real state — the row could have been flagged by an import, or by an
 * activation whose audit note failed to write, both of which the owner should
 * see as an absence rather than as a term somebody invented.
 */
export function matchFeaturedOpportunity(
  listingName: string | null,
  opportunities: readonly OpportunityNote[],
): FeaturedOpportunityMatch | null {
  const target = (listingName ?? '').trim().toLowerCase();
  if (!target) return null;
  let best: FeaturedOpportunityMatch | null = null;
  for (const o of opportunities) {
    const notes = o.notes ?? '';
    ACTIVATION_NOTE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ACTIVATION_NOTE_RE.exec(notes)) !== null) {
      if (m.index === ACTIVATION_NOTE_RE.lastIndex) ACTIVATION_NOTE_RE.lastIndex++;
      if (m[1].trim().toLowerCase() !== target) continue;
      best = { id: o.id, term: m[2] as FeaturedTerm };
    }
  }
  ACTIVATION_NOTE_RE.lastIndex = 0;
  return best;
}

/* --------------------------------------------------------------- renewal */

export type RenewalEffect = {
  /** Days of the current term still unused. Zero once it has passed. */
  unusedDays: number;
  /** The end date a renewal written now would carry. */
  newExpiryDay: string;
  /** Whether renewing now costs the business time it already paid for. */
  losesTime: boolean;
  /** One sentence stating exactly what renewing now does. */
  note: string;
};

/**
 * What renewing RIGHT NOW does to the term, stated in days.
 *
 * REVENUE-2 chose to run a renewal from `now` rather than from the old expiry,
 * and documented the expired case ("extending from a lapsed date would hand
 * back days the business did not pay for"). It did not state the other half:
 * renewing a placement that is still running REPLACES the remaining days rather
 * than adding to them, so a monthly placement renewed with twelve days left
 * gets one month from today and the business loses those twelve days.
 *
 * That behaviour is preserved — the alternative needs a scheduled start, which
 * Model B does not have, and changing it silently is exactly what REVENUE-3 is
 * told not to do. What changes is that the console now SAYS it before the
 * operator commits, which turns a hidden implementation detail into a priced
 * decision: renew on the last day, or knowingly give the days away.
 */
export function renewalEffect(
  currentUntil: string | null | undefined,
  billing: FeaturedTerm,
  now: Date,
): RenewalEffect {
  const newExpiry = featuredExpiryFrom(now, billing);
  const newExpiryDay = newExpiry.toISOString().slice(0, 10);
  const remaining = daysUntil(currentUntil ?? null, now);
  const unusedDays = remaining !== null && remaining > 0 ? remaining : 0;

  if (unusedDays === 0)
    return {
      unusedDays: 0,
      newExpiryDay,
      losesTime: false,
      note: `The current term has already ended, so a renewal adds a full ${billing === 'annual' ? 'year' : 'month'} from today and runs to ${newExpiryDay}. No paid time is lost.`,
    };

  return {
    unusedDays,
    newExpiryDay,
    losesTime: true,
    note: `This placement still has ${unusedDays} paid ${unusedDays === 1 ? 'day' : 'days'} left. A renewal runs from today, so it REPLACES ${unusedDays === 1 ? 'that day' : `those ${unusedDays} days`} rather than adding to them — the new term ends ${newExpiryDay}. Renew on the last day of the term to give none of it away.`,
  };
}

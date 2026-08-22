/**
 * The daily revenue queue — CRM rows turned into an ordered list of work.
 *
 * WHAT THIS EXISTS TO FIX
 *
 * REVENUE-1 built the sale rules, REVENUE-2 gave a placement a real term, and
 * REVENUE-3 made activation safe to press. What none of them built is the thing
 * an owner actually opens in the morning: a list that says who to call, in what
 * order, and why.
 *
 * Reproduced on `main` at b7ecded, the revenue console shows twelve summary
 * tiles, a renewal queue, a "paid, ready to activate" list, a 900px-wide
 * opportunities table and a five-step detail form. Every fact is there. What is
 * missing is the ORDER — nothing on the page says a paid customer waiting to go
 * live matters more than a prospect nobody has rung yet, so the operator has to
 * hold that judgement in their head every time they open it.
 *
 * THREE RULES THIS MODULE KEEPS
 *
 *   1. **No second CRM.** Every value here is derived from columns that already
 *      exist and from the authorities that already own them — `revenue.ts` for
 *      the sale, `offers.ts` for money, `featured-window.ts` for a live
 *      featured term. This module ORDERS and NAMES; it never decides.
 *
 *   2. **Live means live, not "the CRM thinks so".** `sponsors.status` is a
 *      mirror written when a placement is activated, and mirrors drift: on
 *      `main`, stopping a featured listing never clears it, so a stopped
 *      placement still reads `status = 'active'` with its old renewal date. So
 *      liveness comes from the placement authority — `locations.featured_until`
 *      for a featured listing, the `starts_at`/`ends_at` window for a corridor
 *      sponsor — and the CRM mirror is only a hint about which rows to check.
 *
 *   3. **Nothing is invented.** A missing next action is reported as missing,
 *      never back-filled with a date. An amount nobody agreed is shown as the
 *      list price and labelled as one. A queue that quietly invents its own
 *      facts is worse than no queue.
 */

import {
  formatPrice,
  getOffer,
  standardAmountCents,
  type BillingPeriod,
  type OfferId,
} from './offers';
import { STAGE_LABEL, type SaleState } from './revenue';
import { isFeaturedActive, type FeaturedSchema } from './featured-window';
import { isWithinWindow } from './placements';

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for an instant, in UTC. */
function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Whole days from `now` to a `YYYY-MM-DD`. Negative once passed. */
function daysToDay(target: string | null | undefined, now: Date): number | null {
  if (!target || !DAY_RE.test(target)) return null;
  const t = Date.parse(`${target}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.parse(`${day(now)}T00:00:00Z`)) / DAY_MS);
}

/** Whole days from `now` to an ISO instant, rounded up. Negative once passed. */
function daysToInstant(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / DAY_MS);
}

/* ------------------------------------------------------------ next action */

/**
 * Where a next action sits against today.
 *
 * `none` is deliberately its own state rather than being folded into `overdue`.
 * On `main` the summary counts both as "overdue next actions", which reads as
 * one problem and is two: a date that has passed needs the call made, and a
 * missing date needs a decision about what happens next. They are fixed
 * differently, so the queue names them differently.
 */
export type NextActionState = 'overdue' | 'today' | 'upcoming' | 'none';

export const NEXT_ACTION_LABEL: Record<NextActionState, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Scheduled',
  none: 'No next step set',
};

export function nextActionState(
  action: string | null | undefined,
  date: string | null | undefined,
  now: Date,
): NextActionState {
  if (!action?.trim() || !date || !DAY_RE.test(date)) return 'none';
  const delta = daysToDay(date, now);
  if (delta === null) return 'none';
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  return 'upcoming';
}

/* --------------------------------------------------------- the placement */

/**
 * Whether this opportunity has a placement running RIGHT NOW, read from the
 * authority rather than from the CRM mirror.
 *
 * `listingId` is carried so the console can hand the operator straight into the
 * REVENUE-3 renewal checklist for the exact listing, rather than making them
 * search for a business the application already identified.
 */
export type PlacementState =
  | { kind: 'none' }
  | {
      kind: 'featured';
      live: boolean;
      endsAt: string | null;
      daysRemaining: number | null;
      listingId: string;
      listingName: string | null;
    }
  | {
      kind: 'corridor';
      live: boolean;
      endsAt: string | null;
      daysRemaining: number | null;
      sponsorId: string;
      sponsorName: string;
    };

/** The `locations` fields the featured authority needs. Nothing commercial. */
export type FeaturedPlacementRow = {
  id: string;
  name: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  deletedAt: string | null;
  featuredUntil?: string | null;
};

/** The `directory_sponsors` fields the corridor authority needs. */
export type CorridorPlacementRow = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export function featuredPlacementState(
  row: FeaturedPlacementRow,
  now: Date,
  schema: FeaturedSchema,
): PlacementState {
  return {
    kind: 'featured',
    live: isFeaturedActive(
      {
        isFeatured: row.isFeatured,
        isPublished: row.isPublished,
        deletedAt: row.deletedAt,
        name: row.name,
        featuredUntil: row.featuredUntil,
      },
      now,
      schema,
    ),
    endsAt: row.featuredUntil ?? null,
    daysRemaining: daysToInstant(row.featuredUntil ?? null, now),
    listingId: row.id,
    listingName: row.name,
  };
}

export function corridorPlacementState(row: CorridorPlacementRow, now: Date): PlacementState {
  return {
    kind: 'corridor',
    live: row.active && isWithinWindow({ startsAt: row.startsAt, endsAt: row.endsAt }, now),
    endsAt: row.endsAt,
    daysRemaining: daysToInstant(row.endsAt, now),
    sponsorId: row.id,
    sponsorName: row.name,
  };
}

/* -------------------------------------------------------- the sale step */

/**
 * Where the money is, in the words a seller uses.
 *
 * Deliberately NOT the `stage` column. `stage` is a pipeline position an
 * operator sets by hand; this is what is actually true about the deal, derived
 * from the payment, the quote and the live placement. The two can disagree —
 * a row can sit at `closed_won` with nothing paid — and when they do, this
 * reports the money.
 */
export type SaleStep =
  | 'lead'
  | 'contacted'
  | 'quoted'
  | 'committed'
  | 'paid'
  | 'live'
  | 'renewal'
  | 'lost';

export const SALE_STEP_LABEL: Record<SaleStep, string> = {
  lead: 'New lead',
  contacted: 'In conversation',
  quoted: 'Quoted',
  committed: 'Said yes — not paid',
  paid: 'Paid — ready to activate',
  live: 'Live',
  renewal: 'Renewal',
  lost: 'Closed lost',
};

/* --------------------------------------------------------- the buckets */

/**
 * Which pile of work an opportunity belongs in. The order of this list IS the
 * priority order, and the one rule that matters commercially is the first
 * entry: a business that has already paid outranks everything, because the only
 * thing standing between that money and a live placement is the operator.
 */
export const MONEY_BUCKETS = [
  'ready-to-activate',
  'awaiting-payment',
  'follow-up-overdue',
  'follow-up-today',
  'quoted-waiting',
  'new-lead',
  'renewal-approaching',
] as const;

export type MoneyBucket = (typeof MONEY_BUCKETS)[number];

/** Piles that are NOT work today. Kept out of the queue, counted in the summary. */
export type RestingBucket = 'live' | 'later' | 'lost';

export type Bucket = MoneyBucket | RestingBucket;

export const BUCKET_LABEL: Record<Bucket, string> = {
  'ready-to-activate': 'Paid — activate now',
  'awaiting-payment': 'Said yes — chase the payment',
  'follow-up-overdue': 'Follow-up overdue',
  'follow-up-today': 'Follow up today',
  'quoted-waiting': 'Quoted — no answer yet',
  'new-lead': 'New lead',
  'renewal-approaching': 'Renewal coming up',
  live: 'Live',
  later: 'Scheduled for later',
  lost: 'Closed lost',
};

/** How many days before a term ends the queue starts asking for the renewal. */
export const RENEWAL_QUEUE_LEAD_DAYS = 30;

/* ------------------------------------------------------------- the view */

export type OpportunityView = {
  id: string;
  /** 1 · Who? */
  company: string;
  /** 2 · What are we selling? Null when no offer is recorded yet. */
  offerId: OfferId | null;
  product: string;
  /** 3 · How much? */
  amountCents: number | null;
  amountLabel: string;
  /** False when the figure is the list price rather than something agreed. */
  amountIsAgreed: boolean;
  term: BillingPeriod | null;
  /** 4 · Where are we in the sale? */
  saleStep: SaleStep;
  saleStepLabel: string;
  /** The operator-set pipeline position, kept for reference. */
  stageLabel: string;
  /** 5 · What do I do next? */
  nextAction: string | null;
  nextActionDate: string | null;
  nextActionState: NextActionState;
  /** Whole days late. Positive only when overdue. */
  daysOverdue: number | null;
  placement: PlacementState;
  bucket: Bucket;
  /** Lower sorts first. Stable across renders. */
  rank: number;
  /** Set when a renewal now would replace paid days the business still has. */
  renewalCost: { unusedDays: number } | null;
};

export type OpportunityInput = {
  id: string;
  company: string | null;
  sale: SaleState;
  /** The row's own `next_action` text. */
  nextAction: string | null;
  /** The row's own `next_action_date`. */
  nextActionDate: string | null;
  /** The placement this opportunity paid for, from the authority. */
  placement: PlacementState;
  createdAt: string;
};

/**
 * Turn one CRM row into the five answers, its pile and its rank.
 *
 * The delegation is the design, exactly as in REVENUE-3's checklist: the sale
 * state comes from `readSaleState`, money from `offers.ts`, liveness from the
 * placement authority. What is decided here — and only here — is which pile the
 * row belongs in and how urgent it is inside that pile.
 */
export function opportunityView(input: OpportunityInput, now: Date): OpportunityView {
  const { sale, placement } = input;
  const offer = sale.offerId ? getOffer(sale.offerId) : null;

  /* ---- 3 · how much ---- */
  const standard = sale.offerId && sale.term ? standardAmountCents(sale.offerId, sale.term) : null;
  const agreed = sale.quotedCents > 0;
  const amountCents = agreed ? sale.quotedCents : standard;
  const amountIsAgreed = agreed;

  /* ---- 4 · where are we ---- */
  const paidInFull =
    sale.paymentConfirmed && sale.paidCents > 0 && sale.paidCents >= sale.quotedCents;
  const committed = sale.stage === 'committed' || sale.stage === 'closed_won';
  const live = placement.kind !== 'none' && placement.live;

  let saleStep: SaleStep;
  if (sale.stage === 'closed_lost') saleStep = 'lost';
  else if (live) saleStep = 'live';
  else if (paidInFull && committed) saleStep = 'paid';
  else if (committed) saleStep = 'committed';
  else if (agreed && sale.term) saleStep = 'quoted';
  else if (sale.stage === 'contacted' || sale.stage === 'warm') saleStep = 'contacted';
  else saleStep = 'lead';

  /* ---- 5 · what next ---- */
  const naState = nextActionState(input.nextAction, input.nextActionDate, now);
  const delta = daysToDay(input.nextActionDate, now);
  const daysOverdue = naState === 'overdue' && delta !== null ? -delta : null;

  /* ---- renewal, and what renewing now would cost ---- */
  const daysRemaining = placement.kind === 'none' ? null : placement.daysRemaining;
  const renewalSoon = live && daysRemaining !== null && daysRemaining <= RENEWAL_QUEUE_LEAD_DAYS;
  // Model B, preserved from REVENUE-2 and made visible by REVENUE-3: a renewal
  // runs from the day it is pressed, so renewing a term that is still running
  // REPLACES the days left rather than adding to them. Surfaced here so the
  // queue can say so before the operator opens the renewal checklist.
  const renewalCost =
    placement.kind === 'featured' && live && daysRemaining !== null && daysRemaining > 0
      ? { unusedDays: daysRemaining }
      : null;

  /* ---- the pile ---- */
  let bucket: Bucket;
  if (saleStep === 'lost') bucket = 'lost';
  else if (saleStep === 'paid') bucket = 'ready-to-activate';
  else if (live && renewalSoon) bucket = 'renewal-approaching';
  else if (live) bucket = 'live';
  else if (saleStep === 'committed') bucket = 'awaiting-payment';
  else if (naState === 'overdue') bucket = 'follow-up-overdue';
  else if (naState === 'today') bucket = 'follow-up-today';
  else if (saleStep === 'quoted') bucket = 'quoted-waiting';
  else if (naState === 'upcoming') bucket = 'later';
  else bucket = 'new-lead';

  return {
    id: input.id,
    company: (input.company ?? '').trim() || '(unnamed business)',
    offerId: sale.offerId,
    product: offer ? offer.name : 'No offer recorded',
    amountCents,
    amountLabel: amountCents === null ? 'No amount recorded' : formatPrice(amountCents),
    amountIsAgreed,
    term: sale.term,
    saleStep,
    saleStepLabel: SALE_STEP_LABEL[saleStep],
    stageLabel: STAGE_LABEL[sale.stage],
    nextAction: input.nextAction?.trim() || null,
    nextActionDate: input.nextActionDate,
    nextActionState: naState,
    daysOverdue,
    placement,
    bucket,
    rank: rankOf(bucket, daysOverdue, daysRemaining, input.createdAt),
    renewalCost,
  };
}

/**
 * Sort key. Bucket first — that is the commercial decision — then urgency
 * inside the bucket, then age so the order never flickers between renders.
 *
 * Encoded as one number so callers cannot accidentally re-sort by a single
 * dimension and bury a paid customer under a cold lead.
 */
function rankOf(
  bucket: Bucket,
  daysOverdue: number | null,
  daysRemaining: number | null,
  createdAt: string,
): number {
  const order: Bucket[] = [...MONEY_BUCKETS, 'live', 'later', 'lost'];
  const base = order.indexOf(bucket) * 1_000_000;
  // Most overdue first; soonest expiry first; oldest row first.
  const urgency =
    daysOverdue !== null
      ? Math.max(0, 10_000 - Math.min(daysOverdue, 9_999)) * 100
      : daysRemaining !== null
        ? Math.max(0, Math.min(daysRemaining, 9_999)) * 100
        : 500_000;
  const age = Math.min(99, Math.floor((Date.parse(createdAt) || 0) / 1e12));
  return base + urgency + age;
}

/* ------------------------------------------------------- the collections */

/** The prioritized daily list. Resting piles are excluded by construction. */
export function moneyQueue(views: readonly OpportunityView[]): OpportunityView[] {
  return views
    .filter((v) => (MONEY_BUCKETS as readonly string[]).includes(v.bucket))
    .sort((a, b) => a.rank - b.rank || a.company.localeCompare(b.company));
}

export type PipelineBuckets = {
  newLeads: number;
  followUpToday: number;
  followUpOverdue: number;
  quoted: number;
  awaitingPayment: number;
  readyToActivate: number;
  live: number;
  renewalsDue: number;
  /** Open opportunities carrying no next step at all. */
  missingNextAction: number;
  total: number;
};

/**
 * The counts the summary shows. Every one is a count of the SAME views the
 * queue is built from, so a tile and the list underneath it can never disagree.
 */
export function pipelineBuckets(views: readonly OpportunityView[]): PipelineBuckets {
  const count = (b: Bucket) => views.filter((v) => v.bucket === b).length;
  return {
    newLeads: count('new-lead'),
    followUpToday: count('follow-up-today'),
    followUpOverdue: count('follow-up-overdue'),
    quoted: count('quoted-waiting'),
    awaitingPayment: count('awaiting-payment'),
    readyToActivate: count('ready-to-activate'),
    live: count('live') + count('renewal-approaching'),
    renewalsDue: count('renewal-approaching'),
    missingNextAction: views.filter(
      (v) => v.nextActionState === 'none' && v.bucket !== 'lost' && v.bucket !== 'live',
    ).length,
    total: views.length,
  };
}

/* -------------------------------------------------------- renewal queue */

export type RenewalStanding = 'approaching' | 'due' | 'expired';

export const RENEWAL_STANDING_LABEL: Record<RenewalStanding, string> = {
  approaching: 'Renewal approaching',
  due: 'Renewal due',
  expired: 'Ended — needs contact',
};

/** How many days out a renewal stops being "approaching" and becomes "due". */
export const RENEWAL_DUE_DAYS = 7;

/**
 * Where a placement sits against its own end date, from the placement
 * authority. Returns null when this opportunity has no placement to renew.
 *
 * `expired` is reached only for a placement that WAS sold — a row that never
 * went live is a lost deal, not an expired one.
 */
export function renewalStanding(
  view: OpportunityView,
  now: Date,
): { standing: RenewalStanding; days: number } | null {
  const p = view.placement;
  if (p.kind === 'none') return null;
  const days = p.daysRemaining;
  if (days === null) return null;
  if (!p.live) return days <= 0 ? { standing: 'expired', days } : null;
  if (days <= RENEWAL_DUE_DAYS) return { standing: 'due', days };
  if (days <= RENEWAL_QUEUE_LEAD_DAYS) return { standing: 'approaching', days };
  return null;
}

export function renewalQueue(
  views: readonly OpportunityView[],
  now: Date,
): Array<OpportunityView & { standing: RenewalStanding; days: number }> {
  const order: RenewalStanding[] = ['expired', 'due', 'approaching'];
  return views
    .map((v) => {
      const r = renewalStanding(v, now);
      return r ? { ...v, ...r } : null;
    })
    .filter((v): v is OpportunityView & { standing: RenewalStanding; days: number } => v !== null)
    .sort(
      (a, b) =>
        order.indexOf(a.standing) - order.indexOf(b.standing) ||
        a.days - b.days ||
        a.company.localeCompare(b.company),
    );
}

/* -------------------------------------------------------------- filtering */

export type QueueFilter = {
  /** Free text against the business name. */
  q?: string;
  bucket?: Bucket | '';
  offerId?: OfferId | '';
  nextAction?: NextActionState | '';
};

/**
 * Server-side filtering. Deliberately not a client island: the whole set is
 * already on the server, and shipping a CRM to the browser to filter a list an
 * owner can read in one screen would cost bundle for nothing.
 */
export function matchesFilter(view: OpportunityView, filter: QueueFilter): boolean {
  if (filter.q?.trim()) {
    const needle = filter.q.trim().toLowerCase();
    if (!view.company.toLowerCase().includes(needle)) return false;
  }
  if (filter.bucket && view.bucket !== filter.bucket) return false;
  if (filter.offerId && view.offerId !== filter.offerId) return false;
  if (filter.nextAction && view.nextActionState !== filter.nextAction) return false;
  return true;
}

/* ------------------------------------------------- the activation handoff */

/**
 * The link that carries an opportunity into the REVENUE-3 placement checklist.
 *
 * A LINK, and nothing else. This performs no write, activates nothing and
 * decides nothing — every gate still runs on the placements console, where the
 * operator types ACTIVATE. What it removes is the step REVENUE-3 left behind:
 * the revenue console still tells the operator to copy a CRM row id by hand
 * ("Copy this CRM row id into the placements console: 3333…"), which is exactly
 * the defect REVENUE-3 fixed on the other side of the handoff.
 *
 * Returns null when there is nothing safe to hand over — no offer recorded, or
 * an offer this route does not serve — rather than a link that would land the
 * operator on a screen that cannot help them.
 */
export function activationHandoffHref(view: OpportunityView): string | null {
  if (!view.offerId) return null;
  const params = new URLSearchParams();

  if (view.offerId === 'featured-listing') {
    // A renewal knows its listing, so it can go straight to the checklist. A
    // first activation does not, so the operator picks it — the console's own
    // search step, not a guess made here.
    if (view.placement.kind === 'featured') params.set('renew', view.placement.listingId);
    params.set('sale', view.id);
    if (view.term) params.set('billing', view.term);
    return `/admin/directory/placements?${params.toString()}#review`;
  }

  if (view.offerId === 'corridor-sponsor') {
    // Corridor sponsorship has no per-listing checklist; the console's own
    // activation form is the destination.
    return '/admin/directory/placements#corridor';
  }

  // A free listing claim is not a placement and has nothing to activate.
  return null;
}

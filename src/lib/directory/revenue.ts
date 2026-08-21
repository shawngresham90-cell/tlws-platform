/**
 * Revenue operations — the rules between "an inquiry arrived" and "a paid
 * placement is live", expressed as pure functions with no I/O.
 *
 * The platform could already *activate* a placement before this module existed
 * (`placements.ts` answers "is this target promotable, and is the page full?").
 * What it could not do was refuse to activate one that nobody had paid for:
 * the CRM link was an optional free-text box, and no code anywhere read
 * `pledged_cents` or `paid_cents`. This module is the missing half — the SALE
 * side of the gate. `placements.ts` stays the PLACEMENT side, and an activation
 * has to clear both.
 *
 * Three deliberate constraints shape everything here:
 *
 *   1. **No migration.** Every fact is stored in a column that already exists
 *      (`stage`, `status`, `pledged_cents`, `paid_cents`, `next_action`,
 *      `next_action_date`, `tier_interest`) or as one labelled line appended to
 *      `notes` — the same "Label: value" convention the inquiry funnel and the
 *      claim review already use. Money lives in the integer cent columns, never
 *      parsed back out of prose.
 *
 *   2. **No payment processor.** Payment is recorded by a human after it
 *      cleared somewhere else. Nothing here takes a card, and
 *      `paymentInstrumentBlockers` actively refuses text that looks like one.
 *
 *   3. **Gated progression.** A new inquiry cannot become a live public
 *      placement in one move. Stages advance one step at a time, and activation
 *      requires a committed-or-won stage, a confirmed payment, and a term that
 *      matches what was quoted.
 */

import {
  type BillingPeriod,
  type OfferId,
  formatPrice,
  getOffer,
  isBillingPeriod,
  isOfferId,
  standardAmountCents,
} from './offers';
import type { PlacementKind } from './placements';

/* ------------------------------------------------------------------ stages */

/** The `sponsors.stage` vocabulary (migration 006 CHECK). */
export const SPONSOR_STAGES = [
  'prospect',
  'contacted',
  'warm',
  'committed',
  'closed_won',
  'closed_lost',
] as const;

export type SponsorStage = (typeof SPONSOR_STAGES)[number];

export function isSponsorStage(value: unknown): value is SponsorStage {
  return typeof value === 'string' && (SPONSOR_STAGES as readonly string[]).includes(value);
}

export const STAGE_LABEL: Record<SponsorStage, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  warm: 'Warm',
  committed: 'Committed',
  closed_won: 'Closed won',
  closed_lost: 'Closed lost',
};

/**
 * Which stage may follow which. The point is the absences: nothing reaches
 * `closed_won` without passing through `committed`, and no single control moves
 * a brand-new inquiry to a state that would let it go live. A deal can be lost
 * from any open stage, and a lost or won deal can be re-opened at `contacted`
 * (a renewal conversation restarts there rather than pretending it never ended).
 */
export const STAGE_TRANSITIONS: Record<SponsorStage, readonly SponsorStage[]> = {
  prospect: ['contacted', 'closed_lost'],
  contacted: ['warm', 'closed_lost'],
  warm: ['committed', 'closed_lost'],
  committed: ['closed_won', 'closed_lost'],
  closed_won: ['contacted'],
  closed_lost: ['contacted'],
};

export function canTransition(from: SponsorStage, to: SponsorStage): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

/** Why a stage move is refused, or `[]` when it is allowed. */
export function stageTransitionBlockers(
  from: SponsorStage,
  to: SponsorStage,
  reason: string,
): string[] {
  const out: string[] = [];
  if (from === to) {
    out.push(`This opportunity is already ${STAGE_LABEL[to].toLowerCase()}.`);
    return out;
  }
  if (!canTransition(from, to)) {
    const allowed = STAGE_TRANSITIONS[from].map((s) => STAGE_LABEL[s]).join(' or ');
    out.push(
      `${STAGE_LABEL[from]} cannot move straight to ${STAGE_LABEL[to]}. From here: ${allowed || 'nothing'}.`,
    );
  }
  // A loss is the one outcome that has to be explained, because it is the one
  // the pipeline numbers can otherwise quietly absorb.
  if (to === 'closed_lost' && !reason.trim())
    out.push('Closing an opportunity as lost needs a short reason.');
  return out;
}

/* ------------------------------------------------------- payment instrument */

/**
 * Patterns that must never reach the database. The platform takes no card
 * details anywhere, so a reference or a note that looks like an instrument is
 * either a mistake or an attempt to use the CRM as a card vault — both are
 * refused rather than stored and redacted later.
 */
const INSTRUMENT_PATTERNS: [RegExp, string][] = [
  [/\b(?:\d[ -]?){13,19}\b/, 'what looks like a card number'],
  [/\bcvv2?\b|\bcvc\b|\bsecurity code\b/i, 'a card security code'],
  [/\brouting\s*(?:number|no\.?|#)/i, 'a bank routing number'],
  [/\baccount\s*(?:number|no\.?|#)\s*[:=]?\s*\d{4,}/i, 'a bank account number'],
  [/\b(?:exp(?:iry|iration)?)\s*[:=]?\s*\d{2}\s*\/\s*\d{2,4}\b/i, 'a card expiry date'],
  [/\b(?:password|passcode|pin)\s*[:=]\s*\S/i, 'a credential'],
];

/**
 * Refuse free text that carries payment-instrument or credential data. Applied
 * to every operator-typed field that is persisted — references, reasons, notes.
 */
export function paymentInstrumentBlockers(value: string, fieldLabel: string): string[] {
  for (const [re, what] of INSTRUMENT_PATTERNS) {
    if (re.test(value))
      return [
        `${fieldLabel} contains ${what}. This platform never stores payment details — remove it and record only a reference you already have (an invoice number, "bank transfer", "check 1042").`,
      ];
  }
  return [];
}

/* -------------------------------------------------------------- the quote */

/** A bounded free-text field, trimmed and capped. Never silently truncated mid-use. */
export const MAX_REASON = 300;
export const MAX_REFERENCE = 80;

export type Quote = {
  offerId: OfferId;
  term: BillingPeriod;
  /** What the business was actually quoted, in cents. */
  quotedCents: number;
  /** Required only when `quotedCents` differs from the standard price. */
  reason: string;
  /** Who recorded it — the audit actor label, not an account. */
  recordedBy: string;
};

/**
 * Why a quote cannot be recorded, or `[]` when it is sound.
 *
 * A discount is allowed but never silent: it has to be an explicit amount with
 * a written reason, and it never rewrites the standard price — the offer module
 * stays the authority, and the quoted figure is stored separately against the
 * one deal it applies to.
 */
export function quoteBlockers(q: Quote): string[] {
  const out: string[] = [];
  if (!isOfferId(q.offerId)) return ['Choose one of the approved offers.'];
  const offer = getOffer(q.offerId);

  if (!offer.paid) {
    return [`${offer.name} is free. There is nothing to quote and nothing to pay.`];
  }
  if (!isBillingPeriod(q.term) || !offer.terms.includes(q.term))
    out.push(`${offer.name} is sold monthly or annually — choose one.`);
  if (!q.recordedBy.trim()) out.push('Record who agreed this — it is the audit trail.');

  if (!Number.isInteger(q.quotedCents) || q.quotedCents <= 0)
    out.push('A quoted amount must be a whole number of cents above zero.');

  const standard = isBillingPeriod(q.term) ? standardAmountCents(q.offerId, q.term) : null;
  if (standard !== null && q.quotedCents > 0 && q.quotedCents !== standard) {
    if (!q.reason.trim())
      out.push(
        `The quote is ${formatPrice(q.quotedCents)} against a standard ${formatPrice(standard)}. A different price needs a written reason.`,
      );
    if (q.reason.length > MAX_REASON) out.push(`Keep the reason under ${MAX_REASON} characters.`);
  }
  out.push(...paymentInstrumentBlockers(q.reason, 'The reason'));
  return out;
}

/** True when a quote is below the standard price for its offer and term. */
export function isDiscounted(q: Pick<Quote, 'offerId' | 'term' | 'quotedCents'>): boolean {
  const standard = standardAmountCents(q.offerId, q.term);
  return standard !== null && q.quotedCents < standard;
}

/* ------------------------------------------------------------- the payment */

export type PaymentEntry = {
  /** What actually arrived, in cents. */
  paidCents: number;
  /** The day it arrived, `YYYY-MM-DD`. */
  paidOn: string;
  /** The owner ticking "yes, I have seen this money". Never inferred. */
  confirmed: boolean;
  /** Only ever a reference the owner already holds. Optional, never invented. */
  reference: string;
  recordedBy: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayValue(day: string): number | null {
  if (!DAY_RE.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/** `YYYY-MM-DD` for an instant, in UTC. */
export function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Why a payment cannot be recorded against this quote, or `[]` when it can.
 *
 * Recording a payment is a statement of fact about money that already moved.
 * Nothing here creates, requests, or predicts a payment, and every field is
 * something the owner can only know by having looked at their own account.
 */
export function paymentBlockers(
  quoted: Pick<Quote, 'offerId' | 'term' | 'quotedCents'>,
  p: PaymentEntry,
  now: Date,
): string[] {
  const out: string[] = [];
  if (!isOfferId(quoted.offerId)) return ['Record the agreed offer first.'];
  const offer = getOffer(quoted.offerId);
  if (!offer.paid) return [`${offer.name} is free. Do not record a payment against it.`];

  if (!Number.isInteger(p.paidCents) || p.paidCents <= 0)
    out.push('A recorded payment must be a whole number of cents above zero.');
  if (quoted.quotedCents <= 0) out.push('Record the agreed amount before recording a payment.');
  if (p.paidCents > 0 && quoted.quotedCents > 0 && p.paidCents < quoted.quotedCents)
    out.push(
      `Only ${formatPrice(p.paidCents)} of the agreed ${formatPrice(quoted.quotedCents)} is recorded. A placement cannot go live part-paid — record the rest, or re-quote with a reason.`,
    );

  const paid = dayValue(p.paidOn);
  if (paid === null) out.push('The payment date must be a real date (YYYY-MM-DD).');
  else if (paid > now.getTime()) out.push('The payment date cannot be in the future.');

  if (!p.confirmed)
    out.push(
      'Confirm you have actually seen the money. Nothing goes live on an unconfirmed payment.',
    );
  if (!p.recordedBy.trim()) out.push('Record who confirmed the payment — it is the audit trail.');
  if (p.reference.length > MAX_REFERENCE)
    out.push(`Keep the payment reference under ${MAX_REFERENCE} characters.`);
  out.push(...paymentInstrumentBlockers(p.reference, 'The payment reference'));
  return out;
}

/* --------------------------------------------------- the CRM row, parsed */

/** The subset of a `sponsors` row this module reasons about. */
export type SponsorSaleRow = {
  id: string;
  stage: string | null;
  status: string | null;
  tierInterest: string | null;
  pledgedCents: number | null;
  paidCents: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string | null;
};

/** Everything the sale side of the gate needs, derived from the row. */
export type SaleState = {
  id: string;
  stage: SponsorStage;
  /** The approved offer recorded against the row, when it is one of ours. */
  offerId: OfferId | null;
  /** The agreed term, read back from the labelled note line. */
  term: BillingPeriod | null;
  quotedCents: number;
  paidCents: number;
  /** True only when a `Payment confirmed:` line exists. */
  paymentConfirmed: boolean;
  paidOn: string | null;
  paymentReference: string | null;
  closedLostReason: string | null;
  renewalDate: string | null;
};

/**
 * Notes are APPEND-ONLY, so a fact can be stated more than once and the LAST
 * statement is the current one. Every regex here is global and read through
 * `lastMatch` for that reason.
 *
 * Reading the first match instead is not a stylistic difference, it is a money
 * bug: quote a deal monthly, have the business switch to annual, re-quote — and
 * a first-match read still reports `monthly`. The activation gate would then
 * refuse the correct twelve-month window, and the way to make it "work" would
 * be to give an annual-paying sponsor a one-month placement.
 */
const TERM_RE = /^Agreed offer:.*?·\s*(monthly|annual)\s*·/gim;
const PAYMENT_RE = /^Payment confirmed:.*?received (\d{4}-\d{2}-\d{2})/gim;
const PAYMENT_REF_RE = /^Payment confirmed:.*?·\s*ref:\s*(.+?)\s*(?:·|$)/gim;
const CLOSED_LOST_RE = /^Closed lost:\s*reason\s*—\s*(.+?)\s*(?:·|$)/gim;

/** The final match of a global regex, or null. Resets `lastIndex` on the way in. */
function lastMatch(re: RegExp, text: string): RegExpExecArray | null {
  re.lastIndex = 0;
  let found: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found = m;
    // A zero-length match would spin forever; step past it.
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  re.lastIndex = 0;
  return found;
}

export function readSaleState(row: SponsorSaleRow): SaleState {
  const notes = row.notes ?? '';
  const term = lastMatch(TERM_RE, notes);
  const payment = lastMatch(PAYMENT_RE, notes);
  const ref = lastMatch(PAYMENT_REF_RE, notes);
  const lost = lastMatch(CLOSED_LOST_RE, notes);
  return {
    id: row.id,
    stage: isSponsorStage(row.stage) ? row.stage : 'prospect',
    offerId: isOfferId(row.tierInterest) ? row.tierInterest : null,
    term: term && isBillingPeriod(term[1]) ? term[1] : null,
    quotedCents: Math.max(0, row.pledgedCents ?? 0),
    paidCents: Math.max(0, row.paidCents ?? 0),
    paymentConfirmed: payment !== null,
    paidOn: payment ? payment[1] : null,
    paymentReference: ref ? ref[1].slice(0, MAX_REFERENCE) : null,
    closedLostReason: lost ? lost[1].slice(0, MAX_REASON) : null,
    renewalDate: DAY_RE.test(row.nextActionDate ?? '') ? row.nextActionDate : null,
  };
}

/* ------------------------------------------------------- the activation gate */

/** Which offer each placement mechanism is allowed to serve. */
export const KIND_OFFER: Record<PlacementKind, OfferId> = {
  'featured-listing': 'featured-listing',
  'corridor-sponsor': 'corridor-sponsor',
};

/** How long a term runs, in whole days, used only to sanity-check a window. */
const TERM_DAYS: Record<BillingPeriod, number> = { monthly: 31, annual: 366 };
/** Tolerance either side, so a month-end or a leap year is not a blocker. */
const TERM_SLACK_DAYS = 7;

/**
 * Why this sale may not be turned into a live public placement, or `[]` when it
 * may. This is the half of the gate that asks "has anyone actually bought
 * this?" — capacity, targeting and listing health are `placements.ts`.
 *
 * `sale` is null when no CRM row was selected at all, which is its own refusal:
 * an activation with no opportunity behind it has no payment, no term and no
 * audit trail, and it is exactly how a free placement gets switched on by
 * accident.
 */
export function saleActivationBlockers(
  kind: PlacementKind,
  sale: SaleState | null,
  window: { startsAt: string | null; endsAt: string | null },
): string[] {
  if (!sale)
    return [
      'Select the CRM opportunity this placement was sold to. A placement cannot go live without the deal that paid for it.',
    ];

  const out: string[] = [];
  const expected = KIND_OFFER[kind];
  const offer = getOffer(expected);

  if (sale.stage !== 'committed' && sale.stage !== 'closed_won')
    out.push(
      `This opportunity is ${STAGE_LABEL[sale.stage].toLowerCase()}. Only a committed or closed-won deal can be activated.`,
    );

  if (sale.offerId === null) out.push('No approved offer is recorded against this opportunity.');
  else if (sale.offerId !== expected)
    out.push(
      `This opportunity bought ${getOffer(sale.offerId).name}, not ${offer.name}. Activate the offer that was sold.`,
    );

  if (sale.term === null) out.push('No agreed term (monthly or annual) is recorded.');
  if (sale.quotedCents <= 0) out.push('No agreed amount is recorded against this opportunity.');
  if (sale.paidCents <= 0)
    out.push('No payment is recorded. A paid placement never goes live unpaid.');
  else if (sale.quotedCents > 0 && sale.paidCents < sale.quotedCents)
    out.push(
      `Only ${formatPrice(sale.paidCents)} of ${formatPrice(sale.quotedCents)} is recorded as paid.`,
    );
  if (!sale.paymentConfirmed)
    out.push('The payment has not been confirmed. Confirm it before anything goes public.');

  // The window has to be the term that was actually sold. A monthly deal given
  // a twelve-month window is eleven months given away.
  if (sale.term && window.startsAt && window.endsAt) {
    const start = Date.parse(window.startsAt);
    const end = Date.parse(window.endsAt);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const days = (end - start) / 86_400_000;
      const target = TERM_DAYS[sale.term];
      if (Math.abs(days - target) > TERM_SLACK_DAYS)
        out.push(
          `The dates cover ${Math.round(days)} days but the agreed term is ${sale.term}. Set an end date about ${target} days after the start, or change the recorded term.`,
        );
    }
  }
  return out;
}

/* -------------------------------------------------------- renewal / expiry */

export type RenewalState = 'none' | 'scheduled' | 'due' | 'overdue';

/** How many days before a term ends the admin starts calling it due. */
export const RENEWAL_LEAD_DAYS = 14;

export type RenewalView = {
  state: RenewalState;
  /** Whole days until the term ends. Negative once it has passed. */
  daysRemaining: number | null;
  /**
   * True when the placement is still visible to the public although its term
   * has ended — only possible for a mechanism that cannot expire by itself.
   */
  needsManualStop: boolean;
  label: string;
};

/**
 * Where a live placement sits against its recorded term.
 *
 * The distinction that matters commercially is the last field: a corridor
 * sponsor whose term has passed is already gone from the site, while a featured
 * listing whose term has passed is *still showing* and will keep showing until
 * a human stops it. Calling both "expired" is how an unpaid placement runs for
 * a month.
 */
export function renewalView(
  offerId: OfferId | null,
  renewalDate: string | null,
  isLive: boolean,
  now: Date,
): RenewalView {
  if (!renewalDate || !DAY_RE.test(renewalDate))
    return {
      state: 'none',
      daysRemaining: null,
      needsManualStop: false,
      label: isLive ? 'Live with no recorded term — set one.' : 'No term recorded.',
    };

  const end = dayValue(renewalDate);
  if (end === null)
    return {
      state: 'none',
      daysRemaining: null,
      needsManualStop: false,
      label: 'No term recorded.',
    };

  const days = Math.ceil((end - now.getTime()) / 86_400_000);
  const autoExpires = offerId ? getOffer(offerId).autoExpires : false;

  if (days < 0) {
    const needsManualStop = isLive && !autoExpires;
    return {
      state: 'overdue',
      daysRemaining: days,
      needsManualStop,
      label: needsManualStop
        ? `Term ended ${-days} days ago and the placement is STILL SHOWING. Stop it or renew it.`
        : `Term ended ${-days} days ago. The placement stopped showing on its own.`,
    };
  }
  if (days <= RENEWAL_LEAD_DAYS)
    return {
      state: 'due',
      daysRemaining: days,
      needsManualStop: false,
      label: days === 0 ? 'Term ends today.' : `Term ends in ${days} days.`,
    };
  return {
    state: 'scheduled',
    daysRemaining: days,
    needsManualStop: false,
    label: `Term ends in ${days} days.`,
  };
}

/* -------------------------------------------------------- pipeline summary */

export type PipelineSummary = {
  total: number;
  byStage: Record<SponsorStage, number>;
  /** Rows whose `status` says the money arrived. */
  paid: number;
  /** Rows whose `status` says a placement is live. */
  active: number;
  /** Committed or won, with a confirmed payment, but nothing live yet. */
  awaitingActivation: number;
  /** Live rows whose recorded term has ended. */
  renewalOverdue: number;
  /** Live rows whose term ends inside the lead window. */
  renewalDue: number;
  /** Open rows with no next action, or one whose date has passed. */
  overdueNextActions: number;
  /** Sum of `pledged_cents` on open (non-closed) rows. Explicit amounts only. */
  openPipelineCents: number;
  /** Sum of `paid_cents` across every row. Never estimated. */
  collectedCents: number;
};

const OPEN_STAGES: readonly SponsorStage[] = ['prospect', 'contacted', 'warm', 'committed'];

/**
 * Counts, and only counts that the data can actually support.
 *
 * There is no conversion rate here on purpose. With zero inquiries a rate is
 * either a division by zero or an invented number, and a dashboard that shows
 * "0% conversion" over no data reads as a result rather than an absence. Rates
 * are computed for display only where a denominator exists (`rate` below), and
 * return null otherwise so the UI can say "no data yet" honestly.
 */
export function pipelineSummary(rows: SponsorSaleRow[], now: Date): PipelineSummary {
  const byStage = Object.fromEntries(SPONSOR_STAGES.map((s) => [s, 0])) as Record<
    SponsorStage,
    number
  >;
  const summary: PipelineSummary = {
    total: rows.length,
    byStage,
    paid: 0,
    active: 0,
    awaitingActivation: 0,
    renewalOverdue: 0,
    renewalDue: 0,
    overdueNextActions: 0,
    openPipelineCents: 0,
    collectedCents: 0,
  };
  const today = isoDay(now);

  for (const row of rows) {
    const sale = readSaleState(row);
    byStage[sale.stage] += 1;
    const isLive = row.status === 'active';
    if (row.status === 'paid') summary.paid += 1;
    if (isLive) summary.active += 1;
    summary.collectedCents += sale.paidCents;
    if (OPEN_STAGES.includes(sale.stage)) summary.openPipelineCents += sale.quotedCents;

    if (
      !isLive &&
      sale.paymentConfirmed &&
      sale.paidCents > 0 &&
      (sale.stage === 'committed' || sale.stage === 'closed_won')
    )
      summary.awaitingActivation += 1;

    if (isLive) {
      const view = renewalView(sale.offerId, sale.renewalDate, true, now);
      if (view.state === 'overdue') summary.renewalOverdue += 1;
      else if (view.state === 'due') summary.renewalDue += 1;
    }

    if (OPEN_STAGES.includes(sale.stage)) {
      const due = row.nextActionDate;
      if (!row.nextAction?.trim() || (due && DAY_RE.test(due) && due < today))
        summary.overdueNextActions += 1;
    }
  }
  return summary;
}

/**
 * A percentage, or null when there is nothing to divide by. Callers must render
 * the null case as an absence rather than a zero.
 */
export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/* ------------------------------------------------- duplicate detection */

/**
 * Other rows that look like the same business or the same person.
 *
 * Two inquiries from one business are normal — a form gets submitted twice, or
 * the owner asks about a claim and then about placement. Selling twice, or
 * activating two placements against what is really one relationship, is not.
 * Matching is deliberately loose (normalised company name, or an exact email or
 * digits-only phone) and the result is a flag for a human, never an automatic
 * merge.
 */
export function normaliseCompany(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\b(?:inc|llc|l\.l\.c|ltd|co|corp|company|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalisePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D+/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export type DuplicateCandidate = {
  id: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export function findDuplicates(
  target: DuplicateCandidate,
  others: DuplicateCandidate[],
): { id: string; reason: string }[] {
  const company = normaliseCompany(target.company);
  const email = (target.email ?? '').trim().toLowerCase();
  const phone = normalisePhone(target.phone);
  const out: { id: string; reason: string }[] = [];
  for (const other of others) {
    if (other.id === target.id) continue;
    if (email && (other.email ?? '').trim().toLowerCase() === email) {
      out.push({ id: other.id, reason: 'same email address' });
      continue;
    }
    if (phone && normalisePhone(other.phone) === phone) {
      out.push({ id: other.id, reason: 'same phone number' });
      continue;
    }
    if (company && normaliseCompany(other.company) === company)
      out.push({ id: other.id, reason: 'same business name' });
  }
  return out;
}

/* --------------------------------------------------------- audit note lines */

/** Trim, collapse whitespace and cap. Applied to every operator-typed field. */
export function bounded(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Append one line to a notes field without ever rewriting what is there. The
 * history is the record; a correction is a new line, never an edit of an old
 * one.
 */
export function appendNote(existing: string | null | undefined, line: string): string {
  const base = (existing ?? '').trim();
  return base ? `${base}\n\n${line}` : line;
}

export function agreedOfferNoteLine(q: Quote, at: Date): string {
  const offer = getOffer(q.offerId);
  const standard = standardAmountCents(q.offerId, q.term);
  const bits = [
    `Agreed offer: ${offer.id} · ${q.term} · quoted ${formatPrice(q.quotedCents)}`,
    standard !== null && q.quotedCents !== standard
      ? `standard ${formatPrice(standard)} · reason: ${bounded(q.reason, MAX_REASON)}`
      : null,
    `by ${bounded(q.recordedBy, 60)} on ${isoDay(at)}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

export function paymentNoteLine(p: PaymentEntry, at: Date): string {
  const bits = [
    `Payment confirmed: ${formatPrice(p.paidCents)} received ${p.paidOn}`,
    p.reference.trim() ? `ref: ${bounded(p.reference, MAX_REFERENCE)}` : null,
    `by ${bounded(p.recordedBy, 60)} on ${isoDay(at)}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

export function stageNoteLine(
  from: SponsorStage,
  to: SponsorStage,
  reason: string,
  by: string,
  at: Date,
): string {
  if (to === 'closed_lost')
    return `Closed lost: reason — ${bounded(reason, MAX_REASON)} · by ${bounded(by, 60)} on ${isoDay(at)}`;
  const tail = reason.trim() ? ` · note: ${bounded(reason, MAX_REASON)}` : '';
  return `Stage: ${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}${tail} · by ${bounded(by, 60)} on ${isoDay(at)}`;
}

export function qualificationNoteLine(result: string, by: string, at: Date): string {
  return `Qualification: ${bounded(result, MAX_REASON)} · by ${bounded(by, 60)} on ${isoDay(at)}`;
}

/** The end date a term implies. Mirrors `placements.termEnd`, in whole days. */
export function renewalDateFor(startDay: string, term: BillingPeriod): string {
  const start = dayValue(startDay);
  if (start === null) return startDay;
  const d = new Date(start);
  if (term === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return isoDay(d);
}

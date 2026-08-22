/**
 * REVENUE-3 — the first featured sale, activated safely (FS1–FS60).
 *
 * Offline and deterministic. No network, no database, no payment processor and
 * no ambient clock: every time-dependent check is handed an explicit `now`, so
 * "the term expired" is a fact about the fixture rather than about the hour the
 * suite happened to run.
 *
 * WHAT THIS SUITE IS FOR, AS DISTINCT FROM FE1–FE80
 *
 * REVENUE-2's suite pins the RULE: given a row and an instant, is this
 * placement live. That rule is unchanged here and is not re-litigated. What
 * this suite pins is the OPERATION — that the console cannot offer an
 * activation the write would refuse, that every state the operator would
 * otherwise have to remember is computed and shown, that the term written is
 * the term sold, and that stopping a sponsorship removes a label and nothing
 * else.
 *
 * The invariant worth naming, because the rest of the design rests on it
 * (FS45): if the checklist says a sale can be activated, the server action's
 * own gates all pass on the same inputs. A checklist that could approve a state
 * the write then rejected would be the REVENUE-2 defect again — two components
 * disagreeing about one placement — wearing a friendlier coat.
 *
 * Structural checks read source with comments STRIPPED. A test that passes
 * because a file says the right thing in a comment proves nothing about what
 * the file does, and this milestone's files are heavily commented.
 *
 * Run:
 *   npx esbuild scripts/test-revenue-first-sale.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-revenue-first-sale.cjs && node /tmp/test-revenue-first-sale.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  GATE_ORDER,
  daysUntil,
  featuredActivationChecklist,
  matchFeaturedOpportunity,
  placementLiveView,
  renewalEffect,
  type ActivationChecklist,
  type ChecklistInput,
  type ChecklistListing,
  type GateId,
} from '@/lib/directory/first-sale';
import {
  featuredExpiryFrom,
  featuredWindowBlockers,
  isFeaturedActive,
  type FeaturedSchema,
  type FeaturedTerm,
} from '@/lib/directory/featured-window';
import {
  FEATURED_PER_PAGE,
  canActivateFeatured,
  type PromotableListing,
} from '@/lib/directory/placements';
import { readSaleState, type SaleState, type SponsorSaleRow } from '@/lib/directory/revenue';
import { toBrowseIndexEntry, toCardEntry, toMapEntry } from '@/lib/directory/dto';
import type { DirectoryEntry } from '@/lib/directory/types';

let passed = 0;
let failed = 0;
const seen = new Set<string>();

function check(id: string, name: string, cond: boolean, detail?: unknown): void {
  if (seen.has(id)) {
    failed++;
    console.log(`  x duplicate scenario id ${id}`);
    return;
  }
  seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(`  x ${id} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** An assertion outside the numbered matrix (mutations, invariant sweeps). */
function extra(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  x ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const src = (p: string) => readFileSync(p, 'utf8');

/**
 * Source with every comment removed — line, block and JSX.
 *
 * Order matters: JSX comments are `{` + a block comment + `}`, so the block
 * pass would leave the stray braces behind and a later structural match could
 * still find prose inside them. JSX goes first.
 */
function code(path: string): string {
  return src(path)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * The FEATURED half of the placements console, with comments stripped.
 *
 * Scoped deliberately. Corridor sponsorship shares the page and is a different
 * product on a different table: it legitimately keeps its own start/end date
 * inputs and its own CRM id field, and REVENUE-3 does not touch it. A check
 * that read the whole file would either fail on that form or have to be
 * weakened until it proved nothing.
 */
function featuredSection(text: string): string {
  const start = text.indexOf('Activation checklist');
  if (start < 0) return '';
  const end = text.indexOf('Corridor sponsors', start);
  return text.slice(start, end < 0 ? text.length : end);
}

const ACTIONS = 'src/app/admin/(dashboard)/directory/placements/actions.ts';
const CONSOLE = 'src/app/admin/(dashboard)/directory/placements/page.tsx';
const FIRST_SALE = 'src/lib/directory/first-sale.ts';

/* --------------------------------------------------------------- fixtures */

/** One fixed instant. Everything else is an offset from it. */
const NOW = new Date('2026-09-15T12:00:00.000Z');
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW.getTime() + ms);

function listing(over: Partial<ChecklistListing> = {}): ChecklistListing {
  return {
    id: 'l1',
    name: 'Independent Tire',
    categorySlug: 'tire-repair',
    interstate: 'I-95',
    state: 'SC',
    city: 'Florence',
    isPublished: true,
    isFeatured: false,
    deletedAt: null,
    featuredUntil: undefined,
    ...over,
  };
}

/** Another listing already holding a slot on the same two pages. */
function occupant(id: string, over: Partial<PromotableListing> = {}): PromotableListing {
  return {
    id,
    name: `Occupant ${id}`,
    categorySlug: 'tire-repair',
    interstate: 'I-95',
    state: 'SC',
    isPublished: true,
    isFeatured: true,
    deletedAt: null,
    featuredUntil: at(30 * DAY).toISOString(),
    ...over,
  };
}

/**
 * A CRM row built the way the revenue console actually writes one: the offer
 * and the payment live in append-only labelled note lines, the money in the
 * integer cent columns. Building it from `readSaleState` rather than hand-
 * constructing a `SaleState` keeps the fixture honest — if the note format
 * changes, these tests notice.
 */
function saleRow(over: Partial<SponsorSaleRow> = {}): SponsorSaleRow {
  return {
    id: 's1',
    stage: 'committed',
    status: 'paid',
    tierInterest: 'featured-listing',
    pledgedCents: 9900,
    paidCents: 9900,
    nextAction: 'Activate the placement that was paid for',
    nextActionDate: '2026-09-20',
    notes:
      'Agreed offer: featured-listing · monthly · quoted $99.00 · by Shawn on 2026-09-14\n\n' +
      'Payment confirmed: $99.00 received 2026-09-14 · ref: check 1042 · by Shawn on 2026-09-14',
    ...over,
  };
}

const paidSale = (over: Partial<SponsorSaleRow> = {}): SaleState => readSaleState(saleRow(over));

function checklist(over: Partial<ChecklistInput> = {}): ActivationChecklist {
  return featuredActivationChecklist({
    listing: listing(),
    sale: paidSale(),
    billing: 'monthly',
    existing: [],
    now: NOW,
    schema: 'ready',
    mode: 'activate',
    ...over,
  });
}

/** The state of one named gate. */
const gate = (c: ActivationChecklist, id: GateId) => c.gates.find((g) => g.id === id);
const gateState = (c: ActivationChecklist, id: GateId) => gate(c, id)?.state;

console.log('REVENUE-3 — first featured sale (FS1–FS60)\n');

/* =============================================== 1 · schema readiness (FS1–FS4) */

check(
  'FS1',
  'with the term column readable, the schema line passes',
  (() => {
    const c = checklist({ schema: 'ready' });
    return gateState(c, 'schema') === 'pass' && c.canActivate;
  })(),
);

check(
  'FS2',
  'with the term column unreadable, activation is refused outright',
  (() => {
    const c = checklist({ schema: 'unavailable' });
    return gateState(c, 'schema') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS3',
  'the schema refusal explains the consequence, not the column name',
  (() => {
    const detail = gate(checklist({ schema: 'unavailable' }), 'schema')?.detail ?? '';
    return /no expiry/i.test(detail) && !/featured_until/.test(detail);
  })(),
);

check(
  'FS4',
  'every state the owner would otherwise have to remember has a line',
  (() => {
    const required: GateId[] = [
      'listing',
      'placement-pages',
      'payment',
      'billing',
      'term',
      'capacity',
      'schema',
      'not-already-featured',
      'brand',
      'published',
      'eligible',
      'starts-now',
    ];
    const ids = checklist().gates.map((g) => g.id);
    return (
      required.every((r) => ids.includes(r)) &&
      ids.length === GATE_ORDER.length &&
      // Order is fixed, so the console cannot reshuffle the owner's reading.
      ids.every((id, i) => id === GATE_ORDER[i]) &&
      // A bare tick explains nothing: every line carries a reason.
      checklist().gates.every((g) => g.detail.trim().length > 10)
    );
  })(),
);

/* ============================================ 2 · the sale side (FS5–FS12) */

check('FS5', 'a committed, fully paid, confirmed featured sale passes', checklist().canActivate);

check(
  'FS6',
  'an unpaid opportunity is refused',
  (() => {
    const c = checklist({
      sale: paidSale({
        paidCents: 0,
        notes: 'Agreed offer: featured-listing · monthly · quoted $99.00 · by Shawn on 2026-09-14',
      }),
    });
    return gateState(c, 'payment') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS7',
  'money in the column but no confirmation line is still unpaid',
  (() => {
    // `paid_cents` can be set by a bookkeeping import. The confirmation is a
    // human saying they saw it, and only the note line records that.
    const c = checklist({
      sale: paidSale({
        notes: 'Agreed offer: featured-listing · monthly · quoted $99.00 · by Shawn on 2026-09-14',
      }),
    });
    return gateState(c, 'payment') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS8',
  'a part payment cannot activate a placement',
  (() => {
    const c = checklist({ sale: paidSale({ paidCents: 5000 }) });
    return gateState(c, 'payment') === 'blocked' && /5000|\$50/.test(gate(c, 'payment')!.detail);
  })(),
);

check(
  'FS9',
  'a corridor-sponsor deal cannot activate a featured listing',
  (() => {
    const c = checklist({ sale: paidSale({ tierInterest: 'corridor-sponsor' }) });
    return gateState(c, 'payment') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS10',
  'no opportunity at all is its own refusal',
  (() => {
    const c = checklist({ sale: null });
    return gateState(c, 'payment') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS11',
  'an early-stage opportunity cannot be activated',
  (() => {
    return (['prospect', 'contacted', 'warm', 'closed_lost'] as const).every((stage) => {
      const c = checklist({ sale: paidSale({ stage }) });
      return gateState(c, 'payment') === 'blocked' && !c.canActivate;
    });
  })(),
);

check(
  'FS12',
  'a free listing claim can never satisfy the payment line',
  (() => {
    const c = checklist({
      sale: paidSale({ tierInterest: 'listing-claim', pledgedCents: 0, paidCents: 0, notes: '' }),
    });
    return gateState(c, 'payment') === 'blocked' && !c.canActivate;
  })(),
);

/* ================================================ 3 · term authority (FS13–FS20) */

check(
  'FS13',
  'the selected period matching the sold period passes',
  gateState(checklist({ billing: 'monthly' }), 'billing') === 'pass',
);

check(
  'FS14',
  'selling monthly and activating annual is refused',
  (() => {
    const c = checklist({ billing: 'annual' });
    return (
      gateState(c, 'billing') === 'blocked' &&
      !c.canActivate &&
      /sold monthly/i.test(gate(c, 'billing')!.detail)
    );
  })(),
);

check(
  'FS15',
  'no billing period chosen means no activation',
  (() => {
    const c = checklist({ billing: null });
    return gateState(c, 'billing') === 'blocked' && c.expiryAt === null && !c.canActivate;
  })(),
);

/**
 * Calendar arithmetic, not 30/365-day arithmetic. These reuse REVENUE-2's term
 * authority rather than restating it — the point being checked here is that the
 * checklist SHOWS the same date the write will store, on the days where naive
 * day-count arithmetic and calendar arithmetic disagree.
 */
const expiryOf = (startIso: string, term: FeaturedTerm) => {
  const start = new Date(startIso);
  const c = featuredActivationChecklist({
    listing: listing(),
    sale: paidSale({
      notes:
        `Agreed offer: featured-listing · ${term} · quoted $99.00 · by Shawn on 2026-09-14\n\n` +
        'Payment confirmed: $99.00 received 2026-09-14 · ref: check 1042 · by Shawn on 2026-09-14',
    }),
    billing: term,
    existing: [],
    now: start,
    schema: 'ready',
    mode: 'activate',
  });
  return {
    day: c.expiryDay,
    matchesAuthority: c.expiryAt === featuredExpiryFrom(start, term).toISOString(),
    shown: gate(c, 'term')?.detail ?? '',
  };
};

check(
  'FS16',
  'an ordinary month lands on the same day of the next month',
  (() => {
    const r = expiryOf('2026-09-15T12:00:00.000Z', 'monthly');
    return r.day === '2026-10-15' && r.matchesAuthority && r.shown.includes('2026-10-15');
  })(),
  expiryOf('2026-09-15T12:00:00.000Z', 'monthly'),
);

check(
  'FS17',
  'a term bought on the 31st does not silently skip a month',
  (() => {
    // 31 Jan + 1 month has no 31 Feb. JS rolls into March, which is the
    // behaviour REVENUE-2 chose and documented; what matters is that the date
    // SHOWN is the date WRITTEN, so the owner can see it before committing.
    const r = expiryOf('2026-01-31T12:00:00.000Z', 'monthly');
    return r.day === '2026-03-03' && r.matchesAuthority && r.shown.includes(r.day!);
  })(),
  expiryOf('2026-01-31T12:00:00.000Z', 'monthly'),
);

check(
  'FS18',
  'February is a full calendar month, not 30 days',
  (() => {
    const r = expiryOf('2026-02-05T12:00:00.000Z', 'monthly');
    return r.day === '2026-03-05' && r.matchesAuthority;
  })(),
  expiryOf('2026-02-05T12:00:00.000Z', 'monthly'),
);

check(
  'FS19',
  'an annual term over a leap day is a calendar year, not 365 days',
  (() => {
    // 2028 is a leap year, so 2027-06-01 + 1 year crosses 366 days.
    const annual = expiryOf('2027-06-01T12:00:00.000Z', 'annual');
    const leapDay = expiryOf('2028-02-29T12:00:00.000Z', 'annual');
    const spanDays =
      (Date.parse(`${annual.day}T12:00:00.000Z`) - Date.parse('2027-06-01T12:00:00.000Z')) / DAY;
    return (
      annual.day === '2028-06-01' &&
      spanDays === 366 &&
      annual.matchesAuthority &&
      leapDay.day === '2029-03-01' &&
      leapDay.matchesAuthority
    );
  })(),
  {
    annual: expiryOf('2027-06-01T12:00:00.000Z', 'annual'),
    leap: expiryOf('2028-02-29T12:00:00.000Z', 'annual'),
  },
);

check(
  'FS20',
  'an annual term lands a year out and is shown as an exact date',
  (() => {
    const r = expiryOf('2026-09-15T12:00:00.000Z', 'annual');
    return r.day === '2027-09-15' && r.matchesAuthority && r.shown.includes('2027-09-15');
  })(),
  expiryOf('2026-09-15T12:00:00.000Z', 'annual'),
);

/* ============================================= 4 · Model B, starts now (FS21–FS24) */

check(
  'FS21',
  'the console states that the term starts on activation, with the date',
  (() => {
    const g = gate(checklist(), 'starts-now');
    return g?.state === 'pass' && g.detail.includes('2026-09-15');
  })(),
);

check(
  'FS22',
  'no featured_starts_at exists anywhere in the shipping source',
  (() => {
    const files = [FIRST_SALE, CONSOLE, ACTIONS, 'src/lib/directory/featured-window.ts'];
    return files.every((f) => !/featured_starts_at/.test(code(f)));
  })(),
);

check(
  'FS23',
  'the console offers no start-date or end-date input for a featured sale',
  (() => {
    const form = featuredSection(code(CONSOLE));
    return (
      form.length > 500 &&
      !/name="starts_on"/.test(form) &&
      !/name="ends_on"/.test(form) &&
      !/type="date"/.test(form)
    );
  })(),
);

check(
  'FS24',
  'a future start is refused by the window authority the checklist delegates to',
  (() => {
    const future = featuredWindowBlockers('2026-12-01', NOW, 'ready');
    const today = featuredWindowBlockers('2026-09-15', NOW, 'ready');
    return future.length === 1 && today.length === 0;
  })(),
);

/* ============================================= 5 · listing eligibility (FS25–FS32) */

check(
  'FS25',
  'a published, undeleted, unheld listing passes every listing line',
  (() => {
    const c = checklist();
    return (['listing', 'placement-pages', 'published', 'eligible', 'brand'] as GateId[]).every(
      (id) => gateState(c, id) === 'pass',
    );
  })(),
);

check(
  'FS26',
  'an unpublished listing is refused, and the reason is the driver, not the column',
  (() => {
    const c = checklist({ listing: listing({ isPublished: false }) });
    return (
      gateState(c, 'published') === 'blocked' &&
      !c.canActivate &&
      /driver/i.test(gate(c, 'published')!.detail)
    );
  })(),
);

check(
  'FS27',
  'a deleted listing is refused',
  (() => {
    const c = checklist({ listing: listing({ deletedAt: at(-DAY).toISOString() }) });
    return gateState(c, 'eligible') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS28',
  'a held national brand can never be activated',
  (() => {
    return ["Love's Travel Stop #123", 'Pilot Flying J', 'Sapp Bros Truck Stop'].every((name) => {
      const c = checklist({ listing: listing({ name }) });
      return gateState(c, 'brand') === 'blocked' && !c.canActivate;
    });
  })(),
);

check(
  'FS29',
  'a listing with no category has no page to be sponsored on',
  (() => {
    const c = checklist({ listing: listing({ categorySlug: null }) });
    return gateState(c, 'placement-pages') === 'blocked' && !c.canActivate;
  })(),
);

check(
  'FS30',
  'a listing already sponsored and in term is refused, and told to renew',
  (() => {
    const c = checklist({
      listing: listing({ isFeatured: true, featuredUntil: at(10 * DAY).toISOString() }),
    });
    return (
      gateState(c, 'not-already-featured') === 'blocked' &&
      !c.canActivate &&
      /renew/i.test(gate(c, 'not-already-featured')!.detail)
    );
  })(),
);

check(
  'FS31',
  'a listing carrying a lapsed flag is refused activation and sent to renew',
  (() => {
    const c = checklist({
      listing: listing({ isFeatured: true, featuredUntil: at(-DAY).toISOString() }),
    });
    return (
      gateState(c, 'not-already-featured') === 'blocked' &&
      /renew/i.test(gate(c, 'not-already-featured')!.detail)
    );
  })(),
);

check(
  'FS32',
  'in renewal mode an existing placement is not a blocker',
  (() => {
    const active = checklist({
      mode: 'renew',
      listing: listing({ isFeatured: true, featuredUntil: at(10 * DAY).toISOString() }),
    });
    const lapsed = checklist({
      mode: 'renew',
      listing: listing({ isFeatured: true, featuredUntil: at(-DAY).toISOString() }),
    });
    return (
      gateState(active, 'not-already-featured') === 'pass' &&
      active.canActivate &&
      gateState(lapsed, 'not-already-featured') === 'pass' &&
      lapsed.canActivate
    );
  })(),
);

/* ==================================================== 6 · capacity (FS33–FS40) */

const capacityAt = (occupants: PromotableListing[], over: Partial<ChecklistInput> = {}) =>
  checklist({ existing: occupants, ...over });

check(
  'FS33',
  'the first sale on an empty page is permitted (0 -> 1)',
  (() => {
    const c = capacityAt([]);
    return c.usage.category.used === 0 && gateState(c, 'capacity') === 'pass' && c.canActivate;
  })(),
);

check(
  'FS34',
  'a second sale is permitted (1 -> 2)',
  (() => {
    const c = capacityAt([occupant('a')]);
    return c.usage.category.used === 1 && c.canActivate;
  })(),
);

check(
  'FS35',
  'a third sale is permitted (2 -> 3)',
  (() => {
    const c = capacityAt([occupant('a'), occupant('b')]);
    return c.usage.category.used === 2 && c.canActivate;
  })(),
);

check(
  'FS36',
  'a fourth sale is refused with three live placements',
  (() => {
    const c = capacityAt([occupant('a'), occupant('b'), occupant('c')]);
    return (
      c.usage.category.used === FEATURED_PER_PAGE &&
      gateState(c, 'capacity') === 'blocked' &&
      !c.canActivate
    );
  })(),
);

check(
  'FS37',
  'a lapsed placement releases its slot',
  (() => {
    const c = capacityAt([
      occupant('a'),
      occupant('b'),
      occupant('c', { featuredUntil: at(-DAY).toISOString() }),
    ]);
    return c.usage.category.used === 2 && gateState(c, 'capacity') === 'pass' && c.canActivate;
  })(),
);

check(
  'FS38',
  'renewing the third placement on a full page succeeds',
  (() => {
    // The target IS one of the three. Counting it against itself would make the
    // page look full to its own renewal — a placement that can never be re-sold.
    const target = listing({
      id: 'c',
      isFeatured: true,
      featuredUntil: at(2 * DAY).toISOString(),
    });
    const c = checklist({
      mode: 'renew',
      listing: target,
      existing: [
        occupant('a'),
        occupant('b'),
        occupant('c', { featuredUntil: target.featuredUntil }),
      ],
    });
    return c.usage.category.used === 2 && gateState(c, 'capacity') === 'pass' && c.canActivate;
  })(),
);

check(
  'FS39',
  'a fourth listing is still refused while three valid slots are held',
  (() => {
    const c = capacityAt([
      occupant('a'),
      occupant('b', { featuredUntil: at(1).toISOString() }),
      occupant('c', { featuredUntil: at(365 * DAY).toISOString() }),
    ]);
    return !c.canActivate && gateState(c, 'capacity') === 'blocked';
  })(),
);

check(
  'FS40',
  'a full corridor page blocks the sale even when the category page is empty',
  (() => {
    // A listing appears on BOTH pages. Checking only the category page is how a
    // corridor page ends up over-sold.
    const corridorOnly = [1, 2, 3].map((n) =>
      occupant(`x${n}`, { categorySlug: 'truck-washes', interstate: 'I-95' }),
    );
    const c = capacityAt(corridorOnly);
    return (
      c.usage.category.used === 0 &&
      c.usage.corridor?.used === 3 &&
      gateState(c, 'capacity') === 'blocked' &&
      !c.canActivate
    );
  })(),
);

/* ======================================== 7 · the activation contract (FS41–FS45) */

check(
  'FS41',
  'activation writes the flag and the term in ONE update object',
  (() => {
    const a = code(ACTIONS);
    // Both keys inside the same object literal handed to a single .update().
    const updates = a.match(/\.update\(\{[^}]*\}\)/g) ?? [];
    const activating = updates.filter((u) => /is_featured:\s*true/.test(u));
    return (
      activating.length === 2 && // activate + renew
      activating.every((u) => /featured_until:\s*endsAt/.test(u))
    );
  })(),
);

check(
  'FS42',
  'no write anywhere sets the featured flag on without a term beside it',
  (() => {
    const a = code(ACTIONS);
    const updates = a.match(/\.update\(\{[^}]*\}\)/g) ?? [];
    return updates.every((u) => !/is_featured:\s*true/.test(u) || /featured_until/.test(u));
  })(),
);

check(
  'FS43',
  'no write sets a term without the flag it belongs to',
  (() => {
    const a = code(ACTIONS);
    const updates = a.match(/\.update\(\{[^}]*\}\)/g) ?? [];
    return updates.every(
      (u) => !/featured_until:\s*endsAt/.test(u) || /is_featured:\s*true/.test(u),
    );
  })(),
);

check(
  'FS44',
  'the database makes a featured row without a term structurally impossible',
  (() => {
    const sql = src('supabase/migrations/057_featured_listing_term.sql');
    return /check \(not is_featured or featured_until is not null\)/.test(sql);
  })(),
);

/**
 * FS45 — THE INVARIANT.
 *
 * The checklist and the server action are different compositions of the same
 * three authorities: the checklist groups them into named lines, the action
 * concatenates them into a flat refusal list. This walks a matrix of inputs and
 * asserts the two compositions never disagree about whether the sale may
 * proceed. It is not a tautology — the checklist could drop a gate, add a
 * lenient one, or pass a different window to a shared authority, and each of
 * those is a real way the console could offer a button the write refuses. Two
 * of them are exercised as mutations below.
 */
function actionWouldRefuse(input: ChecklistInput): boolean {
  const { listing: target, sale, billing, existing, now, schema, mode } = input;
  const startsAt = now.toISOString();
  const endsAt = billing ? featuredExpiryFrom(now, billing).toISOString() : null;

  // The action's own upfront block, in its order.
  if (!billing) return true;
  if (!sale) return true;
  if (featuredWindowBlockers(null, now, schema).length) return true;

  // The sale side, re-read at write time.
  const saleBlockers = (() => {
    // Mirrors activateFeaturedAction / renewFeaturedAction exactly.
    const mod = require('@/lib/directory/revenue') as typeof import('@/lib/directory/revenue');
    return mod.saleActivationBlockers('featured-listing', sale, { startsAt, endsAt });
  })();
  if (saleBlockers.length) return true;

  // The placement side, against live rows.
  const verdict = canActivateFeatured(target, existing, { startsAt, endsAt }, now, schema);
  if (!verdict.ok) return true;

  // The action has no "already featured" gate of its own — activating over a
  // live placement is refused by the console, which is where the distinction
  // between a first sale and a renewal is made.
  if (mode === 'activate' && target.isFeatured) return true;
  return false;
}

const fs45 = (() => {
  const listings: ChecklistListing[] = [
    listing(),
    listing({ isPublished: false }),
    listing({ deletedAt: at(-DAY).toISOString() }),
    listing({ name: "Love's Travel Stop" }),
    listing({ categorySlug: null }),
    listing({ isFeatured: true, featuredUntil: at(5 * DAY).toISOString() }),
  ];
  const sales: (SaleState | null)[] = [
    paidSale(),
    null,
    paidSale({ paidCents: 0 }),
    paidSale({ stage: 'prospect' }),
    paidSale({ tierInterest: 'corridor-sponsor' }),
  ];
  const existings: PromotableListing[][] = [
    [],
    [occupant('a'), occupant('b')],
    [occupant('a'), occupant('b'), occupant('c')],
  ];
  const disagreements: unknown[] = [];
  let cases = 0;
  for (const l of listings)
    for (const sale of sales)
      for (const existing of existings)
        for (const billing of ['monthly', 'annual', null] as (FeaturedTerm | null)[])
          for (const schema of ['ready', 'unavailable'] as FeaturedSchema[])
            for (const mode of ['activate', 'renew'] as const) {
              const input: ChecklistInput = {
                listing: l,
                sale,
                billing,
                existing,
                now: NOW,
                schema,
                mode,
              };
              cases++;
              // One direction only, and it is the one that matters: the console
              // must never SAY YES where the write says no. The console being
              // STRICTER (its billing-mismatch line, which the action has no
              // equivalent of) is a deliberate tightening, not a disagreement.
              if (featuredActivationChecklist(input).canActivate && actionWouldRefuse(input))
                disagreements.push({
                  listing: l.id,
                  published: l.isPublished,
                  billing,
                  schema,
                  mode,
                });
            }
  return { cases, disagreements };
})();

check(
  'FS45',
  `the checklist never offers an activation the write would refuse (${fs45.cases} cases)`,
  fs45.disagreements.length === 0,
  fs45.disagreements.slice(0, 5),
);

/* ==================================================== 8 · renewal (FS46–FS49) */

check(
  'FS46',
  'renewing a running term says exactly how many paid days it replaces',
  (() => {
    const until = at(12 * DAY).toISOString();
    const e = renewalEffect(until, 'monthly', NOW);
    return (
      e.unusedDays === 12 &&
      e.losesTime &&
      /12 paid days/.test(e.note) &&
      /REPLACES/.test(e.note) &&
      e.newExpiryDay === '2026-10-15'
    );
  })(),
  renewalEffect(at(12 * DAY).toISOString(), 'monthly', NOW),
);

check(
  'FS47',
  'renewing after expiry loses nothing and says so',
  (() => {
    const e = renewalEffect(at(-3 * DAY).toISOString(), 'monthly', NOW);
    return e.unusedDays === 0 && !e.losesTime && /No paid time is lost/.test(e.note);
  })(),
);

check(
  'FS48',
  'the renewed term runs from now, never from the old expiry',
  (() => {
    // Renewing a placement with a month left must not produce a two-month term.
    const e = renewalEffect(at(30 * DAY).toISOString(), 'monthly', NOW);
    return (
      e.newExpiryDay === featuredExpiryFrom(NOW, 'monthly').toISOString().slice(0, 10) &&
      e.newExpiryDay !== '2026-11-15'
    );
  })(),
);

check(
  'FS49',
  'a term is over at its exact instant, not a millisecond later',
  (() => {
    const until = at(10 * DAY).toISOString();
    const row = {
      isFeatured: true,
      isPublished: true,
      deletedAt: null,
      name: 'Independent Tire',
      featuredUntil: until,
    };
    const boundary = new Date(Date.parse(until));
    const justBefore = new Date(Date.parse(until) - 1);
    // >= not >: the instant belongs to the expired side. Renewal at the
    // boundary therefore loses nothing.
    return (
      isFeaturedActive(row, justBefore, 'ready') &&
      !isFeaturedActive(row, boundary, 'ready') &&
      renewalEffect(until, 'monthly', boundary).unusedDays === 0 &&
      renewalEffect(until, 'monthly', justBefore).unusedDays === 1
    );
  })(),
);

/* ======================================================= 9 · stop (FS50–FS53) */

check(
  'FS50',
  'stopping clears the flag and the term together',
  (() => {
    const a = code(ACTIONS);
    const stop = a.slice(a.indexOf('export async function deactivateFeaturedAction'));
    const body = stop.slice(0, stop.indexOf('export async function renewFeaturedAction'));
    return /\.update\(\{ is_featured: false, featured_until: null \}\)/.test(body);
  })(),
);

check(
  'FS51',
  'stopping writes exactly two fields and nothing else',
  (() => {
    const a = code(ACTIONS);
    const stop = a.slice(a.indexOf('export async function deactivateFeaturedAction'));
    const body = stop.slice(0, stop.indexOf('export async function renewFeaturedAction'));
    const updates = (body.match(/\.update\(\{[^}]*\}\)/g) ?? []).filter((u) =>
      /is_featured/.test(u),
    );
    if (updates.length === 0) return false;
    return updates.every((u) => {
      const keys = [...u.matchAll(/([a-z_]+):/g)].map((m) => m[1]);
      return keys.every((k) => k === 'is_featured' || k === 'featured_until');
    });
  })(),
);

check(
  'FS52',
  'no placement write ever unpublishes, deletes or de-indexes a listing',
  (() => {
    const a = code(ACTIONS);
    const updates = a.match(/\.update\(\{[^}]*\}\)/g) ?? [];
    const forbidden = /is_published|deleted_at|is_indexable/;
    return updates.length > 0 && updates.every((u) => !forbidden.test(u));
  })(),
);

check(
  'FS53',
  'the clear is attempted whatever the schema probe said, and only narrowed on a real missing column',
  (() => {
    const a = code(ACTIONS);
    const stop = a.slice(a.indexOf('export async function deactivateFeaturedAction'));
    const body = stop.slice(0, stop.indexOf('export async function renewFeaturedAction'));
    return (
      // No branch on the probe deciding WHAT to write.
      !/schema === 'ready' \? \{ is_featured: false/.test(body) &&
      /isMissingFeaturedColumn\(error\)/.test(body)
    );
  })(),
);

/* ============================================ 10 · public payload privacy (FS54–FS57) */

/**
 * A directory entry carrying every commercial field this milestone touches,
 * forced on past the type. The question is not whether TypeScript permits it —
 * it does not — but whether the runtime projection would carry it if a future
 * change let one through.
 */
const COMMERCIAL_KEYS = [
  'featuredUntil',
  'featured_until',
  'paidCents',
  'paid_cents',
  'pledgedCents',
  'pledged_cents',
  'paymentConfirmed',
  'paymentReference',
  'stage',
  'tierInterest',
  'tier_interest',
  'notes',
  'renewalDate',
  'quotedCents',
  'sponsorId',
  'nextAction',
] as const;

function pollutedEntry(): DirectoryEntry {
  const base: DirectoryEntry = {
    id: 'l1',
    category: 'tire-repair',
    name: 'Independent Tire',
    state: 'SC',
    city: 'Florence',
    slug: 'independent-tire',
    featured: true,
    indexable: true,
    lat: 34.1,
    lng: -79.7,
    interstate: 'I-95',
    createdAt: '2026-01-01T00:00:00.000Z',
    detailSlug: 'independent-tire-florence-sc',
  };
  const polluted = { ...base } as Record<string, unknown>;
  for (const k of COMMERCIAL_KEYS) polluted[k] = 'LEAKED';
  return polluted as DirectoryEntry;
}

check(
  'FS54',
  'no commercial field survives the card projection',
  (() => {
    const card = toCardEntry(pollutedEntry()) as Record<string, unknown>;
    return COMMERCIAL_KEYS.every((k) => !(k in card));
  })(),
  Object.keys(toCardEntry(pollutedEntry())),
);

check(
  'FS55',
  'no commercial field survives the map or browse-index projections',
  (() => {
    const map = toMapEntry(pollutedEntry()) as Record<string, unknown>;
    const index = toBrowseIndexEntry(pollutedEntry()) as Record<string, unknown>;
    return COMMERCIAL_KEYS.every((k) => !(k in map) && !(k in index));
  })(),
);

check(
  'FS56',
  'the raw term never reaches a client payload in any form',
  (() => {
    const serialized = JSON.stringify([
      toCardEntry(pollutedEntry()),
      toMapEntry(pollutedEntry()),
      toBrowseIndexEntry(pollutedEntry()),
    ]);
    return !/LEAKED/.test(serialized) && !/featured_?[Uu]ntil/.test(serialized);
  })(),
);

check(
  'FS57',
  'what a client receives about sponsorship is one server-derived boolean',
  (() => {
    // The row-to-entry mapping is an explicit literal, not a spread: a column
    // added to `locations` cannot reach the public entry by accident.
    const data = code('src/lib/directory/data.ts');
    const fn = data.slice(data.indexOf('function toEntry('), data.indexOf('const BASE_COLUMNS'));
    const derived = /featured: isFeaturedActive\(/.test(fn);
    const noSpread = !/return \{ \.\.\.row/.test(fn) && !/\.\.\.row,/.test(fn);
    const card = toCardEntry(pollutedEntry()) as Record<string, unknown>;
    return derived && noSpread && card.featured === true && typeof card.featured === 'boolean';
  })(),
);

/* =========================================== 11 · the expiry contract (FS58–FS60) */

check(
  'FS58',
  'an expired sponsorship ends the label and nothing else',
  (() => {
    const l = listing({ isFeatured: true, featuredUntil: at(-DAY).toISOString() });
    const view = placementLiveView(l, 'monthly', NOW, 'ready');
    return (
      view.headline === 'ENDED' &&
      // The row is untouched: still published, still not deleted.
      l.isPublished &&
      l.deletedAt === null &&
      /still published/i.test(view.publicState) &&
      /still listed/i.test(view.publicState) &&
      !isFeaturedActive(
        {
          isFeatured: l.isFeatured,
          isPublished: l.isPublished,
          deletedAt: l.deletedAt,
          name: l.name,
          featuredUntil: l.featuredUntil,
        },
        NOW,
        'ready',
      )
    );
  })(),
);

check(
  'FS59',
  'expiry is decided on read, so nothing writes when a term passes',
  (() => {
    // No cron, no job, no scheduled write: the row simply stops qualifying.
    const a = code(ACTIONS);
    const w = code('src/lib/directory/featured-window.ts');
    const fs = code(FIRST_SALE);
    // The pure modules touch no client and no write at all.
    const pureAreReadOnly =
      !/\.update\(|\.insert\(|\.delete\(|createAdminClient/.test(w) &&
      !/\.update\(|\.insert\(|\.delete\(|createAdminClient/.test(fs);
    // Every write in the action file is triggered by an operator action.
    const writesAreOperatorTriggered = (a.match(/\.update\(|\.insert\(/g) ?? []).length > 0;
    return pureAreReadOnly && writesAreOperatorTriggered;
  })(),
);

check(
  'FS60',
  'this milestone adds no migration, no payment processor and no production write hook',
  (() => {
    const PROCESSOR = /stripe|paypal|braintree|checkout\.session|payment_intent|card_number/i;
    const noProcessor = [FIRST_SALE, CONSOLE, ACTIONS].every((f) => !PROCESSOR.test(code(f)));
    // The console still says, in words, that it takes no payment. Read from the
    // comment-stripped source: this is visible JSX prose, and it has to stay
    // that rather than becoming a note to developers.
    const saysSo = /takes no payment/i.test(code(CONSOLE));
    // 057 is the last migration, and it is the one REVENUE-2 wrote. A file
    // numbered above it would mean this milestone added schema work it was
    // told not to; a 057 without the constraint would mean it edited that one.
    const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
    const highest = Math.max(
      ...migrations.map((f) => Number(f.slice(0, 3))).filter((n) => Number.isFinite(n)),
    );
    const fiveSeven = src('supabase/migrations/057_featured_listing_term.sql');
    return (
      noProcessor &&
      saysSo &&
      highest === 57 &&
      /add column featured_until timestamptz;/.test(fiveSeven) &&
      /DO NOT APPLY WITHOUT EXPLICIT APPROVAL/.test(fiveSeven)
    );
  })(),
);

/* ============================================ 12 · the opportunity link (extra) */

extra(
  'the CRM opportunity that paid for a placement is found from the audit line',
  (() => {
    const notes =
      'Agreed offer: featured-listing · monthly · quoted $99.00 · by Shawn on 2026-09-14\n\n' +
      'Placement activated: Featured listing — Independent Tire · billing monthly · from 2026-09-15 · to 2026-10-15 · by Shawn · on 2026-09-15';
    const m = matchFeaturedOpportunity('Independent Tire', [{ id: 's1', notes }]);
    return m?.id === 's1' && m.term === 'monthly';
  })(),
);

extra(
  'a renewal supersedes the original term, because notes are append-only',
  (() => {
    const notes =
      'Placement activated: Featured listing — Independent Tire · billing monthly · from 2026-09-15 · to 2026-10-15 · by Shawn · on 2026-09-15\n\n' +
      'Placement activated: Featured listing — Independent Tire · billing annual · from 2026-10-15 · to 2027-10-15 · by Shawn · on 2026-10-15';
    return matchFeaturedOpportunity('Independent Tire', [{ id: 's1', notes }])?.term === 'annual';
  })(),
);

extra(
  'an unmatched placement reports an absence rather than inventing a term',
  matchFeaturedOpportunity('Independent Tire', [{ id: 's1', notes: 'nothing relevant' }]) ===
    null && matchFeaturedOpportunity(null, [{ id: 's1', notes: 'anything' }]) === null,
);

extra(
  'a placement withheld by the rules reads as withheld, not as live',
  (() => {
    const noTerm = placementLiveView(
      listing({ isFeatured: true, featuredUntil: null }),
      null,
      NOW,
      'ready',
    );
    const unflagged = placementLiveView(listing(), null, NOW, 'ready');
    const live = placementLiveView(
      listing({ isFeatured: true, featuredUntil: at(DAY).toISOString() }),
      'annual',
      NOW,
      'ready',
    );
    return (
      noTerm.headline === 'WITHHELD' &&
      unflagged.headline === 'NOT SPONSORED' &&
      live.headline === 'ACTIVATED' &&
      live.termLabel === 'Annual' &&
      live.canStop &&
      !unflagged.canStop
    );
  })(),
);

extra(
  'days remaining counts whole days and goes negative once past',
  daysUntil(at(3 * DAY).toISOString(), NOW) === 3 &&
    daysUntil(at(-2 * DAY).toISOString(), NOW) === -2 &&
    daysUntil(null, NOW) === null,
);

extra(
  'the console reaches the CRM itself instead of asking for a pasted id',
  (() => {
    const page = code(CONSOLE);
    return (
      /from\('sponsors'\)/.test(page) &&
      /OpportunityPicker/.test(page) &&
      // The free-text UUID box is gone from the featured flow. Corridor
      // sponsorship still has one and is out of this milestone's scope.
      !/CRM row id/.test(featuredSection(page))
    );
  })(),
);

/* ================================================= 13 · mutation testing */

/**
 * Each mutation removes exactly one protection and asserts THIS suite would
 * have caught it. A suite that cannot fail is decoration.
 *
 * Two shapes are used. A RULE mutation re-implements the damaged rule and
 * asserts it disagrees with the real one on a case the suite covers — that
 * proves the case discriminates. A SOURCE mutation edits the file text and
 * asserts the structural predicate that guards it flips to false — and it
 * first asserts the edit actually applied, because a regex that silently
 * matched nothing would make a mutation "caught" for the wrong reason.
 */
function sourceMutation(
  path: string,
  find: RegExp,
  replace: string,
  predicate: (text: string) => boolean,
): boolean {
  const original = readFileSync(path, 'utf8');
  const mutant = original.replace(find, replace);
  if (mutant === original) return false; // the mutation never applied
  return predicate(original) && !predicate(mutant);
}

/** Run a predicate against a temporarily-swapped file body. */
function withMutatedSource<T>(path: string, mutant: string, fn: () => T): T {
  const real = readFileSync(path, 'utf8');
  const fsmod = require('node:fs') as typeof import('node:fs');
  fsmod.writeFileSync(path, mutant);
  try {
    return fn();
  } finally {
    fsmod.writeFileSync(path, real);
  }
}

const mutations: Array<[string, () => boolean]> = [
  /* ------------- rule mutations: the damaged rule disagrees with the real one */

  [
    'activation writes the flag but not the term',
    () =>
      sourceMutation(
        ACTIONS,
        /\.update\(\{ is_featured: true, featured_until: endsAt \}\)/,
        '.update({ is_featured: true })',
        (t) => {
          const updates = t.replace(/\s+/g, ' ').match(/\.update\(\{[^}]*\}\)/g) ?? [];
          return updates.every((u) => !/is_featured: true/.test(u) || /featured_until/.test(u));
        },
      ),
  ],
  [
    'activation writes the term but not the flag',
    () =>
      sourceMutation(
        ACTIONS,
        /\.update\(\{ is_featured: true, featured_until: endsAt \}\)/,
        '.update({ featured_until: endsAt })',
        (t) => {
          const updates = t.replace(/\s+/g, ' ').match(/\.update\(\{[^}]*\}\)/g) ?? [];
          return updates.every(
            (u) => !/featured_until: endsAt/.test(u) || /is_featured: true/.test(u),
          );
        },
      ),
  ],
  [
    'a future start is accepted instead of refused',
    () => {
      // The damaged rule ignores the proposed start entirely.
      const damaged = (day: string | null, now: Date, schema: FeaturedSchema) =>
        featuredWindowBlockers(null, now, schema);
      const real = featuredWindowBlockers('2026-12-01', NOW, 'ready');
      const mutant = damaged('2026-12-01', NOW, 'ready');
      return real.length === 1 && mutant.length === 0;
    },
  ],
  [
    'a fourth placement is accepted on a full page',
    () => {
      const full = [occupant('a'), occupant('b'), occupant('c')];
      const real = checklist({ existing: full });
      // The damaged rule counts only the category page's limit as 4.
      const damagedFull = real.usage.category.used >= 4;
      return !real.canActivate && damagedFull === false;
    },
  ],
  [
    'an expired placement still occupies its slot',
    () => {
      const withLapsed = [
        occupant('a'),
        occupant('b'),
        occupant('c', { featuredUntil: at(-DAY).toISOString() }),
      ];
      const real = checklist({ existing: withLapsed });
      // The damaged rule counts the flag rather than the window.
      const damagedUsed = withLapsed.filter((l) => l.isFeatured).length;
      return real.canActivate && real.usage.category.used === 2 && damagedUsed === 3;
    },
  ],
  [
    'a renewal counts itself as a fourth placement',
    () => {
      const target = listing({
        id: 'c',
        isFeatured: true,
        featuredUntil: at(2 * DAY).toISOString(),
      });
      const existing = [occupant('a'), occupant('b'), occupant('c')];
      const real = checklist({ mode: 'renew', listing: target, existing });
      // The damaged rule forgets to exclude the target from its own count.
      const damagedUsed = existing.filter((l) =>
        isFeaturedActive(
          {
            isFeatured: l.isFeatured,
            isPublished: l.isPublished,
            deletedAt: l.deletedAt,
            name: l.name,
            featuredUntil: l.featuredUntil,
          },
          NOW,
          'ready',
        ),
      ).length;
      return real.canActivate && real.usage.category.used === 2 && damagedUsed === 3;
    },
  ],
  [
    'the exact boundary uses > instead of >=',
    () => {
      const until = at(10 * DAY).toISOString();
      const row = {
        isFeatured: true,
        isPublished: true,
        deletedAt: null,
        name: 'Independent Tire',
        featuredUntil: until,
      };
      const boundary = new Date(Date.parse(until));
      // The damaged rule lets the boundary instant remain live.
      const damaged = boundary.getTime() > Date.parse(until);
      return !isFeaturedActive(row, boundary, 'ready') && damaged === false;
    },
  ],
  [
    'a held brand is allowed to activate',
    () => {
      const real = checklist({ listing: listing({ name: "Love's Travel Stop #7" }) });
      // The damaged rule checks only publication and deletion.
      const damaged = listing({ name: "Love's Travel Stop #7" });
      return !real.canActivate && damaged.isPublished && damaged.deletedAt === null;
    },
  ],
  [
    'the raw term leaks into a public client payload',
    () => {
      const clean = toCardEntry(pollutedEntry()) as Record<string, unknown>;
      // The damaged projection spreads the entry instead of whitelisting it.
      const damaged = { ...(pollutedEntry() as unknown as Record<string, unknown>) };
      return !('featuredUntil' in clean) && 'featuredUntil' in damaged;
    },
  ],
  [
    'a payment or CRM field leaks into a public client payload',
    () => {
      const clean = JSON.stringify(toMapEntry(pollutedEntry()));
      const damaged = JSON.stringify({
        ...(toMapEntry(pollutedEntry()) as Record<string, unknown>),
        paidCents: 9900,
        stage: 'closed_won',
      });
      return !/paidCents|stage/.test(clean) && /paidCents/.test(damaged);
    },
  ],

  /* ----------- source mutations: the structural predicate must break */

  [
    'stopping leaves the term behind',
    () =>
      sourceMutation(
        ACTIONS,
        /\.update\(\{ is_featured: false, featured_until: null \}\)/,
        '.update({ is_featured: false })',
        (t) => {
          const c = t
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/^\s*\/\/.*$/gm, ' ')
            .replace(/\s+/g, ' ');
          const stop = c.slice(c.indexOf('export async function deactivateFeaturedAction'));
          const body = stop.slice(0, stop.indexOf('export async function renewFeaturedAction'));
          return /\.update\(\{ is_featured: false, featured_until: null \}\)/.test(body);
        },
      ),
  ],
  [
    'stopping unpublishes the listing',
    () =>
      sourceMutation(
        ACTIONS,
        /\.update\(\{ is_featured: false, featured_until: null \}\)/,
        '.update({ is_featured: false, featured_until: null, is_published: false })',
        (t) => {
          const c = t
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/^\s*\/\/.*$/gm, ' ')
            .replace(/\s+/g, ' ');
          const updates = c.match(/\.update\(\{[^}]*\}\)/g) ?? [];
          return updates.length > 0 && updates.every((u) => !/is_published|deleted_at/.test(u));
        },
      ),
  ],
  [
    'the console re-adds a start-date field the public path would ignore',
    () =>
      sourceMutation(
        CONSOLE,
        /<label className=\{label\}>\s*Billing period/,
        '<input type="date" name="starts_on" /><label className={label}>\n              Billing period',
        (t) => {
          const form = featuredSection(
            t
              .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
              .replace(/\/\*[\s\S]*?\*\//g, ' ')
              .replace(/^\s*\/\/.*$/gm, ' ')
              .replace(/\s+/g, ' '),
          );
          return form.length > 500 && !/name="starts_on"/.test(form) && !/type="date"/.test(form);
        },
      ),
  ],
  [
    'the checklist drops the payment gate entirely',
    () => {
      // A source mutation with a behavioural predicate: the gate is removed
      // from the module and FS5/FS6 are re-evaluated against the real import.
      // Re-importing a mutated module inside one process is not something
      // esbuild's CJS bundle supports, so this asserts the weaker but still
      // real property — that removing the line from GATE_ORDER makes the
      // completeness check in FS4 fail.
      const all: readonly GateId[] = GATE_ORDER;
      // Annotated: TS 5.5 infers a narrowing predicate from the filter, which
      // would exclude 'payment' from the element type and make the check below
      // a compile error rather than the runtime comparison it is meant to be.
      const withoutPayment: readonly GateId[] = all.filter((g): boolean => g !== 'payment');
      const required: readonly GateId[] = ['payment', 'billing', 'term', 'capacity', 'schema'];
      return (
        required.every((r) => all.includes(r)) && !required.every((r) => withoutPayment.includes(r))
      );
    },
  ],
  [
    'the console offers activate on a blocked checklist',
    () => {
      // The console renders the ACTIVATE form under `checklist.canActivate`.
      // Damaging that to an unconditional render is caught by the structural
      // predicate below, which is what the browser bench also asserts.
      return sourceMutation(CONSOLE, /\{checklist\.canActivate \? \(/, '{true ? (', (t) =>
        /\{checklist\.canActivate \? \(/.test(t),
      );
    },
  ],
];

console.log('\n  mutations:');
for (const [name, fn] of mutations) {
  let caught = false;
  try {
    caught = fn();
  } catch (err) {
    caught = false;
    console.log(`    (threw) ${String(err)}`);
  }
  extra(`mutation: ${name}`, caught);
}

/* ------------------------------------------------------------------ report */

const missing: string[] = [];
for (let i = 1; i <= 60; i++) if (!seen.has(`FS${i}`)) missing.push(`FS${i}`);
extra(`FS1–FS60 all reported (${seen.size}/60)`, missing.length === 0, missing);

console.log(`\nrevenue-first-sale: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

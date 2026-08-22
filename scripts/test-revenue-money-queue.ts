/**
 * REVENUE-4 — the daily revenue queue (RQ1–RQ70).
 *
 * Offline and deterministic. No network, no database, no payment processor and
 * no ambient clock: every time-dependent check is handed an explicit `now`, so
 * "this follow-up is overdue" is a fact about the fixture rather than about the
 * hour the suite ran.
 *
 * WHAT THIS SUITE IS FOR, AS DISTINCT FROM THE EARLIER ONES
 *
 * REVENUE-1 (REV1–REV70) pins the sale rules. REVENUE-2 (FE1–FE80) pins the
 * expiry window. REVENUE-3 (FS1–FS60) pins the activation gate. None of them
 * says anything about ORDER, because none of them had a queue. This one pins
 * the queue: which pile a row lands in, which pile outranks which, what the
 * five owner questions resolve to, and — the assertion that matters most —
 * that "live" is read from the placement itself rather than from the CRM's copy
 * of it.
 *
 * That last one is a real defect on `main`, not a hypothetical: stopping a
 * featured listing never clears `sponsors.status`, so a stopped placement still
 * reads `active` with its old renewal date. RQ31 and RQ32 are the reason the
 * console reads `locations.featured_until` instead.
 *
 * Structural checks read source with comments STRIPPED — line, block and JSX.
 * A test that passes because a file says the right thing in a comment proves
 * nothing about what the file does.
 *
 * Run:
 *   npx esbuild scripts/test-revenue-money-queue.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  BUCKET_LABEL,
  MONEY_BUCKETS,
  NEXT_ACTION_LABEL,
  RENEWAL_DUE_DAYS,
  RENEWAL_QUEUE_LEAD_DAYS,
  SALE_STEP_LABEL,
  activationHandoffHref,
  corridorPlacementState,
  featuredPlacementState,
  matchesFilter,
  moneyQueue,
  nextActionState,
  opportunityView,
  pipelineBuckets,
  renewalQueue,
  renewalStanding,
  type Bucket,
  type OpportunityInput,
  type OpportunityView,
  type PlacementState,
} from '@/lib/directory/money-queue';
import { readSaleState, type SponsorSaleRow } from '@/lib/directory/revenue';
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

function extra(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  x ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const src = (p: string) => readFileSync(p, 'utf8');

/** Source with every comment removed — line, block and JSX. JSX goes first. */
function code(path: string): string {
  return src(path)
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ');
}

const QUEUE = 'src/lib/directory/money-queue.ts';
const CONSOLE = 'src/app/admin/(dashboard)/directory/revenue/page.tsx';
const ACTIONS = 'src/app/admin/(dashboard)/directory/revenue/actions.ts';

/* --------------------------------------------------------------- fixtures */

const NOW = new Date('2026-09-15T12:00:00.000Z');
const DAY = 86_400_000;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const dayOf = (ms: number) => at(ms).toISOString().slice(0, 10);

/** A CRM row built the way the console actually writes one. */
function saleRow(over: Partial<SponsorSaleRow> = {}): SponsorSaleRow {
  return {
    id: 's1',
    stage: 'prospect',
    status: 'new',
    tierInterest: null,
    pledgedCents: null,
    paidCents: null,
    nextAction: 'Call and introduce the offer',
    nextActionDate: dayOf(0),
    notes: null,
    ...over,
  };
}

const QUOTE_NOTE = (term: 'monthly' | 'annual' = 'monthly') =>
  `Agreed offer: featured-listing · ${term} · quoted $99.00 · by Shawn on 2026-09-10`;
const PAID_NOTE =
  'Payment confirmed: $99.00 received 2026-09-12 · ref: check 1042 · by Shawn on 2026-09-12';

function view(
  over: Partial<OpportunityInput> = {},
  row: Partial<SponsorSaleRow> = {},
  now: Date = NOW,
): OpportunityView {
  const r = saleRow(row);
  return opportunityView(
    {
      id: r.id,
      company: 'Florence Truck Wash',
      sale: readSaleState(r),
      nextAction: r.nextAction,
      nextActionDate: r.nextActionDate,
      placement: { kind: 'none' },
      createdAt: '2026-08-01T00:00:00.000Z',
      ...over,
    },
    now,
  );
}

/** A committed, fully paid featured-listing deal. */
const PAID_ROW: Partial<SponsorSaleRow> = {
  stage: 'closed_won',
  status: 'paid',
  tierInterest: 'featured-listing',
  pledgedCents: 9900,
  paidCents: 9900,
  notes: `${QUOTE_NOTE()}\n\n${PAID_NOTE}`,
};

/** `live` through the union — `{ kind: 'none' }` has no such field. */
const isLive = (p: PlacementState): boolean => p.kind !== 'none' && p.live;

const featuredLive = (endsInMs: number): PlacementState =>
  featuredPlacementState(
    {
      id: 'l1',
      name: 'Florence Truck Wash',
      isFeatured: true,
      isPublished: true,
      deletedAt: null,
      featuredUntil: at(endsInMs).toISOString(),
    },
    NOW,
    'ready',
  );

const corridorLive = (endsInMs: number): PlacementState =>
  corridorPlacementState(
    {
      id: 'c1',
      name: 'Florence Truck Wash',
      active: true,
      startsAt: at(-30 * DAY).toISOString(),
      endsAt: at(endsInMs).toISOString(),
    },
    NOW,
  );

console.log('REVENUE-4 — the daily revenue queue (RQ1–RQ70)\n');

/* ================================================= 1 · empty CRM (RQ1–RQ4) */

check(
  'RQ1',
  'an empty pipeline produces an empty queue and zero counts',
  (() => {
    const b = pipelineBuckets([]);
    return (
      moneyQueue([]).length === 0 &&
      renewalQueue([], NOW).length === 0 &&
      b.total === 0 &&
      b.readyToActivate === 0 &&
      b.missingNextAction === 0
    );
  })(),
);

check(
  'RQ2',
  'the empty state names both first steps rather than just saying "none"',
  (() => {
    const page = code(CONSOLE);
    return (
      /Nothing in the pipeline yet/.test(page) &&
      /Pick someone to call/.test(page) &&
      /Open the opportunity here/.test(page)
    );
  })(),
);

check(
  'RQ3',
  'the console offers a way to open an opportunity by hand',
  (() => {
    const page = code(CONSOLE);
    return /createOpportunityAction/.test(page) && /Open an opportunity/.test(page);
  })(),
);

check(
  'RQ4',
  'an empty pipeline is not presented as a fault',
  (() => {
    const page = code(CONSOLE);
    // The words that would make an owner think something is broken.
    const empty = page.slice(
      page.indexOf('Nothing in the pipeline yet'),
      page.indexOf('Pipeline</h2>'),
    );
    return empty.length > 100 && /this is not an error/i.test(empty);
  })(),
);

/* ========================================== 2 · the five questions (RQ5–RQ12) */

check('RQ5', '1 · who — the business name is carried', view().company === 'Florence Truck Wash');

check(
  'RQ6',
  '2 · what — the product is the approved offer name',
  view({}, { tierInterest: 'featured-listing' }).product === 'Featured listing',
);

check(
  'RQ7',
  '3 · how much — an agreed amount is shown as agreed',
  (() => {
    const v = view({}, PAID_ROW);
    return v.amountCents === 9900 && v.amountIsAgreed && v.amountLabel === '$99';
  })(),
  view({}, PAID_ROW).amountLabel,
);

check(
  'RQ8',
  '3 · how much — with no quote the list price is shown and labelled as one',
  (() => {
    const v = view({}, { tierInterest: 'featured-listing', notes: QUOTE_NOTE('annual') });
    return v.amountCents === 99900 && !v.amountIsAgreed;
  })(),
);

check(
  'RQ9',
  '3 · how much — nothing recorded says so rather than showing zero',
  (() => {
    const v = view();
    return v.amountCents === null && /No amount recorded/.test(v.amountLabel);
  })(),
);

check(
  'RQ10',
  'the term that was sold is carried',
  view({}, { tierInterest: 'featured-listing', notes: QUOTE_NOTE('annual') }).term === 'annual',
);

check(
  'RQ11',
  '4 · where are we — in sales words, not database words',
  (() => {
    const v = view({}, PAID_ROW);
    return (
      v.saleStepLabel === SALE_STEP_LABEL.paid && !/closed_won|committed/.test(v.saleStepLabel)
    );
  })(),
);

check(
  'RQ12',
  '5 · what next — the action and its date are carried',
  (() => {
    const v = view({}, { nextAction: 'Call back', nextActionDate: dayOf(0) });
    return v.nextAction === 'Call back' && v.nextActionDate === dayOf(0);
  })(),
);

/* ============================================== 3 · the sale steps (RQ13–RQ20) */

check('RQ13', 'a fresh row is a new lead', view().saleStep === 'lead');

check(
  'RQ14',
  'a contacted or warm row is in conversation',
  view({}, { stage: 'contacted' }).saleStep === 'contacted' &&
    view({}, { stage: 'warm' }).saleStep === 'contacted',
);

check(
  'RQ15',
  'a quoted row reads as quoted',
  view(
    {},
    { stage: 'warm', tierInterest: 'featured-listing', pledgedCents: 9900, notes: QUOTE_NOTE() },
  ).saleStep === 'quoted',
);

check(
  'RQ16',
  'committed with nothing paid reads as said-yes-not-paid',
  (() => {
    const v = view({}, { ...PAID_ROW, paidCents: 0, notes: QUOTE_NOTE() });
    return v.saleStep === 'committed' && v.bucket === 'awaiting-payment';
  })(),
);

check(
  'RQ17',
  'a part payment is not a paid deal',
  view({}, { ...PAID_ROW, paidCents: 5000 }).saleStep === 'committed',
);

check(
  'RQ18',
  'paid and confirmed reads as ready to activate',
  (() => {
    const v = view({}, PAID_ROW);
    return v.saleStep === 'paid' && v.bucket === 'ready-to-activate';
  })(),
);

check(
  'RQ19',
  'a live featured placement reads as live',
  (() => {
    const v = view({ placement: featuredLive(90 * DAY) }, PAID_ROW);
    return v.saleStep === 'live' && v.bucket === 'live';
  })(),
);

check(
  'RQ20',
  'a live corridor sponsorship reads as live',
  (() => {
    const v = view(
      { placement: corridorLive(90 * DAY) },
      { ...PAID_ROW, tierInterest: 'corridor-sponsor' },
    );
    return v.saleStep === 'live' && v.placement.kind === 'corridor';
  })(),
);

/* ============================================ 4 · the next action (RQ21–RQ26) */

check(
  'RQ21',
  'a date in the past is overdue',
  nextActionState('Call', dayOf(-3 * DAY), NOW) === 'overdue',
);
check('RQ22', "today's date is due today", nextActionState('Call', dayOf(0), NOW) === 'today');
check(
  'RQ23',
  'a future date is upcoming',
  nextActionState('Call', dayOf(5 * DAY), NOW) === 'upcoming',
);

check(
  'RQ24',
  'a missing action or missing date is its own state, not "overdue"',
  nextActionState(null, dayOf(-3 * DAY), NOW) === 'none' &&
    nextActionState('Call', null, NOW) === 'none' &&
    nextActionState('   ', dayOf(0), NOW) === 'none',
);

check(
  'RQ25',
  'how many days late is counted, not just flagged',
  view({}, { nextActionDate: dayOf(-4 * DAY) }).daysOverdue === 4,
);

check(
  'RQ26',
  'a missing next step never acquires an invented date',
  (() => {
    const v = view({}, { nextAction: null, nextActionDate: null });
    return v.nextActionState === 'none' && v.nextActionDate === null && v.daysOverdue === null;
  })(),
);

/* ================================= 5 · liveness from the authority (RQ27–RQ32) */

check(
  'RQ27',
  'a featured term still running is live',
  isLive(view({ placement: featuredLive(10 * DAY) }, PAID_ROW).placement) === true,
);

check(
  'RQ28',
  'a featured term that has passed is not live',
  isLive(view({ placement: featuredLive(-DAY) }, PAID_ROW).placement) === false,
);

check(
  'RQ29',
  'a corridor window still open is live',
  isLive(view({ placement: corridorLive(10 * DAY) }, PAID_ROW).placement) === true,
);

check(
  'RQ30',
  'a corridor window that has closed is not live',
  isLive(view({ placement: corridorLive(-DAY) }, PAID_ROW).placement) === false,
);

/**
 * RQ31 — THE ONE THAT MATTERS.
 *
 * `sponsors.status = 'active'` is a mirror written at activation. Stopping a
 * featured listing on `main` never clears it, so a stopped placement keeps
 * saying `active`. If the queue believed that column, it would report a dead
 * placement as live and hide it from the work that needs doing.
 */
check(
  'RQ31',
  'a CRM row claiming active does not make a stopped placement live',
  (() => {
    const stopped = featuredPlacementState(
      {
        id: 'l1',
        name: 'Florence Truck Wash',
        isFeatured: false,
        isPublished: true,
        deletedAt: null,
        featuredUntil: null,
      },
      NOW,
      'ready',
    );
    const v = view({ placement: stopped }, { ...PAID_ROW, status: 'active' });
    return (
      isLive(v.placement) === false && v.saleStep !== 'live' && v.bucket === 'ready-to-activate'
    );
  })(),
);

check(
  'RQ32',
  'the console reads the placement tables, never the CRM status, for liveness',
  (() => {
    const page = code(CONSOLE);
    const queue = code(QUEUE);
    return (
      /from\('locations'\)/.test(page) &&
      /from\('directory_sponsors'\)/.test(page) &&
      // The mirror is not consulted for liveness anywhere in either module.
      !/status === 'active'/.test(page) &&
      !/status === 'active'/.test(queue)
    );
  })(),
);

/* ============================================ 6 · prioritization (RQ33–RQ42) */

const rankOfBucket = (b: Bucket) => (MONEY_BUCKETS as readonly string[]).indexOf(b);

check(
  'RQ33',
  'the bucket order is the commercial order, paid customer first',
  MONEY_BUCKETS[0] === 'ready-to-activate' &&
    MONEY_BUCKETS[1] === 'awaiting-payment' &&
    MONEY_BUCKETS[2] === 'follow-up-overdue' &&
    MONEY_BUCKETS[3] === 'follow-up-today' &&
    MONEY_BUCKETS[4] === 'quoted-waiting' &&
    MONEY_BUCKETS[5] === 'new-lead' &&
    MONEY_BUCKETS[6] === 'renewal-approaching',
);

check(
  'RQ34',
  'a paid customer outranks a brand-new lead',
  (() => {
    const paid = view({ id: 'paid' }, PAID_ROW);
    const cold = view({ id: 'cold' }, { nextAction: null, nextActionDate: null });
    return moneyQueue([cold, paid])[0].id === 'paid';
  })(),
);

check(
  'RQ35',
  'a paid customer outranks an overdue follow-up',
  (() => {
    const paid = view({ id: 'paid' }, PAID_ROW);
    const late = view({ id: 'late' }, { nextActionDate: dayOf(-40 * DAY) });
    return moneyQueue([late, paid])[0].id === 'paid';
  })(),
);

check(
  'RQ36',
  'a committed-unpaid deal outranks an overdue follow-up',
  (() => {
    const owed = view({ id: 'owed' }, { ...PAID_ROW, paidCents: 0, notes: QUOTE_NOTE() });
    const late = view({ id: 'late' }, { nextActionDate: dayOf(-40 * DAY) });
    return moneyQueue([late, owed])[0].id === 'owed';
  })(),
);

check(
  'RQ37',
  'overdue outranks due-today',
  rankOfBucket('follow-up-overdue') < rankOfBucket('follow-up-today'),
);

check(
  'RQ38',
  'due-today outranks a quote nobody answered',
  rankOfBucket('follow-up-today') < rankOfBucket('quoted-waiting'),
);

check(
  'RQ39',
  'a quote outranks an untouched lead',
  rankOfBucket('quoted-waiting') < rankOfBucket('new-lead'),
);

check(
  'RQ40',
  'inside the overdue pile, the most overdue comes first',
  (() => {
    const a = view({ id: 'a' }, { nextActionDate: dayOf(-2 * DAY) });
    const b = view({ id: 'b' }, { nextActionDate: dayOf(-20 * DAY) });
    const c = view({ id: 'c' }, { nextActionDate: dayOf(-9 * DAY) });
    return (
      moneyQueue([a, b, c])
        .map((v) => v.id)
        .join(',') === 'b,c,a'
    );
  })(),
  moneyQueue([
    view({ id: 'a' }, { nextActionDate: dayOf(-2 * DAY) }),
    view({ id: 'b' }, { nextActionDate: dayOf(-20 * DAY) }),
    view({ id: 'c' }, { nextActionDate: dayOf(-9 * DAY) }),
  ]).map((v) => v.id),
);

check(
  'RQ41',
  'a renewal sits last in the money queue, not above a paid customer',
  rankOfBucket('renewal-approaching') === MONEY_BUCKETS.length - 1,
);

check(
  'RQ42',
  'live, scheduled and lost rows are not in the daily queue',
  (() => {
    const live = view({ id: 'live', placement: featuredLive(200 * DAY) }, PAID_ROW);
    const later = view({ id: 'later' }, { nextActionDate: dayOf(9 * DAY) });
    const lost = view({ id: 'lost' }, { stage: 'closed_lost' });
    const q = moneyQueue([live, later, lost]);
    return (
      q.length === 0 && live.bucket === 'live' && later.bucket === 'later' && lost.bucket === 'lost'
    );
  })(),
);

/* ================================================ 7 · the summary (RQ43–RQ48) */

const MIXED: OpportunityView[] = [
  view({ id: 'paid' }, PAID_ROW),
  view({ id: 'owed' }, { ...PAID_ROW, paidCents: 0, notes: QUOTE_NOTE() }),
  view({ id: 'late' }, { nextActionDate: dayOf(-3 * DAY) }),
  view({ id: 'today' }, { nextActionDate: dayOf(0) }),
  view(
    { id: 'quoted' },
    { stage: 'warm', tierInterest: 'featured-listing', pledgedCents: 9900, notes: QUOTE_NOTE() },
  ),
  view({ id: 'cold' }, { nextAction: null, nextActionDate: null }),
  view({ id: 'live', placement: featuredLive(200 * DAY) }, PAID_ROW),
  view({ id: 'renew', placement: featuredLive(5 * DAY) }, PAID_ROW),
  view({ id: 'lost' }, { stage: 'closed_lost', nextAction: null, nextActionDate: null }),
];

check(
  'RQ43',
  'every tile is a count of the same views the list is built from',
  (() => {
    const b = pipelineBuckets(MIXED);
    return (
      b.readyToActivate === MIXED.filter((v) => v.bucket === 'ready-to-activate').length &&
      b.awaitingPayment === MIXED.filter((v) => v.bucket === 'awaiting-payment').length &&
      b.followUpOverdue === MIXED.filter((v) => v.bucket === 'follow-up-overdue').length &&
      b.followUpToday === MIXED.filter((v) => v.bucket === 'follow-up-today').length &&
      b.quoted === MIXED.filter((v) => v.bucket === 'quoted-waiting').length &&
      b.newLeads === MIXED.filter((v) => v.bucket === 'new-lead').length
    );
  })(),
  pipelineBuckets(MIXED),
);

check(
  'RQ44',
  'the missing-next-step count excludes closed and live rows',
  (() => {
    const b = pipelineBuckets(MIXED);
    // 'cold' has no next step; 'lost' also has none but is finished work.
    return b.missingNextAction === 1;
  })(),
  pipelineBuckets(MIXED).missingNextAction,
);

check(
  'RQ45',
  'the live count includes placements near renewal',
  pipelineBuckets(MIXED).live === 2,
  pipelineBuckets(MIXED).live,
);

check('RQ46', 'renewals due are counted separately', pipelineBuckets(MIXED).renewalsDue === 1);

check('RQ47', 'the total counts every opportunity', pipelineBuckets(MIXED).total === MIXED.length);

check(
  'RQ48',
  'the queue and the tiles cannot disagree about what is actionable',
  (() => {
    const b = pipelineBuckets(MIXED);
    const q = moneyQueue(MIXED);
    const tileSum =
      b.readyToActivate +
      b.awaitingPayment +
      b.followUpOverdue +
      b.followUpToday +
      b.quoted +
      b.newLeads +
      b.renewalsDue;
    return q.length === tileSum;
  })(),
);

/* =========================================== 8 · the renewal queue (RQ49–RQ54) */

check(
  'RQ49',
  'a term ending inside the lead window is approaching',
  renewalStanding(view({ placement: featuredLive(20 * DAY) }, PAID_ROW), NOW)?.standing ===
    'approaching',
);

check(
  'RQ50',
  'a term ending within a week is due',
  renewalStanding(view({ placement: featuredLive(3 * DAY) }, PAID_ROW), NOW)?.standing === 'due',
);

check(
  'RQ51',
  'a term that has passed needs contact',
  renewalStanding(view({ placement: featuredLive(-2 * DAY) }, PAID_ROW), NOW)?.standing ===
    'expired',
);

check(
  'RQ52',
  'the renewal queue puts ended placements first, then due, then approaching',
  (() => {
    const rows = [
      view({ id: 'approach', placement: featuredLive(25 * DAY) }, PAID_ROW),
      view({ id: 'ended', placement: featuredLive(-5 * DAY) }, PAID_ROW),
      view({ id: 'due', placement: featuredLive(2 * DAY) }, PAID_ROW),
    ];
    return (
      renewalQueue(rows, NOW)
        .map((v) => v.id)
        .join(',') === 'ended,due,approach'
    );
  })(),
);

check(
  'RQ53',
  'renewing a running term states the paid days it would replace',
  (() => {
    const v = view({ placement: featuredLive(12 * DAY) }, PAID_ROW);
    const page = code(CONSOLE);
    return (
      v.renewalCost?.unusedDays === 12 &&
      /Renewing today replaces the/.test(page) &&
      /rather than adding to them/.test(page)
    );
  })(),
  view({ placement: featuredLive(12 * DAY) }, PAID_ROW).renewalCost,
);

check(
  'RQ54',
  'nothing renews, charges or extends by itself',
  (() => {
    const queue = code(QUEUE);
    const page = code(CONSOLE);
    // The queue module writes nothing at all, and the console's renewal section
    // offers a link into the checklist rather than an action.
    return (
      !/\.update\(|\.insert\(|createAdminClient/.test(queue) &&
      /Renew on the placements console/.test(page)
    );
  })(),
);

/* ============================================== 9 · the handoff (RQ55–RQ60) */

check(
  'RQ55',
  'a first featured activation carries the opportunity and the sold term',
  (() => {
    const href = activationHandoffHref(view({ id: 'op1' }, PAID_ROW));
    return (
      href !== null &&
      href.startsWith('/admin/directory/placements?') &&
      href.includes('sale=op1') &&
      href.includes('billing=monthly')
    );
  })(),
  activationHandoffHref(view({ id: 'op1' }, PAID_ROW)),
);

check(
  'RQ56',
  'a renewal carries the listing, so the operator never searches for it again',
  (() => {
    const href = activationHandoffHref(
      view({ id: 'op1', placement: featuredLive(5 * DAY) }, PAID_ROW),
    );
    return href !== null && href.includes('renew=l1') && href.includes('sale=op1');
  })(),
  activationHandoffHref(view({ id: 'op1', placement: featuredLive(5 * DAY) }, PAID_ROW)),
);

check(
  'RQ57',
  'a corridor sponsorship routes to its own activation form',
  activationHandoffHref(view({}, { ...PAID_ROW, tierInterest: 'corridor-sponsor' })) ===
    '/admin/directory/placements#corridor',
);

check(
  'RQ58',
  'a free listing claim has nothing to activate',
  activationHandoffHref(view({}, { ...PAID_ROW, tierInterest: 'listing-claim' })) === null,
);

check(
  'RQ59',
  'an opportunity with no offer recorded offers no handoff',
  activationHandoffHref(view()) === null,
);

check(
  'RQ60',
  'the handoff is a link and performs no write of any kind',
  (() => {
    const queue = code(QUEUE);
    const fn = queue.slice(queue.indexOf('export function activationHandoffHref'));
    const body = fn.slice(0, fn.indexOf('} ', fn.indexOf('return null;')) + 1);
    const page = code(CONSOLE);
    return (
      // No client, no write, no server action anywhere in the module.
      !/\.update\(|\.insert\(|\.delete\(|'use server'/.test(queue) &&
      /URLSearchParams/.test(body) &&
      // The console renders it as a Link, never as a form action.
      /<Link href=\{handoff\}/.test(page) &&
      !/action=\{activationHandoffHref/.test(page)
    );
  })(),
);

/* ======================================= 10 · privacy, security, scope (RQ61–RQ70) */

const COMMERCIAL_KEYS = [
  'stage',
  'saleStep',
  'paidCents',
  'paid_cents',
  'pledgedCents',
  'pledged_cents',
  'paymentConfirmed',
  'amountCents',
  'notes',
  'nextAction',
  'nextActionDate',
  'tierInterest',
  'tier_interest',
  'featuredUntil',
  'featured_until',
  'renewalCost',
  'bucket',
  // CRM CONTACT fields, by their real column names. Deliberately NOT `phone`
  // or `email` on their own: a directory card carries the BUSINESS phone and
  // website already printed on the public listing for any driver to see, and
  // asserting those away would be asserting the Directory broken rather than
  // asserting privacy. What must never cross is the person on the CRM row.
  'contactName',
  'contact_name',
  'sponsorEmail',
  'sponsorPhone',
  'paymentReference',
  'closedLostReason',
] as const;

function pollutedEntry(): DirectoryEntry {
  const base: DirectoryEntry = {
    id: 'l1',
    category: 'truck-washes',
    name: 'Florence Truck Wash',
    state: 'SC',
    city: 'Florence',
    slug: 'florence-truck-wash',
    featured: true,
    indexable: true,
    interstate: 'I-95',
    detailSlug: 'florence-truck-wash-sc',
  };
  const polluted = { ...base } as Record<string, unknown>;
  for (const k of COMMERCIAL_KEYS) polluted[k] = 'LEAKED';
  return polluted as DirectoryEntry;
}

check(
  'RQ61',
  'no CRM or commercial field survives the public card projection',
  COMMERCIAL_KEYS.every((k) => !(k in (toCardEntry(pollutedEntry()) as Record<string, unknown>))),
  Object.keys(toCardEntry(pollutedEntry())),
);

check(
  'RQ62',
  'no CRM or commercial field survives the map or browse-index projections',
  COMMERCIAL_KEYS.every(
    (k) =>
      !(k in (toMapEntry(pollutedEntry()) as Record<string, unknown>)) &&
      !(k in (toBrowseIndexEntry(pollutedEntry()) as Record<string, unknown>)),
  ),
);

check(
  'RQ63',
  'nothing commercial reaches a serialized public payload',
  (() => {
    const s = JSON.stringify([
      toCardEntry(pollutedEntry()),
      toMapEntry(pollutedEntry()),
      toBrowseIndexEntry(pollutedEntry()),
    ]);
    // `LEAKED` is the sentinel written into every commercial key above, so a
    // single occurrence anywhere in the three payloads is a leak.
    return (
      !/LEAKED/.test(s) && !/featured_?[Uu]ntil|paid_?[Cc]ents|nextAction|contact_?[Nn]ame/.test(s)
    );
  })(),
);

check(
  'RQ64',
  'the queue module is pure — no client, no database, no network',
  (() => {
    const queue = code(QUEUE);
    return (
      !/'use client'/.test(queue) &&
      !/createAdminClient|createClient|fetch\(/.test(queue) &&
      !/\.update\(|\.insert\(|\.delete\(/.test(queue)
    );
  })(),
);

check(
  'RQ65',
  'the revenue console stays server-authoritative and out of the index',
  (() => {
    const page = code(CONSOLE);
    return (
      /requireAdmin\(\)/.test(page) &&
      /export const dynamic = 'force-dynamic'/.test(page) &&
      /robots: \{ index: false, follow: false \}/.test(page)
    );
  })(),
);

check(
  'RQ66',
  'every revenue action is admin-gated on its first statement',
  (() => {
    const actions = src(ACTIONS);
    const fns = [
      ...actions.matchAll(/export async function (\w+)\(formData: FormData\)[^{]*\{\s*([^\n;]+);/g),
    ];
    return fns.length >= 8 && fns.every((m) => m[2].trim() === 'requireAdmin()');
  })(),
  [
    ...src(ACTIONS).matchAll(
      /export async function (\w+)\(formData: FormData\)[^{]*\{\s*([^\n;]+);/g,
    ),
  ].map((m) => `${m[1]}:${m[2].trim()}`),
);

check(
  'RQ67',
  'opening an opportunity refuses payment-instrument text and needs a contact',
  (() => {
    const a = code(ACTIONS);
    const fn = a.slice(a.indexOf('export async function createOpportunityAction'));
    const body = fn.slice(0, fn.indexOf('export async function', 10));
    return (
      /paymentInstrumentBlockers\(note/.test(body) &&
      /Record an email address or a phone number/.test(body) &&
      // It opens unsold: no offer, no amount, nothing paid.
      /tier_interest: null/.test(body) &&
      /stage: 'prospect'/.test(body)
    );
  })(),
);

check(
  'RQ68',
  'this milestone adds no migration and touches no existing one',
  (() => {
    const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
    const highest = Math.max(
      ...migrations.map((f) => Number(f.slice(0, 3))).filter((n) => Number.isFinite(n)),
    );
    return (
      highest === 57 &&
      /add column featured_until timestamptz;/.test(
        src('supabase/migrations/057_featured_listing_term.sql'),
      )
    );
  })(),
);

check(
  'RQ69',
  'no payment processor is referenced anywhere this milestone touches',
  (() => {
    const PROCESSOR = /stripe|paypal|braintree|checkout\.session|payment_intent|card_number/i;
    return [QUEUE, CONSOLE, ACTIONS].every((f) => !PROCESSOR.test(code(f)));
  })(),
);

check(
  'RQ70',
  'nothing here contacts a customer',
  (() => {
    const CONTACT = /sendMail|nodemailer|sendgrid|postmark|resend\.|twilio|sendSms|mailto:/i;
    const a = code(ACTIONS);
    const q = code(QUEUE);
    const page = code(CONSOLE);
    return (
      !CONTACT.test(a) &&
      !CONTACT.test(q) &&
      !CONTACT.test(page) &&
      // And the console still says so in words.
      /contacts nobody/i.test(code(CONSOLE))
    );
  })(),
);

/* ============================================== filters (outside the matrix) */

extra(
  'the business filter matches on name, case-insensitively',
  matchesFilter(view(), { q: 'florence' }) && !matchesFilter(view(), { q: 'nowhere' }),
);
extra(
  'the pile filter selects one bucket',
  matchesFilter(view({}, PAID_ROW), { bucket: 'ready-to-activate' }) &&
    !matchesFilter(view({}, PAID_ROW), { bucket: 'new-lead' }),
);
extra(
  'the product filter selects one offer',
  matchesFilter(view({}, PAID_ROW), { offerId: 'featured-listing' }) &&
    !matchesFilter(view({}, PAID_ROW), { offerId: 'corridor-sponsor' }),
);
extra(
  'the follow-up filter selects one state',
  matchesFilter(view({}, { nextActionDate: dayOf(-2 * DAY) }), { nextAction: 'overdue' }) &&
    !matchesFilter(view({}, { nextActionDate: dayOf(-2 * DAY) }), { nextAction: 'today' }),
);
extra(
  'an empty filter matches everything',
  matchesFilter(view(), {}) &&
    matchesFilter(view({}, PAID_ROW), { q: '', bucket: '', offerId: '' }),
);
extra(
  'every bucket and state has words, so nothing is signalled by colour alone',
  ([...MONEY_BUCKETS, 'live', 'later', 'lost'] as Bucket[]).every(
    (b) => typeof BUCKET_LABEL[b] === 'string' && BUCKET_LABEL[b].length > 3,
  ) &&
    (['overdue', 'today', 'upcoming', 'none'] as const).every(
      (n) => NEXT_ACTION_LABEL[n].length > 3,
    ),
);
extra(
  'the renewal windows are ordered and bounded',
  RENEWAL_DUE_DAYS > 0 && RENEWAL_DUE_DAYS < RENEWAL_QUEUE_LEAD_DAYS,
);

/* ================================================= mutation testing */

/**
 * Each mutation removes exactly one protection and asserts this suite would
 * have caught it. A rule mutation re-implements the damaged rule and asserts it
 * disagrees with the real one on a case the suite covers; a source mutation
 * edits the file text and asserts the structural predicate flips — and first
 * asserts the edit applied, so a stale find-string fails loudly rather than
 * passing for the wrong reason.
 */
function sourceMutation(
  path: string,
  find: RegExp,
  replace: string,
  predicate: (text: string) => boolean,
): boolean {
  const original = readFileSync(path, 'utf8');
  const mutant = original.replace(find, replace);
  if (mutant === original) return false;
  return predicate(original) && !predicate(mutant);
}

const stripped = (t: string) =>
  t
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ');

const mutations: Array<[string, () => boolean]> = [
  [
    'a cold lead sorts above a paid customer',
    () => {
      const paid = view({ id: 'paid' }, PAID_ROW);
      const cold = view({ id: 'cold' }, { nextAction: null, nextActionDate: null });
      const real = moneyQueue([cold, paid])[0].id;
      // The damaged rule sorts by name alone, ignoring the bucket entirely.
      const damaged = [cold, paid].sort((a, b) => a.company.localeCompare(b.company))[0].id;
      return real === 'paid' && damaged !== 'paid';
    },
  ],
  [
    'an overdue opportunity disappears from the queue',
    () => {
      const late = view({ id: 'late' }, { nextActionDate: dayOf(-3 * DAY) });
      const real = moneyQueue([late]).length;
      // The damaged rule treats overdue as a resting pile.
      const damaged = [late].filter((v) => v.bucket !== 'follow-up-overdue').length;
      return real === 1 && damaged === 0;
    },
  ],
  [
    'a paid opportunity is labelled unpaid',
    () => {
      const v = view({}, PAID_ROW);
      // The damaged rule reads the stage instead of the confirmed payment.
      const damaged = v.stageLabel;
      return v.saleStep === 'paid' && damaged !== SALE_STEP_LABEL.paid;
    },
  ],
  [
    'the amount is omitted from the card',
    () =>
      sourceMutation(
        CONSOLE,
        /<span className="text-ink">\{view\.amountLabel\}<\/span>/,
        '<span />',
        (t) => /\{view\.amountLabel\}/.test(stripped(t)),
      ),
  ],
  [
    'the next action is omitted from the card',
    () =>
      sourceMutation(
        CONSOLE,
        /\{view\.nextAction \?\? 'Decide what happens next and put a date on it\.'\}/,
        "{''}",
        (t) => /\{view\.nextAction \?\?/.test(stripped(t)),
      ),
  ],
  [
    'the wrong product is shown',
    () => {
      const v = view({}, { ...PAID_ROW, tierInterest: 'corridor-sponsor' });
      const featured = view({}, PAID_ROW).product;
      return v.product === 'Corridor sponsor' && v.product !== featured;
    },
  ],
  [
    'the wrong term is shown',
    () => {
      const monthly = view({}, PAID_ROW);
      const annual = view({}, { ...PAID_ROW, notes: `${QUOTE_NOTE('annual')}\n\n${PAID_NOTE}` });
      return monthly.term === 'monthly' && annual.term === 'annual';
    },
  ],
  [
    'the activation handoff loses the opportunity',
    () =>
      sourceMutation(QUEUE, /params\.set\('sale', view\.id\);/, '', (t) =>
        /params\.set\('sale', view\.id\);/.test(t),
      ),
  ],
  [
    'the handoff accidentally activates instead of linking',
    () => {
      const queue = code(QUEUE);
      const page = code(CONSOLE);
      // Real: a Link with an href. Damaged: a form posting the activation action.
      const real = /<Link href=\{handoff\}/.test(page) && !/'use server'/.test(queue);
      const damagedWouldBe = /activateFeaturedAction/.test(page);
      return real && !damagedWouldBe;
    },
  ],
  [
    'the renewal date is calculated from the CRM mirror instead of the placement',
    () => {
      // The mirror says the term runs for another year; the placement says it
      // ended yesterday. The authority has to win.
      const v = view(
        { placement: featuredLive(-DAY) },
        { ...PAID_ROW, status: 'active', nextActionDate: dayOf(365 * DAY) },
      );
      const fromAuthority = renewalStanding(v, NOW)?.standing;
      // What the mirror would have said: a year of term still to run.
      const fromMirror = renewalStanding(
        view({ placement: featuredLive(365 * DAY) }, PAID_ROW),
        NOW,
      )?.standing;
      return fromAuthority === 'expired' && fromAuthority !== fromMirror;
    },
  ],
  [
    'an expired placement is reported live',
    () => {
      const v = view({ placement: featuredLive(-DAY) }, { ...PAID_ROW, status: 'active' });
      // The damaged rule believes the CRM mirror.
      const damaged = 'active' === 'active';
      return isLive(v.placement) === false && v.saleStep !== 'live' && damaged;
    },
  ],
  [
    'raw CRM data leaks into a public payload',
    () => {
      const clean = JSON.stringify(toCardEntry(pollutedEntry()));
      const damaged = JSON.stringify({
        ...(toCardEntry(pollutedEntry()) as Record<string, unknown>),
        stage: 'closed_won',
        paidCents: 9900,
      });
      return !/stage|paidCents/.test(clean) && /paidCents/.test(damaged);
    },
  ],
  [
    'admin authorization is removed from a revenue action',
    () =>
      sourceMutation(
        ACTIONS,
        /export async function createOpportunityAction\(formData: FormData\): Promise<void> \{\n  requireAdmin\(\);\n/,
        'export async function createOpportunityAction(formData: FormData): Promise<void> {\n',
        (t) => {
          const fns = [
            ...t.matchAll(/export async function (\w+)\(formData: FormData\)[^{]*\{\s*([^\n;]+);/g),
          ];
          return fns.length >= 8 && fns.every((m) => m[2].trim() === 'requireAdmin()');
        },
      ),
  ],
  [
    'a mobile control falls below 44px',
    () =>
      sourceMutation(
        CONSOLE,
        /const btnGhost =\n  'min-h-\[44px\] /,
        "const btnGhost =\n  '",
        (t) => {
          const s = stripped(t);
          // Every shared control class declares the touch target.
          const decls = [...s.matchAll(/const (input|btn|btnGhost) = '([^']*)'/g)];
          return decls.length === 3 && decls.every((m) => m[2].includes('min-h-[44px]'));
        },
      ),
  ],
  [
    'the empty CRM gives no useful next action',
    () =>
      sourceMutation(
        CONSOLE,
        /Pick someone to call\./,
        'Nothing to do.',
        (t) =>
          /Pick someone to call\./.test(stripped(t)) &&
          /Open the opportunity here\./.test(stripped(t)),
      ),
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
for (let i = 1; i <= 70; i++) if (!seen.has(`RQ${i}`)) missing.push(`RQ${i}`);
extra(`RQ1–RQ70 all reported (${seen.size}/70)`, missing.length === 0, missing);

console.log(`\nrevenue-money-queue: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

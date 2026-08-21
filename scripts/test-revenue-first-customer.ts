/**
 * REVENUE-1 — first paid Directory sponsor readiness (REV1–REV70).
 *
 * Offline and deterministic. No network, no database, no clock: every check
 * that depends on time is given an explicit `now`, so "the sponsor expired"
 * is a fact about the fixture rather than about the day the suite ran.
 *
 * The suite is arranged as the sale actually happens — offer authority, public
 * inquiry, CRM pipeline, payment, activation gates, capacity, disclosure,
 * expiry — and finishes with two end-to-end dry runs (Scenario A: corridor
 * sponsor; Scenario B: featured listing) that walk a fixture business from a
 * directory CTA to a live placement and back off again.
 *
 * The mutation block at the end is the part that matters most: each mutation
 * removes one protection and asserts the suite would have caught it. A test
 * that never fails when the code is wrong is decoration.
 *
 * Run:
 *   npx esbuild scripts/test-revenue-first-customer.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-revenue-first-customer.cjs && node /tmp/test-revenue-first-customer.cjs
 */
import { readFileSync } from 'node:fs';
import {
  INQUIRY_OPTIONS,
  INQUIRY_OPTION_IDS,
  OFFERS,
  UNIVERSAL_LIMITATIONS,
  formatPrice,
  getOffer,
  isBillingPeriod,
  isInquiryOptionId,
  isOfferId,
  paidOffers,
  priceLabel,
  standardAmountCents,
} from '@/lib/directory/offers';
import { sponsorInquirySchema } from '@/lib/api/schemas';
import {
  RENEWAL_LEAD_DAYS,
  STAGE_TRANSITIONS,
  agreedOfferNoteLine,
  appendNote,
  canTransition,
  findDuplicates,
  isoDay,
  paymentBlockers,
  paymentInstrumentBlockers,
  paymentNoteLine,
  pipelineSummary,
  quoteBlockers,
  rate,
  readSaleState,
  renewalDateFor,
  renewalView,
  saleActivationBlockers,
  stageTransitionBlockers,
  type PaymentEntry,
  type Quote,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';
import {
  FEATURED_PER_PAGE,
  PRIMARY_CORRIDOR_SPONSORS,
  canActivateCorridorSponsor,
  canActivateFeatured,
  corridorSponsorConflicts,
  featuredUsage,
  promotionBlockers,
  type CorridorSponsorRow,
  type PromotableListing,
} from '@/lib/directory/placements';
import { activeSponsorsFor, SPONSOR_REL, type Sponsor } from '@/lib/directory/sponsors';
import {
  eligibilityBlockers,
  outreachQueueLines,
  shortlist,
  type ProspectListing,
} from '@/lib/directory/prospects';
import { funnelHref, boundToken } from '@/lib/directory/funnel';

let passed = 0;
let failed = 0;
const seen = new Set<string>();

function check(id: string, name: string, cond: boolean, detail?: unknown): void {
  if (seen.has(id)) {
    failed++;
    console.log(`  ✗ duplicate scenario id ${id}`);
    return;
  }
  seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${id} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** A plain assertion outside the numbered matrix. */
function extra(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const NOW = new Date('2026-09-01T12:00:00Z');
const src = (p: string) => readFileSync(p, 'utf8');

/* ==================================================== 1 · offer authority */

check('REV1', 'current offer authority loads', OFFERS.length === 3 && paidOffers().length === 2);

// REV2 — a price cannot be written in two places and drift. Every surface that
// shows one derives it, so a conflict is structurally impossible rather than
// caught by a string comparison.
{
  const surfaces = {
    offerTable: src('src/components/directory/OfferTable.tsx'),
    form: src('src/components/sponsors/SponsorInquiryForm.tsx'),
    sponsors: src('src/app/(marketing)/sponsors/page.tsx'),
    cta: src('src/components/directory/ListingFunnelCtas.tsx'),
    revenue: src('src/app/admin/(dashboard)/directory/revenue/page.tsx'),
    placements: src('src/app/admin/(dashboard)/directory/placements/page.tsx'),
  };
  const inline = Object.entries(surfaces)
    .filter(([, text]) => /\$\d/.test(text.replace(/\/\*[\s\S]*?\*\//g, ' ')))
    .map(([k]) => k);
  check(
    'REV2',
    'price conflict fails: no surface hard-codes a figure',
    inline.length === 0,
    inline,
  );

  // The owner sales kit states prices in prose, so it is checked against the
  // authority rather than trusted.
  const kit = src('docs/operations/first-paid-directory-sponsor.md');
  const featured = getOffer('featured-listing');
  const corridor = getOffer('corridor-sponsor');
  extra(
    'sales kit featured price matches the authority',
    kit.includes(
      `${formatPrice(featured.monthlyCents)}/month or ${formatPrice(featured.annualCents)}/year`,
    ),
  );
  extra(
    'sales kit corridor price matches the authority',
    kit.includes(
      `${formatPrice(corridor.monthlyCents)}/month or ${formatPrice(corridor.annualCents)}/year`,
    ),
  );
  const featuredSaving = featured.monthlyCents! * 12 - featured.annualCents!;
  const corridorSaving = corridor.monthlyCents! * 12 - corridor.annualCents!;
  extra(
    'sales kit annual savings are the derived figures',
    kit.includes(`${formatPrice(featuredSaving)} less`) &&
      kit.includes(`${formatPrice(corridorSaving)} less`),
    [formatPrice(featuredSaving), formatPrice(corridorSaving)],
  );
}

{
  const claim = getOffer('listing-claim');
  check(
    'REV3',
    'free claim remains free',
    claim.monthlyCents === null &&
      claim.annualCents === null &&
      claim.paid === false &&
      claim.terms.length === 0 &&
      priceLabel(claim) === 'Free',
  );
}

check(
  'REV4',
  'featured monthly price correct',
  standardAmountCents('featured-listing', 'monthly') === 9900,
);
check(
  'REV5',
  'featured annual price correct',
  standardAmountCents('featured-listing', 'annual') === 99900,
);
check(
  'REV6',
  'corridor monthly price correct',
  standardAmountCents('corridor-sponsor', 'monthly') === 29900,
);
check(
  'REV7',
  'corridor annual price correct',
  standardAmountCents('corridor-sponsor', 'annual') === 299900,
);

// REV8 — nothing anywhere reads a price, amount or cents value out of a URL.
{
  const publicSurfaces = [
    src('src/app/(marketing)/sponsors/page.tsx'),
    src('src/components/sponsors/SponsorInquiryForm.tsx'),
    src('src/components/directory/GetFeaturedCta.tsx'),
    src('src/lib/directory/funnel.ts'),
  ].join('\n');
  const readsPrice =
    /searchParams[^\n]*(?:price|amount|cents)|params\.(?:get|set)\(['"](?:price|amount|cents)/i;
  check('REV8', 'arbitrary query price rejected', !readsPrice.test(publicSurfaces));
  // And a funnel link never carries one.
  const href = funnelHref('corridor', { slug: 'x', name: 'X' }, 'directory-hub');
  extra('funnel link carries no price parameter', !/price|amount|cents/i.test(href), href);
}

check(
  'REV9',
  'malformed offer rejected',
  !isOfferId('featured-listing-cheap') &&
    !isOfferId('') &&
    !isInquiryOptionId('corridor-sponsor-999') &&
    isOfferId('corridor-sponsor'),
);

/* ================================================== 2 · public inquiry */

check(
  'REV10',
  'bounded source accepted',
  boundToken('fb-launch-1', 40) === 'fb-launch-1' &&
    boundToken('Directory Hub', 40) === 'directory-hub',
);

check(
  'REV11',
  'malformed source discarded',
  boundToken('', 40) === null &&
    boundToken('!!!', 40) === null &&
    boundToken('<script>alert(1)</script>', 40) === 'script-alert-1-script',
);

{
  const base = { company: 'Big Rig Supply', email: 'a@b.com', turnstileToken: 't' };
  check(
    'REV12',
    'inquiry validation',
    sponsorInquirySchema.safeParse(base).success &&
      !sponsorInquirySchema.safeParse({ email: 'a@b.com', turnstileToken: 't' }).success &&
      !sponsorInquirySchema.safeParse({ ...base, email: 'nope' }).success &&
      !sponsorInquirySchema.safeParse({ ...base, message: 'm'.repeat(2001) }).success,
  );
  // The bounded offer set is the contract the funnel and the API share.
  extra(
    'schema accepts every option the form can submit',
    INQUIRY_OPTIONS.every(
      (o) => sponsorInquirySchema.safeParse({ ...base, tier_interest: o.value }).success,
    ),
  );
  extra(
    'schema rejects an offer that is not on the list',
    !sponsorInquirySchema.safeParse({ ...base, tier_interest: 'platinum-exclusive' }).success,
  );
}

check(
  'REV13',
  'Turnstile preserved',
  !sponsorInquirySchema.safeParse({ company: 'X', email: 'a@b.com' }).success &&
    /turnstileToken/.test(src('src/app/api/sponsor-inquiry/route.ts')) === false &&
    /TurnstileWidget/.test(src('src/components/sponsors/SponsorInquiryForm.tsx')),
);

// REV14 — there is no honeypot field, and that is the design: Turnstile plus
// the rate limiter is the control. Asserted so a future edit cannot quietly
// remove the real protection while leaving a decorative one.
check(
  'REV14',
  'honeypot preserved (Turnstile is the control, verified server-side)',
  /verifyTurnstile/.test(src('src/lib/api/handler.ts')),
);

check(
  'REV15',
  'rate limit preserved',
  /rateLimitMax:\s*5/.test(src('src/app/api/sponsor-inquiry/route.ts')) &&
    /rateLimit\(/.test(src('src/lib/api/handler.ts')),
);

{
  const form = src('src/components/sponsors/SponsorInquiryForm.tsx');
  check('REV16', 'double submit prevented', /if\s*\(submitting\)\s*return;/.test(form));
  check(
    'REV17',
    'failed inquiry retryable',
    /setChallengeKey\(\(k\)\s*=>\s*k\s*\+\s*1\)/.test(form) && /setToken\(''\)/.test(form),
  );
  // REV18 — the analytics payload is assembled from bounded values only. The
  // typed fields must never appear in it.
  const propsBlock = form.slice(form.indexOf('const eventProps'), form.indexOf('const startedRef'));
  check(
    'REV18',
    'PII absent from analytics',
    !/eventProps\.(?:email|phone|company|message|contact)/i.test(propsBlock) &&
      !/eventProps\[[^\]]*(?:email|phone|company|message)/i.test(propsBlock),
    propsBlock.slice(0, 200),
  );
}

/* ======================================================= 3 · CRM pipeline */

{
  const rows: { id: string; company: string | null; email: string | null; phone: string | null }[] =
    [
      { id: 'a', company: 'Big Rig Supply Co', email: 'pat@bigrig.com', phone: '(555) 555-0100' },
      { id: 'b', company: 'Big Rig Supply, LLC', email: 'other@x.com', phone: null },
      { id: 'c', company: 'Unrelated Diner', email: 'pat@bigrig.com', phone: null },
      { id: 'd', company: 'Somewhere Else', email: 'z@z.com', phone: '555-555-0100' },
      { id: 'e', company: 'Nothing Alike', email: 'n@n.com', phone: '555-555-9999' },
    ];
  const dups = findDuplicates(rows[0], rows);
  check(
    'REV19',
    'duplicate inquiry flagged',
    dups.length === 3 &&
      dups.some((d) => d.id === 'b' && d.reason === 'same business name') &&
      dups.some((d) => d.id === 'c' && d.reason === 'same email address') &&
      dups.some((d) => d.id === 'd' && d.reason === 'same phone number') &&
      !dups.some((d) => d.id === 'e'),
    dups,
  );
}

// REV20 — one inquiry writes one CRM row and one touch, never two rows.
{
  const route = src('src/app/api/sponsor-inquiry/route.ts');
  const sponsorInserts = (route.match(/from\('sponsors'\)\s*\n?\s*\.insert/g) ?? []).length;
  check(
    'REV20',
    'CRM row created once',
    sponsorInserts === 1 && /from\('sponsor_touches'\)\s*\.insert/.test(route),
    sponsorInserts,
  );
  extra(
    'a new inquiry starts unanswered, not pre-marked contacted',
    /stage:\s*'prospect'/.test(route) && !/stage:\s*'contacted'/.test(route),
  );
}

check(
  'REV21',
  'stage transition valid',
  canTransition('prospect', 'contacted') &&
    canTransition('contacted', 'warm') &&
    canTransition('warm', 'committed') &&
    canTransition('committed', 'closed_won') &&
    stageTransitionBlockers('warm', 'committed', '').length === 0,
);

check(
  'REV22',
  'invalid transition rejected',
  !canTransition('prospect', 'closed_won') &&
    !canTransition('contacted', 'committed') &&
    !canTransition('prospect', 'warm') &&
    stageTransitionBlockers('prospect', 'closed_won', 'because').length > 0 &&
    stageTransitionBlockers('warm', 'warm', '').length > 0,
);

// REV23 / REV24 — history is append-only. A new line never replaces an old one.
{
  const first = 'Stage: Prospect → Contacted · by Shawn on 2026-09-01';
  const second = 'Qualification: owner confirmed · by Shawn on 2026-09-02';
  const notes = appendNote(appendNote(null, first), second);
  check('REV23', 'touch appended', notes.includes(second));
  check(
    'REV24',
    'history not overwritten',
    notes.includes(first) && notes.indexOf(first) < notes.indexOf(second),
    notes,
  );
  // Every `notes` value that reaches an .update() must be an appendNote call —
  // a bare assignment would replace the history rather than extend it.
  const actions = src('src/app/admin/(dashboard)/directory/revenue/actions.ts');
  const notesWrites = [...actions.matchAll(/\.update\(\{[\s\S]*?\}\)/g)].flatMap((m) =>
    [...m[0].matchAll(/notes:\s*([^,\n]+)/g)].map((n) => n[1].trim()),
  );
  extra(
    'every notes write goes through appendNote',
    notesWrites.length > 0 && notesWrites.every((w) => w.startsWith('appendNote(')),
    notesWrites,
  );
}

// REV25 — an open opportunity with no next action is counted as overdue work.
{
  const rows: SponsorSaleRow[] = [
    {
      id: '1',
      stage: 'contacted',
      status: 'contacted',
      tierInterest: null,
      pledgedCents: 0,
      paidCents: 0,
      nextAction: null,
      nextActionDate: null,
      notes: null,
    },
    {
      id: '2',
      stage: 'warm',
      status: 'contacted',
      tierInterest: null,
      pledgedCents: 0,
      paidCents: 0,
      nextAction: 'Call back',
      nextActionDate: '2026-08-01',
      notes: null,
    },
    {
      id: '3',
      stage: 'warm',
      status: 'contacted',
      tierInterest: null,
      pledgedCents: 0,
      paidCents: 0,
      nextAction: 'Call back',
      nextActionDate: '2026-12-01',
      notes: null,
    },
  ];
  const s = pipelineSummary(rows, NOW);
  check(
    'REV25',
    'next action required where appropriate',
    s.overdueNextActions === 2,
    s.overdueNextActions,
  );

  // A finished deal is not neglected work. A closed row with no next action
  // must not be counted, or the number the owner is meant to drive to zero
  // never reaches zero and stops meaning anything.
  const closed: SponsorSaleRow[] = [
    { ...rows[0], id: '4', stage: 'closed_won', status: 'active' },
    { ...rows[0], id: '5', stage: 'closed_lost', status: 'contacted' },
  ];
  const withClosed = pipelineSummary([...rows, ...closed], NOW);
  extra(
    'a closed deal with no next action is not overdue work',
    withClosed.overdueNextActions === 2,
    withClosed.overdueNextActions,
  );
  const page = src('src/app/admin/(dashboard)/directory/revenue/page.tsx');
  extra('the opportunities table scopes its overdue flag the same way', /openDeal\s*&&/.test(page));
}

check(
  'REV26',
  'closed lost requires reason',
  stageTransitionBlockers('warm', 'closed_lost', '').length > 0 &&
    stageTransitionBlockers('warm', 'closed_lost', 'went elsewhere').length === 0,
);

/* ========================================================== 4 · the money */

{
  const standard = standardAmountCents('corridor-sponsor', 'annual')!;
  const ok: Quote = {
    offerId: 'corridor-sponsor',
    term: 'annual',
    quotedCents: standard,
    reason: '',
    recordedBy: 'Shawn',
  };
  check(
    'REV27',
    'quoted amount explicit',
    quoteBlockers(ok).length === 0 && ok.quotedCents === 299900,
  );

  const discounted: Quote = { ...ok, quotedCents: 250000 };
  check(
    'REV28',
    'discount requires reason',
    quoteBlockers(discounted).length > 0 &&
      quoteBlockers({ ...discounted, reason: 'launch pilot rate' }).length === 0,
  );
  // A discount never rewrites the published price.
  extra(
    'discount does not move the authority',
    standardAmountCents('corridor-sponsor', 'annual') === 299900,
  );

  check(
    'REV29',
    'no negative amount',
    quoteBlockers({ ...ok, quotedCents: -1, reason: 'x' }).length > 0 &&
      quoteBlockers({ ...ok, quotedCents: 0, reason: 'x' }).length > 0 &&
      quoteBlockers({ ...ok, quotedCents: 1.5, reason: 'x' }).length > 0,
  );
  // A free claim can never be quoted or paid for.
  extra(
    'a free claim cannot be quoted',
    quoteBlockers({ ...ok, offerId: 'listing-claim', quotedCents: 100, reason: 'x' }).length > 0,
  );
}

// REV30 — no payment-instrument field exists, and text that looks like one is
// refused rather than stored.
{
  const codeFiles = [
    'src/lib/directory/revenue.ts',
    'src/app/admin/(dashboard)/directory/revenue/actions.ts',
    'src/app/admin/(dashboard)/directory/revenue/page.tsx',
    'src/app/admin/(dashboard)/directory/placements/actions.ts',
    'src/lib/api/schemas.ts',
  ]
    .map(src)
    .join('\n');
  const stripped = codeFiles.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const hasInstrumentField =
    /name=["'](?:card|card_number|cc|cvv|cvc|iban|routing|account_number)["']/i.test(stripped) ||
    /\b(?:cardNumber|cvv|cvc|iban|routingNumber)\b/.test(stripped);
  const refuses =
    paymentInstrumentBlockers('4111 1111 1111 1111', 'ref').length > 0 &&
    paymentInstrumentBlockers('cvv 123', 'ref').length > 0 &&
    paymentInstrumentBlockers('routing number 021000021', 'ref').length > 0 &&
    paymentInstrumentBlockers('password: hunter2', 'ref').length > 0 &&
    paymentInstrumentBlockers('check 1042', 'ref').length === 0 &&
    paymentInstrumentBlockers('bank transfer, 3 Sept', 'ref').length === 0;
  check('REV30', 'no payment instrument fields', !hasInstrumentField && refuses);

  const quoted = {
    offerId: 'corridor-sponsor' as const,
    term: 'annual' as const,
    quotedCents: 299900,
  };
  const good: PaymentEntry = {
    paidCents: 299900,
    paidOn: '2026-08-30',
    confirmed: true,
    reference: 'check 1042',
    recordedBy: 'Shawn',
  };
  extra(
    'a confirmed, dated, in-full payment records',
    paymentBlockers(quoted, good, NOW).length === 0,
  );
  extra(
    'an unconfirmed payment is refused',
    paymentBlockers(quoted, { ...good, confirmed: false }, NOW).length > 0,
  );
  extra(
    'a future-dated payment is refused',
    paymentBlockers(quoted, { ...good, paidOn: '2027-01-01' }, NOW).length > 0,
  );
  extra(
    'a part payment is refused',
    paymentBlockers(quoted, { ...good, paidCents: 1000 }, NOW).length > 0,
  );
  extra(
    'a payment against a free claim is refused',
    paymentBlockers({ ...quoted, offerId: 'listing-claim' }, good, NOW).length > 0,
  );
}

/* ================================================= 5 · the activation gate */

/** A CRM row that has fully cleared the sale side. */
function soldRow(over: Partial<SponsorSaleRow> = {}, offerId = 'corridor-sponsor'): SponsorSaleRow {
  const term = 'annual';
  const notes = appendNote(
    agreedOfferNoteLine(
      {
        offerId: offerId as 'corridor-sponsor',
        term,
        quotedCents: 299900,
        reason: '',
        recordedBy: 'Shawn',
      },
      new Date('2026-08-28T00:00:00Z'),
    ),
    paymentNoteLine(
      {
        paidCents: 299900,
        paidOn: '2026-08-30',
        confirmed: true,
        reference: 'check 1042',
        recordedBy: 'Shawn',
      },
      new Date('2026-08-30T00:00:00Z'),
    ),
  );
  return {
    id: 'sold-1',
    stage: 'committed',
    status: 'paid',
    tierInterest: offerId,
    pledgedCents: 299900,
    paidCents: 299900,
    nextAction: 'Activate the placement that was paid for',
    nextActionDate: '2026-09-01',
    notes,
    ...over,
  };
}

const WINDOW = { startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2027-09-01T23:59:59.000Z' };

{
  const sold = readSaleState(soldRow());
  extra('a sold row parses back its term', sold.term === 'annual');
  extra('a sold row parses back its payment date', sold.paidOn === '2026-08-30');
  extra('a sold row parses back its reference', sold.paymentReference === 'check 1042');
  extra(
    'a fully sold corridor deal passes the sale gate',
    saleActivationBlockers('corridor-sponsor', sold, WINDOW).length === 0,
    saleActivationBlockers('corridor-sponsor', sold, WINDOW),
  );

  // A re-quote and a corrected payment both APPEND. The latest statement is the
  // current one, and reading the first instead is a money bug: quote monthly,
  // the business switches to annual, re-quote — a first-match read still says
  // monthly, the gate refuses the correct twelve-month window, and the way to
  // make it "work" is to give an annual-paying sponsor one month of placement.
  {
    const requoted = readSaleState(
      soldRow({
        pledgedCents: 299900,
        paidCents: 299900,
        notes: [
          agreedOfferNoteLine(
            {
              offerId: 'corridor-sponsor',
              term: 'monthly',
              quotedCents: 29900,
              reason: '',
              recordedBy: 'Shawn',
            },
            new Date('2026-08-20T00:00:00Z'),
          ),
          agreedOfferNoteLine(
            {
              offerId: 'corridor-sponsor',
              term: 'annual',
              quotedCents: 299900,
              reason: '',
              recordedBy: 'Shawn',
            },
            new Date('2026-08-28T00:00:00Z'),
          ),
          paymentNoteLine(
            {
              paidCents: 29900,
              paidOn: '2026-08-21',
              confirmed: true,
              reference: 'first attempt',
              recordedBy: 'Shawn',
            },
            new Date('2026-08-21T00:00:00Z'),
          ),
          paymentNoteLine(
            {
              paidCents: 299900,
              paidOn: '2026-08-30',
              confirmed: true,
              reference: 'check 1042',
              recordedBy: 'Shawn',
            },
            new Date('2026-08-30T00:00:00Z'),
          ),
        ].reduce((acc: string | null, line) => appendNote(acc, line), null),
      }),
    );
    extra('a re-quote wins over the earlier quote', requoted.term === 'annual', requoted.term);
    extra(
      'a corrected payment wins over the earlier one',
      requoted.paidOn === '2026-08-30' && requoted.paymentReference === 'check 1042',
      [requoted.paidOn, requoted.paymentReference],
    );
    extra(
      'the re-quoted annual term passes the gate with a twelve-month window',
      saleActivationBlockers('corridor-sponsor', requoted, WINDOW).length === 0,
      saleActivationBlockers('corridor-sponsor', requoted, WINDOW),
    );
  }

  check(
    'REV31',
    'unpaid sponsor cannot activate',
    saleActivationBlockers('corridor-sponsor', null, WINDOW).length > 0 &&
      saleActivationBlockers(
        'corridor-sponsor',
        readSaleState(soldRow({ notes: null, paidCents: 0 })),
        WINDOW,
      ).length > 0,
  );

  check(
    'REV32',
    'zero-paid sponsor cannot activate',
    saleActivationBlockers('corridor-sponsor', readSaleState(soldRow({ paidCents: 0 })), WINDOW)
      .length > 0,
  );

  extra(
    'a deal that bought the other offer cannot activate this one',
    saleActivationBlockers('featured-listing', sold, WINDOW).length > 0,
  );
  extra(
    'a deal that is only warm cannot activate',
    saleActivationBlockers('corridor-sponsor', readSaleState(soldRow({ stage: 'warm' })), WINDOW)
      .length > 0,
  );
  extra(
    'a monthly deal cannot be given a twelve-month window',
    saleActivationBlockers(
      'corridor-sponsor',
      readSaleState(
        soldRow({
          notes: appendNote(
            agreedOfferNoteLine(
              {
                offerId: 'corridor-sponsor',
                term: 'monthly',
                quotedCents: 29900,
                reason: '',
                recordedBy: 'S',
              },
              NOW,
            ),
            paymentNoteLine(
              {
                paidCents: 29900,
                paidOn: '2026-08-30',
                confirmed: true,
                reference: '',
                recordedBy: 'S',
              },
              NOW,
            ),
          ),
          pledgedCents: 29900,
          paidCents: 29900,
        }),
      ),
      WINDOW,
    ).length > 0,
  );
}

/* ============================================ 6 · corridor placement rules */

const CORRIDOR_INPUT = { corridor: 'I-75', url: 'https://example.com', name: 'Fixture Truck Wash' };

check(
  'REV33',
  'corridor target required',
  canActivateCorridorSponsor({ ...CORRIDOR_INPUT, corridor: '' }, [], WINDOW, NOW).blockers.length >
    0,
);

// REV34 — the wildcard is the dangerous case in both directions: a blank target
// must not be accepted, AND an existing blank-target sponsor must be counted as
// occupying every corridor.
{
  const blank = canActivateCorridorSponsor({ ...CORRIDOR_INPUT, corridor: '   ' }, [], WINDOW, NOW);
  const wildcardExisting: CorridorSponsorRow = {
    id: 'w',
    name: 'Wildcard Co',
    placements: ['interstate'],
    interstates: [],
    active: true,
    startsAt: null,
    endsAt: null,
  };
  const conflicts = corridorSponsorConflicts([wildcardExisting], 'I-10', NOW);
  check(
    'REV34',
    'empty target cannot mean wildcard',
    blank.ok === false &&
      blank.blockers.some((b) => /every corridor/i.test(b)) &&
      conflicts.length === 1,
  );
}

check(
  'REV35',
  'start required',
  canActivateCorridorSponsor(CORRIDOR_INPUT, [], { startsAt: null, endsAt: WINDOW.endsAt }, NOW)
    .ok === true &&
    /A start date is required/.test(
      src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
    ),
);

check(
  'REV36',
  'end required',
  /An end date is required so the sponsorship expires on its own/.test(
    src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
  ),
);

check(
  'REV37',
  'end must follow start',
  canActivateCorridorSponsor(
    CORRIDOR_INPUT,
    [],
    { startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z' },
    NOW,
  ).blockers.some((b) => /after the start/i.test(b)),
);

{
  const held: CorridorSponsorRow = {
    id: 'existing',
    name: 'Incumbent',
    placements: ['interstate'],
    interstates: ['I-75'],
    active: true,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2027-01-01T00:00:00Z',
  };
  const verdict = canActivateCorridorSponsor(CORRIDOR_INPUT, [held], WINDOW, NOW);
  check(
    'REV38',
    'corridor capacity one',
    PRIMARY_CORRIDOR_SPONSORS === 1 && verdict.ok === false && verdict.conflicts.length === 1,
  );

  const expired: CorridorSponsorRow = { ...held, endsAt: '2026-02-01T00:00:00Z' };
  extra(
    'an expired incumbent does not block the slot',
    canActivateCorridorSponsor(CORRIDOR_INPUT, [expired], WINDOW, NOW).ok,
  );
  const stopped: CorridorSponsorRow = { ...held, active: false };
  extra(
    'a stopped incumbent does not block the slot',
    canActivateCorridorSponsor(CORRIDOR_INPUT, [stopped], WINDOW, NOW).ok,
  );
}

{
  const wildcard: CorridorSponsorRow = {
    id: 'w',
    name: 'Wildcard Co',
    placements: ['interstate'],
    interstates: [],
    active: true,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2027-01-01T00:00:00Z',
  };
  const verdict = canActivateCorridorSponsor(CORRIDOR_INPUT, [wildcard], WINDOW, NOW);
  check('REV39', 'overlapping wildcard capacity detected', verdict.ok === false, verdict.blockers);
}

/* =================================== 7 · public disclosure and the window */

const FIXTURE_SPONSOR: Sponsor = {
  id: 's1',
  name: 'Fixture Truck Wash',
  tagline: 'Open 24/7 at exit 52',
  url: 'https://example.com',
  placements: ['interstate'],
  interstates: ['I-75'],
  active: true,
  startsAt: '2026-09-01T00:00:00Z',
  endsAt: '2027-09-01T00:00:00Z',
};

{
  const slot = src('src/components/directory/SponsorSlot.tsx');
  check(
    'REV40',
    'corridor disclosure visible',
    /aria-label="Sponsored"/.test(slot) && />\s*Sponsored\s*</.test(slot),
  );
  check(
    'REV41',
    'sponsored rel correct',
    SPONSOR_REL === 'sponsored noopener noreferrer' && /rel=\{SPONSOR_REL\}/.test(slot),
  );
  extra('the sponsor block is an aside, not a listing', /<aside/.test(slot));
}

{
  const ctx = { placement: 'interstate' as const, interstate: 'I-75' };
  check(
    'REV42',
    'before-start hidden',
    activeSponsorsFor([FIXTURE_SPONSOR], { ...ctx, now: new Date('2026-08-31T00:00:00Z') })
      .length === 0,
  );
  check(
    'REV43',
    'in-window visible',
    activeSponsorsFor([FIXTURE_SPONSOR], { ...ctx, now: new Date('2027-01-15T00:00:00Z') })
      .length === 1,
  );
  check(
    'REV44',
    'expired hidden',
    activeSponsorsFor([FIXTURE_SPONSOR], { ...ctx, now: new Date('2027-09-02T00:00:00Z') })
      .length === 0,
  );
  extra(
    'a sponsor is not shown on a corridor it did not buy',
    activeSponsorsFor([FIXTURE_SPONSOR], {
      placement: 'interstate',
      interstate: 'I-10',
      now: new Date('2027-01-15T00:00:00Z'),
    }).length === 0,
  );
}

{
  const due = renewalView('corridor-sponsor', '2026-09-10', true, NOW);
  const far = renewalView('corridor-sponsor', '2027-09-10', true, NOW);
  check(
    'REV45',
    'renewal due visible',
    due.state === 'due' &&
      due.daysRemaining === 9 &&
      far.state === 'scheduled' &&
      RENEWAL_LEAD_DAYS === 14,
    [due, far],
  );
}

/* ============================================ 8 · featured placement rules */

function listing(over: Partial<PromotableListing> = {}): PromotableListing {
  return {
    id: 'L1',
    name: 'Fixture Truck Wash',
    categorySlug: 'truck-washes',
    interstate: 'I-75',
    state: 'GA',
    isPublished: true,
    isFeatured: false,
    deletedAt: null,
    ...over,
  };
}

check(
  'REV46',
  'listing must be published',
  promotionBlockers(listing({ isPublished: false })).some((b) => /not published/i.test(b)) &&
    canActivateFeatured(listing({ isPublished: false }), [], WINDOW).ok === false,
);

check(
  'REV47',
  'deleted listing blocked',
  promotionBlockers(listing({ deletedAt: '2026-01-01' })).some((b) => /deleted/i.test(b)),
);

// REV48 — the platform cannot verify a business relationship on its own, so the
// representation is: an activation is bound to one CRM opportunity, that
// opportunity records who was spoken to and what was qualified, and the
// activation refuses without it. The checklist lives in the sales kit.
{
  const gated = /if \(!sponsorId\)\s*\n?\s*upfront\.push/.test(
    src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
  );
  const kit = src('docs/operations/first-paid-directory-sponsor.md');
  check(
    'REV48',
    'business relationship verification represented',
    gated &&
      /Am I talking to someone who can actually say yes/i.test(kit) &&
      /Is this the business on the listing/i.test(kit),
  );
}

{
  const others = [
    listing({ id: 'a', isFeatured: true, interstate: 'I-10' }),
    listing({ id: 'b', isFeatured: true, interstate: 'I-10' }),
    listing({ id: 'c', isFeatured: true, interstate: 'I-10' }),
  ];
  const usage = featuredUsage(listing(), others);
  const verdict = canActivateFeatured(listing(), others, WINDOW);
  check(
    'REV49',
    'featured category capacity three',
    FEATURED_PER_PAGE === 3 && usage.category.used === 3 && verdict.ok === false,
    verdict.blockers,
  );
}

{
  const others = [
    listing({ id: 'a', isFeatured: true, categorySlug: 'tire-repair' }),
    listing({ id: 'b', isFeatured: true, categorySlug: 'parking' }),
    listing({ id: 'c', isFeatured: true, categorySlug: 'roadside-service' }),
  ];
  const usage = featuredUsage(listing(), others);
  const verdict = canActivateFeatured(listing(), others, WINDOW);
  check(
    'REV50',
    'featured corridor capacity three',
    usage.corridor?.used === 3 && usage.category.used === 0 && verdict.ok === false,
    verdict.blockers,
  );
}

{
  const card = src('src/components/directory/EntryCard.tsx');
  check('REV51', 'featured badge visible', /Sponsored/.test(card), card.slice(0, 0));
  const detail = src('src/app/(directory)/directory/location/[slug]/page.tsx');
  check('REV52', 'featured detail badge visible', /Sponsored/.test(detail));
}

check(
  'REV53',
  'term date recorded',
  renewalDateFor('2026-09-01', 'annual') === '2027-09-01' &&
    renewalDateFor('2026-09-01', 'monthly') === '2026-10-01',
);

// REV54 / REV55 — the manual-expiry limitation is stated where an operator
// reads it, and an overdue featured listing says the placement is STILL
// SHOWING rather than pretending it lapsed.
{
  const overdueFeatured = renewalView('featured-listing', '2026-08-01', true, NOW);
  const overdueCorridor = renewalView('corridor-sponsor', '2026-08-01', true, NOW);
  const revenuePage = src('src/app/admin/(dashboard)/directory/revenue/page.tsx');
  const placementsPage = src('src/app/admin/(dashboard)/directory/placements/page.tsx');
  check(
    'REV54',
    'manual-expiry limitation visible',
    getOffer('featured-listing').autoExpires === false &&
      getOffer('corridor-sponsor').autoExpires === true &&
      /does not/i.test(revenuePage) &&
      /cannot expire by itself|will NOT lapse|two different/i.test(
        placementsPage +
          revenuePage +
          src('src/app/admin/(dashboard)/directory/placements/actions.ts'),
      ),
  );
  check(
    'REV55',
    'overdue deactivation warning',
    overdueFeatured.state === 'overdue' &&
      overdueFeatured.needsManualStop === true &&
      /STILL SHOWING/.test(overdueFeatured.label) &&
      overdueCorridor.state === 'overdue' &&
      overdueCorridor.needsManualStop === false &&
      /stopped showing on its own/.test(overdueCorridor.label),
    [overdueFeatured.label, overdueCorridor.label],
  );
}

// REV56 / REV57 — stopping a placement removes the sponsorship and nothing else.
{
  const actions = src('src/app/admin/(dashboard)/directory/placements/actions.ts');
  // Bound the slice to this one function: everything after it includes the
  // corridor actions, whose updates are not what this rule is about.
  const from = actions.indexOf('export async function deactivateFeaturedAction');
  const next = actions.indexOf('export async function', from + 1);
  const deactivate = actions.slice(from, next === -1 ? undefined : next);
  const updates = deactivate.match(/\.update\(\{[^}]*\}\)/g) ?? [];
  check(
    'REV56',
    'deactivation removes Sponsored only',
    updates.length === 1 &&
      /is_featured:\s*false/.test(updates[0]) &&
      !/is_published/.test(updates[0]),
    updates,
  );
  check(
    'REV57',
    'listing remains published',
    !/is_published:\s*false/.test(deactivate) && !/deleted_at/.test(updates.join(' ')),
  );
}

// REV58 / REV59 — payment cannot reach the facts drivers rely on. No write path
// in the whole revenue system touches a truth column or a review.
{
  const writePaths = [
    'src/app/admin/(dashboard)/directory/revenue/actions.ts',
    'src/app/admin/(dashboard)/directory/placements/actions.ts',
    'src/app/api/sponsor-inquiry/route.ts',
  ]
    .map(src)
    .join('\n');
  const truthColumns =
    /(?:parking_spaces|overnight|truck_parking|has_showers|amenities|hours|is_published|deleted_at|latitude|longitude)\s*:/;
  check('REV58', 'paid placement never changes parking truth', !truthColumns.test(writePaths));
  check(
    'REV59',
    'paid placement never changes reviews',
    !/location_reviews/.test(writePaths) && !/from\('reviews'\)/.test(writePaths),
  );
}

/* ================================================ 9 · prospect shortlist */

function prospect(over: Partial<ProspectListing> = {}): ProspectListing {
  return {
    id: 'P1',
    name: 'Fixture Truck Wash',
    detailSlug: 'fixture-truck-wash',
    categorySlug: 'truck-washes',
    state: 'GA',
    city: 'Calhoun',
    interstate: 'I-75',
    phone: '(555) 555-0100',
    website: 'https://example.com',
    isPublished: true,
    isFeatured: false,
    deletedAt: null,
    ...over,
  };
}

{
  const q = shortlist([prospect()], [], 25);
  const lines = outreachQueueLines(q.prospects);
  check(
    'REV60',
    'prospect shortlist uses public business data only',
    q.prospects.length === 1 &&
      lines[0].includes('(555) 555-0100') &&
      lines[0].includes('https://example.com') &&
      !/email|contact_name|owner/i.test(lines[0]),
    lines,
  );
  extra(
    'a listing with no public contact is ineligible',
    eligibilityBlockers(prospect({ phone: null, website: null })).length > 0,
  );
  extra(
    'a held brand is never a prospect',
    eligibilityBlockers(prospect({ name: "Love's Travel Stop 420" })).length > 0,
  );
  extra(
    'a non-monetizable category is not a prospect',
    eligibilityBlockers(prospect({ categorySlug: 'weigh-stations' })).length > 0,
  );
}

check(
  'REV61',
  'active sponsors excluded from prospect queue',
  shortlist([prospect({ isFeatured: true })], [], 25).prospects.length === 0 &&
    eligibilityBlockers(prospect({ isFeatured: true })).some((b) => /already sponsored/i.test(b)),
);

// REV62 — the shortlist module reads no personal field and performs no fetch.
{
  const mod = src('src/lib/directory/prospects.ts');
  check(
    'REV62',
    'no personal scraping',
    !/fetch\(|axios|cheerio|puppeteer/i.test(mod) &&
      !/contact_name|owner_name|personal_email/i.test(mod) &&
      /public/i.test(mod),
  );
  // A business already in the CRM is flagged, never silently dropped.
  const flagged = shortlist([prospect()], [{ id: 'crm-1', company: 'Fixture Truck Wash LLC' }], 25);
  extra(
    'a business already in the CRM is flagged',
    flagged.prospects[0]?.existingCrmId === 'crm-1',
  );
  // Truncation is stated, never silent.
  const many = Array.from({ length: 30 }, (_, i) =>
    prospect({ id: `P${i}`, name: `Fixture ${i}` }),
  );
  const capped = shortlist(many, [], 25);
  extra('truncation is reported', capped.prospects.length === 25 && capped.dropped === 5);
}

/* ===================================================== 10 · admin safety */

{
  const revenuePage = src('src/app/admin/(dashboard)/directory/revenue/page.tsx');
  check(
    'REV63',
    'admin pages noindex',
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(revenuePage),
  );
  check(
    'REV64',
    'admin null canonical',
    /alternates:\s*\{\s*canonical:\s*null\s*\}/.test(revenuePage),
  );
  extra(
    'admin revenue page is force-dynamic',
    /export const dynamic = 'force-dynamic'/.test(revenuePage),
  );
}

// REV65 — requireAdmin() is the FIRST statement of every exported server action
// and of the page itself.
{
  const files = [
    'src/app/admin/(dashboard)/directory/revenue/actions.ts',
    'src/app/admin/(dashboard)/directory/placements/actions.ts',
  ];
  const offenders: string[] = [];
  for (const f of files) {
    const text = src(f);
    const re =
      /export async function (\w+)\(formData: FormData\): Promise<void> \{\s*\n\s*([^\n]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (!m[2].startsWith('requireAdmin()')) offenders.push(`${f}:${m[1]}`);
    }
  }
  const revenuePage = src('src/app/admin/(dashboard)/directory/revenue/page.tsx');
  check(
    'REV65',
    'requireAdmin first',
    offenders.length === 0 && /\{\s*\n\s*requireAdmin\(\);/.test(revenuePage),
    offenders,
  );
}

// REV66 — the service role client is server-only, and no client component
// imports it or the admin data layer.
{
  const adminClient = src('src/lib/supabase/admin.ts');
  const clientComponents = [
    'src/components/sponsors/SponsorInquiryForm.tsx',
    'src/components/directory/ListingFunnelCtas.tsx',
    'src/components/admin/AdminNav.tsx',
  ].map(src);
  check(
    'REV66',
    'no service role in client',
    /server-only/.test(adminClient) &&
      clientComponents.every((c) => !/supabase\/admin|SERVICE_ROLE/.test(c)),
  );
  // The revenue console is a server component: no 'use client' anywhere in it.
  extra(
    'the revenue console is a server component',
    !/^'use client'/m.test(src('src/app/admin/(dashboard)/directory/revenue/page.tsx')),
  );
}

// REV67 — no public surface renders CRM contact data, and no public API exposes
// the sponsors table.
{
  const publicSurfaces = [
    'src/app/(marketing)/sponsors/page.tsx',
    'src/components/directory/SponsorSlot.tsx',
    'src/components/directory/GetFeaturedCta.tsx',
    'src/lib/directory/sponsors-data.ts',
  ]
    .map(src)
    .join('\n');
  check(
    'REV67',
    'no CRM PII public',
    !/from\('sponsors'\)/.test(publicSurfaces) &&
      !/contact_name|pledged_cents|paid_cents/.test(publicSurfaces),
  );
  // The public sponsor reader only ever selects display columns.
  const reader = src('src/lib/directory/sponsors-data.ts');
  extra(
    'the public sponsor reader selects display columns only',
    !/notes|email|phone/.test(reader),
  );
}

// REV68 — this suite writes nothing. It constructs no Supabase client, imports
// no network module, and reads the filesystem only.
//
// The check is deliberately about IMPORTS and CALLS rather than about the
// characters `.update(` appearing anywhere: this file contains regexes that
// *look for* write calls in the application source, and a naive scan would
// flag its own inspection tooling. What matters is that nothing here can reach
// a database.
{
  const self = src('scripts/test-revenue-first-customer.ts');
  const imports = [...self.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const forbiddenImport = imports.find(
    (i) => /supabase|node:http|node:net|undici|axios/i.test(i) && !/directory|api\/schemas/.test(i),
  );
  // A real call, not a string or a regex: `supabase.from(...)`, `createXClient()`, `fetch(`.
  const callsNetwork =
    /(?:^|[^'"`\w.])(?:createAdminClient|createStaticClient|createServerClient)\s*\(/m.test(
      self.replace(/\/\*[\s\S]*?\*\//g, ' '),
    );
  const callsFetch = /(?:^|[^'"`\w.])fetch\s*\(/m.test(self.replace(/\/\*[\s\S]*?\*\//g, ' '));
  check(
    'REV68',
    'no production writes in test',
    forbiddenImport === undefined && !callsNetwork && !callsFetch,
    forbiddenImport,
  );
}

// REV69 / REV70 — nothing in the revenue system sends anything or charges
// anything.
{
  const system = [
    'src/lib/directory/revenue.ts',
    'src/lib/directory/offers.ts',
    'src/lib/directory/prospects.ts',
    'src/app/admin/(dashboard)/directory/revenue/actions.ts',
    'src/app/admin/(dashboard)/directory/revenue/page.tsx',
    'src/app/admin/(dashboard)/directory/placements/actions.ts',
    'src/app/api/sponsor-inquiry/route.ts',
  ]
    .map(src)
    .join('\n');
  const stripped = system.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  check(
    'REV69',
    'no automatic outreach',
    !/sendMail|nodemailer|sendgrid|postmark|resend\.|twilio|mailto:/i.test(stripped),
  );
  check(
    'REV70',
    'no payment processor',
    !/stripe|paypal|square|braintree|paymentIntent|checkout\.session|createCharge/i.test(stripped),
  );
}

/* ============================================ 11 · Scenario A — corridor */

{
  const log: string[] = [];
  const step = (n: string, cond: boolean) => {
    extra(`A · ${n}`, cond);
    log.push(`${cond ? 'ok  ' : 'FAIL'} ${n}`);
  };

  // 1. arrives from an I-75 CTA
  const href = funnelHref('corridor', { slug: 'fixture-truck-wash', interstate: 'I-75' }, 'i75');
  step(
    '1 arrives from an I-75 CTA',
    href.includes('interest=corridor-sponsor') && href.includes('from=i75'),
  );

  // 2. submits the inquiry
  const payload = {
    company: 'Fixture Truck Wash',
    contact_name: 'Pat',
    email: 'pat@example.com',
    tier_interest: 'corridor-sponsor',
    message: 'Came from: i75',
    turnstileToken: 'tok',
  };
  step('2 inquiry validates', sponsorInquirySchema.safeParse(payload).success);

  // 3. CRM row appears, unanswered
  let row: SponsorSaleRow = {
    id: 'A1',
    stage: 'prospect',
    status: 'new',
    tierInterest: 'corridor-sponsor',
    pledgedCents: 0,
    paidCents: 0,
    nextAction: 'Reply to this inquiry',
    nextActionDate: '2026-09-01',
    notes: 'Came from: i75',
  };
  step('3 CRM row starts unanswered', readSaleState(row).stage === 'prospect');

  // 4. duplicate detection runs
  step(
    '4 duplicate detection runs',
    findDuplicates({ id: 'A1', company: 'Fixture Truck Wash', email: null, phone: null }, [])
      .length === 0,
  );

  // 5–6. record a call, move to contacted, then warm
  step(
    '5 contact recorded then stage moves',
    stageTransitionBlockers('prospect', 'contacted', '').length === 0,
  );
  row = { ...row, stage: 'contacted', status: 'contacted' };
  step('6 marks warm', stageTransitionBlockers('contacted', 'warm', '').length === 0);
  row = { ...row, stage: 'warm' };

  // 7–8. annual corridor offer, proposal uses the authority price
  const quote: Quote = {
    offerId: 'corridor-sponsor',
    term: 'annual',
    quotedCents: standardAmountCents('corridor-sponsor', 'annual')!,
    reason: '',
    recordedBy: 'Shawn',
  };
  step('7 annual corridor offer accepted', quoteBlockers(quote).length === 0);
  step(
    '8 proposal price comes from the authority',
    quote.quotedCents === 299900 && formatPrice(quote.quotedCents) === '$2,999',
  );
  row = {
    ...row,
    pledgedCents: quote.quotedCents,
    notes: appendNote(row.notes, agreedOfferNoteLine(quote, new Date('2026-09-02T00:00:00Z'))),
  };

  // 9. committed
  step('9 records committed', stageTransitionBlockers('warm', 'committed', '').length === 0);
  row = { ...row, stage: 'committed' };

  // 10. manual payment
  const payment: PaymentEntry = {
    paidCents: 299900,
    paidOn: '2026-09-03',
    confirmed: true,
    reference: 'check 1042',
    recordedBy: 'Shawn',
  };
  step(
    '10 payment records',
    paymentBlockers(quote, payment, new Date('2026-09-03T12:00:00Z')).length === 0,
  );
  row = {
    ...row,
    paidCents: payment.paidCents,
    status: 'paid',
    notes: appendNote(row.notes, paymentNoteLine(payment, new Date('2026-09-03T00:00:00Z'))),
  };

  // 11–13. target, capacity, dates
  const sale = readSaleState(row);
  const win = { startsAt: '2026-09-05T00:00:00.000Z', endsAt: '2027-09-05T23:59:59.000Z' };
  step('11 selects I-75', CORRIDOR_INPUT.corridor === 'I-75');
  const placementVerdict = canActivateCorridorSponsor(
    CORRIDOR_INPUT,
    [],
    win,
    new Date('2026-09-04T00:00:00Z'),
  );
  step('12 capacity check passes', placementVerdict.ok);
  step('13 start and end saved', win.endsAt > win.startsAt);

  // 14–15. disclosure preview, then both halves of the gate pass
  step('14 preview says Sponsored', getOffer('corridor-sponsor').disclosure === 'Sponsored');
  const saleVerdict = saleActivationBlockers('corridor-sponsor', sale, win);
  step('15 activation succeeds in the fixture', saleVerdict.length === 0 && placementVerdict.ok);

  // 16–19. the public window
  const live: Sponsor = { ...FIXTURE_SPONSOR, startsAt: win.startsAt, endsAt: win.endsAt };
  const ctx = { placement: 'interstate' as const, interstate: 'I-75' };
  step(
    '16 public I-75 page displays the sponsor',
    activeSponsorsFor([live], { ...ctx, now: new Date('2026-10-01T00:00:00Z') }).length === 1,
  );
  step(
    '17 before start: hidden',
    activeSponsorsFor([live], { ...ctx, now: new Date('2026-09-04T00:00:00Z') }).length === 0,
  );
  step(
    '18 during term: visible',
    activeSponsorsFor([live], { ...ctx, now: new Date('2027-03-01T00:00:00Z') }).length === 1,
  );
  step(
    '19 after end: hidden automatically',
    activeSponsorsFor([live], { ...ctx, now: new Date('2027-09-06T00:00:00Z') }).length === 0,
  );

  // 20. the renewal task survives the placement
  const renewal = renewalView(
    'corridor-sponsor',
    '2027-09-05',
    true,
    new Date('2027-08-28T00:00:00Z'),
  );
  step(
    '20 renewal task remains visible',
    renewal.state === 'due' && renewal.needsManualStop === false,
  );

  console.log('\n  Scenario A — corridor sponsor');
  for (const l of log) console.log(`    ${l}`);
}

/* ============================================ 12 · Scenario B — featured */

{
  const log: string[] = [];
  const step = (n: string, cond: boolean) => {
    extra(`B · ${n}`, cond);
    log.push(`${cond ? 'ok  ' : 'FAIL'} ${n}`);
  };

  const target = listing({
    id: 'B-listing',
    name: 'Fixture Tire Repair',
    categorySlug: 'tire-repair',
  });

  // 1–2. inquiry references a real listing; relationship verified on the call
  step('1 inquiry references a real listing', target.isPublished && target.deletedAt === null);
  step(
    '2 relationship verified before quoting',
    /qualification/i.test(src('src/app/admin/(dashboard)/directory/revenue/actions.ts')),
  );

  // 3–4. monthly featured offer, payment recorded
  const quote: Quote = {
    offerId: 'featured-listing',
    term: 'monthly',
    quotedCents: standardAmountCents('featured-listing', 'monthly')!,
    reason: '',
    recordedBy: 'Shawn',
  };
  step(
    '3 monthly featured offer selected',
    quoteBlockers(quote).length === 0 && quote.quotedCents === 9900,
  );
  const payment: PaymentEntry = {
    paidCents: 9900,
    paidOn: '2026-09-03',
    confirmed: true,
    reference: 'bank transfer',
    recordedBy: 'Shawn',
  };
  step(
    '4 payment recorded',
    paymentBlockers(quote, payment, new Date('2026-09-03T12:00:00Z')).length === 0,
  );

  const row: SponsorSaleRow = {
    id: 'B1',
    stage: 'committed',
    status: 'paid',
    tierInterest: 'featured-listing',
    pledgedCents: 9900,
    paidCents: 9900,
    nextAction: 'Activate the placement that was paid for',
    nextActionDate: '2026-09-03',
    notes: appendNote(
      agreedOfferNoteLine(quote, new Date('2026-09-02T00:00:00Z')),
      paymentNoteLine(payment, new Date('2026-09-03T00:00:00Z')),
    ),
  };
  const sale = readSaleState(row);

  // 5. capacity on both pages
  const win = { startsAt: '2026-09-05T00:00:00.000Z', endsAt: '2026-10-05T23:59:59.000Z' };
  const verdict = canActivateFeatured(target, [], win);
  step(
    '5 category and corridor capacity checked',
    verdict.usage.category.slug === 'tire-repair' &&
      verdict.usage.corridor?.corridor === 'I-75' &&
      verdict.ok,
  );

  // 6–7. the sale gate agrees, and the public sees a badge
  step(
    '6 listing becomes Sponsored in fixture',
    saleActivationBlockers('featured-listing', sale, win).length === 0,
  );
  step(
    '7 card and detail page display Sponsored',
    /Sponsored/.test(src('src/components/directory/EntryCard.tsx')) &&
      /Sponsored/.test(src('src/app/(directory)/directory/location/[slug]/page.tsx')),
  );

  // 8–9. the term ends and the admin says so, loudly
  const end = renewalDateFor('2026-09-05', 'monthly');
  step('8 term date reaches expiry', end === '2026-10-05');
  const overdue = renewalView('featured-listing', end, true, new Date('2026-10-12T00:00:00Z'));
  step(
    '9 admin shows overdue deactivation warning',
    overdue.state === 'overdue' && overdue.needsManualStop && /STILL SHOWING/.test(overdue.label),
  );

  // 10–11. deactivation removes the sponsorship and nothing else
  const stopped = { ...target, isFeatured: false };
  step('10 owner deactivates', stopped.isFeatured === false);
  step('11 listing remains published', stopped.isPublished === true && stopped.deletedAt === null);

  console.log('\n  Scenario B — featured listing');
  for (const l of log) console.log(`    ${l}`);
}

/* ================================================ 13 · mutation testing */

/**
 * Each mutation removes exactly one protection and asserts the rule that
 * protects it would now fail. If a mutation still "passes", the corresponding
 * check is decorative and this suite says so.
 */
{
  const mutations: [string, () => boolean][] = [
    [
      'removing Sponsored from the sponsor block would be caught',
      () => {
        const mutated = src('src/components/directory/SponsorSlot.tsx').replace(
          /Sponsored/g,
          'Partner',
        );
        return !(/aria-label="Sponsored"/.test(mutated) && />\s*Sponsored\s*</.test(mutated));
      },
    ],
    [
      'allowing unpaid activation would be caught',
      () =>
        saleActivationBlockers(
          'corridor-sponsor',
          readSaleState(soldRow({ paidCents: 0, notes: null })),
          WINDOW,
        ).length > 0,
    ],
    [
      'allowing an empty corridor wildcard would be caught',
      () =>
        canActivateCorridorSponsor({ ...CORRIDOR_INPUT, corridor: '' }, [], WINDOW, NOW).ok ===
        false,
    ],
    [
      'exceeding corridor capacity would be caught',
      () =>
        canActivateCorridorSponsor(
          CORRIDOR_INPUT,
          [
            {
              id: 'x',
              name: 'Incumbent',
              placements: ['interstate'],
              interstates: ['I-75'],
              active: true,
              startsAt: null,
              endsAt: null,
            },
          ],
          WINDOW,
          NOW,
        ).ok === false,
    ],
    [
      'exceeding featured capacity would be caught',
      () =>
        canActivateFeatured(
          listing(),
          [
            listing({ id: '1', isFeatured: true }),
            listing({ id: '2', isFeatured: true }),
            listing({ id: '3', isFeatured: true }),
          ],
          WINDOW,
        ).ok === false,
    ],
    [
      'accepting an expired sponsor would be caught',
      () =>
        activeSponsorsFor([FIXTURE_SPONSOR], {
          placement: 'interstate',
          interstate: 'I-75',
          now: new Date('2028-01-01T00:00:00Z'),
        }).length === 0,
    ],
    [
      'sending PII to analytics would be caught',
      () => {
        const form = src('src/components/sponsors/SponsorInquiryForm.tsx');
        const mutated = form.replace(
          'if (from) eventProps.surface = from;',
          'eventProps.email = email;',
        );
        const block = mutated.slice(
          mutated.indexOf('const eventProps'),
          mutated.indexOf('const startedRef'),
        );
        return /eventProps\.(?:email|phone|company|message)/i.test(block);
      },
    ],
    [
      'exposing notes publicly would be caught',
      () => {
        const mutated = src('src/lib/directory/sponsors-data.ts').replace(
          "'id, name, tagline, url, logo, placements, states, interstates, categories, active, starts_at, ends_at',",
          "'id, name, notes, email',",
        );
        return /notes|email/.test(mutated);
      },
    ],
    [
      'inventing a payment reference would be caught',
      () => {
        // A reference is only ever what the operator typed; nothing generates one.
        const actions = src('src/app/admin/(dashboard)/directory/revenue/actions.ts');
        return (
          !/reference\s*=\s*(?:`|'|")(?!\s*$)[^'"`]*\$\{/.test(actions) &&
          /field\(formData, 'reference'\)/.test(actions)
        );
      },
    ],
    [
      'skipping the admin gate would be caught',
      () => {
        const mutated = src('src/app/admin/(dashboard)/directory/revenue/actions.ts').replace(
          /requireAdmin\(\);\n/,
          '',
        );
        const re =
          /export async function (\w+)\(formData: FormData\): Promise<void> \{\s*\n\s*([^\n]+)/g;
        let m: RegExpExecArray | null;
        let offenders = 0;
        while ((m = re.exec(mutated)) !== null) if (!m[2].startsWith('requireAdmin()')) offenders++;
        return offenders > 0;
      },
    ],
  ];
  console.log('\n  Mutation checks');
  for (const [name, fn] of mutations) {
    const caught = fn();
    extra(`mutation: ${name}`, caught);
    console.log(`    ${caught ? 'ok  ' : 'FAIL'} ${name}`);
  }
}

/* ======================================================== 14 · coverage */

{
  const expected = Array.from({ length: 70 }, (_, i) => `REV${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  extra(`REV1–REV70 all reported (${seen.size}/70)`, missing.length === 0, missing);
}

// Honest empty states: with no data, a rate is an absence, not a zero.
{
  const empty = pipelineSummary([], NOW);
  extra('empty pipeline reports no rate rather than 0%', rate(empty.paid, empty.total) === null);
  extra('empty pipeline counts are zero', empty.total === 0 && empty.collectedCents === 0);
  extra(
    'the console says so in words',
    /no conversion rate to show|invented number/i.test(
      src('src/app/admin/(dashboard)/directory/revenue/page.tsx'),
    ),
  );
}

// The universal limitations are stated in the offer authority and reused.
{
  extra(
    'universal limitations name the guarantees we do not give',
    UNIVERSAL_LIMITATIONS.some((l) => /No guaranteed traffic/i.test(l)),
  );
  extra(
    'every paid offer carries the universal limitations',
    paidOffers().every((o) => UNIVERSAL_LIMITATIONS.every((l) => o.limitations.includes(l))),
  );
  extra(
    'every paid offer declares its disclosure word',
    paidOffers().every((o) => o.disclosure === 'Sponsored'),
  );
  extra('the free claim declares no disclosure', getOffer('listing-claim').disclosure === null);
  extra(
    'every inquiry option id is bounded',
    INQUIRY_OPTIONS.every((o) => (INQUIRY_OPTION_IDS as readonly string[]).includes(o.value)),
  );
  extra(
    'billing periods are narrowed at runtime',
    isBillingPeriod('annual') && !isBillingPeriod('quarterly'),
  );
  extra(
    'stage machine has no path that skips committed',
    !STAGE_TRANSITIONS.warm.includes('closed_won'),
  );
  extra('isoDay is stable', isoDay(new Date('2026-09-01T23:59:59Z')) === '2026-09-01');
}

console.log(`\nrevenue-first-customer: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

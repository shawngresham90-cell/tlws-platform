/**
 * Paid placement safety — capacity, date windows, activation/deactivation,
 * duplicate sponsorships, expiry, claim/paid separation, disclosure labels,
 * held-listing exclusion, authorization, and failure behaviour.
 *
 * Offline: the pure rule modules are exercised directly, and the admin actions
 * and pages are read as source to assert the guarantees that only exist in the
 * wiring (every action is admin-gated, no action touches a listing from the
 * claim path, no action collects payment).
 *
 * Run:
 *   npx esbuild scripts/test-placements.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-placements.cjs && node /tmp/test-placements.cjs
 */
import { readFileSync } from 'node:fs';
import {
  FEATURED_PER_PAGE,
  PRIMARY_CORRIDOR_SPONSORS,
  canActivateCorridorSponsor,
  canActivateFeatured,
  corridorSponsorConflicts,
  featuredUsage,
  isHeldBrand,
  isWithinWindow,
  placementNoteLine,
  placementTouchSummary,
  promotionBlockers,
  termEnd,
  windowBlockers,
  windowStatus,
  type CorridorSponsorRow,
  type PromotableListing,
} from '@/lib/directory/placements';
import {
  CLAIM_CHECKLIST,
  CLAIM_DECISION_STAGE,
  parseReview,
  reviewBlockers,
  reviewNoteLine,
  reviewTouchSummary,
} from '@/lib/admin/claim-review';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail: unknown = '') {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${String(detail)}` : ''}`);
  }
}

const NOW = new Date('2026-08-01T12:00:00Z');

function listing(over: Partial<PromotableListing> = {}): PromotableListing {
  return {
    id: 'l1',
    name: 'Independent Tire',
    categorySlug: 'tire-repair',
    interstate: 'I-95',
    state: 'SC',
    isPublished: true,
    isFeatured: false,
    deletedAt: null,
    ...over,
  };
}

function sponsor(over: Partial<CorridorSponsorRow> = {}): CorridorSponsorRow {
  return {
    id: 's1',
    name: 'Snider Fleet',
    placements: ['interstate'],
    interstates: ['I-95'],
    active: true,
    startsAt: '2026-07-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    ...over,
  };
}

/* ------------------------------------------------------ approved capacity */
check('featured capacity is three', FEATURED_PER_PAGE === 3, FEATURED_PER_PAGE);
check(
  'corridor primary capacity is one',
  PRIMARY_CORRIDOR_SPONSORS === 1,
  PRIMARY_CORRIDOR_SPONSORS,
);

/* -------------------------------------------------- held-brand exclusion */
for (const held of [
  "Love's Travel Stop #123",
  'PILOT TRAVEL CENTER',
  'Flying J Travel Plaza',
  'Sapp Bros Truck Stop',
  'Goasis Travel Center',
  'Thorntons #45',
]) {
  check(`held brand rejected: ${held}`, isHeldBrand(held));
  check(
    `held brand blocks promotion: ${held}`,
    promotionBlockers(listing({ name: held })).some((b) => /held brand/i.test(b)),
  );
}
for (const ok of ['Martino Commercial Tire', "Pat's Tire", 'Colony Tire & Service']) {
  check(`independent is promotable: ${ok}`, !isHeldBrand(ok));
  check(
    `independent has no blockers: ${ok}`,
    promotionBlockers(listing({ name: ok })).length === 0,
  );
}
check('null name is not a held brand', !isHeldBrand(null));

/* ------------------------------------------------- other promotion blockers */
check(
  'unpublished listing cannot be promoted',
  promotionBlockers(listing({ isPublished: false })).some((b) => /not published/i.test(b)),
);
check(
  'deleted listing cannot be promoted',
  promotionBlockers(listing({ deletedAt: '2026-01-01T00:00:00Z' })).some((b) => /deleted/i.test(b)),
);
check(
  'uncategorised listing cannot be promoted',
  promotionBlockers(listing({ categorySlug: null })).some((b) => /no category/i.test(b)),
);

/* ------------------------------------------------------------ date windows */
const term = { startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-12-31T23:59:59Z' };
check('in-term window is active', windowStatus(term, NOW) === 'active', windowStatus(term, NOW));
check(
  'future window is scheduled',
  windowStatus({ startsAt: '2026-09-01T00:00:00Z', endsAt: null }, NOW) === 'scheduled',
);
check(
  'past window is expired',
  windowStatus({ startsAt: null, endsAt: '2026-07-31T23:59:59Z' }, NOW) === 'expired',
);
check(
  'no end date is open-ended, not active',
  windowStatus({ startsAt: null, endsAt: null }, NOW) === 'open-ended',
);
check('active window displays', isWithinWindow(term, NOW));
check(
  'expired window does not display',
  !isWithinWindow({ startsAt: null, endsAt: '2026-07-31T00:00:00Z' }, NOW),
);
check(
  'scheduled window does not display yet',
  !isWithinWindow({ startsAt: '2026-09-01T00:00:00Z', endsAt: null }, NOW),
);
check(
  'expiry is exact to the second — one second after the end is expired',
  !isWithinWindow({ startsAt: null, endsAt: '2026-08-01T11:59:59Z' }, NOW),
);
check(
  'one second before the end is still live',
  isWithinWindow({ startsAt: null, endsAt: '2026-08-01T12:00:01Z' }, NOW),
);

check(
  'inverted term is rejected',
  windowBlockers({ startsAt: term.endsAt, endsAt: term.startsAt }).length > 0,
);
check(
  'equal start and end is rejected',
  windowBlockers({ startsAt: term.startsAt, endsAt: term.startsAt }).length > 0,
);
check('garbage date is rejected', windowBlockers({ startsAt: 'soon', endsAt: null }).length > 0);
check(
  'blank term is allowed by the parser',
  windowBlockers({ startsAt: null, endsAt: null }).length === 0,
);

check(
  'monthly term ends a month later',
  termEnd('2026-08-01T00:00:00Z', 'monthly').startsWith('2026-09-01'),
);
check(
  'annual term ends a year later',
  termEnd('2026-08-01T00:00:00Z', 'annual').startsWith('2027-08-01'),
);

/* -------------------------------------------- featured-listing capacity */
const threeInCategory: PromotableListing[] = [1, 2, 3].map((n) =>
  listing({ id: `f${n}`, name: `Shop ${n}`, isFeatured: true, interstate: 'I-40' }),
);
const usageFull = featuredUsage(listing({ id: 'new' }), threeInCategory);
check('three in category is counted', usageFull.category.used === 3, usageFull.category.used);
check(
  'a full category page blocks activation',
  !canActivateFeatured(listing({ id: 'new' }), threeInCategory, term).ok,
);
check(
  'the refusal names the category limit',
  canActivateFeatured(listing({ id: 'new' }), threeInCategory, term).blockers.some((b) =>
    b.includes('tire-repair'),
  ),
);

const twoInCategory = threeInCategory.slice(0, 2);
check(
  'two in category still leaves room',
  canActivateFeatured(listing({ id: 'new' }), twoInCategory, term).ok,
);

// A listing sits on BOTH its category page and its corridor page: a full
// corridor must block even when the category is empty.
const threeOnCorridor: PromotableListing[] = [1, 2, 3].map((n) =>
  listing({
    id: `c${n}`,
    name: `Wash ${n}`,
    categorySlug: 'truck-washes',
    interstate: 'I-95',
    isFeatured: true,
  }),
);
const corridorVerdict = canActivateFeatured(listing({ id: 'new' }), threeOnCorridor, term);
check('an empty category page does not excuse a full corridor', !corridorVerdict.ok);
check(
  'the refusal names the corridor limit',
  corridorVerdict.blockers.some((b) => b.includes('I-95')),
  corridorVerdict.blockers,
);

// Re-activating a listing that is already featured must not count itself.
const self = listing({ id: 'self', isFeatured: true });
check(
  'a listing does not count against its own capacity',
  featuredUsage(self, [self, ...twoInCategory]).category.used === 2,
);

// Unpublished or deleted featured rows are not occupying a public slot.
check(
  'an unpublished featured row does not occupy a slot',
  featuredUsage(listing({ id: 'new' }), [
    ...twoInCategory,
    listing({ id: 'ghost', isFeatured: true, isPublished: false }),
  ]).category.used === 2,
);
check(
  'a deleted featured row does not occupy a slot',
  featuredUsage(listing({ id: 'new' }), [
    ...twoInCategory,
    listing({ id: 'gone', isFeatured: true, deletedAt: '2026-01-01T00:00:00Z' }),
  ]).category.used === 2,
);

// A listing with no corridor is only limited by its category page.
check(
  'a listing off-corridor has no corridor limit',
  featuredUsage(listing({ id: 'new', interstate: null }), threeOnCorridor).corridor === null,
);

// A held brand cannot be activated even when there is plenty of room.
check(
  'a held brand is refused even with capacity free',
  !canActivateFeatured(listing({ id: 'new', name: "Love's #55" }), [], term).ok,
);
// An invalid term is refused even when everything else is fine.
check(
  'an invalid term is refused',
  !canActivateFeatured(listing({ id: 'new' }), [], { startsAt: 'x', endsAt: null }).ok,
);

/* -------------------------------------------- corridor-sponsor capacity */
check(
  'an existing in-window sponsor conflicts',
  corridorSponsorConflicts([sponsor()], 'I-95', NOW).length === 1,
);
check(
  'a different corridor does not conflict',
  corridorSponsorConflicts([sponsor()], 'I-40', NOW).length === 0,
);
check(
  'an inactive sponsor does not conflict',
  corridorSponsorConflicts([sponsor({ active: false })], 'I-95', NOW).length === 0,
);
check(
  'an expired sponsor does not conflict',
  corridorSponsorConflicts([sponsor({ endsAt: '2026-07-31T00:00:00Z' })], 'I-95', NOW).length === 0,
);
check(
  'a scheduled sponsor still conflicts is FALSE — it is not showing yet',
  corridorSponsorConflicts([sponsor({ startsAt: '2026-09-01T00:00:00Z' })], 'I-95', NOW).length ===
    0,
);
check(
  'a non-interstate placement does not conflict',
  corridorSponsorConflicts([sponsor({ placements: ['detail'] })], 'I-95', NOW).length === 0,
);
// The wildcard is the case that actually double-sells a page.
check(
  'a blank-targeting sponsor conflicts with EVERY corridor',
  corridorSponsorConflicts([sponsor({ interstates: [] })], 'I-10', NOW).length === 1,
);
check(
  'excludeId lets a sponsor be restarted against itself',
  corridorSponsorConflicts([sponsor()], 'I-95', NOW, 's1').length === 0,
);

const goodInput = { corridor: 'I-40', url: 'https://example.com', name: 'Acme Diesel' };
check(
  'a free corridor accepts a sponsor',
  canActivateCorridorSponsor(goodInput, [sponsor()], term, NOW).ok,
);
check(
  'a taken corridor refuses a second sponsor',
  !canActivateCorridorSponsor({ ...goodInput, corridor: 'I-95' }, [sponsor()], term, NOW).ok,
);
check(
  'the refusal names the incumbent',
  canActivateCorridorSponsor(
    { ...goodInput, corridor: 'I-95' },
    [sponsor()],
    term,
    NOW,
  ).blockers.some((b) => b.includes('Snider Fleet')),
);
check(
  'a blank corridor is refused rather than becoming a wildcard',
  !canActivateCorridorSponsor({ ...goodInput, corridor: '' }, [], term, NOW).ok,
);
check(
  'the blank-corridor refusal explains why',
  canActivateCorridorSponsor({ ...goodInput, corridor: '' }, [], term, NOW).blockers.some((b) =>
    /every corridor page/i.test(b),
  ),
);
check(
  'a US route is not an interstate',
  !canActivateCorridorSponsor({ ...goodInput, corridor: 'US-1' }, [], term, NOW).ok,
);
for (const bad of ['javascript:alert(1)', 'ftp://x.example', 'example.com', '']) {
  check(
    `an unsafe sponsor link is refused: ${bad || '(blank)'}`,
    !canActivateCorridorSponsor({ ...goodInput, url: bad }, [], term, NOW).ok,
  );
}
check(
  'a nameless sponsor is refused',
  !canActivateCorridorSponsor({ ...goodInput, name: '   ' }, [], term, NOW).ok,
);

/* ------------------------------------------------------------ audit trail */
const noteLine = placementNoteLine(
  {
    kind: 'featured-listing',
    target: 'Martino Commercial Tire',
    billing: 'annual',
    startsAt: '2026-08-01T00:00:00Z',
    endsAt: '2027-08-01T23:59:59Z',
    reviewer: 'Shawn',
    action: 'activated',
  },
  '2026-08-01T12:00:00Z',
);
check('audit note names the placement', noteLine.includes('Featured listing'));
check('audit note names the target', noteLine.includes('Martino Commercial Tire'));
check('audit note records the reviewer', noteLine.includes('by Shawn'));
check(
  'audit note records the term',
  noteLine.includes('from 2026-08-01') && noteLine.includes('to 2027-08-01'),
);
check('audit note records the billing', noteLine.includes('billing annual'));
check('audit note is a single line', !noteLine.includes('\n'));
check(
  'touch summary says what happened',
  /Featured listing activated: Martino Commercial Tire through 2027-08-01/.test(
    placementTouchSummary({
      kind: 'featured-listing',
      target: 'Martino Commercial Tire',
      billing: 'annual',
      startsAt: null,
      endsAt: '2027-08-01T00:00:00Z',
      reviewer: 'Shawn',
      action: 'activated',
    }),
  ),
);
check(
  'a deactivation touch does not claim a term',
  !placementTouchSummary({
    kind: 'corridor-sponsor',
    target: 'Acme on I-40',
    billing: null,
    startsAt: null,
    endsAt: null,
    reviewer: 'Shawn',
    action: 'deactivated',
  }).includes('through'),
);

/* ------------------------------------------------------------ claim review */
check('verified maps to closed_won', CLAIM_DECISION_STAGE.verified === 'closed_won');
check('rejected maps to closed_lost', CLAIM_DECISION_STAGE.rejected === 'closed_lost');
check('the checklist has five items', CLAIM_CHECKLIST.length === 5, CLAIM_CHECKLIST.length);

const allChecks = CLAIM_CHECKLIST.map((c) => c.id);
check(
  'verifying with every check and a reviewer is allowed',
  reviewBlockers({ decision: 'verified', reviewer: 'Shawn', confirmed: allChecks, reason: '' })
    .length === 0,
);
check(
  'verifying with a missing check is refused',
  reviewBlockers({
    decision: 'verified',
    reviewer: 'Shawn',
    confirmed: allChecks.slice(1),
    reason: '',
  }).length > 0,
);
check(
  'verifying without a reviewer is refused',
  reviewBlockers({ decision: 'verified', reviewer: '  ', confirmed: allChecks, reason: '' })
    .length > 0,
);
check(
  'rejecting without a reason is refused',
  reviewBlockers({ decision: 'rejected', reviewer: 'Shawn', confirmed: [], reason: '' }).length > 0,
);
check(
  'rejecting with a reason is allowed and needs no checklist',
  reviewBlockers({
    decision: 'rejected',
    reviewer: 'Shawn',
    confirmed: [],
    reason: 'Phone did not match.',
  }).length === 0,
);

const reviewNote = reviewNoteLine(
  { decision: 'verified', reviewer: 'Shawn', confirmed: allChecks, reason: 'Called the shop.' },
  '2026-08-02T09:00:00Z',
);
check('review note is parseable', parseReview(reviewNote) !== null);
check('review note round-trips the decision', parseReview(reviewNote)?.decision === 'verified');
check('review note round-trips the reviewer', parseReview(reviewNote)?.reviewer === 'Shawn');
check('review note round-trips the date', parseReview(reviewNote)?.date === '2026-08-02');
check('an unreviewed note parses to null', parseReview('Just an inquiry.') === null);
check('an empty note parses to null', parseReview(null) === null);
check(
  'a rejection round-trips',
  parseReview(
    reviewNoteLine(
      { decision: 'rejected', reviewer: 'Shawn', confirmed: [], reason: 'No match.' },
      '2026-08-02T09:00:00Z',
    ),
  )?.decision === 'rejected',
);
check(
  'the touch summary carries the reason',
  reviewTouchSummary({
    decision: 'rejected',
    reviewer: 'Shawn',
    confirmed: [],
    reason: 'No match.',
  }).includes('No match.'),
);

/* --------------------------------------------- wiring guarantees (source) */
const src = {
  placementActions: readFileSync(
    'src/app/admin/(dashboard)/directory/placements/actions.ts',
    'utf8',
  ),
  placementPage: readFileSync('src/app/admin/(dashboard)/directory/placements/page.tsx', 'utf8'),
  claimActions: readFileSync('src/app/admin/(dashboard)/sponsors/actions.ts', 'utf8'),
  sponsorPage: readFileSync('src/app/admin/(dashboard)/sponsors/page.tsx', 'utf8'),
  legacySponsorActions: readFileSync(
    'src/app/admin/(dashboard)/directory/sponsors/actions.ts',
    'utf8',
  ),
  slot: readFileSync('src/components/directory/SponsorSlot.tsx', 'utf8'),
  card: readFileSync('src/components/directory/EntryCard.tsx', 'utf8'),
};

// Authorization. Not "the file mentions requireAdmin somewhere" — every
// exported server action must gate as its FIRST statement, before it reads a
// form field or touches the database.
for (const [name, text] of Object.entries(src)) {
  if (!text.startsWith("'use server'")) continue;
  const actions = [...text.matchAll(/export async function (\w+)\([\s\S]*?\{\n([^\n]*)/g)];
  check(`${name}: has server actions`, actions.length > 0, actions.length);
  for (const [, fn, firstLine] of actions) {
    check(
      `${name}.${fn}: gates on requireAdmin() first`,
      firstLine.trim() === 'requireAdmin();',
      firstLine.trim(),
    );
  }
}
// And the gate itself fails closed when the env is not configured.
check(
  'requireAdmin fails closed without admin env vars',
  /adminConfigured\(\)/.test(readFileSync('src/lib/admin/auth.ts', 'utf8')) &&
    /return Boolean\(process\.env\.ADMIN_PASSWORD && process\.env\.ADMIN_SESSION_SECRET\)/.test(
      readFileSync('src/lib/admin/auth.ts', 'utf8'),
    ),
);
// The dashboard layout gates every page in the group as a second wall.
check(
  'the admin dashboard layout gates every page',
  /requireAdmin\(\);/.test(readFileSync('src/app/admin/(dashboard)/layout.tsx', 'utf8')),
);

// Claim/paid separation, enforced server-side and not merely in the UI.
check(
  'the claim action refuses anything that is not a listing-claim',
  /tier_interest[\s\S]{0,120}listing-claim/.test(src.claimActions),
);
check('the claim action never writes to locations', !/from\('locations'\)/.test(src.claimActions));
check('the claim action never touches is_featured', !/is_featured/.test(src.claimActions));
check('the claim action does not delete anything', !/\.delete\(/.test(src.claimActions));
check(
  'the sponsor inbox only offers review on a claim',
  /dir\.type !== 'listing-claim'/.test(src.sponsorPage),
);

// Activation safety.
check(
  'activation requires a typed confirmation',
  /CONFIRM_WORD/.test(src.placementActions) && /confirm/.test(src.placementPage),
);
check(
  'activation re-reads live capacity rather than trusting the form',
  /canActivateFeatured\(/.test(src.placementActions) &&
    /from\('locations'\)[\s\S]{0,200}is_featured/.test(src.placementActions),
);
check(
  'corridor activation re-checks capacity',
  /canActivateCorridorSponsor\(/.test(src.placementActions),
);
check(
  'restarting a stopped sponsor re-checks capacity',
  /setCorridorSponsorActiveAction[\s\S]*canActivateCorridorSponsor/.test(src.placementActions),
);
check(
  'deactivation needs no confirmation word (stopping is always safe)',
  /deactivateFeaturedAction[\s\S]{0,600}listing_id/.test(src.placementActions),
);
check(
  'a failed write reports refusal instead of half-applying',
  /The update failed\. Nothing was changed\./.test(src.placementActions),
);
check(
  'the audit note is best effort and cannot undo a decision',
  /audit note is best effort/i.test(src.placementActions),
);

// No payment, anywhere in the revenue path.
for (const [name, text] of Object.entries(src)) {
  check(
    `${name}: no payment integration`,
    !/stripe|paymentIntent|checkout\.session|card_number/i.test(text),
  );
}
// No migration was introduced.
check(
  'placement actions only touch existing tables',
  !/from\('(?!locations|directory_sponsors|sponsors|sponsor_touches)/.test(src.placementActions),
);

// Disclosure.
check('the sponsor block is labelled Sponsored', /Sponsored/.test(src.slot));
check('the sponsor block carries rel=sponsored', /SPONSOR_REL/.test(src.slot));
check('a featured card is labelled Sponsored', />\s*Sponsored\s*</.test(src.card));
check('the placements console states the disclosure', /Sponsored/.test(src.placementPage));
check(
  'the placements console states that no payment is taken',
  /takes no payment/i.test(src.placementPage),
);
check(
  'the placements console admits the capacity check is not a DB constraint',
  /not a database constraint/i.test(src.placementPage),
);
check(
  'the placements console admits a featured listing does not self-expire',
  /no end date in the database/i.test(src.placementPage),
);
check(
  'the placements console warns about the every-corridor wildcard',
  /EVERY CORRIDOR|every corridor page/i.test(src.placementPage),
);

// The legacy manager finally exposes the term columns it always had.
check('legacy sponsor create sets starts_at', /starts_at: startsAt/.test(src.legacySponsorActions));
check('legacy sponsor create sets ends_at', /ends_at: endsAt/.test(src.legacySponsorActions));
check(
  'legacy sponsor create refuses an inverted term',
  /Date\.parse\(endsAt\) <= Date\.parse\(startsAt\)/.test(src.legacySponsorActions),
);

console.log(`placements: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

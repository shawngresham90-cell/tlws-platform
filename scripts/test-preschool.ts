/**
 * CDL Pre-School Founding Student tests (Phase 13).
 * Run: npx esbuild scripts/test-preschool.ts --bundle --platform=node --format=cjs --alias:@=./src --outfile=/tmp/preschool.cjs && node /tmp/preschool.cjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHECKOUT_DISCLOSURE,
  FOUNDING_STUDENT_CAPACITY,
  FOUNDING_CLAIM_PATH,
  FOUNDING_WALL_PATH,
  PRESCHOOL_EVENTS,
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_LABEL,
  PRESCHOOL_PRICE_USD,
  PRESCHOOL_PURCHASE_REL,
  PRESCHOOL_PURCHASE_URL,
} from '@/lib/preschool/constants';
import {
  isSafePublicUrl,
  isSoldOut,
  publicDisplayName,
  publicLinkFields,
  sortWall,
  spotsFilled,
  spotsRemaining,
} from '@/lib/preschool/founding-students';
import { EMPTY_WALL } from '@/lib/preschool/data';
import { claimSchema } from '@/lib/preschool/schema';
import { preschoolCourseSchema } from '@/lib/preschool/preschool-schema';
import { capacityReached, nextSpotNumber } from '@/lib/admin/preschool';
import {
  CURRICULUM_GROUPS,
  FAQS,
  LESSON_COUNT,
  MODULE_COUNT,
  QUIZ_PASS_PERCENT,
  WHATS_INCLUDED,
} from '@/lib/preschool/content';
import { buildMetadata } from '@/lib/seo/metadata';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

// --- Offer constants: price, capacity, exact purchase URL, rel ---
check('price is 149', PRESCHOOL_PRICE_USD === 149);
check('price label is $149', PRESCHOOL_PRICE_LABEL === '$149');
check('capacity is 20', FOUNDING_STUDENT_CAPACITY === 20);
check(
  'purchase URL is exact',
  PRESCHOOL_PURCHASE_URL ===
    'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/cdl-preschool--founding-student',
);
for (const relPart of ['sponsored', 'noopener', 'noreferrer']) {
  check(`purchase rel contains ${relPart}`, PRESCHOOL_PURCHASE_REL.split(' ').includes(relPart));
}
check('checkout disclosure names Stan Store', CHECKOUT_DISCLOSURE.includes('Stan Store'));
check('checkout disclosure says no card collection', /never collect card/i.test(CHECKOUT_DISCLOSURE));

// --- Spots math: clamped, never negative, sold-out ---
check('0 approved → 0 filled', spotsFilled(0) === 0);
check('0 approved → 20 remaining', spotsRemaining(0) === 20);
check('5 approved → 15 remaining', spotsRemaining(5) === 15);
check('20 approved → 0 remaining', spotsRemaining(20) === 0);
check('25 approved → filled capped at 20', spotsFilled(25) === 20);
check('25 approved → remaining never below zero', spotsRemaining(25) === 0);
check('negative count → 0 filled', spotsFilled(-3) === 0);
check('NaN count → 0 filled', spotsFilled(Number.NaN) === 0);
check('sold out at 20', isSoldOut(20) === true);
check('not sold out at 19', isSoldOut(19) === false);
check('EMPTY_WALL zero state', EMPTY_WALL.filled === 0 && EMPTY_WALL.remaining === 20 && EMPTY_WALL.students.length === 0);

// --- Anonymous handling + link safety ---
const anon = { spotNumber: 1, displayName: 'Real Name', isAnonymous: true, businessName: 'Biz', websiteUrl: 'https://example.com' };
check('anonymous display name', publicDisplayName(anon) === 'Anonymous Founding Student');
const anonLinks = publicLinkFields(anon);
check('anonymous hides business', anonLinks.businessName === null);
check('anonymous hides website', anonLinks.websiteUrl === null);
const named = { spotNumber: 2, displayName: 'Big Mike R.', isAnonymous: false, businessName: 'Mike Trucking', websiteUrl: 'https://miketrucking.example' };
check('named display name', publicDisplayName(named) === 'Big Mike R.');
check('named business shown', publicLinkFields(named).businessName === 'Mike Trucking');
check('blank name falls back safely', publicDisplayName({ ...named, displayName: '  ' }) === 'Founding Student');
check('https url allowed', isSafePublicUrl('https://example.com'));
check('http url rejected', !isSafePublicUrl('http://example.com'));
check('javascript: url rejected', !isSafePublicUrl('javascript:alert(1)'));
check('empty url rejected', !isSafePublicUrl(''));
const sorted = sortWall([
  { spotNumber: null, displayName: 'Zed', isAnonymous: false },
  { spotNumber: 3, displayName: 'C', isAnonymous: false },
  { spotNumber: 1, displayName: 'A', isAnonymous: false },
]);
check('wall sorts numbered spots first, in order', sorted[0].spotNumber === 1 && sorted[1].spotNumber === 3 && sorted[2].spotNumber === null);

// --- Claim schema: validation, duplicates prevented upstream, no auto-publish ---
const validClaim = {
  purchaser_email: 'Buyer@Example.COM',
  display_name: 'Big Mike R.',
  is_anonymous: false,
  business_name: '',
  website_url: 'https://example.com',
  confirmed_checkout: true,
  consent_public_display: true,
  company_website: '',
};
const parsedClaim = claimSchema.safeParse(validClaim);
check('valid claim parses', parsedClaim.success);
if (parsedClaim.success) {
  check('email normalized to lowercase', parsedClaim.data.purchaser_email === 'buyer@example.com');
}
check('missing consent rejected', !claimSchema.safeParse({ ...validClaim, consent_public_display: false }).success);
check('unconfirmed checkout rejected', !claimSchema.safeParse({ ...validClaim, confirmed_checkout: false }).success);
check('bad email rejected', !claimSchema.safeParse({ ...validClaim, purchaser_email: 'not-an-email' }).success);
check('http website rejected', !claimSchema.safeParse({ ...validClaim, website_url: 'http://example.com' }).success);
check('short display name rejected', !claimSchema.safeParse({ ...validClaim, display_name: 'A' }).success);
check('empty optional website ok', claimSchema.safeParse({ ...validClaim, website_url: '' }).success);

// --- Admin capacity + spot assignment ---
check('capacityReached at 20', capacityReached(20));
check('capacity not reached at 19', !capacityReached(19));
check('first spot is 1', nextSpotNumber([]) === 1);
check('fills gaps first', nextSpotNumber([1, 3]) === 2);
check('sequential assignment', nextSpotNumber([1, 2]) === 3);
check('null spots ignored', nextSpotNumber([null, 1]) === 2);
check('all taken → null', nextSpotNumber(Array.from({ length: 20 }, (_, i) => i + 1)) === null);

// --- Schema.org: factual only ---
const course = preschoolCourseSchema() as Record<string, unknown>;
const offer = course.offers as Record<string, unknown>;
check('schema type is Course', course['@type'] === 'Course');
check('offer price 149.00', offer.price === '149.00');
check('offer currency USD', offer.priceCurrency === 'USD');
check('offer url is exact purchase URL', offer.url === PRESCHOOL_PURCHASE_URL);
const schemaJson = JSON.stringify(course);
check('no AggregateRating', !schemaJson.includes('AggregateRating'));
check('no Review schema', !/"review"/i.test(schemaJson));
check('no enrollment count', !/enroll/i.test(schemaJson));
check('availability is the real LimitedAvailability', offer.availability === 'https://schema.org/LimitedAvailability');

// --- Metadata + canonical ---
const meta = buildMetadata({ title: 'x', description: 'y', path: PRESCHOOL_PATH });
check('canonical ends with /cdl-pre-school', String(meta.alternates?.canonical ?? '').endsWith('/cdl-pre-school'));

// --- Analytics events: exact names, no personal data possible in constants ---
check('pageView event name', PRESCHOOL_EVENTS.pageView === 'preschool_page_view');
check('purchase CTA event name', PRESCHOOL_EVENTS.purchaseCtaClick === 'preschool_purchase_cta_click');
check('curriculum event name', PRESCHOOL_EVENTS.curriculumExpand === 'preschool_curriculum_expand');
check('claim started event name', PRESCHOOL_EVENTS.claimStarted === 'founding_student_claim_started');
check('claim submitted event name', PRESCHOOL_EVENTS.claimSubmitted === 'founding_student_claim_submitted');
const claimFormSrc = src('src/components/preschool/ClaimForm.tsx');
check('claim events carry no props (no personal data)', /trackEvent\(PRESCHOOL_EVENTS\.claimStarted\)/.test(claimFormSrc) && /trackEvent\(PRESCHOOL_EVENTS\.claimSubmitted\)/.test(claimFormSrc));

// --- FAQ coverage (owner-required questions) ---
for (const must of [
  'Is this CDL school?',
  'Does this replace ELDT?',
  'How do I access the course?',
  'How is my name added to the Founding Student Wall?',
  'Can I remain anonymous?',
  'What happens after the first 20 spots sell?',
  'Does buying guarantee Academy admission?',
]) {
  check(`FAQ present: ${must}`, FAQS.some((f) => f.question === must));
}

// --- Verified curriculum (source: cdl-preschool repo @ f6a004c + portal course tables) ---
check('module count is 7', MODULE_COUNT === 7);
check('lesson count is 33', LESSON_COUNT === 33);
check('quiz pass percent is 80', QUIZ_PASS_PERCENT === 80);
const allModules = CURRICULUM_GROUPS.flatMap((g) => [...g.modules]);
check('groups contain all 7 modules', allModules.length === MODULE_COUNT);
check('module lesson counts sum to 33', allModules.reduce((n, m) => n + m.lessons, 0) === LESSON_COUNT);
check('module numbers are 1..7 in order', allModules.map((m) => m.number).join(',') === '1,2,3,4,5,6,7');
for (const title of [
  'Before You Ever Touch a Truck',
  'Choosing the Right CDL School (Not a Mill)',
  'Crushing the Permit Tests',
  'The Pre-Trip That Passes Every Time',
  'Backing, Turning & Truck Control',
  'On the Road Without the Panic',
  'Land the Job & Keep It',
]) {
  check(`verified module title: ${title}`, allModules.some((m) => m.title === title));
}
check('curriculum has 4 groups', CURRICULUM_GROUPS.length === 4);
for (const heading of ['Get ready before day one', 'Pass the permit', 'Master the skills', 'Start the career']) {
  check(`curriculum group heading: ${heading}`, CURRICULUM_GROUPS.some((g) => g.heading === heading));
}
check('whats-included mentions workbooks', WHATS_INCLUDED.some((b) => /workbook/i.test(b)));
check('whats-included states the real quiz gate', WHATS_INCLUDED.some((b) => b.includes('80%')));

// --- Verified access wording; no unsupported claims; no private URLs ---
const contentSrc = src('src/lib/preschool/content.ts');
const accessFaq = FAQS.find((f) => f.question === 'How do I access the course?');
check('access FAQ says enrollment is personal, not automated', /personally enrolls|issued by hand/.test(accessFaq?.answer ?? ''));
check('access FAQ mentions welcome email login', /welcome email/.test(accessFaq?.answer ?? ''));
const publicCopy = JSON.stringify(FAQS) + JSON.stringify(WHATS_INCLUDED) + JSON.stringify(CURRICULUM_GROUPS);
check('no instant-access claim', !/instant access|immediate access/i.test(publicCopy));
check('no lifetime-access claim', !/lifetime/i.test(publicCopy));
check('no refund FAQ / no invented refund policy', !FAQS.some((f) => /refund/i.test(f.question + f.answer)));
check('sales page makes no refund claim', !/refund/i.test(salesSrcFull()));
check('no success/employment guarantee wording', !/guarantee[ds]? (a |your )?(cdl|job|employment|pass)/i.test(publicCopy));
check('content exposes no portal URL', !/netlify\.app/i.test(contentSrc));
check('content exposes no temp-password format', !contentSrc.includes('TLA-'));
check('sales page exposes no portal URL', !/netlify\.app/i.test(salesSrcFull()));
function salesSrcFull() {
  return src('src/app/(marketing)/cdl-pre-school/page.tsx');
}

// --- Source-level wiring: pages, nav, sitemap, privacy ---
const salesSrc = src('src/app/(marketing)/cdl-pre-school/page.tsx');
check('sales page uses PurchaseCta', salesSrc.includes('PurchaseCta'));
check('sales page shows checkout disclosure', salesSrc.includes('CHECKOUT_DISCLOSURE'));
check('sales page uses price constant, not a stray price', !/\$1[0-9]9/.test(salesSrc.replace(/PRESCHOOL_PRICE_LABEL/g, '')));
const ctaSrc = src('src/components/preschool/PurchaseCta.tsx');
check('PurchaseCta uses exact URL constant', ctaSrc.includes('PRESCHOOL_PURCHASE_URL'));
check('PurchaseCta uses sponsored rel constant', ctaSrc.includes('PRESCHOOL_PURCHASE_REL'));
check('PurchaseCta opens new tab', ctaSrc.includes('target="_blank"'));
const wallSrc = src('src/app/(marketing)/cdl-pre-school/founding-students/page.tsx');
check('wall empty state copy present', wallSrc.includes('Founding Student spots are now available'));
check('wall never fabricates founders', wallSrc.includes('No placeholders, no fabricated spots'));
const readerSrc = src('src/lib/preschool/data.ts');
check('wall reader never selects purchaser email', !readerSrc.includes('purchaser_email'));
check('wall reader selects published rows only', readerSrc.includes("eq('is_published', true)"));
const routeSrc = src('src/app/api/preschool/claim/route.ts');
check('claim route inserts pending only', routeSrc.includes("status: 'pending'"));
check('claim route cannot publish', !routeSrc.includes('preschool_founding_students'));
check('claim route guards duplicates', routeSrc.includes('duplicate_claim'));
const actionsSrc = src('src/app/admin/(dashboard)/cdl-preschool/founding-students/actions.ts');
const actionCount = (actionsSrc.match(/export async function/g) ?? []).length;
const gateCount = (actionsSrc.match(/requireAdmin\(\);/g) ?? []).length;
check('every admin action gated by requireAdmin', actionCount > 0 && gateCount === actionCount, `${gateCount}/${actionCount}`);
check('admin enforces 20-cap', actionsSrc.includes('capacityReached'));
const homeSrc = src('src/app/page.tsx');
check('homepage renders FourPaths', homeSrc.includes('<FourPaths />'));
const fourSrc = src('src/components/sections/FourPaths.tsx');
check('homepage card links to sales page', fourSrc.includes('PRESCHOOL_PATH'));
check('homepage card primary CTA label', fourSrc.includes('Start CDL Pre-School'));
check('homepage card capacity from constant', fourSrc.includes('FOUNDING_STUDENT_CAPACITY'));
check('no fake urgency on homepage card', !/timer|countdown|only today|recently purchased/i.test(fourSrc));
const headerSrc = src('src/components/layout/Header.tsx');
check('header links pre-school', headerSrc.includes("href: '/cdl-pre-school'"));
const footerSrc = src('src/components/layout/Footer.tsx');
check('footer links pre-school', footerSrc.includes("href: '/cdl-pre-school'"));
const sitemapSrc = src('src/app/sitemap.ts');
for (const p of [PRESCHOOL_PATH, FOUNDING_WALL_PATH, FOUNDING_CLAIM_PATH]) {
  check(`sitemap includes ${p}`, sitemapSrc.includes(p));
}
const migrationSrc = src('supabase/migrations/028_cdl_preschool.sql');
check('migration locks claims table (RLS, no anon)', migrationSrc.includes('enable row level security') && migrationSrc.includes('revoke all on public.preschool_founding_claims'));
check('migration caps spots 1..20', migrationSrc.includes('between 1 and 20'));
check('migration has capacity trigger', migrationSrc.includes('preschool_enforce_capacity'));
check('migration blocks duplicate pending emails', migrationSrc.includes('preschool_claims_pending_email_uidx'));

// --- Conversion optimization (post-launch milestone) ---
check('scroll event name', PRESCHOOL_EVENTS.scrollDepth === 'preschool_scroll_depth');
check('faq event name', PRESCHOOL_EVENTS.faqOpen === 'preschool_faq_open');
check('nav event name', PRESCHOOL_EVENTS.navClick === 'preschool_nav_click');

const salesSrc2 = salesSrcFull();
for (const comp of ['StickyCta', 'ScrollDepth', 'TrustBadges', 'SpotsMeter', 'FaqItem', 'TrackedNavLink']) {
  check(`sales page renders ${comp}`, salesSrc2.includes(`<${comp}`));
}
for (const placement of ['"hero"', '"after-curriculum"', '"offer"', '"final"']) {
  check(`purchase CTA placement ${placement}`, salesSrc2.includes(`placement=${placement}`));
}
check('sales page reserves sticky-bar space', salesSrc2.includes('h-24 sm:hidden'));

const stickySrc = src('src/components/preschool/StickyCta.tsx');
check('sticky uses exact URL constant', stickySrc.includes('PRESCHOOL_PURCHASE_URL'));
check('sticky uses sponsored rel constant', stickySrc.includes('PRESCHOOL_PURCHASE_REL'));
check('sticky is mobile-only', stickySrc.includes('sm:hidden'));
check('sticky label', stickySrc.includes('Start CDL Pre-School'));
check('sticky tracks placement only', stickySrc.includes("placement: 'sticky-mobile'"));

const meterSrc = src('src/components/preschool/SpotsMeter.tsx');
check('meter uses capacity constant', meterSrc.includes('FOUNDING_STUDENT_CAPACITY'));
check('meter is pure (no data fetching)', !meterSrc.includes('supabase') && !meterSrc.includes("from '@/lib/preschool/data'"));
check('meter has ARIA meter role', meterSrc.includes('role="meter"'));
check('meter zero-state is honest', meterSrc.includes('spots are open'));

const trustSrc = src('src/components/preschool/TrustBadges.tsx');
check('trust badges mention Stan Store', trustSrc.includes('Stan Store'));
check('trust badges mention CDL instructor', trustSrc.includes('CDL instructor'));
check('trust badges mobile friendly', trustSrc.includes('Mobile friendly'));
check('trust badges make no guarantees', !/guarantee/i.test(trustSrc));

const fourSrc2 = src('src/components/sections/FourPaths.tsx');
check('four paths uses real wall data', fourSrc2.includes('getFoundingWall'));
check('four paths renders SpotsMeter', fourSrc2.includes('SpotsMeter'));
check('four paths has no hardcoded filled count', !/filled=\{\d/.test(fourSrc2));
check('four paths still no fake urgency', !/countdown|only today|recently purchased/i.test(fourSrc2));

const heroSrc = src('src/components/sections/Hero.tsx');
check('hero leads with Pre-School CTA', heroSrc.indexOf('/cdl-pre-school') < heroSrc.indexOf('/academy'));
check('hero Pre-School CTA shows price', heroSrc.includes('Start CDL Pre-School — $149'));

const ogSrc = src('src/app/(marketing)/cdl-pre-school/opengraph-image.tsx');
check('og image exists and uses price constant', ogSrc.includes('PRESCHOOL_PRICE_LABEL'));
check('og image uses capacity constant', ogSrc.includes('FOUNDING_STUDENT_CAPACITY'));
check('og image is 1200x630', ogSrc.includes('1200') && ogSrc.includes('630'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

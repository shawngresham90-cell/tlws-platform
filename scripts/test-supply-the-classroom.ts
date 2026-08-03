/**
 * Supply the Classroom campaign tests.
 *
 * Countdown behaviour is tested for REAL against the exported pure functions —
 * before, at, and after the opening instant, plus the DST trap in the date
 * literal — because that logic is where a live clock actually goes wrong.
 * Route wiring, link safety and copy claims are source-level: the failure
 * modes there are "someone edited the file", which is exactly what a source
 * assertion catches.
 *
 * The claim-safety checks are release-blocking. The reference copy promised
 * Founder Wall placement and launch-film recognition for classroom
 * supporters; neither is supported by this repository (founder records are
 * created by a manual admin action against fixed PAID tiers, and "launch
 * film" exists nowhere). These tests fail if that promise reappears.
 *
 * Run:
 *   npx esbuild scripts/test-supply-the-classroom.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-supply-the-classroom.cjs \
 *   && node /tmp/test-supply-the-classroom.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AMAZON_WISHLIST_URL,
  CAMPAIGN_CITY,
  CAMPAIGN_OPENS_AT_MS,
  CAMPAIGN_OPENS_ISO,
  CAMPAIGN_OPENS_LABEL,
  CAMPAIGN_DESTINATION,
  CAMPAIGN_LOAD_NUMBER,
  CAMPAIGN_OPENS_STAMP,
  CAMPAIGN_PATH,
  CASH_APP_URL,
  MANIFEST_ROWS,
  SUPPLY_TIERS,
  countdownParts,
  pad2,
  tickIntervalMs,
} from '@/lib/classroom/campaign';
import { CLASSROOM_EVENTS } from '@/lib/classroom/analytics';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const page = read('src/app/(marketing)/supply-the-classroom/page.tsx');
const ctas = read('src/components/classroom/ClassroomCtas.tsx');
const countdown = read('src/components/classroom/ClassroomCountdown.tsx');
const homeBand = read('src/components/sections/SupplyClassroom.tsx');
const home = read('src/app/page.tsx');
const sitemap = read('src/app/sitemap.ts');
/**
 * Claim and copy checks must run against what a VISITOR sees, not against the
 * source. Doc comments in these files deliberately discuss the removed
 * Founder Wall / launch-film promise in order to explain why it is gone —
 * asserting on raw source would flag that explanation as the offence itself.
 * So: strip comments, then collapse whitespace, because JSX wraps prose across
 * lines and a reader never sees the break.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const visibleText = (s: string) => stripComments(s).replace(/\s+/g, ' ');

const rendered = [page, ctas, countdown, homeBand].map(visibleText).join('\n');
const pageText = visibleText(page);
const homeBandText = visibleText(homeBand);
const countdownCode = stripComments(countdown);
const ctasCode = stripComments(ctas);

/* --------------------------------------------------------- exact URLs */

check(
  'Amazon wishlist URL is exactly the approved list',
  AMAZON_WISHLIST_URL === 'https://www.amazon.com/hz/wishlist/ls/1VNA3OIBPOYEB',
  AMAZON_WISHLIST_URL,
);
check(
  'Cash App URL is exactly the approved handle',
  CASH_APP_URL === 'https://cash.app/$ShawnDavidGresham',
  CASH_APP_URL,
);
check('campaign route is /supply-the-classroom', CAMPAIGN_PATH === '/supply-the-classroom');
check(
  'no campaign URL is hardcoded at a call site',
  !/amazon\.com|cash\.app/i.test(page) &&
    !/amazon\.com|cash\.app/i.test(homeBand) &&
    (ctas.match(/https:\/\//g) ?? []).length === 0,
);

/* ------------------------------------------------- opening date + DST */

// October 18 2026 08:00 America/New_York. US DST 2026 runs Mar 8 → Nov 1, so
// this date is EDT (UTC−4) and the instant is 12:00Z. A literal written with
// the wrong offset (e.g. -05:00 standard time) fails here.
check('opening literal carries an explicit offset', /[+-]\d{2}:\d{2}$/.test(CAMPAIGN_OPENS_ISO));
check(
  'opening instant is 2026-10-18T12:00:00Z (08:00 EDT)',
  CAMPAIGN_OPENS_AT_MS === Date.UTC(2026, 9, 18, 12, 0, 0),
  new Date(CAMPAIGN_OPENS_AT_MS).toISOString(),
);
check(
  'opening instant renders as 8 AM in America/New_York',
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: true,
  }).format(new Date(CAMPAIGN_OPENS_AT_MS)) === '8 AM',
);
check('opening label matches the date', CAMPAIGN_OPENS_LABEL === 'October 18, 2026');

/* ------------------------------------------------- countdown behaviour */

const T = CAMPAIGN_OPENS_AT_MS;
const before = countdownParts(T - (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000, T);
check(
  'countdown decomposes remaining time correctly',
  before.days === 2 &&
    before.hours === 3 &&
    before.minutes === 4 &&
    before.seconds === 5 &&
    !before.complete,
  before,
);
check('countdown is not complete one second early', countdownParts(T - 1000, T).complete === false);
check('countdown completes exactly at the opening instant', countdownParts(T, T).complete === true);
check(
  'countdown stays complete after the date',
  countdownParts(T + 86_400_000, T).complete === true,
);
check(
  'completed countdown zeroes every segment (never negative)',
  (() => {
    const c = countdownParts(T + 999_999_999, T);
    return c.days === 0 && c.hours === 0 && c.minutes === 0 && c.seconds === 0;
  })(),
);
check('countdown survives a nonsense clock', countdownParts(Number.NaN, T).complete === true);
check(
  'sub-minute remainder does not round up into a false minute',
  (() => {
    const c = countdownParts(T - 59_000, T);
    return c.days === 0 && c.hours === 0 && c.minutes === 0 && c.seconds === 59;
  })(),
);
check('pad2 pads single digits', pad2(7) === '07' && pad2(42) === '42' && pad2(-3) === '00');

/* --------------------------------------------------- reduced motion */

check(
  'reduced motion slows the tick to once a minute',
  tickIntervalMs(true) === 60_000 && tickIntervalMs(false) === 1_000,
);
check(
  'countdown reads the reduced-motion preference',
  /prefers-reduced-motion: reduce/.test(countdown) && /tickIntervalMs\(/.test(countdown),
);
check('countdown clears its interval on unmount', /clearInterval/.test(countdown));
check(
  'countdown removes its media-query listener on unmount',
  /removeEventListener\('change'/.test(countdown),
);

/* ------------------------------------------------------ hydration safety */

check(
  'countdown renders no clock on the server or first paint',
  /useState<CountdownParts \| null>\(null\)/.test(countdown) && /parts === null/.test(countdown),
);
check(
  'the SSR fallback states the date instead of a stale number',
  /Doors open \{CAMPAIGN_OPENS_LABEL\}/.test(countdown),
);
check(
  'countdown has a completed state',
  /complete/.test(countdown) && /doors are open/i.test(countdown),
);
check(
  'the clock is read exactly once, inside the effect',
  (countdownCode.match(/Date\.now\(\)/g) ?? []).length === 1 &&
    /const update = \(\) =>/.test(countdownCode),
);

/* -------------------------------------------------- external link safety */

const anchorBlocks = ctas.match(/<a[\s\S]*?>/g) ?? [];
check('both CTAs are anchors', anchorBlocks.length === 2, anchorBlocks.length);
check(
  'every external anchor opens in a new tab',
  anchorBlocks.every((a) => a.includes('target="_blank"')),
);
check(
  'every external anchor is rel="noopener noreferrer"',
  anchorBlocks.every((a) => a.includes('rel="noopener noreferrer"')),
);
check(
  'every external anchor has a descriptive accessible name saying it opens a new tab',
  anchorBlocks.every((a) => /aria-label="[^"]*opens in a new tab\)"/.test(a)),
);
check(
  'external anchors keep a visible keyboard focus ring',
  /focus-visible:ring-4/.test(ctas) && /focus-visible:ring-4/.test(homeBand),
);
check(
  'CTA targets meet the 48px minimum',
  /min-h-\[48px\]/.test(ctas) && /min-h-\[48px\]/.test(homeBand),
);
check(
  'CTA hover/press motion is reduced-motion-safe',
  /motion-safe:hover:scale/.test(ctas) &&
    !/[^-]hover:scale/.test(ctas.replace(/motion-safe:hover:scale/g, '')),
);

/* ------------------------------------------------------------- homepage */

check('homepage renders the campaign band', /<SupplyClassroom \/>/.test(home));
check(
  'homepage band imports from the sections module',
  /import \{ SupplyClassroom \} from '@\/components\/sections\/SupplyClassroom'/.test(home),
);
check(
  'homepage CTA links INTERNALLY to the campaign page, never straight to Amazon',
  /href=\{CAMPAIGN_PATH\}/.test(homeBand) &&
    !/amazon\.com/i.test(homeBand) &&
    !/href="https?:/i.test(homeBand),
);
check('homepage band uses the required wording', /Supply the Classroom/i.test(homeBand));
check(
  'homepage band carries the supporting concept and opening date',
  /Help equip Trucking Life Academy/.test(homeBandText) &&
    /\{CAMPAIGN_OPENS_LABEL\}/.test(homeBandText),
);
check(
  'homepage band uses the required primary action label',
  /View the Amazon List/.test(homeBand),
);
check(
  'campaign band is additive — core homepage sections all still render',
  ['<Hero />', '<ProofBar />', '<FourPaths />', '<Academy />', '<Newsletter />', '<Store />'].every(
    (tag) => home.includes(tag),
  ),
);
check(
  'campaign band sits high on the page (above the four core paths)',
  home.indexOf('<SupplyClassroom />') > home.indexOf('<ProofBar />') &&
    home.indexOf('<SupplyClassroom />') < home.indexOf('<FourPaths />'),
);

/* --------------------------------------------------------- route + SEO */

check(
  'route file exists at the required path',
  fs.existsSync(path.join(process.cwd(), 'src/app/(marketing)/supply-the-classroom/page.tsx')),
);
check(
  'route exports metadata through buildMetadata',
  /export const metadata = buildMetadata\(/.test(page),
);
check(
  'metadata title is the approved title',
  /title: 'Supply the Classroom \| Trucking Life Academy'/.test(page),
);
check(
  'metadata description names the city and the opening date',
  /description: `Help equip the Trucking Life Academy classroom in \$\{CAMPAIGN_CITY\} before doors open \$\{CAMPAIGN_OPENS_LABEL\}\.`/.test(
    page,
  ),
);
check('metadata sets the canonical path', /path: CAMPAIGN_PATH/.test(page));
check('route is registered in the sitemap', /'\/supply-the-classroom'/.test(sitemap));
check('route emits breadcrumb structured data', /breadcrumbSchema\(/.test(page));

/* ------------------------------------------------------------ analytics */

check(
  'analytics event names are stable and namespaced',
  CLASSROOM_EVENTS.homeCtaClick === 'classroom_home_cta_click' &&
    CLASSROOM_EVENTS.amazonClick === 'classroom_amazon_click' &&
    CLASSROOM_EVENTS.cashAppClick === 'classroom_cashapp_click',
);
check('homepage CTA fires its event', /trackEvent\(CLASSROOM_EVENTS\.homeCtaClick/.test(homeBand));
check('Amazon CTA fires its event', /trackEvent\(CLASSROOM_EVENTS\.amazonClick/.test(ctas));
check('Cash App CTA fires its event', /trackEvent\(CLASSROOM_EVENTS\.cashAppClick/.test(ctas));
check(
  'analytics goes through the shared dispatcher only (no second library)',
  /from '@\/lib\/analytics'/.test(ctasCode) &&
    /from '@\/lib\/analytics'/.test(stripComments(homeBand)) &&
    !/\bgtag\(|googletagmanager|analytics\.js|mixpanel|posthog|@segment\//i.test(rendered),
);
check(
  'analytics payloads carry only a placement string — no personal data',
  (rendered.match(/trackEvent\([^)]*\)/g) ?? []).every(
    (call) => !/email|name|phone|address|user|id:/i.test(call),
  ),
);

/* ----------------------------------------------------- claim safety */

check(
  'the unsupported Founder Wall promise is absent',
  !/name goes on the wall/i.test(rendered) && !/every founder gets called out/i.test(rendered),
);
check('no launch-film recognition is promised', !/launch film|launch-film/i.test(rendered));
check(
  'the claim-safety decision is documented in the source for the next editor',
  /launch film/i.test(page) && /CLAIM SAFETY/.test(page),
);
check(
  'the campaign never claims to create Founder Wall records',
  !/founder wall/i.test(rendered) && !/founders wall/i.test(rendered),
);
check(
  'no individual recognition is promised in exchange for supplies',
  !/your name/i.test(rendered) && !/called out by name/i.test(rendered),
);
// What replaced it must still be there: an honest statement of effect.
check(
  'the honest replacement statement is present',
  /becomes part of the room drivers train in/.test(pageText),
);

/* ---------------------------------------------------- privacy / address */

check(
  'only the city is named — no street address, ZIP or unit number',
  /Dalton, Georgia/.test(CAMPAIGN_CITY) &&
    !/\b\d{1,6}\s+[A-Z][a-z]+\s+(St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ln|Lane|Blvd|Hwy|Highway|Way|Ct|Court|Pkwy)\b/.test(
      rendered,
    ) &&
    !/\b\d{5}(-\d{4})?\b/.test(rendered.replace(/\d{4}-\d{2}-\d{2}/g, '')) &&
    !/\b(Suite|Ste\.|Apt\.?|Unit)\s*[#\w]/i.test(rendered),
);
check(
  'ship-to uses the conservative unverified-config wording',
  /Amazon handles delivery through the wishlist checkout\./.test(pageText) &&
    /The private street address is not displayed on this page\./.test(pageText),
);
check(
  'ship-to never asserts the private Amazon address setting as verified',
  !/auto-?fill/i.test(pageText) && !/keeps the street line private/i.test(pageText),
);

/* ------------------------------------------------------- campaign concept */

/* ---- approved manifest design: the bill-of-lading strip, field by field */
const EXPECTED_MANIFEST: Array<[string, string]> = [
  ['Load', 'TLA-001'],
  ['Origin', 'Anywhere'],
  ['Destination', 'Dalton, GA'],
  ['Deliver by', '10.18.2026'],
  ['Status', 'Loading'],
];
check('manifest strip has exactly five fields', MANIFEST_ROWS.length === 5, MANIFEST_ROWS.length);
for (const [field, value] of EXPECTED_MANIFEST) {
  check(
    `manifest strip: ${field} = ${value}`,
    MANIFEST_ROWS.some((r) => r.field === field && r.value === value),
    MANIFEST_ROWS.find((r) => r.field === field),
  );
}
check('manifest strip renders from the shared source', /MANIFEST_ROWS\.map/.test(page));
check('load number constant matches the manifest', CAMPAIGN_LOAD_NUMBER === 'TLA-001');
check('destination constant matches the manifest', CAMPAIGN_DESTINATION === 'Dalton, GA');
check('deliver-by stamp matches the opening date', CAMPAIGN_OPENS_STAMP === '10.18.2026');

/* ---- approved hero */
check(
  'hero eyebrow is the approved Classroom Manifest line',
  /Classroom Manifest · Trucking Life Academy/.test(pageText),
);
check(
  'hero headline is "The Room Is Empty." with the period',
  /The Room Is Empty\./.test(pageText),
);

/* ---- approved section order */
const SECTION_ORDER = [
  'Why this list exists',
  'What&rsquo;s on the load',
  'Pick your weight class',
  'Two ways in',
  'Ship to',
  'Built by drivers.',
];
let lastIdx = -1;
let ordered = true;
for (const heading of SECTION_ORDER) {
  const idx = page.indexOf(heading);
  if (idx === -1 || idx < lastIdx) ordered = false;
  else lastIdx = idx;
  check(`section present: ${heading.replace('&rsquo;', String.fromCharCode(39))}`, idx > -1);
}
check('sections appear in the approved order', ordered);
check(
  'closing block carries the Trucking Life Academy identity',
  /Trucking Life Academy<\/p>/.test(page) || /Trucking Life Academy/.test(pageText),
);

/* ---- approved styling: dark ground, yellow primary, orange secondary */
check('page uses the dark asphalt ground', /bg-asphalt/.test(page));
check('yellow (signal) is the primary accent', /text-signal|border-signal/.test(page));
check('orange (flare) is the secondary accent', /text-flare-300/.test(page));
check('manifest rows are bordered', (page.match(/border-2 border-ink\/15/g) ?? []).length >= 4);
check('display type is condensed uppercase', /font-display/.test(page) && /uppercase/.test(page));
check('the orange accent is a real theme token', /flare:/.test(read('tailwind.config.ts')));
check('exactly four supply tiers are defined', SUPPLY_TIERS.length === 4, SUPPLY_TIERS.length);
check(
  'every tier has a range, a title and a blurb',
  SUPPLY_TIERS.every((t) => t.id && t.range && t.title && t.blurb),
);
check('tier ids are unique', new Set(SUPPLY_TIERS.map((t) => t.id)).size === SUPPLY_TIERS.length);
check('page renders the tiers from the shared source', /SUPPLY_TIERS\.map/.test(page));
check(
  'the load section avoids promising a specific item at a specific price',
  /Exact items, quantities and prices live on the Amazon list/.test(pageText),
);

/* ------------------------------------------------------- accessibility */

check('page has exactly one h1', (page.match(/<h1/g) ?? []).length === 1);
check(
  'section headings are h2 and subheadings h3 (no skipped levels)',
  (page.match(/<h2/g) ?? []).length >= 4 && !/<h4|<h5|<h6/.test(page),
);
check(
  'the ticking clock is hidden from screen readers behind one spoken sentence',
  /aria-hidden="true"/.test(countdown) &&
    /sr-only/.test(countdown) &&
    /role="status"/.test(countdown),
);
check(
  'no external font is introduced',
  !/fonts\.googleapis|fonts\.gstatic|@import url/i.test(rendered),
);
check('no raw HTML is injected', !/dangerouslySetInnerHTML/.test(rendered));

console.log(`supply-the-classroom: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

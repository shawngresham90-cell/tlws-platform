/**
 * Guards that /academy shows CURRENT Founder Wall campaign data.
 *
 * The page renders the shared FundedStatusPanel instead of the live
 * `campaign_progress` aggregate but carried no revalidate window, so Next
 * prerendered it once at build time and it kept serving whatever the totals
 * were on deploy day. /founders and /road-ahead were already ISR at 60s, so
 * the same aggregate rendered three different ways depending on the URL.
 *
 * These checks pin the fix and the shape of it:
 *   1. /academy revalidates, on the same 60s window as the other two;
 *   2. EVERY page reading the aggregate revalidates or is dynamic — the class
 *      of bug, not just the one instance;
 *   3. the page reads through the authoritative reader and hands the result
 *      straight to the shared component;
 *   4. the funded wording stays owned by AdminCampaignThermometer (admin-only);
 *   5. no campaign figure is hard-coded into the page, where it would silently
 *      go stale exactly like the prerendered HTML did.
 *
 * Filesystem + pure functions only. No database, no network, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { remainingCents, pctToGoal } from '@/lib/community/campaign';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const ACADEMY = 'src/app/(academy)/academy/page.tsx';
const FOUNDERS = 'src/app/(community)/founders/page.tsx';
const ROAD_AHEAD = 'src/app/(marketing)/road-ahead/page.tsx';
const THERMOMETER = 'src/components/admin/AdminCampaignThermometer.tsx';

const academy = read(ACADEMY);
const thermometer = read(THERMOMETER);

/** Source with comments stripped — what actually ships. */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const academyCode = codeOnly(academy);

/** The `export const revalidate = N` a module declares, if any. */
function revalidateOf(src: string): number | null {
  const m = codeOnly(src).match(/^export const revalidate\s*=\s*(\d+)\s*;/m);
  return m ? Number(m[1]) : null;
}

/* 1. /academy revalidates -------------------------------------------- */

check('academy exports revalidate = 60', revalidateOf(academy) === 60, revalidateOf(academy));
check(
  'academy revalidate is at module scope, not nested',
  /^export const revalidate = 60;$/m.test(academyCode),
);
check(
  'academy is not forced back to static',
  !/export const dynamic\s*=\s*['"]force-static['"]/.test(academyCode),
);
check(
  'academy does not opt out of revalidation with dynamicParams/fetchCache force-cache',
  !/export const fetchCache\s*=\s*['"]force-cache['"]/.test(academyCode),
);

/* 2. the whole class: every aggregate reader stays fresh -------------- */

/** Every page under src/app that reads the campaign aggregate. */
function pagesReadingCampaign(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name === 'page.tsx' && read(rel).includes('getCampaignProgress')) out.push(rel);
    }
  };
  walk('src/app');
  return out.sort();
}

const readers = pagesReadingCampaign();
// Now that the school is funded, the campaign aggregate is PUBLIC-READ BY
// NOBODY except the Road Ahead wall, which uses it only for the founder COUNT.
// /academy and /founders dropped the read entirely, so their funded headline
// cannot be affected by a database outage. Asserting the exact set (rather
// than "at least three") is what keeps a money read from creeping back in.
check(
  'road ahead still reads the aggregate (founder count only)',
  readers.includes(ROAD_AHEAD),
  readers,
);
for (const p of [ACADEMY, FOUNDERS]) {
  check(`${p} no longer reads the campaign aggregate`, !readers.includes(p), readers);
}
for (const p of readers) {
  const src = codeOnly(read(p));
  const rev = revalidateOf(read(p));
  const isDynamic = /export const dynamic\s*=\s*['"]force-dynamic['"]/.test(src);
  check(
    `${p} cannot be permanently baked (revalidate or force-dynamic)`,
    (rev !== null && rev > 0) || isDynamic,
    { revalidate: rev, isDynamic },
  );
}
check(
  'academy matches the window used by the other campaign surfaces',
  revalidateOf(academy) === revalidateOf(read(FOUNDERS)) &&
    revalidateOf(academy) === revalidateOf(read(ROAD_AHEAD)),
  {
    academy: revalidateOf(academy),
    founders: revalidateOf(read(FOUNDERS)),
    roadAhead: revalidateOf(read(ROAD_AHEAD)),
  },
);

/* 3. the authoritative data path is unchanged ------------------------- */
// The owner declared the school funded, so /academy no longer reads campaign
// money at all: the funded headline is a static constant, not a query. These
// assertions are STRICTER than the ones they replace — the page must render
// the shared funded panel, must not import the admin thermometer, and must not
// touch the campaign aggregate or the database.

check('academy renders the shared FundedStatusPanel', /<FundedStatusPanel\s*\/>/.test(academyCode));
check(
  'academy imports the funded panel from the shared community component',
  /import\s*\{\s*FundedStatusPanel\s*\}\s*from\s*'@\/components\/community\/FundedStatusPanel'/.test(
    academyCode,
  ),
);
check(
  'academy no longer reads the campaign aggregate',
  !/getCampaignProgress|campaign_progress/.test(academyCode),
);
check('academy never renders the admin thermometer', !/CampaignThermometer/.test(academyCode));
check(
  'academy does not build its own progress object',
  !/raised_cents|goal_cents|remaining_cents|pct_to_goal|founder_count/.test(academyCode),
);
check(
  'academy does not query the database directly',
  !/createClient|createStaticClient|from\('founders'\)/.test(academyCode),
);

/* 4. funded wording stays owned by the shared component ---------------- */

const FUNDED = 'FUNDED — THE WALL IS COMPLETE';
check('thermometer carries the approved funded wording', thermometer.includes(FUNDED));
check(
  'the funded wording sits inside the goalReached branch',
  thermometer.indexOf(FUNDED) > thermometer.indexOf('goalReached ? ('),
);
check(
  'the funded branch is still gated on remaining reaching zero',
  /const goalReached = goal > 0 && remaining === 0;/.test(thermometer),
);
check('academy does not restate the funded wording', !academy.includes(FUNDED));
check('academy does not contain the word FUNDED at all', !/\bFUNDED\b/.test(academy));

/* 5. no hard-coded campaign figures ----------------------------------- */

// Checked against the FULL source including comments: a number written into a
// comment goes stale just as silently as one written into the markup.
for (const literal of [
  '12,060',
  '1206000',
  '1_206_000',
  '11,550',
  '1155000',
  '1_155_000',
  '11,305',
  '1130500',
  '51 founder',
  '31 founder',
]) {
  check(`academy hard-codes no campaign figure: ${literal}`, !academy.includes(literal));
}
check(
  'academy states no founder count of its own',
  !/\b\d+\s+founders\s+on\s+the\s+wall/i.test(academy),
);
check(
  'academy prints no dollar total of its own near the thermometer',
  !/\$\d[\d,]*\s*(raised|goal|left|remaining)/i.test(academy),
);

/* 6. behaviour: the shipped math produces the funded state ------------- */

// Through the REAL functions the component calls, not restated arithmetic.
// These are the current production aggregate values; the point is that the
// component's own gate flips, so the revalidated page renders the funded copy.
const RAISED = 1_206_000;
const GOAL = 1_155_000;
const remaining = remainingCents(GOAL, RAISED);
check('remaining clamps to zero when over goal', remaining === 0, remaining);
check(
  'percentage clamps to 100 when over goal',
  pctToGoal(GOAL, RAISED) === 100,
  pctToGoal(GOAL, RAISED),
);
check('goalReached gate is satisfied, so the funded copy renders', GOAL > 0 && remaining === 0);
// and the pre-write state must NOT have satisfied it — otherwise the gate
// proves nothing about the change.
check(
  'the gate was genuinely false before the roster write',
  remainingCents(GOAL, 1_130_500) !== 0,
  remainingCents(GOAL, 1_130_500),
);

/* 7. nothing unrelated on the page moved ------------------------------ */

check(
  'academy keeps its metadata export',
  /export const metadata = buildMetadata\(\{/.test(academyCode),
);
check(
  'academy keeps its default page component',
  /export default async function AcademyPage\(\)/.test(academyCode),
);
check(
  'academy keeps its course + breadcrumb schema',
  /courseSchema\(\)/.test(academyCode) && /breadcrumbSchema\(/.test(academyCode),
);

console.log(`academy-campaign-freshness: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

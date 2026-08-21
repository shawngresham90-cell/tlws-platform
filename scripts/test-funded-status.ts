/**
 * PUBLIC FUNDED STATE — FOUNDER-WALL-FUNDED-1 (2026-08-20).
 *
 * The owner declared the school funded. These are the release-blocking
 * properties of that declaration:
 *
 *   - every public founder surface says the exact string SCHOOL IS FUNDED;
 *   - no public surface shows raised / goal / remaining / "to go" / percent,
 *     a campaign progress bar, or a monetary aria-valuetext;
 *   - the funded message does NOT depend on a database request succeeding —
 *     a Supabase outage must never make the site read "$0 raised";
 *   - admin-only financial visibility is untouched.
 *
 * Bundle+run: see scripts/run-tests.mjs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SCHOOL_IS_FUNDED,
  FUNDED_HEADLINE,
  fundedStatusLabel,
} from '@/lib/community/funded-status';

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
/** Strip block + line comments so prose about the OLD money never counts as money. */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ------------------------------------------------- the authority itself */

check('funded authority: school is funded', SCHOOL_IS_FUNDED === true);
check('funded authority: exact headline', FUNDED_HEADLINE === 'SCHOOL IS FUNDED');

const authority = read('src/lib/community/funded-status.ts');
check(
  'funded authority is static — no DB client, no fetch, no async',
  !/createClient|createStaticClient|supabase|fetch\(|await |async /i.test(codeOnly(authority)),
  authority,
);
check(
  'funded authority exports no money',
  !/raised|goal_cents|remaining|pct_to_goal|dollars/i.test(codeOnly(authority)),
);

// The accessible sentence must never carry a monetary total.
for (const n of [0, 1, 54, 999]) {
  const label = fundedStatusLabel(n);
  check(`aria label has no money (n=${n})`, !/\$|\braised\b|\bgoal\b|%/i.test(label), label);
  check(`aria label states funded (n=${n})`, label.includes('SCHOOL IS FUNDED'));
}

/* ------------------------------------------- public surfaces say FUNDED */

const PUBLIC_SURFACES: [string, string][] = [
  ['homepage Founders Wall', 'src/components/sections/FoundersWall.tsx'],
  ['/founders', 'src/app/(community)/founders/page.tsx'],
  ['/academy', 'src/app/(academy)/academy/page.tsx'],
  ['funded panel', 'src/components/community/FundedStatusPanel.tsx'],
  ['road ahead totals', 'src/components/road-ahead/FundraisingTotals.tsx'],
];

// The headline reaches every surface through the shared authority/panel rather
// than being retyped, so it can never drift between pages.
for (const [label, file] of PUBLIC_SURFACES) {
  const src = codeOnly(read(file));
  const carries =
    src.includes('FUNDED_HEADLINE') ||
    src.includes('FundedStatusPanel') ||
    src.includes(FUNDED_HEADLINE);
  check(`${label} carries the funded status`, carries, file);
}

/* --------------------------------- no aggregate money on public surfaces */

const MONEY = [
  /\bdollars\s*\(/,
  /raised_cents/,
  /goal_cents/,
  /remaining_cents/,
  /pct_to_goal/,
  /pctToGoal/,
  /remainingCents/,
  /\bto go\b/i,
  /left to open the school/i,
  /% funded/,
  // Aggregate campaign money only. A bare dollar figure is legitimate
  // elsewhere (tuition, and the founder's-story $400 Pathfinder on /academy).
  /\$[\d,]+\s*(raised|goal|left|remaining|to go)/i,
  /(raised|goal|remaining|to go)\D{0,12}\$[\d,]+/i,
];
for (const [label, file] of PUBLIC_SURFACES) {
  const src = codeOnly(read(file));
  for (const re of MONEY) {
    check(`${label} shows no aggregate money (${re})`, !re.test(src), src.match(re)?.[0]);
  }
  check(`${label} has no campaign progressbar`, !/role="progressbar"/.test(src));
  check(`${label} has no monetary aria-valuetext`, !/aria-valuetext/.test(src));
  check(
    `${label} does not import the admin thermometer`,
    !/AdminCampaignThermometer/.test(src),
    file,
  );
}

/* --------------------------- outage-proof: no query gates the headline */

// FundedStatusPanel must render the headline unconditionally — not inside a
// branch on fetched data. Its founderCount is optional precisely so a failed
// count still leaves SCHOOL IS FUNDED on the page.
const panel = read('src/components/community/FundedStatusPanel.tsx');
check('panel takes an OPTIONAL founder count', /founderCount\?:/.test(panel));
check('panel defaults the count to null', /founderCount = null/.test(panel));
check(
  'panel never fetches',
  !/createClient|createStaticClient|fetch\(|await /.test(codeOnly(panel)),
);
check(
  'panel renders the headline unconditionally (not inside a data branch)',
  /\{FUNDED_HEADLINE\}/.test(panel),
);

// The homepage section's DB failure path must not resurrect a zeroed campaign.
const homeSection = codeOnly(read('src/components/sections/FoundersWall.tsx'));
check(
  'homepage catch returns null, not a zeroed campaign object',
  /catch\s*\{\s*return null;\s*\}/.test(homeSection),
  homeSection,
);
check('homepage no longer reads campaign_progress', !/campaign_progress/.test(homeSection));

/* ----------------------------------- admin keeps its financial visibility */

const admin = read('src/components/admin/AdminCampaignThermometer.tsx');
check('admin thermometer still shows raised', admin.includes('dollars(raised)'));
check('admin thermometer still shows the goal', admin.includes('dollars(goal)'));
check('admin thermometer still shows a percentage', admin.includes('% funded'));
check('admin thermometer keeps its progressbar', admin.includes('role="progressbar"'));

const adminPage = read('src/app/admin/(dashboard)/founders/page.tsx');
check('admin page renders the admin thermometer', adminPage.includes('AdminCampaignThermometer'));

// The money component must live under admin and be imported by nothing public.
function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const publicImporters = walk(path.join(process.cwd(), 'src'))
  .filter((p) => !p.includes(`${path.sep}admin${path.sep}`))
  // codeOnly: this harness and the funded authority both NAME the admin
  // component in prose explaining why it is admin-only.
  .filter((p) => codeOnly(fs.readFileSync(p, 'utf8')).includes('AdminCampaignThermometer'));
check(
  'no non-admin file imports the admin thermometer',
  publicImporters.length === 0,
  publicImporters,
);

/* ------------------------------ public copy no longer contradicts funded */

const CONTRADICTIONS = [
  /help build the school/i,
  /help finish the build/i,
  /left to open the school/i,
];
for (const [label, file] of PUBLIC_SURFACES) {
  const src = codeOnly(read(file));
  for (const re of CONTRADICTIONS) {
    check(`${label} drops pre-funded copy (${re})`, !re.test(src));
  }
}

// Public structured content (llms.txt) must not solicit build funding either.
const llms = read('src/app/llms.txt/route.ts');
check(
  'llms.txt does not ask for help funding the school',
  !/ways to help fund the school/i.test(llms),
);
check('llms.txt states the build is funded', /funded/i.test(llms));

console.log(`funded-status: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * SEO-ENGINE-1 Scout contract — fixture-based, deterministic, offline.
 *
 * Covers the milestone's S1–S18 checklist: classification thresholds,
 * anti-noise floors, explainable scoring, existing-URL-first actions,
 * bounded reporting, credential safety, honest failure on malformed or
 * empty data, and the structural guarantees (no Supabase, no automation,
 * no publishing) that keep the Scout evidence-only.
 *
 * No network, no database. The GSC client is exercised only through its
 * pure parsing/windowing functions.
 *
 *   npx esbuild scripts/test-seo-scout.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  classifyAll,
  clusterForQuery,
  isDecay,
  isStrengthen,
  isStrikingDistance,
  recommendAction,
} from './seo-scout/classify';
import { scoreOpportunity } from './seo-scout/score';
import { buildReport } from './seo-scout/report';
import { computeWindows, parseSearchAnalyticsResponse } from './seo-scout/gsc';
import { REPORT_ABSOLUTE_CAP, REPORT_MAX_OPPORTUNITIES } from './seo-scout/config';
import { ScoutError, type GscRow, type ScoutWindows } from './seo-scout/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const row = (over: Partial<GscRow>): GscRow => ({
  query: 'cdl school dalton ga',
  page: 'https://truckinglifewithshawn.com/academy',
  clicks: 10,
  impressions: 300,
  ctr: 10 / 300,
  position: 8,
  ...over,
});

const WINDOWS: ScoutWindows = {
  current: { startDate: '2026-07-20', endDate: '2026-08-16' },
  prior: { startDate: '2026-06-22', endDate: '2026-07-19' },
};

/* ── S1 striking-distance classification ─────────────────────────────── */
check('S1: position 8 with 300 impressions is striking distance', isStrikingDistance(row({})));
check(
  'S1: position 4 and 20 are both inside the band',
  isStrikingDistance(row({ position: 4 })) && isStrikingDistance(row({ position: 20 })),
);
check(
  'S1: below the documented impression floor is NOT striking distance',
  !isStrikingDistance(row({ impressions: 49 })),
);

/* ── S2 top-3 positions are not striking distance ────────────────────── */
check('S2: position 1 is not striking distance', !isStrikingDistance(row({ position: 1 })));
check('S2: position 3 is not striking distance', !isStrikingDistance(row({ position: 3 })));

/* ── S3 beyond position 20 handled correctly ─────────────────────────── */
check('S3: position 21 is not striking distance', !isStrikingDistance(row({ position: 21 })));
const deep = classifyAll([row({ position: 35, impressions: 400, clicks: 2, ctr: 0.005 })], []);
check(
  'S3: a deep position with real impressions classifies as GAP instead',
  deep.length === 1 &&
    deep[0].types.includes('GAP') &&
    !deep[0].types.includes('STRIKING_DISTANCE'),
  deep[0]?.types,
);

/* ── S4 decay with meaningful prior data ─────────────────────────────── */
check(
  'S4: 40% click drop on a 25-click base is decay',
  isDecay(row({ clicks: 15 }), row({ clicks: 25 })),
);
check(
  'S4: 35% impression collapse on a 1000-impression base is decay',
  isDecay(row({ clicks: 0, impressions: 650 }), row({ clicks: 2, impressions: 1000 })),
);

/* ── S5 low-volume noise is not decay ────────────────────────────────── */
check(
  'S5: 5 clicks → 3 clicks is noise, not decay',
  !isDecay(row({ clicks: 3, impressions: 80 }), row({ clicks: 5, impressions: 90 })),
);
check(
  'S5: a large relative drop without the absolute floor is not decay',
  !isDecay(row({ clicks: 7, impressions: 280 }), row({ clicks: 10, impressions: 310 })),
);
check('S5: no prior period at all is never decay', !isDecay(row({}), null));

/* ── S6 positive momentum classifies strengthen ──────────────────────── */
check('S6: 8 → 14 clicks is strengthen', isStrengthen(row({ clicks: 14 }), row({ clicks: 8 })));
check(
  'S6: 3 → 4 clicks stays below the floors',
  !isStrengthen(row({ clicks: 4 }), row({ clicks: 3 })),
);

/* ── S7 commercial cluster weighting is explainable ──────────────────── */
const academyScore = scoreOpportunity(row({}), null, 'academy_local', ['STRIKING_DISTANCE']);
const infoScore = scoreOpportunity(row({}), null, 'national_info', ['STRIKING_DISTANCE']);
check(
  'S7: identical metrics rank higher in academy_local than national_info',
  academyScore.score > infoScore.score,
  { academy: academyScore.score, info: infoScore.score },
);
check(
  'S7: the weight is exposed as a component, not hidden in the number',
  academyScore.components.clusterWeight === 3 && infoScore.components.clusterWeight === 1,
);
check(
  'S7: every component needed to recompute the score is exposed',
  [
    'impressions',
    'position',
    'ctr',
    'expectedCtr',
    'headroomClicks',
    'clicksDelta',
    'typeMultiplier',
  ].every((k) => k in academyScore.components),
);

/* ── S8 Academy queries map to the existing Academy URL ──────────────── */
check(
  'S8: "cdl school dalton ga" clusters as academy_local',
  clusterForQuery('cdl school dalton ga') === 'academy_local',
);
const s8 = recommendAction(row({}), 'academy_local', ['STRIKING_DISTANCE']);
check(
  'S8: the ranking /academy URL is the improvement target',
  s8.action === 'IMPROVE_EXISTING_URL' && s8.targetUrl === '/academy',
  s8,
);
const s8b = recommendAction(
  row({ page: 'https://truckinglifewithshawn.com/knowledge/some-article', position: 28 }),
  'academy_local',
  ['GAP'],
);
check(
  'S8: an academy query ranking a mismatched deep URL is steered to /academy, not a new page',
  s8b.action === 'IMPROVE_EXISTING_URL' && s8b.targetUrl === '/academy',
  s8b,
);

/* ── S9 existing URL improvement preferred over duplicate page ───────── */
const s9 = recommendAction(
  row({ page: 'https://truckinglifewithshawn.com/practice-tests/general-knowledge', position: 12 }),
  'product_support',
  ['STRIKING_DISTANCE'],
);
check('S9: ranking product URL is improved in place', s9.action === 'IMPROVE_EXISTING_URL');
const s9b = classifyAll(
  [
    row({
      query: 'cdl practice test georgia',
      page: 'https://truckinglifewithshawn.com/practice-tests',
      position: 15,
      impressions: 800,
      clicks: 4,
      ctr: 0.005,
    }),
  ],
  [],
);
check(
  'S9: even a gap-flagged query on a hinted route stays IMPROVE_EXISTING_URL',
  s9b.length === 1 && s9b[0].action === 'IMPROVE_EXISTING_URL',
  s9b[0]?.action,
);

/* ── S10 no automatic page generation ────────────────────────────────── */
const s10 = classifyAll(
  [
    row({
      query: 'obscure trucking query',
      page: 'https://truckinglifewithshawn.com/some/old-page',
      position: 45,
      impressions: 500,
      clicks: 1,
      ctr: 0.002,
    }),
  ],
  [],
);
check(
  'S10: the strongest gap yields at most a POSSIBLE_NEW_PAGE suggestion',
  s10.length === 1 && ['POSSIBLE_NEW_PAGE', 'MANUAL_REVIEW'].includes(s10[0].action),
  s10[0]?.action,
);
const scoutSources = ['types.ts', 'config.ts', 'gsc.ts', 'classify.ts', 'score.ts', 'report.ts']
  .map((f) => fs.readFileSync(path.join('scripts/seo-scout', f), 'utf8'))
  .concat(fs.readFileSync('scripts/seo-scout.ts', 'utf8'))
  .join('\n');
check(
  'S10: scout code contains no page/file generation toward the app',
  !/src\/app|generateStaticParams|\.mdx|writeFileSync\([^)]*src\//.test(scoutSources),
);

/* ── S11 report capped ───────────────────────────────────────────────── */
const many = classifyAll(
  Array.from({ length: 60 }, (_, i) =>
    row({ query: `query variant ${i}`, impressions: 300 + i, clicks: 6, ctr: 0.02, position: 9 }),
  ),
  [],
);
check('S11: sixty qualifying rows produced', many.length === 60, many.length);
const bigReport = buildReport(many, WINDOWS);
const queueLines = bigReport.match(/^\d+\. \*\*/gm) ?? [];
check(
  `S11: owner queue is capped at ${REPORT_MAX_OPPORTUNITIES}`,
  queueLines.length === REPORT_MAX_OPPORTUNITIES,
  queueLines.length,
);
check(
  'S11: even an inflated cap is clamped to the hard ceiling',
  (buildReport(many, WINDOWS, 999).match(/^\d+\. \*\*/gm) ?? []).length === REPORT_ABSOLUTE_CAP,
);

/* ── S12 credentials never appear in the report ──────────────────────── */
check(
  'S12: a clean report carries no credential markers',
  !/private_key|BEGIN.*KEY/i.test(bigReport),
);
let s12threw = false;
try {
  buildReport(
    classifyAll(
      [
        row({
          query: 'leak "private_key" probe',
          impressions: 300,
          position: 9,
          clicks: 5,
          ctr: 0.016,
        }),
      ],
      [],
    ),
    WINDOWS,
  );
} catch (e) {
  s12threw = e instanceof ScoutError && e.code === 'REPORT_SAFETY';
}
check('S12: credential-marker content aborts report generation entirely', s12threw);

/* ── S13 credentials never reach client code ─────────────────────────── */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const srcHits = walk('src').filter((f) =>
  /GSC_SERVICE_ACCOUNT_JSON|GSC_PROPERTY|seo-scout/.test(fs.readFileSync(f, 'utf8')),
);
check(
  'S13: nothing under src/ references scout credentials or modules',
  srcHits.length === 0,
  srcHits,
);
check(
  'S13: the scout reads the key only from the environment',
  scoutSources.includes('GSC_SERVICE_ACCOUNT_JSON') &&
    // no embedded key MATERIAL (the report guard's marker regex is fine)
    !/\bMII[A-Za-z0-9+/]{40,}/.test(scoutSources),
);
check(
  'S13: no new runtime dependency was added for GSC',
  !fs.readFileSync('package.json', 'utf8').includes('googleapis'),
);

/* ── S14 malformed GSC response fails safely ─────────────────────────── */
for (const [label, payload] of [
  ['a string body', 'nonsense'],
  ['rows as an object', { rows: {} }],
  ['a row missing keys', { rows: [{ clicks: 1, impressions: 2, ctr: 0.5, position: 1 }] }],
  [
    'a row with string clicks',
    { rows: [{ keys: ['a', 'b'], clicks: 'x', impressions: 2, ctr: 0.5, position: 1 }] },
  ],
] as Array<[string, unknown]>) {
  let threw = false;
  try {
    parseSearchAnalyticsResponse(payload);
  } catch (e) {
    threw = e instanceof ScoutError && e.code === 'MALFORMED_RESPONSE';
  }
  check(`S14: ${label} raises MALFORMED_RESPONSE`, threw);
}
check(
  'S14: a valid response still parses',
  parseSearchAnalyticsResponse({
    rows: [{ keys: ['q', 'p'], clicks: 1, impressions: 2, ctr: 0.5, position: 3 }],
  }).length === 1,
);

/* ── S15 zero-data period produces an honest empty report ────────────── */
check(
  'S15: an absent rows field is a valid empty period',
  parseSearchAnalyticsResponse({}).length === 0,
);
const emptyReport = buildReport([], WINDOWS);
check(
  'S15: the empty report says so honestly and fabricates nothing',
  emptyReport.includes('No opportunities this period') &&
    emptyReport.includes('no data was fabricated'),
);
check('S15: the empty report still names its period', emptyReport.includes('2026-07-20'));

/* ── S16 Supabase is not used ────────────────────────────────────────── */
check('S16: scout code never imports or references Supabase', !/supabase/i.test(scoutSources));
const newMigrations = fs
  .readdirSync('supabase/migrations')
  .filter((f) => /05[5-9]|06\d|seo|scout|gsc/.test(f));
check('S16: this milestone adds no database migration', newMigrations.length === 0, newMigrations);

/* ── S17 RLS contract still enforced ─────────────────────────────────── */
// No DB storage was added (S16), so the applicable half of S17 is that the
// existing RLS contract harness still guards the unchanged migration set —
// it runs in the same suite as this file; here we assert it exists and
// still pins the 054 lockdown.
const rls = fs.readFileSync('scripts/test-supabase-rls-contract.ts', 'utf8');
check(
  'S17: the RLS contract harness is present and still pins 054',
  rls.includes('054_public_api_surface_lockdown.sql'),
);

/* ── S18 no automated publishing/merging exists ──────────────────────── */
// Comments stripped: the file's own header explains why there is no cron,
// and that explanation must not satisfy the ban it documents.
const workflow = fs.readFileSync('.github/workflows/seo-scout.yml', 'utf8').replace(/#[^\n]*/g, '');
check(
  'S18: workflow is manual dispatch only (no cron)',
  workflow.includes('workflow_dispatch') && !/\bschedule:|\bcron:/.test(workflow),
);
check(
  'S18: workflow never commits, pushes, or opens PRs',
  !/git push|git commit|create-pull-request|gh pr|octokit/i.test(workflow),
);
check(
  'S18: scout code never shells out to git or the GitHub API',
  !/child_process|execSync|octokit|api\.github\.com/.test(scoutSources),
);
check(
  'S18: scout writes only into its own output directory',
  /SCOUT_OUT_DIR|seo-scout-output/.test(scoutSources) &&
    fs.readFileSync('.gitignore', 'utf8').includes('/seo-scout-output/'),
);

/* ── window math sanity (supports the period the report claims) ──────── */
const w = computeWindows(new Date('2026-08-19T12:00:00Z'));
check(
  'windows: 28 complete days ending 3 days back',
  w.current.endDate === '2026-08-16' && w.current.startDate === '2026-07-20',
  w.current,
);
check(
  'windows: prior period is the preceding 28 days, contiguous',
  w.prior.endDate === '2026-07-19' && w.prior.startDate === '2026-06-22',
  w.prior,
);

console.log(`seo-scout: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

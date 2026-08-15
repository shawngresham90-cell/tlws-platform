/**
 * Guards the confirmed Trucking Life Academy program facts, everywhere.
 *
 * Tuition, start dates and the street address had been written longhand across
 * eight surfaces and had drifted: the homepage advertised a "Full 160-hour
 * curriculum" the curriculum page contradicted, and four pages still said
 * tuition was "being finalized" after it had been set. This harness exists so
 * that class of drift fails the build instead of sitting live for months.
 *
 * Two halves:
 *   1. POSITIVE — every confirmed fact appears on the surfaces a prospective
 *      student actually reads, and the JSON-LD matches the visible copy.
 *   2. NEGATIVE — a repository-wide scan for the stale literals and for the
 *      claims the school must never make. This is the half that matters: it
 *      catches a stale price reappearing in a file this harness never named.
 *
 * Filesystem + pure imports only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-academy-program-facts.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ACADEMY_ADDRESS,
  TUITION,
  TUITION_USD,
  formatTuition,
  WEEKEND,
  WEEKDAY,
  PROGRAMS,
  EQUIPMENT,
  PLACEMENT,
} from '@/lib/academy/program';
import { courseSchema, localSchoolSchema } from '@/lib/seo/academy-schema';

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
const flatten = (s: string) => s.replace(/\s+/g, ' ');

const ACADEMY = 'src/app/(academy)/academy/page.tsx';
const APPLY = 'src/app/(academy)/academy/apply/page.tsx';
const FAQ = 'src/app/(academy)/academy/faq/page.tsx';
const FINANCING = 'src/app/(academy)/academy/financing/page.tsx';
const CURRICULUM = 'src/app/(academy)/academy/curriculum/page.tsx';
const FACILITY = 'src/app/(academy)/academy/facility/page.tsx';
const HOME_BAND = 'src/components/sections/Academy.tsx';
const PROGRAM_LIB = 'src/lib/academy/program.ts';

/* ── 1. the source of truth itself ───────────────────────────────────── */

check('tuition is 3995 dollars', TUITION_USD === 3995, TUITION_USD);
check('tuition formats as $3,995', TUITION === '$3,995', TUITION);
check('the formatter is the only renderer', formatTuition(3995) === '$3,995', formatTuition(3995));
check('address street is 1821 Wendell Street', ACADEMY_ADDRESS.street === '1821 Wendell Street');
check('address city is Dalton', ACADEMY_ADDRESS.city === 'Dalton');
check('address region is GA', ACADEMY_ADDRESS.region === 'GA');
check(
  'address one-line form is correct',
  ACADEMY_ADDRESS.oneLine === '1821 Wendell Street, Dalton, GA',
  ACADEMY_ADDRESS.oneLine,
);
check(
  'no ZIP code is invented anywhere in the source of truth',
  !/\b\d{5}(-\d{4})?\b/.test(read(PROGRAM_LIB)),
);

check('weekend program starts October 2026', WEEKEND.startsLabel === 'Begins October 2026');
check('weekend ISO start is 2026-10', WEEKEND.startIso === '2026-10');
check('weekend meets Saturdays and Sundays', WEEKEND.meets === 'Saturdays and Sundays');
check('weekend runs eight weekends', WEEKEND.length === 'Eight weekends');
check('weekend program is open', WEEKEND.open === true);

check('weekday program starts January 2027', WEEKDAY.startsLabel === 'Begins January 2027');
check('weekday ISO start is 2027-01', WEEKDAY.startIso === '2027-01');
check(
  'weekday runs approximately three to four weeks',
  WEEKDAY.length === 'Approximately three to four weeks',
);
check('weekday program is NOT marked open', WEEKDAY.open === false);

check(
  'both programs carry the same tuition bullet',
  PROGRAMS.every((p) => p.bullets.includes(TUITION)),
);
check(
  'both programs carry manual 10-speed training',
  PROGRAMS.every((p) => p.bullets.includes('Manual 10-speed training')),
);
check(
  'both programs carry job-placement assistance',
  PROGRAMS.every((p) => p.bullets.includes('Job-placement assistance')),
);
check('equipment is manual 10-speed', EQUIPMENT.transmission === 'Manual 10-speed');
check(
  'placement is assistance, and says so',
  PLACEMENT.headline.includes('Job-placement assistance is available to graduates'),
);
check(
  'placement carries the not-guaranteed qualifier',
  PLACEMENT.detail.includes('employment is not guaranteed'),
);

/* ── 2. the facts reach the pages students read ──────────────────────── */

const surfaces: Array<[string, string]> = [
  ['academy landing', ACADEMY],
  ['apply page', APPLY],
  ['academy FAQ', FAQ],
];
for (const [label, file] of surfaces) {
  const src = flatten(read(file));
  check(
    `${label}: renders the street address`,
    src.includes('1821 Wendell Street') || src.includes('ACADEMY_ADDRESS.oneLine'),
  );
  check(
    `${label}: renders tuition`,
    src.includes('$3,995') || src.includes('{TUITION}') || src.includes('${TUITION}'),
  );
  check(
    `${label}: states the October 2026 weekend start`,
    /October 2026/.test(src) || src.includes('WEEKEND.startsLabel'),
  );
}

const academy = flatten(read(ACADEMY));
check(
  'academy: address is visible copy, not only metadata',
  academy.includes('{ACADEMY_ADDRESS.oneLine}</strong>'),
);
check('academy: has a programs section', academy.includes('CDL training in Dalton, Georgia'));
check('academy: renders the program comparison', academy.includes('<ProgramComparison />'));
check(
  'academy: states the weekend meeting pattern',
  /Saturdays and Sundays for eight weekends/.test(academy),
);
check('academy: states the January 2027 weekday start', /January 2027/.test(academy));
check('academy: states three to four weeks', /three to four weeks/.test(academy));
check('academy: states manual 10-speed training', /manual 10-speed/i.test(academy));
check('academy: states job-placement assistance', /Job-placement assistance/i.test(academy));
check('academy: carries the employment disclaimer', /employment is not guaranteed/i.test(academy));

const apply = flatten(read(APPLY));
check(
  'apply: program facts sit near the CTA, above the form',
  apply.indexOf('What you’re applying for') < apply.indexOf('<ApplyForm'),
);
check(
  'apply: states both program names',
  apply.includes('WEEKEND.name') && apply.includes('WEEKDAY.name'),
);
check('apply: carries the employment disclaimer', apply.includes('PLACEMENT.detail'));

const home = flatten(read(HOME_BAND));
check('homepage band: quotes tuition from the shared source', home.includes('{TUITION}'));
check(
  'homepage band: quotes the address from the shared source',
  home.includes('{ACADEMY_ADDRESS.oneLine}'),
);
check('homepage band: states the October 2026 start', /October 2026/.test(home));

check(
  'financing: tuition banner shows the price',
  flatten(read(FINANCING)).includes('Tuition: {TUITION}'),
);
check(
  'curriculum: program length answered with real lengths',
  /eight weekends/i.test(read(CURRICULUM)) && /three to four weeks/i.test(read(CURRICULUM)),
);
check('facility: equipment states manual 10-speed', /manual 10-speed/i.test(read(FACILITY)));

/* ── 3. structured data matches the visible copy ─────────────────────── */

const course = courseSchema() as Record<string, unknown>;
const instances = course.hasCourseInstance as Array<Record<string, unknown>>;
check(
  'course schema emits one instance per program',
  instances.length === PROGRAMS.length,
  instances.length,
);
check(
  'course instances carry start dates',
  instances.every((i) => typeof i.startDate === 'string' && (i.startDate as string).length > 0),
);
check(
  'course instances carry the weekend and weekday starts',
  instances.map((i) => i.startDate).join(',') === '2026-10,2027-01',
  instances.map((i) => i.startDate),
);
check(
  'course instances price tuition at 3995 USD',
  instances.every((i) => {
    const o = i.offers as Record<string, unknown>;
    return o.price === 3995 && o.priceCurrency === 'USD';
  }),
);
check(
  'course instance address carries the street',
  instances.every((i) => {
    const loc = i.location as Record<string, unknown>;
    const addr = loc.address as Record<string, unknown>;
    return addr.streetAddress === '1821 Wendell Street' && addr.addressLocality === 'Dalton';
  }),
);
const local = localSchoolSchema() as Record<string, unknown>;
const localAddr = local.address as Record<string, unknown>;
check(
  'local school schema carries the street address',
  localAddr.streetAddress === '1821 Wendell Street',
);
check(
  'local school schema states no postal code',
  !('postalCode' in localAddr),
  Object.keys(localAddr),
);
check(
  'course schema states no postal code',
  instances.every((i) => {
    const addr = (i.location as Record<string, unknown>).address as Record<string, unknown>;
    return !('postalCode' in addr);
  }),
);

/* ── 4. repository-wide scan: stale facts and forbidden claims ───────── */

/** Every shipped .ts/.tsx under src/, plus content/ if present. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx|md|mdx)$/.test(e.name)) out.push(rel);
    }
  };
  walk('src');
  walk('content');
  return out;
}
const FILES = sourceFiles();
check('the scan found a substantial source tree', FILES.length > 200, FILES.length);

/**
 * SHIPPED text only — comments stripped.
 *
 * Every rule below bans a string, and the honest way to document a banned
 * string is to quote it. This module's own header quotes "160-hour" and
 * "guaranteed job"; the Academy band carries a JSX note naming the line it
 * replaced; lib/preschool/content.ts explains why it has no refund policy.
 * Scanning raw source flags all of those — the scanner reading its own
 * documentation as a violation. Comments cannot reach a visitor, so they are
 * removed before any rule runs. The `(?<!:)` guard keeps `https://` intact.
 */
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

/** Stale Academy claims that must never reappear anywhere in shipped source. */
const STALE: Array<[string, RegExp]> = [
  ['the contradicted 160-hour curriculum claim', /160.?hour/i],
  ['tuition described as being finalized', /tuition[^.]{0,60}being finalized/i],
  ['exact tuition being finalized', /exact tuition is being finalized/i],
  ['pricing to be announced', /pricing to be announced/i],
  ['tuition announced soon', /tuition (details )?announced soon/i],
  ['the address being published soon', /exact address will be published/i],
  ['the application opening soon', /online application opens soon/i],
  ['schedule and start dates being finalized', /start dates[^.]{0,40}being finalized/i],
  ['a malformed price without the comma', /\$3995\b/],
  ['a malformed price with decimals', /\$3,995\.00/],
];
for (const [label, re] of STALE) {
  const hits = FILES.filter((f) => re.test(shipped(f)));
  check(`no stale claim anywhere: ${label}`, hits.length === 0, hits);
}

/** Claims the school must never make, in any file. */
const FORBIDDEN: Array<[string, RegExp]> = [
  ['guaranteed job', /guaranteed job|job is guaranteed/i],
  ['guaranteed placement', /guaranteed placement|placement is guaranteed/i],
  ['guaranteed employment', /guarantee[sd]? (you )?(a )?(job|employment)/i],
  ['a guaranteed CDL or licence', /guarantee[sd]? (you )?(a )?(CDL|licen[sc]e)/i],
  [
    'an invented restriction-removal promise',
    /removes? the automatic restriction|no automatic restriction/i,
  ],
];
for (const [label, re] of FORBIDDEN) {
  const hits = FILES.filter((f) => re.test(shipped(f)));
  check(`no forbidden claim anywhere: ${label}`, hits.length === 0, hits);
}

/** The weekday program must never be described as open today. */
const weekdayOpenClaims = FILES.filter((f) => {
  const s = flatten(shipped(f));
  return /weekday program (is )?(now )?(available|open|enrolling)/i.test(s);
});
check(
  'the weekday program is never described as currently available',
  weekdayOpenClaims.length === 0,
  weekdayOpenClaims,
);

/** Facts that must not be invented — none are confirmed. */
const INVENTED: Array<[string, RegExp]> = [
  ['daily class hours', /class(es)? run [^.]{0,20}\d{1,2}\s?(am|pm)/i],
  ['a refund policy', /refund policy|money.back/i],
  ['class capacity', /class size (is )?limited to \d+|seats? per class/i],
  ['lodging', /lodging (is )?(available|provided)|we provide housing/i],
];
const ACADEMY_FILES = FILES.filter(
  (f) => /\(academy\)/.test(f) || /academy/i.test(path.basename(f)) || f === PROGRAM_LIB,
);
check('the Academy surface set was found', ACADEMY_FILES.length >= 5, ACADEMY_FILES.length);
for (const [label, re] of INVENTED) {
  const hits = ACADEMY_FILES.filter((f) => re.test(shipped(f)));
  check(`no invented Academy detail: ${label}`, hits.length === 0, hits);
}

/** Placement must never appear without its qualifier on the same surface. */
const placementSurfaces = FILES.filter((f) => /job-placement assistance/i.test(shipped(f)));
check(
  'placement is mentioned on at least the key surfaces',
  placementSurfaces.length >= 3,
  placementSurfaces,
);
for (const f of placementSurfaces) {
  const s = shipped(f);
  const qualified =
    /employment is not guaranteed/i.test(s) || f === PROGRAM_LIB || /program\.ts$/.test(f);
  check(`placement is qualified where it is claimed: ${f}`, qualified);
}

console.log(`academy-program-facts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

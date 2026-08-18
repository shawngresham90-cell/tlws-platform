/**
 * LOCAL-SEO-1 contract: one unmistakable, truthful Dalton landing experience.
 *
 * Two pages compete for local CDL-school queries — /academy (the money page)
 * and /academy/cdl-school-dalton-ga (the areas-served satellite). Before this
 * milestone both carried near-identical "CDL School in Dalton GA" titles, so
 * Google had to pick one, and could pick differently query by query. The rule
 * this harness enforces: /academy owns the Dalton head terms; the satellite
 * owns the regional long tail (North Georgia / I-75 corridor / Chattanooga
 * side); their titles, H1s and descriptions must never collapse back into
 * each other.
 *
 * It also guards the truth boundary for local claims: the school's licensing
 * and registry status is NOT yet established, no phone number or ZIP is
 * confirmed, and class starts are month-precision only — so none of those may
 * appear on any Academy surface or in any emitted JSON-LD.
 *
 * Filesystem + pure imports only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-academy-local-seo.ts --bundle \
 *     --platform=node --format=cjs --jsx=automatic --alias:@=./src \
 *     --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { metadata as academyMeta } from '@/app/(academy)/academy/page';
import { metadata as daltonMeta } from '@/app/(academy)/academy/cdl-school-dalton-ga/page';
import { PageHero } from '@/components/academy';
import { organizationSchema, jsonLdPayload } from '@/lib/seo/schema';
import { courseSchema, localSchoolSchema } from '@/lib/seo/academy-schema';
import { coreEntries } from '@/lib/seo/sitemap-entries';
import { ACADEMY_ADDRESS, TUITION, PROGRAM_SUMMARY } from '@/lib/academy/program';
import { SITE } from '@/lib/seo/site';

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
/** Shipped text only — comments stripped (see test-academy-program-facts). */
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

const ACADEMY = 'src/app/(academy)/academy/page.tsx';
const DALTON = 'src/app/(academy)/academy/cdl-school-dalton-ga/page.tsx';
const PRACTICE_HUB = 'src/app/(learn)/practice-tests/page.tsx';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const academyTitle = str(academyMeta.title);
const daltonTitle = str(daltonMeta.title);
const academyDesc = str(academyMeta.description);
const daltonDesc = str(daltonMeta.description);

/* ── 1. /academy metadata — the Dalton money page ────────────────────── */

check(
  'academy title targets the Dalton head terms',
  academyTitle === 'CDL School & Class A Training in Dalton, GA | Trucking Life Academy',
  academyTitle,
);
check(
  'academy canonical is /academy',
  academyMeta.alternates?.canonical === `${SITE.url}/academy`,
  academyMeta.alternates?.canonical,
);
const academyRobots = academyMeta.robots as { index?: boolean; follow?: boolean };
check(
  'academy is index,follow',
  academyRobots?.index === true && academyRobots?.follow === true,
  academyMeta.robots,
);
check('academy description carries the address', academyDesc.includes(ACADEMY_ADDRESS.oneLine));
check('academy description carries tuition', academyDesc.includes(TUITION));
check('academy description carries the weekend start', academyDesc.includes('October 2026'));
check('academy description fits a SERP snippet', academyDesc.length <= 300, academyDesc.length);

/* ── 2. satellite metadata — the areas-served long tail ──────────────── */

check(
  'satellite title targets the regional long tail',
  daltonTitle === 'North Georgia CDL Training — Dalton Campus off I-75 | Trucking Life Academy',
  daltonTitle,
);
check(
  'satellite canonical is its own path',
  daltonMeta.alternates?.canonical === `${SITE.url}/academy/cdl-school-dalton-ga`,
  daltonMeta.alternates?.canonical,
);
const daltonRobots = daltonMeta.robots as { index?: boolean; follow?: boolean };
check(
  'satellite is index,follow',
  daltonRobots?.index === true && daltonRobots?.follow === true,
  daltonMeta.robots,
);
check('satellite description carries the address', daltonDesc.includes(ACADEMY_ADDRESS.oneLine));
check('satellite description names the corridor', daltonDesc.includes('I-75'));
check('satellite description names a served town', daltonDesc.includes('Calhoun'));
check('satellite description fits a SERP snippet', daltonDesc.length <= 300, daltonDesc.length);

/* ── 3. de-cannibalization — the two pages never bid on one query ────── */

check('the two titles differ', academyTitle !== daltonTitle);
check('the two descriptions differ', academyDesc !== daltonDesc);
check('only the money page titles "CDL School"', !daltonTitle.includes('CDL School'));
check(
  'only the satellite leads with the regional frame',
  daltonTitle.startsWith('North Georgia') && !academyTitle.includes('North Georgia'),
);
check(
  'both stay locally relevant to Dalton',
  academyTitle.includes('Dalton') && daltonTitle.includes('Dalton'),
);
check('neither fell back to the default title', ![academyTitle, daltonTitle].includes(''));

/* ── 4. H1s — rendered through the real PageHero ─────────────────────── */

// The exact props each page passes, verified against the shipped source below
// so this render can't drift from what actually ships.
const academyHero = renderToStaticMarkup(
  PageHero({
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Academy' }],
    eyebrow: 'Trucking Life Academy · Dalton, GA · off I-75',
    title: 'CDL Class A training in Dalton, Georgia —',
    highlight: 'built by a driver, for drivers.',
  }),
);
check(
  'academy hero renders exactly one h1',
  (academyHero.match(/<h1/g) ?? []).length === 1,
  academyHero.match(/<h1/g)?.length,
);
check(
  'academy h1 says CDL training in Dalton, Georgia',
  /<h1[^>]*>[^<]*CDL Class A training in Dalton, Georgia/.test(academyHero),
);
check(
  'academy h1 keeps the driver-built emphasis',
  academyHero.includes('built by a driver, for drivers.'),
);
const daltonHero = renderToStaticMarkup(
  PageHero({
    crumbs: [
      { name: 'Home', href: '/' },
      { name: 'Academy', href: '/academy' },
      { name: 'CDL School in Dalton, GA' },
    ],
    eyebrow: 'CDL School · Dalton, GA · off I-75',
    title: "North Georgia's CDL school,",
    highlight: 'off I-75 in Dalton.',
  }),
);
check(
  'satellite hero renders exactly one h1',
  (daltonHero.match(/<h1/g) ?? []).length === 1,
  daltonHero.match(/<h1/g)?.length,
);
check(
  'satellite h1 claims the regional frame',
  /<h1[^>]*>[^<]*North Georgia/.test(daltonHero) && daltonHero.includes('off I-75 in Dalton.'),
);

// The pages really pass those props.
const academySrc = flatten(read(ACADEMY));
const daltonSrc = flatten(read(DALTON));
check(
  'academy page passes the tested h1 props',
  academySrc.includes('title="CDL Class A training in Dalton, Georgia —"') &&
    academySrc.includes('highlight="built by a driver, for drivers."'),
);
check(
  'satellite page passes the tested h1 props',
  daltonSrc.includes(`title="North Georgia's CDL school,"`) &&
    daltonSrc.includes('highlight="off I-75 in Dalton."'),
);

/* ── 5. structured data — org, course, local school agree on the facts ─ */

const org = organizationSchema() as Record<string, unknown>;
const orgAddr = org.address as Record<string, unknown>;
check(
  'organization schema carries the street address',
  orgAddr.streetAddress === ACADEMY_ADDRESS.street,
  orgAddr,
);
check(
  'organization address city/region come from SITE',
  orgAddr.addressLocality === SITE.city && orgAddr.addressRegion === SITE.region,
);
check('organization schema states no postal code', !('postalCode' in orgAddr));
check('organization keeps its stable @id', org['@id'] === `${SITE.url}/#organization`);

const local = localSchoolSchema() as Record<string, unknown>;
const localAddr = local.address as Record<string, unknown>;
check(
  'local school and organization agree on the street',
  localAddr.streetAddress === orgAddr.streetAddress,
);
check(
  'local school is parented to the organization',
  (local.parentOrganization as Record<string, unknown>)?.['@id'] === org['@id'],
);
const areas = (local.areaServed as Array<{ name: string }>).map((a) => a.name);
check(
  'local school serves Dalton and the Chattanooga side',
  areas.includes('Dalton, GA') && areas.includes('Chattanooga, TN'),
  areas,
);

const course = courseSchema() as Record<string, unknown>;
const instances = course.hasCourseInstance as Array<Record<string, unknown>>;
check(
  'course provider is the same organization node',
  (course.provider as Record<string, unknown>)?.['@id'] === org['@id'],
);
check(
  'course instances price tuition at 3995 USD',
  instances.every((i) => {
    const o = i.offers as Record<string, unknown>;
    return o.price === 3995 && o.priceCurrency === 'USD';
  }),
);
check(
  'all three nodes serialize into one valid JSON-LD payload',
  (() => {
    try {
      const parsed = JSON.parse(jsonLdPayload([org, local, course]).replace(/\\u003c/g, '<'));
      return Array.isArray(parsed) && parsed.length === 3;
    } catch {
      return false;
    }
  })(),
);

/* ── 6. truth guardrail — claims that are NOT yet established ────────── */

/**
 * Nothing below is true today. The day one becomes true it goes into
 * lib/academy/program.ts (owner-approved) first — until then it may not
 * appear on any Academy surface, in metadata, or in structured data.
 */
const UNESTABLISHED: Array<[string, RegExp]> = [
  ['a Georgia DDS licensing/approval claim', /Georgia DDS|DDS[- ](licensed|certified|approved)/i],
  ['a state-licensed/certified claim', /state[- ]licensed\b|state[- ]certified\b/i],
  ['a licensed/certified/approved CDL school claim', /(licensed|certified|approved) CDL school/i],
  [
    'an FMCSA Training Provider Registry listing claim',
    /Training Provider Registry|(listed|registered) (on|with) (the )?FMCSA/i,
  ],
  [
    'a day-precision class date (starts are month-precision only)',
    /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th)?,? ?20\d\d/,
  ],
  ['a phone number (none is established)', /\(\d{3}\) ?\d{3}[- ]\d{4}|\b\d{3}-\d{3}-\d{4}\b/],
  ['a ZIP on the address (none is confirmed)', /Dalton,? GA,? \d{5}/i],
];

const ACADEMY_SURFACES = [
  ACADEMY,
  DALTON,
  'src/app/(academy)/academy/apply/page.tsx',
  'src/app/(academy)/academy/faq/page.tsx',
  'src/app/(academy)/academy/financing/page.tsx',
  'src/app/(academy)/academy/curriculum/page.tsx',
  'src/app/(academy)/academy/requirements/page.tsx',
  'src/app/(academy)/academy/facility/page.tsx',
  'src/app/(academy)/academy/instructors/page.tsx',
  'src/components/sections/Academy.tsx',
  'src/lib/academy/program.ts',
  'src/lib/seo/academy-schema.ts',
];
check(
  'every scanned Academy surface exists',
  ACADEMY_SURFACES.every((f) => fs.existsSync(path.join(root, f))),
  ACADEMY_SURFACES.filter((f) => !fs.existsSync(path.join(root, f))),
);
// Rendered output is scanned too — a claim that only materializes when the
// schema builders run would slip past a source-only scan.
const RENDERED = [
  ['academy metadata', `${academyTitle} ${academyDesc}`],
  ['satellite metadata', `${daltonTitle} ${daltonDesc}`],
  ['emitted JSON-LD', jsonLdPayload([org, local, course])],
  ['academy hero markup', academyHero],
  ['satellite hero markup', daltonHero],
] as Array<[string, string]>;
for (const [label, re] of UNESTABLISHED) {
  const fileHits = ACADEMY_SURFACES.filter((f) => re.test(flatten(shipped(f))));
  check(`no unestablished claim in source: ${label}`, fileHits.length === 0, fileHits);
  const renderedHits = RENDERED.filter(([, text]) => re.test(text)).map(([l]) => l);
  check(`no unestablished claim in rendered output: ${label}`, renderedHits.length === 0, {
    label,
    renderedHits,
  });
}

/* ── 7. both pages are in the core sitemap, exactly once ─────────────── */

(async () => {
  const core = await coreEntries();
  const urls = core.map((e) => e.url);
  const academyUrls = urls.filter((u) => u === `${SITE.url}/academy`);
  const daltonUrls = urls.filter((u) => u === `${SITE.url}/academy/cdl-school-dalton-ga`);
  check('core sitemap lists /academy exactly once', academyUrls.length === 1, academyUrls.length);
  check(
    'core sitemap lists the satellite exactly once',
    daltonUrls.length === 1,
    daltonUrls.length,
  );
  const academyEntry = core.find((e) => e.url === `${SITE.url}/academy`);
  check('the money page carries the top academy priority', academyEntry?.priority === 0.9);

  /* ── 8. the local link mesh, and every href resolves ─────────────────── */

  check(
    'academy page links the satellite from visible copy',
    academySrc.includes('href="/academy/cdl-school-dalton-ga"') &&
      academySrc.includes('See the areas we serve'),
  );
  check(
    'academy page names the service area beside the address',
    academySrc.includes('Whitfield County') && academySrc.includes('Chattanooga'),
  );
  check(
    'satellite shows the campus address as visible copy',
    /<address[^>]*>[^<]*The campus is at/.test(daltonSrc) &&
      daltonSrc.includes('{ACADEMY_ADDRESS.oneLine}'),
  );
  check(
    'satellite directions use the derived maps URL',
    daltonSrc.includes('ACADEMY_ADDRESS.mapsUrl') &&
      !/google\.com\/maps/.test(flatten(shipped(DALTON))),
  );
  check(
    'satellite states the program facts from the shared source',
    daltonSrc.includes('{PROGRAM_SUMMARY}') && PROGRAM_SUMMARY.includes(TUITION),
  );
  check(
    'satellite conversion band uses the shared enrolment line',
    daltonSrc.includes('intro={ENROLL_CTA_LINE}'),
  );
  const hub = flatten(read(PRACTICE_HUB));
  check(
    'practice-tests hub links /academy with a Dalton anchor',
    hub.includes('href="/academy"') && hub.includes('our CDL school in Dalton, Georgia'),
  );

  // Every internal href this milestone touches resolves to a real route.
  const ROUTES: Array<[string, string]> = [
    ['/academy', 'src/app/(academy)/academy/page.tsx'],
    ['/academy/cdl-school-dalton-ga', DALTON],
    ['/academy/apply', 'src/app/(academy)/academy/apply/page.tsx'],
    ['/academy/curriculum', 'src/app/(academy)/academy/curriculum/page.tsx'],
    ['/academy/requirements', 'src/app/(academy)/academy/requirements/page.tsx'],
    ['/academy/financing', 'src/app/(academy)/academy/financing/page.tsx'],
    ['/practice-tests', PRACTICE_HUB],
  ];
  for (const [route, file] of ROUTES) {
    check(`route ${route} resolves to a page module`, fs.existsSync(path.join(root, file)), file);
  }

  console.log(`academy-local-seo: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})().catch((err) => {
  console.log('FAIL: harness crashed', err);
  process.exit(1);
});

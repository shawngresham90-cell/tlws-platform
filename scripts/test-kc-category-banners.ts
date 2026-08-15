/**
 * Locks each Knowledge Center category to its approved banner.
 *
 * These six photographs were approved one at a time, several of them after a
 * wrong or non-compliant frame was caught and rejected — a driver in shot, a
 * classroom with the wrong wall, an ELD screen showing impossible hours. The
 * expensive failure now is not a missing image; it is a SWAPPED one, where
 * `health-on-the-road` quietly starts showing the weigh station and nobody
 * notices because both pages still render something.
 *
 * So the mapping is pinned here by exact path AND exact alt text, and the
 * assets are checked on disk by magic bytes and real dimensions rather than
 * by trusting the filename.
 *
 * Also guarded: the rejected and reserved frames must never appear in shipped
 * code — the Weather Driving image is for a future article, not a category,
 * and the two rejected frames are not in the repository at all.
 *
 * Filesystem + pure imports only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-kc-category-banners.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CATEGORY_VISUALS,
  CATEGORY_SLUGS,
  categoryVisual,
  CATEGORY_BANNER_WIDTH,
  CATEGORY_BANNER_HEIGHT,
} from '@/lib/kc/category-visuals';

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
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

const HERO = 'src/components/kc/CategoryHero.tsx';
const CARD = 'src/components/kc/CategoryCard.tsx';
const CATEGORY_PAGE = 'src/app/(marketing)/knowledge/[category]/page.tsx';
const LANDING = 'src/app/(marketing)/knowledge/page.tsx';
const VISUALS_LIB = 'src/lib/kc/category-visuals.ts';

/* ── 1. the six required slugs, mapped exactly ───────────────────────── */

/** The approved mapping, restated independently of the module under test. */
const EXPECTED: Record<string, string> = {
  'dot-compliance': '/images/knowledge/categories/dot-compliance.webp',
  'hours-of-service': '/images/knowledge/categories/hours-of-service.webp',
  'getting-your-cdl': '/images/knowledge/categories/getting-your-cdl.webp',
  'cdl-training': '/images/knowledge/categories/cdl-training.webp',
  'trucking-careers': '/images/knowledge/categories/trucking-careers.webp',
  'health-on-the-road': '/images/knowledge/categories/health-on-the-road.webp',
};

check('exactly six categories have artwork', CATEGORY_SLUGS.length === 6, CATEGORY_SLUGS);
for (const [slug, src] of Object.entries(EXPECTED)) {
  const v = categoryVisual(slug);
  check(`slug present: ${slug}`, v !== null);
  check(`${slug} → ${path.basename(src)}`, v?.src === src, v?.src);
}
for (const slug of CATEGORY_SLUGS) {
  check(`no unexpected slug in the mapping: ${slug}`, Object.hasOwn(EXPECTED, slug));
}

/* ── 2. no duplicate or second mapping ───────────────────────────────── */

const srcs = CATEGORY_SLUGS.map((s) => CATEGORY_VISUALS[s].src);
check('every category has a DISTINCT image', new Set(srcs).size === srcs.length, srcs);
const alts = CATEGORY_SLUGS.map((s) => CATEGORY_VISUALS[s].alt);
check('every category has DISTINCT alt text', new Set(alts).size === alts.length);

// No surface may hardcode a category image path; all must go through the map.
for (const f of [HERO, CARD, CATEGORY_PAGE, LANDING]) {
  check(
    `${f} hardcodes no category image path`,
    !/\/images\/knowledge\/categories\//.test(shipped(f)),
    shipped(f).match(/\/images\/knowledge\/categories\/[^"']*/)?.[0],
  );
}
check(
  'the mapping module is the only place the paths appear',
  /\/images\/knowledge\/categories\//.test(read(VISUALS_LIB)),
);

/* ── 3. the assets are real, and are what they claim ─────────────────── */

for (const slug of CATEGORY_SLUGS) {
  const v = CATEGORY_VISUALS[slug];
  const file = path.join(root, 'public', v.src);
  check(`${slug}: asset exists on disk`, fs.existsSync(file), v.src);
  if (!fs.existsSync(file)) continue;

  const buf = fs.readFileSync(file);
  // Container read from the bytes, not the extension — a .webp that is really
  // a PNG breaks content-type handling and is exactly the mismatch this set
  // already hit once.
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  check(`${slug}: real WebP container`, isWebp);
  check(`${slug}: extension matches container`, v.src.endsWith('.webp') && isWebp);

  const form = buf.subarray(12, 16).toString();
  const [w, h] =
    form === 'VP8X'
      ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
      : [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  check(
    `${slug}: ${CATEGORY_BANNER_WIDTH}×${CATEGORY_BANNER_HEIGHT}`,
    w === CATEGORY_BANNER_WIDTH && h === CATEGORY_BANNER_HEIGHT,
    { w, h },
  );
  check(`${slug}: 16:9`, Math.abs(w / h - 16 / 9) < 0.01, w / h);
}
check('the declared intrinsic width is 1672', CATEGORY_BANNER_WIDTH === 1672);
check('the declared intrinsic height is 941', CATEGORY_BANNER_HEIGHT === 941);

/* ── 4. alt text is real and useful ──────────────────────────────────── */

const CATEGORY_NAMES = [
  'DOT Compliance',
  'Hours of Service',
  'Getting Your CDL',
  'CDL Training',
  'Trucking Careers',
  'Health on the Road',
];
for (const slug of CATEGORY_SLUGS) {
  const alt = CATEGORY_VISUALS[slug].alt;
  check(`${slug}: has alt text`, alt.length > 0);
  check(`${slug}: alt text is descriptive, not a label`, alt.length >= 40, alt);
  check(`${slug}: alt text is not just the category name`, !CATEGORY_NAMES.includes(alt.trim()));
  check(
    `${slug}: alt text says nothing about "banner"/"image"`,
    !/\b(banner|image|photo of)\b/i.test(alt),
    alt,
  );
  // No frame carries readable branding, so no alt may claim any.
  check(
    `${slug}: alt text claims no logo or signage`,
    !/\blogo\b|\bsign reads\b|\bbranded\b/i.test(alt),
    alt,
  );
}

/* ── 5. unknown slug degrades safely ─────────────────────────────────── */

check('unknown slug returns null', categoryVisual('not-a-real-category') === null);
check('empty slug returns null', categoryVisual('') === null);
// Object.hasOwn guards against prototype keys resolving to a "visual".
check('prototype keys do not resolve', categoryVisual('constructor') === null);
check('toString does not resolve', categoryVisual('toString') === null);
check(
  'both surfaces guard on a null visual',
  /visual &&/.test(shipped(HERO)) && /visual &&/.test(shipped(CARD)),
);

/* ── 6. rendering: one h1, correct data source, no baked text ────────── */

const hero = shipped(HERO);
const card = shipped(CARD);
const catPage = shipped(CATEGORY_PAGE);

check(
  'the hero renders exactly one h1',
  (hero.match(/<h1/g) ?? []).length === 1,
  (hero.match(/<h1/g) ?? []).length,
);
check('the category page renders no h1 of its own', !/<h1/.test(catPage));
check(
  'the hero h1 is the category name from the data source',
  /<h1[^>]*>\{name\}<\/h1>/.test(hero),
);
check('the hero renders the description from the data source', /\{description\}/.test(hero));
check(
  'the category page passes the db slug to the hero',
  /<CategoryHero slug=\{cat\.slug\}/.test(catPage),
);
check('the category page passes the db name', /name=\{cat\.name\}/.test(catPage));
check(
  'the category page passes the db description',
  /description=\{cat\.description\}/.test(catPage),
);
check(
  'the page no longer holds the old plain heading block',
  !/display-hero max-w-3xl/.test(catPage),
);

check('the hero uses next/image', /from 'next\/image'/.test(hero));
check('the hero image is decorative beside the h1', /alt=""/.test(hero));
check('the hero image region is aria-hidden', /aria-hidden="true"/.test(hero));
check('the hero declares responsive sizes', /sizes="[^"]+"/.test(hero));
check('the hero image is priority (it is the LCP element)', /priority/.test(hero));
check(
  'the hero applies a horizontal scrim for title contrast',
  /linear-gradient\(90deg/.test(hero),
);
check('the hero applies a mobile bottom scrim', /linear-gradient\(0deg/.test(hero));
// The two scrims must stay mutually exclusive. Stacking them multiplies to
// near-black and throws the photograph away — measured at 0.05 transmittance
// on a phone before this was split by breakpoint.
check(
  'the horizontal scrim is sm-and-up only',
  /className="absolute inset-0 hidden sm:block"/.test(hero),
);
check('the bottom scrim is below-sm only', /className="absolute inset-0 sm:hidden"/.test(hero));
// Below sm the band is far taller than 16:9, so object-cover crops the sides.
// A centred crop cuts the subject out; every approved frame sits right of centre.
check('the hero biases its crop right on narrow screens', /object-\[\d+%_\d+%\]/.test(hero));
check('the hero re-centres its crop from sm', /sm:object-center/.test(hero));
check(
  'the hero reserves its box with fill + object-cover',
  /fill/.test(hero) && /object-cover/.test(hero),
);

check('the card uses next/image', /from 'next\/image'/.test(card));
check('the card image carries the descriptive alt', /alt=\{visual\.alt\}/.test(card));
check('the card thumbnail is 16:9', /aspect-\[16\/9\]/.test(card));
check('the card lazy-loads below-the-fold images', /loading="lazy"/.test(card));
check('the card declares responsive sizes', /sizes="[^"]+"/.test(card));
check(
  'the card reserves intrinsic dimensions',
  /CATEGORY_BANNER_WIDTH/.test(card) && /CATEGORY_BANNER_HEIGHT/.test(card),
);
check('the card keeps the title as real HTML', /<h3[^>]*>\{category\.name\}<\/h3>/.test(card));
check('the card keeps the description as real HTML', /\{category\.description\}/.test(card));
check(
  'the card preserves its link to the category',
  /href=\{`\/knowledge\/\$\{category\.slug\}`\}/.test(card),
);

/* ── 7. rejected and reserved frames stay out of shipped code ────────── */

function shippedFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
    }
  };
  walk('src');
  return out;
}
const FILES = shippedFiles();
for (const [label, re] of [
  ['the reserved Weather Driving frame', /weather-driving/i],
  ['a rejected roadside-triangles frame', /roadside-triangles/i],
  ['a rejected two-window classroom', /pending-label|two-window/i],
  ['a cookbook cover as a category banner', /cookbook.*(cover|banner)/i],
] as Array<[string, RegExp]>) {
  const hits = FILES.filter((f) => re.test(shipped(f)));
  check(`no shipped file references ${label}`, hits.length === 0, hits);
}
// The category banners are CATEGORY assets — they must not leak onto articles.
check(
  'no article surface renders a category banner',
  !FILES.filter((f) => /\[slug\]/.test(f)).some((f) => /knowledge\/categories\//.test(shipped(f))),
);
check(
  'article hero_image_url is untouched',
  read('src/app/(marketing)/knowledge/[category]/[slug]/page.tsx').includes(
    'article.hero_image_url',
  ),
);

/* ── 8. only the six assets are in the directory ─────────────────────── */

const dir = path.join(root, 'public/images/knowledge/categories');
const onDisk = fs.readdirSync(dir).sort();
check('the directory holds exactly six files', onDisk.length === 6, onDisk);
check(
  'every file on disk is a mapped category',
  onDisk.every((f) => CATEGORY_SLUGS.includes(f.replace(/\.webp$/, ''))),
  onDisk,
);

console.log(`kc-category-banners: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

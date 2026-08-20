/**
 * Knowledge Center article visual slot — validation suite (KC-VIS-1).
 *
 * The slot exists so an approved article graphic can appear INSIDE an article
 * without the markdown renderer learning about images. Three things can go
 * wrong, and each is expensive in a different way:
 *
 *   1. A registered entry whose file is missing, mis-sized, over budget, or
 *      not really a WebP — a broken frame on a published page.
 *   2. The image surfaces disagreeing — the inline figure showing one asset
 *      while `Article.image` / `og:image` advertise another (or nothing).
 *   3. The figure landing in the wrong place, or the article's regulatory
 *      text being altered to make room for it.
 *
 * So this harness validates the live registry, then proves the BEHAVIOR with
 * a fixture registered at runtime: the real page module is rendered and the
 * figure's position, dimensions, rendition choice, metadata, and JSON-LD are
 * read out of the actual output. Synthetic WebP files (built byte by byte
 * below) drive the failure cases, so "a missing asset fails validation" is
 * demonstrated rather than assumed.
 *
 * The Class A vs Class B pair is live: its approved artwork is committed and
 * its entry is active in ARTICLE_VISUALS, so the registry checks now validate
 * real bytes. Every check is still written to pass while a future entry sits
 * in PENDING_ARTICLE_VISUALS, and to start enforcing the moment it is
 * promoted.
 *
 * Filesystem + pure imports + a PostgREST fake. No database, no network.
 *
 * Run:
 *   npx esbuild scripts/test-kc-article-visuals.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-kc-article-visuals.cjs && node /tmp/test-kc-article-visuals.cjs
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Metadata } from 'next';
import {
  ARTICLE_VISUALS,
  PENDING_ARTICLE_VISUALS,
  ARTICLE_IMAGE_DIR,
  ARTICLE_VISUAL_MAX_BYTES,
  articleVisual,
  articleImageUrl,
  splitHtmlAfterHeading,
  type ArticleVisual,
} from '@/lib/kc/article-visuals';
import { ArticleFigure } from '@/components/kc/ArticleFigure';
import { renderMarkdown } from '@/lib/kc/mdx';
import { articleSchema } from '@/lib/kc/schema';
import { SITE } from '@/lib/seo/site';
import type { KcArticle, KcCategory } from '@/lib/kc/types';
import ArticlePage, {
  generateMetadata as kcArticleMetadata,
} from '@/app/(marketing)/knowledge/[category]/[slug]/page';
import { installPostgrestFake } from './helpers/postgrest-fake';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
/** Source with comments stripped — so a path named only in a comment doesn't count. */
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

const REGISTRY = 'src/lib/kc/article-visuals.ts';
const FIGURE = 'src/components/kc/ArticleFigure.tsx';
const ARTICLE_PAGE = 'src/app/(marketing)/knowledge/[category]/[slug]/page.tsx';
const KC_SCHEMA = 'src/lib/kc/schema.ts';

const CLASS_AB_KEY = 'getting-your-cdl/class-a-vs-class-b-cdl';

/* ── 0. synthetic WebP fixtures ───────────────────────────────────────────
 * A real (if minimal) VP8X container of an exact declared size, so the
 * dimension/format/budget checks can be exercised against files that are
 * genuinely what they claim — or genuinely not.
 */
function webpBytes(width: number, height: number, padTo = 0): Buffer {
  const head = Buffer.alloc(30);
  head.write('RIFF', 0, 'ascii');
  head.write('WEBP', 8, 'ascii');
  head.write('VP8X', 12, 'ascii');
  head.writeUInt32LE(10, 16); // VP8X chunk payload length
  head.writeUIntLE(width - 1, 24, 3);
  head.writeUIntLE(height - 1, 27, 3);
  // Optional filler chunk so a fixture can exceed the byte budget.
  const padLen = Math.max(0, padTo - head.length);
  const pad = padLen > 0 ? Buffer.alloc(padLen, 0x20) : Buffer.alloc(0);
  const out = Buffer.concat([head, pad]);
  out.writeUInt32LE(out.length - 8, 4); // RIFF size
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-article-visuals-'));
const tmpPublic = path.join(tmp, 'public');
fs.mkdirSync(path.join(tmpPublic, ARTICLE_IMAGE_DIR), { recursive: true });
const writeFixture = (name: string, buf: Buffer) => {
  fs.writeFileSync(path.join(tmpPublic, ARTICLE_IMAGE_DIR, name), buf);
  return `${ARTICLE_IMAGE_DIR}${name}`;
};

/* ── 1. the validator under test ──────────────────────────────────────────
 * One function, run against BOTH the real registry (every registered entry
 * must come back clean) and the synthetic failure fixtures below.
 */
const GENERIC_ALT_OPENERS = /^(image|photo|picture|graphic|infographic)\b/i;
const ALT_FILLER = /\b(image|photo|picture) of\b/i;

function validateRendition(
  rendition: { src: string; width: number; height: number },
  publicRoot: string,
  label: string,
): string[] {
  const problems: string[] = [];
  if (!rendition.src.startsWith(ARTICLE_IMAGE_DIR)) {
    problems.push(`${label}: src is outside ${ARTICLE_IMAGE_DIR}`);
  }
  if (!rendition.src.endsWith('.webp')) problems.push(`${label}: not a .webp path`);
  // Repo-local only: an article graphic must never depend on a remote host.
  if (/^https?:/i.test(rendition.src)) problems.push(`${label}: remote URL`);

  const file = path.join(publicRoot, rendition.src);
  if (!fs.existsSync(file)) {
    problems.push(`${label}: asset missing on disk`);
    return problems;
  }
  const buf = fs.readFileSync(file);
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isWebp) {
    problems.push(`${label}: not a real WebP container`);
    return problems;
  }
  if (buf.length > ARTICLE_VISUAL_MAX_BYTES) {
    problems.push(`${label}: ${buf.length} bytes exceeds the ${ARTICLE_VISUAL_MAX_BYTES} budget`);
  }
  const form = buf.subarray(12, 16).toString();
  const [w, h] =
    form === 'VP8X'
      ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
      : [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (w !== rendition.width || h !== rendition.height) {
    problems.push(`${label}: declared ${rendition.width}×${rendition.height}, file is ${w}×${h}`);
  }
  return problems;
}

function validateVisual(visual: ArticleVisual, publicRoot: string): string[] {
  const problems = [...validateRendition(visual.desktop, publicRoot, 'desktop')];
  if (visual.mobile) {
    problems.push(...validateRendition(visual.mobile, publicRoot, 'mobile'));
    if (visual.mobile.src === visual.desktop.src) {
      problems.push('mobile: same file as desktop — an art-directed pair needs two renditions');
    }
  }
  const alt = visual.alt.trim();
  if (alt.length === 0) problems.push('alt: empty');
  else if (alt.length < 40) problems.push('alt: too short to describe a diagram');
  if (GENERIC_ALT_OPENERS.test(alt)) problems.push('alt: opens with a generic filler word');
  if (ALT_FILLER.test(alt)) problems.push('alt: contains "image of"-style filler');
  if (visual.caption !== undefined) {
    const cap = visual.caption.trim();
    if (cap.length === 0) problems.push('caption: present but empty');
    if (cap === alt) problems.push('caption: duplicates the alt text');
    if (alt.includes(cap)) problems.push('caption: wholly contained in the alt text');
  }
  return problems;
}

/* ── 2. registry contracts ────────────────────────────────────────────── */

check(
  'every REGISTERED visual passes full asset validation',
  Object.entries(ARTICLE_VISUALS).every(
    ([, v]) => validateVisual(v, path.join(root, 'public')).length === 0,
  ),
  Object.entries(ARTICLE_VISUALS)
    .map(([k, v]) => [k, validateVisual(v, path.join(root, 'public'))])
    .filter(([, p]) => (p as string[]).length > 0),
);
check(
  'every registered key is category/article shaped',
  Object.keys(ARTICLE_VISUALS).every((k) => /^[a-z0-9-]+\/[a-z0-9-]+$/.test(k)),
  Object.keys(ARTICLE_VISUALS),
);
// A pending spec is a spec, not a publication: it must not also be live.
for (const key of Object.keys(PENDING_ARTICLE_VISUALS)) {
  check(`pending entry is not also registered: ${key}`, !Object.hasOwn(ARTICLE_VISUALS, key));
}
check(
  'every PENDING spec is shape-valid apart from its (absent) files',
  Object.entries(PENDING_ARTICLE_VISUALS).every(
    ([, v]) =>
      validateVisual(v, path.join(root, 'public')).filter((p) => !p.includes('asset missing'))
        .length === 0,
  ),
  Object.entries(PENDING_ARTICLE_VISUALS).map(([k, v]) => [
    k,
    validateVisual(v, path.join(root, 'public')).filter((p) => !p.includes('asset missing')),
  ]),
);
// Half-promoted state: files committed but the entry still pending (or the
// reverse) is exactly the drift this catches.
for (const [key, v] of Object.entries(PENDING_ARTICLE_VISUALS)) {
  const anyOnDisk = [v.desktop, v.mobile]
    .filter(Boolean)
    .some((r) => fs.existsSync(path.join(root, 'public', (r as { src: string }).src)));
  if (anyOnDisk) {
    check(
      `pending ${key}: artwork is on disk — promote the entry into ARTICLE_VISUALS`,
      false,
      'files exist but the visual is still pending',
    );
  } else {
    check(`pending ${key}: no artwork on disk yet (expected while pending)`, true);
  }
}

check(
  'unknown article returns null',
  articleVisual('getting-your-cdl', 'no-such-article') === null,
);
check('unknown category returns null', articleVisual('no-such-category', 'cdl-cost') === null);
check('empty slugs return null', articleVisual('', '') === null);
check('prototype keys do not resolve', articleVisual('constructor', 'prototype') === null);
check('toString does not resolve', articleVisual('toString', 'toString') === null);

/* ── 3. single authority ──────────────────────────────────────────────── */

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
const hardcoders = FILES.filter(
  (f) => f !== REGISTRY && /\/images\/knowledge\/articles\//.test(shipped(f)),
);
check('only the registry names article image paths', hardcoders.length === 0, hardcoders);
check('the registry does name them', /\/images\/knowledge\/articles\//.test(read(REGISTRY)));
check(
  'the article page reads the registry rather than a literal',
  /articleVisual\(/.test(shipped(ARTICLE_PAGE)) && !/\/images\//.test(shipped(ARTICLE_PAGE)),
);
check(
  'the schema builder resolves through the same helper',
  /articleImageUrl\(/.test(shipped(KC_SCHEMA)) && /articleVisual\(/.test(shipped(KC_SCHEMA)),
);
check(
  'no surface reads hero_image_url directly for the image any more',
  !/image: article\.hero_image_url/.test(shipped(KC_SCHEMA)) &&
    !/image: article\.hero_image_url/.test(shipped(ARTICLE_PAGE)),
);

/* ── 4. asset validation, proven against synthetic files ──────────────── */

const goodDesktop = {
  src: writeFixture('good.webp', webpBytes(1600, 900)),
  width: 1600,
  height: 900,
};
const goodMobile = {
  src: writeFixture('good-mobile.webp', webpBytes(1080, 1350)),
  width: 1080,
  height: 1350,
};
const GOOD_ALT =
  'Side-by-side diagram comparing a combination vehicle with a heavy single truck and the ' +
  'weight thresholds that separate them.';
const good: ArticleVisual = { desktop: goodDesktop, mobile: goodMobile, alt: GOOD_ALT };

check(
  'a well-formed pair validates clean',
  validateVisual(good, tmpPublic).length === 0,
  validateVisual(good, tmpPublic),
);

const missing = { ...good, desktop: { ...goodDesktop, src: `${ARTICLE_IMAGE_DIR}nope.webp` } };
check(
  'missing asset fails validation',
  validateVisual(missing, tmpPublic).some((p) => p.includes('asset missing')),
  validateVisual(missing, tmpPublic),
);

const pngBytes = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(40, 0),
]);
const fakeWebp = {
  ...good,
  desktop: { ...goodDesktop, src: writeFixture('actually-a-png.webp', pngBytes) },
};
check(
  'a PNG wearing a .webp name fails validation',
  validateVisual(fakeWebp, tmpPublic).some((p) => p.includes('not a real WebP')),
  validateVisual(fakeWebp, tmpPublic),
);

const wrongDims = {
  ...good,
  desktop: { src: writeFixture('wrong-dims.webp', webpBytes(1280, 720)), width: 1600, height: 900 },
};
check(
  'declared dimensions must match the file bytes',
  validateVisual(wrongDims, tmpPublic).some((p) =>
    p.includes('declared 1600×900, file is 1280×720'),
  ),
  validateVisual(wrongDims, tmpPublic),
);

const oversize = {
  ...good,
  desktop: {
    src: writeFixture('oversize.webp', webpBytes(1600, 900, ARTICLE_VISUAL_MAX_BYTES + 1024)),
    width: 1600,
    height: 900,
  },
};
check(
  'over-budget files fail validation',
  validateVisual(oversize, tmpPublic).some((p) => p.includes('exceeds the')),
  validateVisual(oversize, tmpPublic),
);
check('the byte budget is the house 200 KB', ARTICLE_VISUAL_MAX_BYTES === 200 * 1024);
check(
  'a file exactly at the budget is allowed',
  validateRendition(
    {
      src: writeFixture('at-budget.webp', webpBytes(1600, 900, ARTICLE_VISUAL_MAX_BYTES)),
      width: 1600,
      height: 900,
    },
    tmpPublic,
    'desktop',
  ).length === 0,
);

const remote = {
  ...good,
  desktop: { ...goodDesktop, src: 'https://cdn.example.com/x.webp' },
};
check(
  'a remote image URL fails validation (repo-local only)',
  validateVisual(remote, tmpPublic).length > 0,
);

/* ── 5. alt and caption rules ─────────────────────────────────────────── */

check(
  'empty alt fails',
  validateVisual({ ...good, alt: '' }, tmpPublic).some((p) => p.startsWith('alt: empty')),
);
check(
  'label-length alt fails',
  validateVisual({ ...good, alt: 'CDL classes' }, tmpPublic).some((p) => p.includes('too short')),
);
check(
  'generic opener fails',
  validateVisual(
    { ...good, alt: 'Image showing the difference between Class A and Class B trucks.' },
    tmpPublic,
  ).some((p) => p.includes('generic filler')),
);
check(
  '"photo of"-style filler fails',
  validateVisual(
    {
      ...good,
      alt: 'A detailed photo of a Class A combination vehicle beside a Class B straight truck today.',
    },
    tmpPublic,
  ).some((p) => p.includes('filler')),
);
check(
  'caption is optional',
  validateVisual(good, tmpPublic).length === 0 && good.caption === undefined,
);
check(
  'an empty caption fails when present',
  validateVisual({ ...good, caption: '   ' }, tmpPublic).some((p) => p.includes('caption')),
);
check(
  'a caption duplicating the alt fails',
  validateVisual({ ...good, caption: GOOD_ALT }, tmpPublic).some((p) => p.includes('duplicates')),
);
check(
  'a caption wholly contained in the alt fails',
  validateVisual({ ...good, caption: 'weight thresholds that separate them.' }, tmpPublic).some(
    (p) => p.includes('contained'),
  ),
);

/* ── 6. desktop/mobile pairing ────────────────────────────────────────── */

check(
  'a mobile rendition pointing at the desktop file fails',
  validateVisual({ ...good, mobile: { ...goodDesktop } }, tmpPublic).some((p) =>
    p.includes('same file'),
  ),
);
check(
  'a desktop-only visual is valid (mobile is optional)',
  validateVisual({ desktop: goodDesktop, alt: GOOD_ALT }, tmpPublic).length === 0,
);

/* ── 7. the configured heading exists in the real article ─────────────── */

const seed055 = read('supabase/migrations/055_seed_kc_class_a_vs_class_b.sql');
const bodyMatch = /\$mdx\$([\s\S]*?)\$mdx\$/.exec(seed055);
check('055: the article body parses out of the migration', bodyMatch !== null);
const CLASS_AB_BODY = bodyMatch?.[1] ?? '';
const { html: classAbHtml } = renderMarkdown(CLASS_AB_BODY);

const pendingAb = PENDING_ARTICLE_VISUALS[CLASS_AB_KEY];
check(
  'the Class A vs B spec is present (pending or promoted)',
  !!pendingAb || !!ARTICLE_VISUALS[CLASS_AB_KEY],
);
const abSpec = ARTICLE_VISUALS[CLASS_AB_KEY] ?? pendingAb;

check(
  'the Class A vs B spec configures a heading anchor',
  typeof abSpec?.afterHeadingId === 'string',
);
check(
  'the configured heading id exists in the rendered article',
  !!abSpec?.afterHeadingId && new RegExp(`id="${abSpec.afterHeadingId}"`).test(classAbHtml),
  abSpec?.afterHeadingId,
);
check(
  'the anchor is the at-a-glance comparison heading',
  abSpec?.afterHeadingId === 'class-a-vs-class-b-at-a-glance',
  abSpec?.afterHeadingId,
);
check(
  'the spec declares the blueprint renditions (1600×900 + 1080×1350 WebP)',
  abSpec?.desktop.width === 1600 &&
    abSpec?.desktop.height === 900 &&
    abSpec?.mobile?.width === 1080 &&
    abSpec?.mobile?.height === 1350 &&
    abSpec?.desktop.src === `${ARTICLE_IMAGE_DIR}class-a-vs-class-b-cdl-comparison.webp` &&
    abSpec?.mobile?.src === `${ARTICLE_IMAGE_DIR}class-a-vs-class-b-cdl-comparison-mobile.webp`,
  abSpec,
);

// Accessibility floor: the article prose must carry every regulatory fact the
// graphic shows, so the image is never the sole source of a rule.
for (const fact of ['26,001', '10,000', '383.91']) {
  check(
    `the article text states "${fact}" independently of the graphic`,
    CLASS_AB_BODY.includes(fact),
  );
}

/* ── 8. splitting never alters the body ───────────────────────────────── */

const split = splitHtmlAfterHeading(classAbHtml, 'class-a-vs-class-b-at-a-glance');
check('the split finds the configured heading', split !== null);
check(
  'the two halves reconstitute the body byte-for-byte',
  !!split && split.before + split.after === classAbHtml,
);
check('the split cuts AFTER the heading element', !!split && /<\/h2>$/.test(split.before));
check(
  'the comparison list survives, in the second half',
  !!split && /<ul[^>]*>/.test(split.after) && split.after.includes('Vehicle type:'),
);
check(
  'an unknown heading id yields no split',
  splitHtmlAfterHeading(classAbHtml, 'not-a-heading') === null,
);
check(
  'a regex-special heading id cannot break the matcher',
  splitHtmlAfterHeading(classAbHtml, 'a.*b') === null,
);

/* ── 9. the figure component's own output ─────────────────────────────── */

const figureHtml = renderToStaticMarkup(
  createElement(ArticleFigure, {
    visual: { ...good, caption: 'A verified caption citing 49 CFR 383.91.' },
  }),
);
check('renders a <figure>', /^<figure/.test(figureHtml));
check('renders a <figcaption> when a caption is configured', /<figcaption/.test(figureHtml));
check(
  'the caption text is real HTML, not baked into the image',
  figureHtml.includes('49 CFR 383.91'),
);
check('carries the alt text', figureHtml.includes(GOOD_ALT));
check(
  'reserves width and height on the img',
  /<img[^>]*width="1080"/.test(figureHtml) && /<img[^>]*height="1350"/.test(figureHtml),
);
check('lazy-loads (below the fold, never the LCP element)', /loading="lazy"/.test(figureHtml));
check(
  'never marks itself priority/eager',
  !/fetchpriority|fetchPriority/i.test(figureHtml) && !/loading="eager"/.test(figureHtml),
);
check('declares responsive sizes', /sizes="[^"]+"/.test(figureHtml));
check('art-directs through one <picture>', (figureHtml.match(/<picture>/g) ?? []).length === 1);
check(
  'the desktop rendition is the sm-and-up source',
  /<source media="\(min-width: 640px\)"/.test(figureHtml) &&
    /good\.webp/.test(figureHtml.split('<img')[0]),
);
check(
  'the mobile rendition is the default img (phones never fetch the master)',
  /<img[^>]*src="[^"]*good-mobile\.webp/.test(
    figureHtml.replace(/&amp;/g, '&').replace(/%2F/g, '/'),
  ),
);
check(
  'the frame reserves both aspect ratios',
  /kc-figure-frame/.test(figureHtml) &&
    /--kc-figure-ratio-mobile:1080 \/ 1350/.test(figureHtml) &&
    /--kc-figure-ratio-desktop:1600 \/ 900/.test(figureHtml),
);
check(
  'the diagram is never cropped',
  /object-contain/.test(figureHtml) && !/object-cover/.test(figureHtml),
);
check('no third-party script or iframe', !/<script|<iframe/i.test(figureHtml));

const noCaption = renderToStaticMarkup(createElement(ArticleFigure, { visual: good }));
check('no <figcaption> when no caption is configured', !/<figcaption/.test(noCaption));

const single = renderToStaticMarkup(
  createElement(ArticleFigure, { visual: { desktop: goodDesktop, alt: GOOD_ALT } }),
);
check('a single-rendition figure uses plain next/image (no <picture>)', !/<picture>/.test(single));
check(
  'a single-rendition figure still reserves its box',
  /width="1600"/.test(single) && /height="900"/.test(single),
);
check('a single-rendition figure lazy-loads', /loading="lazy"/.test(single));
check('a single-rendition figure needs no ratio variables', !/kc-figure-frame/.test(single));

check(
  'globals.css carries the frame rule at the same breakpoint the component uses',
  /\.kc-figure-frame\s*\{[^}]*--kc-figure-ratio-mobile/.test(read('src/app/globals.css')) &&
    /@media \(min-width: 640px\)[\s\S]{0,160}--kc-figure-ratio-desktop/.test(
      read('src/app/globals.css'),
    ) &&
    /\(min-width: 640px\)/.test(shipped(FIGURE)),
);
// Comment-stripped: the component's own docs discuss the absence of the
// directive, and that sentence must not read as the directive itself.
check(
  'the figure is a server component (no client JS)',
  !/['"]use client['"]/.test(shipped(FIGURE)),
);
check(
  'the figure uses no React hooks',
  !/\buse(State|Effect|Ref|Memo|Callback|Context)\b/.test(shipped(FIGURE)),
);

/* ── 10. the real page: placement, metadata, schema ───────────────────── */

const CATEGORY: KcCategory = {
  id: 'cat-gyc',
  slug: 'getting-your-cdl',
  name: 'Getting Your CDL',
  description: 'The road from zero to CDL.',
  intro_md: null,
  icon: 'map',
  sort_order: 6,
  meta_title: null,
  meta_description: null,
};
const ARTICLE_ROW: KcArticle = {
  id: 'art-ab',
  slug: 'class-a-vs-class-b-cdl',
  category_id: CATEGORY.id,
  title: 'Class A vs Class B CDL: Which One Should You Get?',
  excerpt: 'Class A or Class B is the first real decision of a trucking career.',
  body_mdx: CLASS_AB_BODY,
  meta_title: 'Class A vs Class B CDL: Which One Should You Get? | Trucking Life with Shawn',
  meta_description:
    'Class A covers combinations with trailers over 10,000 lb; Class B covers heavy single trucks.',
  hero_image_url: null,
  author_name: 'Shawn Gresham',
  author_bio: 'CDL-A driver and instructor — 17 years driving, zero violations.',
  sources: [],
  faqs: [{ q: 'Can I drive a tractor-trailer with a Class B CDL?', a: 'No.' }],
  tags: ['getting-your-cdl'],
  reading_time_min: 8,
  featured: false,
  reg_verified: true,
  reg_verified_date: '2026-08-19',
  published_at: '2026-08-19T15:00:00Z',
  updated_at: '2026-08-19T15:00:00Z',
};
/** A second article that must keep rendering exactly as it did pre-KC-VIS-1. */
const PLAIN_ROW: KcArticle = {
  ...ARTICLE_ROW,
  id: 'art-cost',
  slug: 'cdl-cost',
  title: 'What Does It Cost to Get a CDL?',
  meta_title: 'What Does It Cost to Get a CDL?',
  body_mdx: '## Costs at a glance\n\nTuition varies by school.\n\n- **Tuition:** varies\n',
};
/** kc_related rows carry their joined card so getRelated returns without a tag scan. */
const RELATED_ROWS = [1, 2, 3].map((i) => ({
  article_id: 'art-ab',
  related_id: `rel-${i}`,
  sort_order: i,
  kc_articles: {
    id: `rel-${i}`,
    slug: `related-${i}`,
    title: `Related ${i}`,
    excerpt: null,
    category_id: CATEGORY.id,
    reading_time_min: 5,
    published_at: '2026-08-01T00:00:00Z',
  },
}));

function installFixtures() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({
    kc_categories: [CATEGORY as unknown as Record<string, unknown>],
    kc_articles: [
      ARTICLE_ROW as unknown as Record<string, unknown>,
      PLAIN_ROW as unknown as Record<string, unknown>,
    ],
    kc_related: RELATED_ROWS as unknown as Record<string, unknown>[],
  });
}

async function renderArticle(categorySlug: string, slug: string): Promise<string> {
  installFixtures();
  const tree = await ArticlePage({ params: { category: categorySlug, slug } });
  return renderToStaticMarkup(tree as React.ReactElement);
}

async function pageChecks() {
  const AB_PATH = '/knowledge/getting-your-cdl/class-a-vs-class-b-cdl';

  /* --- an article with NO registered visual: pre-KC-VIS-1 behavior, unchanged.
     Demonstrated on cdl-cost rather than on Class A vs B, which now carries
     real approved artwork — the no-visual contract has to be proved against an
     article that genuinely has none, or it proves nothing. --- */
  const plainBefore = await renderArticle('getting-your-cdl', 'cdl-cost');
  const PLAIN_PATH = '/knowledge/getting-your-cdl/cdl-cost';
  check(
    'article without a visual renders no figure',
    !/kc-figure-frame|<figcaption/.test(plainBefore),
  );
  check(
    'article without a visual keeps one body block',
    (plainBefore.match(/class="mt-8 text-lg"/g) ?? []).length === 1,
  );
  check(
    'article without a visual still renders its body',
    plainBefore.includes('Costs at a glance'),
  );

  installFixtures();
  const metaBefore: Metadata = await kcArticleMetadata({
    params: { category: 'getting-your-cdl', slug: 'cdl-cost' },
  });
  check('with no visual, no og:image is asserted', metaBefore.openGraph?.images === undefined);
  check(
    'with no visual, Article schema carries no image',
    (articleSchema(PLAIN_ROW, CATEGORY, `${SITE.url}${PLAIN_PATH}`) as { image?: string }).image ===
      undefined,
  );

  /* --- the live registration drives the render. Assigning here keeps the
     block self-contained if the entry is ever pending again; the prior value
     is restored afterwards so the harness never mutates real state. --- */
  const priorRegistration = Object.hasOwn(ARTICLE_VISUALS, CLASS_AB_KEY)
    ? ARTICLE_VISUALS[CLASS_AB_KEY]
    : null;
  ARTICLE_VISUALS[CLASS_AB_KEY] = abSpec as ArticleVisual;
  try {
    const after = await renderArticle('getting-your-cdl', 'class-a-vs-class-b-cdl');

    check('registered article renders the figure', /kc-figure-frame/.test(after));
    const headingIdx = after.indexOf('id="class-a-vs-class-b-at-a-glance"');
    const figureIdx = after.indexOf('kc-figure-frame');
    const listIdx = after.indexOf('Vehicle type:');
    check(
      'the figure renders AFTER the configured heading',
      headingIdx > -1 && figureIdx > headingIdx,
      {
        headingIdx,
        figureIdx,
      },
    );
    check('the figure renders BEFORE the comparison list it introduces', listIdx > figureIdx, {
      figureIdx,
      listIdx,
    });
    check(
      'the comparison list is untouched',
      after.includes('Vehicle type:') && after.includes('Trailer threshold:'),
    );
    check(
      'the regulatory text is unchanged by the insertion',
      after.includes('26,001') && after.includes('over 10,000 pounds') && after.includes('383.91'),
    );
    check(
      'the body is split into exactly two blocks',
      (after.match(/text-lg"/g) ?? []).length === 2,
    );
    check(
      'the figure carries the registry alt text',
      after.includes((abSpec as ArticleVisual).alt.slice(0, 60)),
    );
    check('the figure carries the registry caption', after.includes('The trailer draws the line'));
    check(
      'the rendered figure reserves dimensions',
      /<img[^>]*width="1080"[^>]*height="1350"/.test(after),
    );
    check('the rendered figure lazy-loads', /loading="lazy"/.test(after));
    check(
      'the mobile rendition is served to phones',
      after
        .replace(/&amp;/g, '&')
        .replace(/%2F/g, '/')
        .includes('class-a-vs-class-b-cdl-comparison-mobile.webp'),
    );
    check(
      'the desktop master is the sm-and-up source',
      after
        .replace(/&amp;/g, '&')
        .replace(/%2F/g, '/')
        .includes('class-a-vs-class-b-cdl-comparison.webp'),
    );
    check('no video markup is introduced', !/<iframe|youtube|VideoObject/i.test(after));

    /* other articles are untouched by another article's registration */
    const plainAfter = await renderArticle('getting-your-cdl', 'cdl-cost');
    check('an article with no visual renders byte-identically', plainAfter === plainBefore);

    /* metadata + schema + OG all resolve to ONE canonical URL */
    const expected = `${SITE.url}${(abSpec as ArticleVisual).desktop.src}`;
    installFixtures();
    const metaAfter: Metadata = await kcArticleMetadata({
      params: { category: 'getting-your-cdl', slug: 'class-a-vs-class-b-cdl' },
    });
    const ogImages = metaAfter.openGraph?.images as { url?: string }[] | undefined;
    const twImages = (metaAfter.twitter as { images?: string[] } | undefined)?.images;
    check('og:image is the registry master', ogImages?.[0]?.url === expected, ogImages);
    check('twitter:image is the same URL', twImages?.[0] === expected, twImages);
    const schema = articleSchema(ARTICLE_ROW, CATEGORY, `${SITE.url}${AB_PATH}`) as {
      image?: string;
    };
    check('Article.image is the same URL', schema.image === expected, schema.image);
    check(
      'all three surfaces resolve to ONE stable repo-local asset',
      new Set([ogImages?.[0]?.url, twImages?.[0], schema.image]).size === 1 &&
        expected.startsWith(`${SITE.url}${ARTICLE_IMAGE_DIR}`),
    );
    check(
      'the inline figure and the advertised image are the same file',
      after
        .replace(/&amp;/g, '&')
        .replace(/%2F/g, '/')
        .includes((abSpec as ArticleVisual).desktop.src),
    );

    /* hero_image_url keeps precedence when a row has one */
    const withHero = { ...ARTICLE_ROW, hero_image_url: 'https://cdn.example.com/hero.webp' };
    check(
      'a DB hero_image_url still wins over the registry',
      articleImageUrl(withHero.hero_image_url, abSpec as ArticleVisual) ===
        'https://cdn.example.com/hero.webp',
    );
    check(
      'Article schema honours that precedence too',
      (articleSchema(withHero, CATEGORY, `${SITE.url}${AB_PATH}`) as { image?: string }).image ===
        'https://cdn.example.com/hero.webp',
    );
    check(
      'no visual and no hero yields no image at all',
      articleImageUrl(null, null) === undefined,
    );
  } finally {
    if (priorRegistration) ARTICLE_VISUALS[CLASS_AB_KEY] = priorRegistration;
    else delete ARTICLE_VISUALS[CLASS_AB_KEY];
  }
  check(
    'the harness leaves the registry exactly as it found it',
    Object.hasOwn(ARTICLE_VISUALS, CLASS_AB_KEY) === !!priorRegistration,
  );
}

/* ── 11. scope guards — what KC-VIS-1 must NOT have done ──────────────── */

function scopeChecks() {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));
  check(
    'no migration mentions article visuals (no DB change in this milestone)',
    !migrations.some((m) => /article[-_]visual/i.test(read(`supabase/migrations/${m}`))),
  );
  check(
    'the registry performs no database access',
    !/supabase|createClient|from\('kc_/.test(read(REGISTRY)),
  );
  check(
    'the KC article types are unchanged (no new column)',
    !/article_visual|visual_slug/.test(read('src/lib/kc/types.ts')),
  );
  check(
    'the markdown renderer still supports no images or embeds',
    !/!\[|<img|<iframe|<picture/i.test(read('src/lib/kc/mdx.ts')),
  );
  for (const f of [REGISTRY, FIGURE, ARTICLE_PAGE]) {
    check(
      `${path.basename(f)} adds no video support`,
      !/iframe|youtube|VideoObject|<video/i.test(shipped(f)),
    );
  }
  check('no VideoObject schema anywhere', !FILES.some((f) => /VideoObject/.test(shipped(f))));
  check(
    'the sitemap architecture is untouched by this milestone',
    !/article-visuals|ArticleFigure/.test(read('src/lib/seo/sitemap-entries.ts')),
  );
  check(
    'no image sitemap was added',
    !/image:image|image:loc/i.test(read('src/lib/seo/sitemap-entries.ts')),
  );
  check(
    'Navigator is untouched',
    !FILES.filter((f) => f.includes('/navigator')).some((f) =>
      /article-visuals|ArticleFigure/.test(shipped(f)),
    ),
  );
  check(
    'the SEO Scout is untouched',
    !fs
      .readdirSync(path.join(root, 'scripts/seo-scout'))
      .some((f) => /article-visuals|ArticleFigure/.test(read(`scripts/seo-scout/${f}`))),
  );
  check(
    'no new remote image host was allowed',
    (read('next.config.mjs').match(/hostname:/g) ?? []).length === 2,
  );
  check(
    'the category banner system is untouched',
    !/article-visuals/.test(read('src/lib/kc/category-visuals.ts')),
  );
  check(
    'the Organization/publisher schema is untouched',
    !/logo/.test(read('src/lib/seo/schema.tsx')),
  );
}

/* ── run ──────────────────────────────────────────────────────────────── */

pageChecks()
  .then(() => {
    scopeChecks();
  })
  .catch((err) => {
    failed++;
    console.log('FAIL: page/schema checks threw', err);
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`kc-article-visuals: ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
  });

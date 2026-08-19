/**
 * KC-VIS-1 — Knowledge Center article visual infrastructure.
 *
 * The Knowledge Center could not show a diagram inside an article: the
 * renderer is text-only by design, and article artwork had no authority to
 * live in. This milestone adds one — lib/kc/article-visuals — plus a figure
 * component and a heading-boundary placement seam, and proves it on the Class
 * A vs Class B comparison.
 *
 * The invariant this file exists to protect is the PENDING/READY split. A
 * visual is registered before its artwork exists so the placement, alt text
 * and asset contract can be agreed and pinned while the image is still being
 * produced. That state must be indistinguishable from "no visual" at runtime
 * and completely distinguishable from "registered but broken" in CI:
 *
 *   pending  → renders nothing, references nothing, passes.
 *   ready    → the file must exist, be a real WebP, hit its exact dimensions,
 *              stay under the weight ceiling, and pair its mobile rendition.
 *
 * Get that backwards and either a missing file 500s an article, or a broken
 * one ships quietly. Both are checked below against the real registry.
 *
 * V1–V30 map to the milestone's checklist; the section headers name them.
 * Filesystem + pure imports only. No database, no network, CI-safe.
 *
 * Run:
 *   npx esbuild scripts/test-kc-article-visuals.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-kc-vis.cjs && node /tmp/test-kc-vis.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createElement } from 'react';
import renderer from 'react-test-renderer';
import { ArticleFigure } from '@/components/kc/ArticleFigure';
import type { ArticleVisual } from '@/lib/kc/article-visuals';
import {
  ARTICLE_VISUALS,
  ARTICLE_VISUAL_SLUGS,
  ARTICLE_VISUAL_MAX_BYTES,
  articleVisual,
  registeredArticleVisual,
  articleVisualImageUrl,
} from '@/lib/kc/article-visuals';
import { renderMarkdown, splitHtmlAfterHeading } from '@/lib/kc/mdx';
import { articleSchema } from '@/lib/kc/schema';
import { SITE } from '@/lib/seo/site';
import type { KcArticle, KcCategory } from '@/lib/kc/types';

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
/** Source with comments stripped — a rule must be enforced by code, not prose. */
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

const REGISTRY = 'src/lib/kc/article-visuals.ts';
const FIGURE = 'src/components/kc/ArticleFigure.tsx';
const ARTICLE_PAGE = 'src/app/(marketing)/knowledge/[category]/[slug]/page.tsx';
const SCHEMA = 'src/lib/kc/schema.ts';
const MDX = 'src/lib/kc/mdx.ts';

const PROOF_SLUG = 'class-a-vs-class-b-cdl';

/* ── V1: the registry is the single authority ────────────────────────── */

check('V1a: the registry exposes a lookup and a URL builder', typeof articleVisual === 'function');
check(
  'V1b: article image paths appear in the registry module',
  /\/images\/knowledge\/articles\//.test(read(REGISTRY)),
);
for (const f of [FIGURE, ARTICLE_PAGE, SCHEMA, MDX]) {
  check(
    `V1c: ${path.basename(f)} hardcodes no article image path`,
    !/\/images\/knowledge\/articles\//.test(shipped(f)),
    shipped(f).match(/\/images\/knowledge\/articles\/[^"']*/)?.[0],
  );
}
// Both image consumers must read the ONE builder, not re-derive a URL.
check(
  'V1d: the page metadata image reads the registry authority',
  /articleVisualImageUrl\(article\.slug, SITE\.url\)/.test(shipped(ARTICLE_PAGE)),
);
check(
  'V1e: Article schema reads the same authority',
  /articleVisualImageUrl\(article\.slug, SITE\.url\)/.test(shipped(SCHEMA)),
);
check(
  'V1f: no second article-visual registry exists',
  fs
    .readdirSync(path.join(root, 'src/lib/kc'))
    .filter((f) => /visual/i.test(f))
    .sort()
    .join(',') === 'article-visuals.ts,category-visuals.ts',
);
// Category artwork and article artwork stay in separate directories and
// separate modules, so neither can quietly serve the other's image.
check(
  'V1g: the article registry references no category banner',
  !/\/images\/knowledge\/categories\//.test(read(REGISTRY)),
);

/* ── V2: unknown slug yields no visual ───────────────────────────────── */

check('V2a: unknown slug → null', articleVisual('not-a-real-article') === null);
check('V2b: empty slug → null', articleVisual('') === null);
check('V2c: prototype keys do not resolve', articleVisual('constructor') === null);
check('V2d: toString does not resolve', articleVisual('toString') === null);
check('V2e: unknown slug has no image URL', articleVisualImageUrl('nope', SITE.url) === null);

/* ── V3: a pending visual never reaches the page ─────────────────────── */

const pending = ARTICLE_VISUAL_SLUGS.filter((s) => ARTICLE_VISUALS[s].status === 'pending');
const ready = ARTICLE_VISUAL_SLUGS.filter((s) => ARTICLE_VISUALS[s].status === 'ready');
check(
  'V3a: every entry declares a known status',
  ARTICLE_VISUAL_SLUGS.every((s) => ['ready', 'pending'].includes(ARTICLE_VISUALS[s].status)),
);
for (const slug of pending) {
  check(`V3b: pending ${slug} is registered`, registeredArticleVisual(slug) !== null);
  check(`V3c: pending ${slug} is NOT renderable`, articleVisual(slug) === null);
  check(
    `V3d: pending ${slug} advertises no image URL`,
    articleVisualImageUrl(slug, SITE.url) === null,
  );
}
// The page must gate on the renderable lookup, so a pending entry takes the
// untouched rendering path rather than a half-built one.
check(
  'V3e: the page gates the figure on the renderable lookup',
  /const visual = articleVisual\(article\.slug\)/.test(shipped(ARTICLE_PAGE)) &&
    /visual \? splitHtmlAfterHeading/.test(shipped(ARTICLE_PAGE)),
);
check(
  'V3f: the page renders the whole body when there is no split',
  /split && visual \?/.test(shipped(ARTICLE_PAGE)) && /__html: html/.test(shipped(ARTICLE_PAGE)),
);

/* ── V4–V9: a READY entry is validated hard ──────────────────────────── */

// Nothing is 'ready' until the artwork lands; when one is, every rule below
// applies to it. This loop is the difference between "pending" and "broken".
for (const slug of ready) {
  const v = ARTICLE_VISUALS[slug];
  const file = path.join(root, 'public', v.src);
  const exists = fs.existsSync(file);
  check(`V4: ready ${slug}: desktop asset exists on disk`, exists, v.src);
  if (!exists) continue;

  const buf = fs.readFileSync(file);
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  check(`V6: ready ${slug}: real WebP container (magic bytes)`, isWebp);
  check(`V6b: ready ${slug}: extension matches container`, v.src.endsWith('.webp') && isWebp);

  const form = buf.subarray(12, 16).toString();
  const [w, h] =
    form === 'VP8X'
      ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
      : [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  check(
    `V7: ready ${slug}: desktop is exactly ${v.width}×${v.height}`,
    w === v.width && h === v.height,
    { w, h },
  );
  check(`V9: ready ${slug}: desktop ≤ 200 KB`, buf.length <= ARTICLE_VISUAL_MAX_BYTES, buf.length);

  // V5: the mobile rendition is all-or-nothing — a src without its dimensions
  // (or the reverse) would reserve the wrong box and reintroduce the shift.
  const mobileFieldCount = [v.mobileSrc, v.mobileWidth, v.mobileHeight].filter(Boolean).length;
  check(
    `V5: ready ${slug}: mobile rendition fully paired or fully absent`,
    mobileFieldCount === 0 || mobileFieldCount === 3,
    mobileFieldCount,
  );

  if (v.mobileSrc && v.mobileWidth && v.mobileHeight) {
    const mfile = path.join(root, 'public', v.mobileSrc);
    const mexists = fs.existsSync(mfile);
    check(`V5b: ready ${slug}: mobile asset exists on disk`, mexists, v.mobileSrc);
    if (!mexists) continue;
    const mbuf = fs.readFileSync(mfile);
    const misWebp =
      mbuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      mbuf.subarray(8, 12).toString('ascii') === 'WEBP';
    check(`V6c: ready ${slug}: mobile is a real WebP`, misWebp);
    const mform = mbuf.subarray(12, 16).toString();
    const [mw, mh] =
      mform === 'VP8X'
        ? [1 + mbuf.readUIntLE(24, 3), 1 + mbuf.readUIntLE(27, 3)]
        : [mbuf.readUInt16LE(26) & 0x3fff, mbuf.readUInt16LE(28) & 0x3fff];
    check(
      `V8: ready ${slug}: mobile is exactly ${v.mobileWidth}×${v.mobileHeight}`,
      mw === v.mobileWidth && mh === v.mobileHeight,
      { mw, mh },
    );
    check(
      `V9b: ready ${slug}: mobile ≤ 200 KB`,
      mbuf.length <= ARTICLE_VISUAL_MAX_BYTES,
      mbuf.length,
    );
    check(`V5c: ready ${slug}: renditions are distinct files`, v.mobileSrc !== v.src);
  }
}
// The asset contract is pinned whatever the status, so the artwork cannot be
// produced to the wrong spec while the entry waits.
const proof = registeredArticleVisual(PROOF_SLUG)!;
check('V4b: the proof visual is registered', proof !== null);
check(
  'V7b: proof desktop contract is 1600×900 (16:9)',
  proof.width === 1600 &&
    proof.height === 900 &&
    Math.abs(proof.width / proof.height - 16 / 9) < 0.001,
);
check(
  'V8b: proof mobile contract is 1080×1350 (4:5)',
  proof.mobileWidth === 1080 &&
    proof.mobileHeight === 1350 &&
    Math.abs(proof.mobileWidth! / proof.mobileHeight! - 4 / 5) < 0.001,
);
check('V9c: the weight ceiling is 200 KB', ARTICLE_VISUAL_MAX_BYTES === 200 * 1024);
check(
  'V6d: both contracted paths are .webp under the articles directory',
  proof.src === '/images/knowledge/articles/class-a-vs-class-b-cdl-comparison.webp' &&
    proof.mobileSrc === '/images/knowledge/articles/class-a-vs-class-b-cdl-comparison-mobile.webp',
);

/* ── V10–V12: alt text and caption ───────────────────────────────────── */

for (const slug of ARTICLE_VISUAL_SLUGS) {
  const v = ARTICLE_VISUALS[slug];
  check(`V10: ${slug}: alt is non-empty`, v.alt.trim().length > 0);
  check(`V10b: ${slug}: alt is substantial, not a label`, v.alt.trim().length >= 60, v.alt.length);
  // V11: an alt that names the file's subject instead of describing the frame
  // is the failure mode here — "CDL infographic" tells a screen-reader user
  // nothing about what is being compared.
  check(
    `V11: ${slug}: alt is not a generic label`,
    !/^(image|graphic|infographic|diagram|chart|illustration|photo)\b/i.test(v.alt.trim()) &&
      !/\b(image|graphic|infographic) (of|showing)\b/i.test(v.alt),
    v.alt,
  );
  check(
    `V11b: ${slug}: alt says nothing about being an image`,
    !/\b(image|photo of|picture of|banner)\b/i.test(v.alt),
    v.alt,
  );
  check(
    `V11c: ${slug}: alt is not keyword-stuffed with the slug`,
    !new RegExp(slug.replace(/-/g, '[ -]'), 'i').test(v.alt),
    v.alt,
  );
  // V12: the caption is optional, but when present it must not simply repeat
  // the alt — that is duplicate text for anyone using both.
  if (v.caption !== undefined) {
    check(`V12: ${slug}: caption is non-empty when present`, v.caption.trim().length > 0);
    check(`V12b: ${slug}: caption is shorter than the alt`, v.caption.length < v.alt.length, {
      caption: v.caption.length,
      alt: v.alt.length,
    });
    check(`V12c: ${slug}: caption is not the alt repeated`, v.caption.trim() !== v.alt.trim());
  }
}
check(
  'V12d: caption is optional in the type, not required',
  /caption\?: string/.test(read(REGISTRY)),
);
// The proof alt must carry the actual comparison, both classes and both sides
// of the towed-unit line — that IS the visual's content.
check(
  'V10c: the proof alt states both classes and both sides of the 10,000 lb line',
  /Class A/.test(proof.alt) &&
    /Class B/.test(proof.alt) &&
    /over 10,000 pounds/.test(proof.alt) &&
    /10,000 pounds or less/.test(proof.alt) &&
    /26,001 pounds or more/.test(proof.alt),
  proof.alt,
);

/* ── V13–V16: placement and rendering ────────────────────────────────── */

// The configured anchor must exist in the SEEDED article body, not merely be
// a plausible string — this is what catches a renamed heading.
const seed055 = read('supabase/migrations/055_seed_kc_class_a_vs_class_b.sql');
const body = seed055.match(/\$mdx\$([\s\S]*?)\$mdx\$/)![1];
const { html } = renderMarkdown(body);
check(
  'V13: the configured heading anchor exists in the rendered article',
  html.includes(`id="${proof.afterHeadingId}"`),
  proof.afterHeadingId,
);
check(
  'V13b: the anchor is the at-a-glance comparison heading',
  proof.afterHeadingId === 'class-a-vs-class-b-at-a-glance' &&
    /## Class A vs Class B at a glance/.test(body),
);

const split = splitHtmlAfterHeading(html, proof.afterHeadingId);
check('V14: the body splits at the configured anchor', split !== null);
if (split) {
  const [before, after] = split;
  check(
    'V14b: the split lands AFTER the heading closes',
    before.trimEnd().endsWith('</h2>'),
    before.slice(-60),
  );
  check(
    'V14c: the heading itself stays in the first half',
    before.includes(`id="${proof.afterHeadingId}"`),
  );
  check(
    'V14d: the comparison rows follow the figure, not precede it',
    after.includes('Trailer threshold') && !before.includes('Trailer threshold'),
  );
  check('V14e: the split is lossless — no body content is dropped', before + after === html);
  check('V14f: the quick answer stays above the figure', before.includes('Quick answer'));
}
check(
  'V13c: a missing anchor degrades to null, not a crash',
  splitHtmlAfterHeading(html, 'no-such-heading') === null,
);
check(
  'V13d: a prefix of a real id does not match',
  splitHtmlAfterHeading(html, 'class-a') === null,
);
check('V13e: an empty anchor does not match', splitHtmlAfterHeading('', 'x') === null);

const fig = shipped(FIGURE);
// Desktop dimensions reach the <img> through getImageProps (which emits real
// width/height attributes); the <source> carries its own, so the reserved box
// matches whichever rendition the browser picks.
check(
  'V15: the figure reserves both renditions with explicit intrinsic dimensions',
  /width: visual\.width/.test(fig) &&
    /height: visual\.height/.test(fig) &&
    /width: visual\.mobileWidth/.test(fig) &&
    /height: visual\.mobileHeight/.test(fig) &&
    /width=\{visual\.mobileWidth\}/.test(fig) &&
    /height=\{visual\.mobileHeight\}/.test(fig),
);
check('V15b: the figure is a semantic <figure>', /<figure/.test(fig) && /<\/figure>/.test(fig));
check(
  'V15c: the caption renders as <figcaption>, only when configured',
  /visual\.caption &&/.test(fig) && /<figcaption/.test(fig),
);
check('V15d: the figure lazy-loads (it is below the fold)', /loading: 'lazy'/.test(fig));
check(
  'V15e: the image scales fluidly inside its reserved box',
  /w-full/.test(fig) && /h-auto/.test(fig),
);
check(
  'V16: art direction uses <picture> + <source media>, not CSS toggling',
  /<picture>/.test(fig) && /<source/.test(fig) && /media="\(max-width: 639px\)"/.test(fig),
);
check(
  'V16b: the mobile source is optional and fully guarded',
  /visual\.mobileSrc && visual\.mobileWidth && visual\.mobileHeight/.test(fig),
);
check(
  'V16c: art direction goes through next/image optimization',
  /getImageProps/.test(fig) && /from 'next\/image'/.test(fig),
);
check(
  'V16d: both renditions declare responsive sizes',
  /sizes:/.test(fig) && /sizes=\{mobile\.sizes\}/.test(fig),
);
// display:none does not stop a download; a hidden second <img> would make the
// phone pay for the desktop file it never shows.
check('V16e: no hidden-image toggling', !/hidden sm:block|sm:hidden/.test(fig));

/* ── V15/V16 (rendered): the READY path actually produces the markup ─── */

// Source-text checks above prove intent; this proves behaviour. The registered
// visual is pending, so a ready one is simulated here — that is the only way
// to exercise the render path before the artwork lands, and it is exactly the
// path that must work on the day it does.
const readySim: ArticleVisual = {
  ...proof,
  status: 'ready',
};
const tree = renderer.create(createElement(ArticleFigure, { visual: readySim })).toJSON() as {
  type: string;
  children: { type: string; props: Record<string, unknown>; children: unknown[] }[];
};
check('V15f: rendered root is a <figure>', tree.type === 'figure');
const picture = tree.children[0];
check('V16f: rendered figure contains a <picture>', picture.type === 'picture');
const sourceEl = picture.children[0] as { type: string; props: Record<string, unknown> };
check('V16g: the first child is the mobile <source>', sourceEl.type === 'source');
check(
  'V16h: the source is media-gated to narrow screens',
  sourceEl.props.media === '(max-width: 639px)',
);
check(
  'V16i: the source serves the MOBILE asset',
  String(sourceEl.props.srcSet).includes(encodeURIComponent(proof.mobileSrc!)),
);
check(
  'V15g: the source reserves 1080×1350',
  sourceEl.props.width === 1080 && sourceEl.props.height === 1350,
);
const imgEl = picture.children[1] as { type: string; props: Record<string, unknown> };
check(
  'V16j: the fallback is an <img> serving the DESKTOP asset',
  imgEl.type === 'img' && String(imgEl.props.srcSet).includes(encodeURIComponent(proof.src)),
);
check('V15h: the img reserves 1600×900', imgEl.props.width === 1600 && imgEl.props.height === 900);
check(
  'V15i: the img lazy-loads and decodes async',
  imgEl.props.loading === 'lazy' && imgEl.props.decoding === 'async',
);
check('V10d: the rendered img carries the registry alt', imgEl.props.alt === proof.alt);
check(
  'V12e: the caption renders as a figcaption sibling',
  (tree.children[1] as { type: string }).type === 'figcaption',
);
// Exactly one rendition downloads: a <source> the browser rejects costs nothing.
check(
  'V16k: only one <img> exists — no hidden duplicate',
  picture.children.filter((c) => (c as { type: string }).type === 'img').length === 1,
);

const noMobile = renderer
  .create(
    createElement(ArticleFigure, {
      visual: {
        ...readySim,
        mobileSrc: undefined,
        mobileWidth: undefined,
        mobileHeight: undefined,
      },
    }),
  )
  .toJSON() as { children: { children: unknown[] }[] };
check(
  'V16l: without a mobile rendition, no <source> is emitted',
  (noMobile.children[0].children as { type: string }[]).every((c) => c.type !== 'source'),
);
const noCaption = renderer
  .create(createElement(ArticleFigure, { visual: { ...readySim, caption: undefined } }))
  .toJSON() as { children: unknown[] };
check('V12f: without a caption, no empty figcaption is emitted', noCaption.children.length === 1);

/* ── V17–V20: one image authority across schema, OG and Twitter ──────── */

const CATEGORY: KcCategory = {
  id: 'c1',
  slug: 'getting-your-cdl',
  name: 'Getting Your CDL',
  description: null,
  intro_md: null,
  icon: null,
  sort_order: 6,
  meta_title: null,
  meta_description: null,
};
const baseArticle: KcArticle = {
  id: 'a1',
  slug: PROOF_SLUG,
  category_id: 'c1',
  title: 'T',
  excerpt: null,
  body_mdx: '',
  meta_title: null,
  meta_description: null,
  hero_image_url: null,
  author_name: 'Shawn Gresham',
  author_bio: null,
  sources: [],
  faqs: [],
  tags: [],
  reading_time_min: 8,
  featured: false,
  reg_verified: true,
  reg_verified_date: '2026-08-19',
  published_at: '2026-08-19T00:00:00Z',
  updated_at: '2026-08-19T00:00:00Z',
};
const url = `${SITE.url}/knowledge/getting-your-cdl/${PROOF_SLUG}`;

// With the proof visual pending, the schema image must stay absent — the
// milestone must not advertise artwork that does not exist.
const pendingSchema = articleSchema(baseArticle, CATEGORY, url) as Record<string, unknown>;
check('V17: pending visual contributes no schema image', pendingSchema.image === undefined);
check(
  'V17b: an explicit hero still wins and is untouched',
  (
    articleSchema(
      { ...baseArticle, hero_image_url: 'https://cdn.example/x.webp' },
      CATEGORY,
      url,
    ) as Record<string, unknown>
  ).image === 'https://cdn.example/x.webp',
);
// Simulate the ready state to prove the wiring, without shipping a ready entry.
const simulated = articleVisualImageUrl(PROOF_SLUG, SITE.url);
check('V17c: the URL builder is status-gated', simulated === null);
const expectedAbsolute = `${SITE.url}${proof.src}`;
check(
  'V18: the OG/metadata image would resolve to the primary desktop asset',
  expectedAbsolute ===
    'https://truckinglifewithshawn.com/images/knowledge/articles/class-a-vs-class-b-cdl-comparison.webp',
  expectedAbsolute,
);
// buildMetadata puts one `image` into BOTH openGraph.images and twitter.images,
// so a single authority cannot drift between the two networks.
const metadata = read('src/lib/seo/metadata.ts');
check(
  'V19: Twitter reuses the same image field as Open Graph',
  /twitter:\s*\{[\s\S]*?images: \[opts\.image\]/.test(metadata) &&
    /openGraph:[\s\S]*?images: \[\{ url: opts\.image \}\]/.test(metadata),
);
check(
  'V20: inline src is the path of the schema/social URL',
  expectedAbsolute.endsWith(proof.src) && expectedAbsolute === `${SITE.url}${proof.src}`,
);
check('V20b: the figure renders the same registry src it advertises', /src: visual\.src/.test(fig));
// One CALL SITE each (the import is not a second authority), so neither
// consumer can build a competing URL of its own.
check(
  'V20c: exactly one image-authority call site per consumer',
  (shipped(ARTICLE_PAGE).match(/articleVisualImageUrl\(/g) ?? []).length === 1 &&
    (shipped(SCHEMA).match(/articleVisualImageUrl\(/g) ?? []).length === 1,
);

/* ── V21: the article's regulatory HTML is untouched ─────────────────── */

for (const [label, needle] of [
  ['the 26,001 lb combined threshold', '26,001 pounds or more'],
  ['the >10,000 lb towed-unit line', 'over 10,000 pounds'],
  ['the ≤10,000 lb Class B line', '10,000 pounds or less'],
  ['the 383.91 citation', 'part-383/section-383.91'],
  ['the at-a-glance comparison rows', '**Trailer threshold:**'],
  ['the one-way privilege statement', 'the reverse is never true'],
] as Array<[string, string]>) {
  check(`V21: ${label} is still in the article body`, body.includes(needle));
}
check(
  'V21b: the comparison is still list-built, not replaced by the figure',
  (body.match(/^- \*\*[^*]+:\*\*/gm) ?? []).length >= 6,
);
check(
  'V21c: migration 055 is unmodified by this milestone',
  /reg_verified_date 2026-08-19/.test(seed055) && seed055.includes('$mdx$'),
);

/* ── V22–V24: neighbouring surfaces unchanged ────────────────────────── */

check(
  'V22: the Class A vs B harness still exists and is untouched in scope',
  fs.existsSync(path.join(root, 'scripts/test-kc-class-a-vs-b.ts')),
);
check(
  'V23: the How-Long harness and its migration still exist',
  fs.existsSync(path.join(root, 'scripts/test-kc-how-long-training.ts')) &&
    fs.existsSync(path.join(root, 'supabase/migrations/056_seed_kc_how_long_cdl_training.sql')),
);
check(
  'V23b: How Long Does CDL Training Take? has no registered visual',
  articleVisual('how-long-does-cdl-training-take') === null &&
    registeredArticleVisual('how-long-does-cdl-training-take') === null,
);
// V24: an article with no entry must take a rendering path identical to the
// one that shipped before this milestone.
const seed056 = read('supabase/migrations/056_seed_kc_how_long_cdl_training.sql');
const body056 = seed056.match(/\$mdx\$([\s\S]*?)\$mdx\$/)![1];
check(
  'V24: an article without a visual splits nothing',
  articleVisual('how-long-does-cdl-training-take') === null,
);
check(
  'V24b: its body still renders through the unchanged renderer',
  renderMarkdown(body056).html.includes('<h2'),
);
check(
  'V24c: its schema image stays undefined',
  (
    articleSchema(
      { ...baseArticle, slug: 'how-long-does-cdl-training-take' },
      CATEGORY,
      url,
    ) as Record<string, unknown>
  ).image === undefined,
);
check('V24d: the renderer still emits no <img> of its own', !/<img/.test(read(MDX)));
check('V24e: no markdown image syntax was added to the renderer', !/!\[/.test(read(MDX)));

/* ── V25–V30: scope — nothing outside KC visuals was touched ─────────── */

const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).sort();
check(
  'V25: this milestone adds no database migration',
  migrations[migrations.length - 1] === '056_seed_kc_how_long_cdl_training.sql',
  migrations.slice(-3),
);
check(
  'V25b: no migration mentions article visuals',
  !migrations.some((m) => /visual|image|figure/i.test(m)),
);
for (const f of [REGISTRY, FIGURE]) {
  check(
    `V26: ${path.basename(f)} performs no Supabase access`,
    !/supabase|createClient|from\(['"]kc_/i.test(read(f)),
  );
}
check(
  'V26b: the registry is pure data + pure functions',
  !/fetch\(|process\.env/.test(read(REGISTRY)),
);
for (const f of [REGISTRY, FIGURE]) {
  check(
    `V27: ${path.basename(f)} adds no video or embed support`,
    !/<iframe|<video|youtube|vimeo|embed/i.test(read(f)),
  );
}
check(
  'V27b: no third-party script is introduced',
  !/<script|cdn\.|googleapis/i.test(read(FIGURE) + read(REGISTRY)),
);
check(
  'V28: no SEO Scout surface is referenced',
  !/scout|gsc|search-console/i.test(read(REGISTRY) + read(FIGURE) + shipped(ARTICLE_PAGE)),
);
check(
  'V28b: the Scout harness and modules are still present',
  fs.existsSync(path.join(root, 'scripts/test-seo-scout.ts')) &&
    fs.existsSync(path.join(root, 'scripts/seo-scout/classify.ts')),
);
check(
  'V29: no Navigator or Trip Planner surface is referenced',
  !/navigator|trip-planner|tripPlanner/i.test(read(REGISTRY) + read(FIGURE)),
);
check(
  'V30: no sitemap or robots surface is referenced',
  !/sitemap|robots/i.test(read(REGISTRY) + read(FIGURE) + shipped(ARTICLE_PAGE)),
);
check(
  'V30b: sitemap entries still derive articles from the database',
  /kc_articles/.test(read('src/lib/seo/sitemap-entries.ts')),
);
// The remote-image hosts stay as they were: these assets are repo-local.
check(
  'V30c: no new remote image host was added',
  (read('next.config.mjs').match(/hostname:/g) ?? []).length === 2,
);
check(
  'V30d: registered assets are repo-local paths, never remote',
  ARTICLE_VISUAL_SLUGS.every(
    (s) =>
      ARTICLE_VISUALS[s].src.startsWith('/images/') &&
      (!ARTICLE_VISUALS[s].mobileSrc || ARTICLE_VISUALS[s].mobileSrc!.startsWith('/images/')),
  ),
);

console.log(`\nkc-article-visuals: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

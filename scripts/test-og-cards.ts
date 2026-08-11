/**
 * Open Graph card contracts (offline).
 *
 * The August 2026 OG audit found one site-wide brand card at the root and a
 * segment card for /cdl-pre-school, with every other major route family
 * falling back to the generic root card. Segment cards now exist for
 * /academy, /directory, /knowledge, /practice-tests, and /store, all drawn
 * from ONE shared frame (src/lib/seo/og-card.tsx) so the brand system cannot
 * drift per family. This harness pins that contract without rendering
 * next/og (edge-only): the frame is unit-tested as a pure element tree, and
 * each route file is checked for the exports Next's file convention needs.
 *
 * Run:
 *   npx esbuild scripts/test-og-cards.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-og-cards.cjs && node /tmp/test-og-cards.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ogCard, OG_SIZE } from '@/lib/seo/og-card';
import { SITE } from '@/lib/seo/site';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/* ----------------------------------------------- shared frame behavior */

/** Collect every string rendered anywhere in a React element tree. */
function textOf(node: unknown): string[] {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return [];
}

check('OG size is the standard 1200×630', OG_SIZE.width === 1200 && OG_SIZE.height === 630);

const card = ogCard({ headline: ['Line one', 'line two.'], support: 'Support sentence.' });
const text = textOf(card).join(' ');
check('frame renders both headline lines', text.includes('Line one') && text.includes('line two.'));
check('frame renders the support line', text.includes('Support sentence.'));
check('frame carries the brand eyebrow', text.includes(SITE.brand));
check(
  'frame footer names the canonical host, not a hard-coded string',
  text.includes(new URL(SITE.url).host),
);
check('frame footer keeps the locale line', text.includes(SITE.city) && text.includes(SITE.region));

/* -------------------------------------------- per-family route files */

const CARDS = [
  'src/app/opengraph-image.tsx',
  'src/app/(academy)/academy/opengraph-image.tsx',
  'src/app/(directory)/directory/opengraph-image.tsx',
  'src/app/(marketing)/knowledge/opengraph-image.tsx',
  'src/app/(learn)/practice-tests/opengraph-image.tsx',
  'src/app/(marketing)/store/opengraph-image.tsx',
];

for (const p of CARDS) {
  const src = read(p);
  check(`${p} exists and uses the shared frame`, src.includes('ogCard('));
  check(`${p} exports the shared size`, src.includes('export const size = OG_SIZE'));
  check(`${p} exports contentType png`, /export const contentType = 'image\/png'/.test(src));
  check(`${p} exports a non-empty alt`, /export const alt = .+/.test(src));
  check(`${p} runs at the edge like the root card`, src.includes(`export const runtime = 'edge'`));
}

// The CDL Pre-School card predates this PR and keeps its own specific design —
// it must still exist (deeper file conventions beat the root card).
check(
  'cdl-pre-school keeps its own segment card',
  fs.existsSync(path.join(process.cwd(), 'src/app/(marketing)/cdl-pre-school/opengraph-image.tsx')),
);

// buildMetadata must keep omitting og images when unset — that omission is
// what lets these file-convention cards flow through (and deeper config
// images, like KC article heroes, still win over shallower segment cards).
const metadataSrc = read('src/lib/seo/metadata.ts');
check(
  'buildMetadata still omits og images when unset',
  metadataSrc.includes('...(opts?.image ? { images: [{ url: opts.image }] } : {})'),
);

console.log(`\nog-cards: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

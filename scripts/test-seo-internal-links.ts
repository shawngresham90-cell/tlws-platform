/**
 * PR-C internal-link contracts (offline, rendered HTML + pure helpers).
 *
 * The 2026-08-17 crawl/indexing audit found the academy sub-pages in a
 * closed crawl cluster (no header/footer/homepage inbound links) and the
 * parking / CAT-scale flow trees connected to the engine pages in neither
 * direction. PR-C adds those links as ordinary server-rendered anchors.
 * This harness proves they exist in raw HTML output and that every
 * generated cross-link is facet-backed — never guessed.
 *
 * Run:
 *   npx esbuild scripts/test-seo-internal-links.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-seo-internal-links.cjs && node /tmp/test-seo-internal-links.cjs
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Academy } from '@/components/sections/Academy';
import {
  stateFlowLinks,
  interstateFlowLinks,
  flowEngineReturnLinks,
} from '@/lib/directory/scope-links';
import type { ParkingFacets } from '@/lib/directory/data';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/** Count real `<a href="...">` anchors for a path in rendered HTML. */
const anchors = (html: string, path: string) =>
  (html.match(new RegExp(`<a[^>]+href="${path.replace(/[/[\]]/g, '\\$&')}"`, 'g')) ?? []).length;

/* ─────────────────── 1-5. nav surfaces render real anchors ─────────────────── */

const headerHtml = renderToStaticMarkup(createElement(Header));
check(
  'header: /academy/curriculum anchor in raw HTML',
  anchors(headerHtml, '/academy/curriculum') >= 1,
);
check(
  'header: /academy/financing anchor in raw HTML',
  anchors(headerHtml, '/academy/financing') >= 1,
);
check('header: /academy hub link preserved', anchors(headerHtml, '/academy') >= 1);
check('header: apply CTA preserved', anchors(headerHtml, '/academy/apply') >= 1);
check(
  'header: anchors are <a href>, none replaced by buttons/handlers',
  /<a[^>]+href="\/academy\/curriculum"/.test(headerHtml) &&
    !/onClick=.*academy\/curriculum/.test(headerHtml),
);

const footerHtml = renderToStaticMarkup(createElement(Footer));
check(
  'footer: /academy/curriculum anchor in raw HTML',
  anchors(footerHtml, '/academy/curriculum') >= 1,
);
check(
  'footer: /academy/financing anchor in raw HTML',
  anchors(footerHtml, '/academy/financing') >= 1,
);
check(
  'footer: /academy/requirements anchor in raw HTML',
  anchors(footerHtml, '/academy/requirements') >= 1,
);
check('footer: /academy hub link preserved', anchors(footerHtml, '/academy') >= 1);

const academyHtml = renderToStaticMarkup(createElement(Academy));
check(
  'homepage academy section: curriculum anchor',
  anchors(academyHtml, '/academy/curriculum') >= 1,
);
check(
  'homepage academy section: financing anchor',
  anchors(academyHtml, '/academy/financing') >= 1,
);
check('homepage academy section: apply CTA preserved', anchors(academyHtml, '/academy/apply') >= 1);
check(
  'homepage academy section: curriculum CTA retargeted, not duplicated to hub',
  !/See the curriculum[\s\S]{0,40}href="\/academy"/.test(academyHtml),
);

/* ───────────── 6-11, 14-15. facet-backed engine ⇄ flow cross-links ───────────── */

const PARKING_FACETS: ParkingFacets = {
  states: [
    { code: 'GA', count: 12 },
    { code: 'TN', count: 4 },
  ],
  interstatesByState: {
    GA: [
      { designation: 'I-75', count: 10 },
      { designation: 'I-24', count: 2 },
    ],
    TN: [{ designation: 'I-40', count: 4 }],
  },
};
const CAT_FACETS: ParkingFacets = {
  states: [{ code: 'GA', count: 5 }],
  interstatesByState: { GA: [{ designation: 'I-75', count: 5 }] },
};
const EMPTY_FACETS: ParkingFacets = { states: [], interstatesByState: {} };

// State engine page → flow entry points, only when facet-backed.
const gaFlow = stateFlowLinks('Georgia', 'GA', PARKING_FACETS, CAT_FACETS);
check(
  'state page links its parking flow (facet-backed)',
  gaFlow.links.some((l) => l.href === '/directory/parking/ga'),
  gaFlow.links,
);
check(
  'state page links its CAT-scale flow (facet-backed)',
  gaFlow.links.some((l) => l.href === '/directory/cat-scales/ga'),
  gaFlow.links,
);
const tnFlow = stateFlowLinks('Tennessee', 'TN', PARKING_FACETS, CAT_FACETS);
check(
  'state without cat-scale facet gets NO cat-scale link',
  tnFlow.links.every((l) => !l.href.startsWith('/directory/cat-scales')),
  tnFlow.links,
);
check(
  'state absent from all flow facets gets no links',
  stateFlowLinks('Florida', 'FL', PARKING_FACETS, CAT_FACETS).links.length === 0,
);
check(
  'unknown state code gets no links even with facets',
  stateFlowLinks('Nowhere', 'XX', PARKING_FACETS, CAT_FACETS).links.length === 0,
);
check(
  'empty facets (DB hiccup) render no state flow links',
  stateFlowLinks('Georgia', 'GA', EMPTY_FACETS, EMPTY_FACETS).links.length === 0,
);

// Corridor engine page → per-state flow corridor steps, only when backed.
const i75Flow = interstateFlowLinks('I-75', PARKING_FACETS, CAT_FACETS);
check(
  'corridor page links its parking flow step (facet-backed)',
  i75Flow.links.some((l) => l.href === '/directory/parking/ga/i-75'),
  i75Flow.links,
);
check(
  'corridor page links its CAT-scale flow step (facet-backed)',
  i75Flow.links.some((l) => l.href === '/directory/cat-scales/ga/i-75'),
  i75Flow.links,
);
check(
  'corridor step NOT emitted for a state not on the corridor',
  i75Flow.links.every((l) => !l.href.includes('/tn/i-75')),
  i75Flow.links,
);
check(
  'corridor with no flow coverage emits no links',
  interstateFlowLinks('I-95', PARKING_FACETS, CAT_FACETS).links.length === 0,
);
check(
  'invalid corridor combination emits nothing (empty facets)',
  interstateFlowLinks('I-75', EMPTY_FACETS, EMPTY_FACETS).links.length === 0,
);

// Flow pages → engine return links, validated through the registries.
const gaReturn = flowEngineReturnLinks('GA');
check(
  'flow state step links back to the state engine page',
  gaReturn.some((l) => l.href === '/directory/georgia'),
  gaReturn,
);
const gaI75Return = flowEngineReturnLinks('ga', 'I-75');
check(
  'flow corridor step links back to state + corridor engine pages',
  gaI75Return.some((l) => l.href === '/directory/georgia') &&
    gaI75Return.some((l) => l.href === '/directory/i75'),
  gaI75Return,
);
check('unknown state code returns no engine links', flowEngineReturnLinks('XX').length === 0);
check(
  'free-text designation produces no corridor link',
  flowEngineReturnLinks('GA', 'Alligator Alley').every((l) => !l.href.startsWith('/directory/i')),
  flowEngineReturnLinks('GA', 'Alligator Alley'),
);

// Route-format integrity for everything the helpers can emit.
const allEmitted = [
  ...gaFlow.links,
  ...tnFlow.links,
  ...i75Flow.links,
  ...gaReturn,
  ...gaI75Return,
].map((l) => l.href);
check(
  'every generated href matches the real route grammar',
  allEmitted.every((h) => /^\/directory\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(h) && !h.includes('//')),
  allEmitted,
);
check(
  'no duplicate destinations within any single group',
  [gaFlow, tnFlow, i75Flow].every(
    (g) => new Set(g.links.map((l) => l.href)).size === g.links.length,
  ),
);

/* ────────────── page wiring: the helpers are actually rendered ────────────── */

const engineSrc = readFileSync('src/app/(directory)/directory/[category]/page.tsx', 'utf8');
check('engine state branch renders stateFlowLinks', /stateFlowLinks\(/.test(engineSrc));
check(
  'engine corridor branch renders interstateFlowLinks',
  /interstateFlowLinks\(/.test(engineSrc),
);
for (const p of [
  'src/app/(directory)/directory/parking/[state]/page.tsx',
  'src/app/(directory)/directory/parking/[state]/[interstate]/page.tsx',
  'src/app/(directory)/directory/cat-scales/[state]/page.tsx',
  'src/app/(directory)/directory/cat-scales/[state]/[interstate]/page.tsx',
]) {
  check(
    `${p.split('/directory/')[1]} renders engine return links`,
    /flowEngineReturnLinks\(/.test(readFileSync(p, 'utf8')),
  );
}

console.log(`\nseo-internal-links: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

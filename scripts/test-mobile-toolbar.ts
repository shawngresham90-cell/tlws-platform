/**
 * Mobile bottom bar contracts (offline).
 *
 * Guards the contextual-toolbar pass: the pure `toolsFor` slot resolver
 * (Parking/Trip permanent, third slot yields to the page family's one next
 * action, segment-exact matching), the bar's rendering contracts (48px+
 * targets, grid, aria-current, amber-TEXT money slot, drawn SVG icons), and
 * the bottom-edge stacking fix — the CDL Pre-School sticky purchase bar must
 * ride exactly one tool-bar height above bottom-0, where the tool bar was
 * covering its lower half.
 *
 * Run:
 *   npx esbuild scripts/test-mobile-toolbar.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-mobile-toolbar.cjs && node /tmp/test-mobile-toolbar.cjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toolsFor } from '@/components/layout/toolbar-tools';
import { PRESCHOOL_PATH } from '@/lib/preschool/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const hrefs = (p: string) => toolsFor(p).map((t) => t.href);

/* ------------------------------------------------ toolsFor: default map */

const DEFAULT = ['/directory/parking', '/trip-planner', '/tools/hos-calculator'];
check(
  'default: home gets Parking | Trip | HOS',
  JSON.stringify(hrefs('/')) === JSON.stringify(DEFAULT),
);
check(
  'default: directory pages keep HOS',
  JSON.stringify(hrefs('/directory/parking')) === JSON.stringify(DEFAULT),
);
check(
  'default: /cdl-pre-school keeps HOS — the sticky purchase bar IS the money surface there',
  JSON.stringify(hrefs('/cdl-pre-school')) === JSON.stringify(DEFAULT),
);
check(
  'default: founding-student pages keep HOS too',
  JSON.stringify(hrefs('/cdl-pre-school/founding-students')) === JSON.stringify(DEFAULT),
);

/* --------------------------------------------- toolsFor: contextual map */

for (const p of ['/academy', '/academy/apply', '/academy/faq', '/academy/curriculum/week-1']) {
  const third = toolsFor(p)[2];
  check(
    `academy family (${p}): third slot is Apply → /academy/apply`,
    third.href === '/academy/apply' && third.label === 'Apply' && third.money === true,
  );
}
for (const p of ['/knowledge', '/knowledge/pre-trip', '/knowledge/search']) {
  const third = toolsFor(p)[2];
  check(
    `knowledge family (${p}): third slot is Pre-School → PRESCHOOL_PATH`,
    third.href === PRESCHOOL_PATH && third.label === 'Pre-School' && third.money === true,
  );
}
check(
  'matching is segment-exact — /academyx and /knowledgebase get defaults',
  JSON.stringify(hrefs('/academyx')) === JSON.stringify(DEFAULT) &&
    JSON.stringify(hrefs('/knowledgebase')) === JSON.stringify(DEFAULT),
);

/* --------------------------------------------- toolsFor: invariants */

for (const p of ['/', '/academy', '/knowledge', '/cdl-pre-school', '/store']) {
  const tools = toolsFor(p);
  check(`invariant (${p}): exactly three slots (grid-cols-3 contract)`, tools.length === 3);
  check(
    `invariant (${p}): Parking first, Trip second — permanent slots never move`,
    tools[0].href === '/directory/parking' &&
      tools[0].label === 'Parking' &&
      tools[1].href === '/trip-planner',
  );
  check(
    `invariant (${p}): permanent slots never carry the money treatment`,
    !tools[0].money && !tools[1].money,
  );
}
check(
  'invariant: resolver is pure — same input, same output',
  JSON.stringify(toolsFor('/academy')) === JSON.stringify(toolsFor('/academy')),
);

const toolsSrc = read('src/components/layout/toolbar-tools.ts');
check(
  'Pre-School slot rides the PRESCHOOL_PATH constant, not a copied string',
  toolsSrc.includes('href: PRESCHOOL_PATH'),
);

/* ------------------------------------------------- bar rendering pins */

const bar = read('src/components/layout/MobileToolBar.tsx');
check('bar: resolves slots through toolsFor', bar.includes('toolsFor(pathname)'));
check('bar: 56px minimum tap targets kept', bar.includes('min-h-[56px]'));
check('bar: three-column grid kept', bar.includes('grid-cols-3'));
check(
  'bar: aria-current marks the active tool',
  bar.includes("aria-current={active ? 'page' : undefined}"),
);
check(
  'bar: money slot is amber TEXT, exactly the active-state weight',
  bar.includes("active || money ? 'text-signal'"),
);
check('bar: never a filled amber bar', !bar.includes('bg-signal'));
check(
  'bar: still owns bottom-0 at z-50 with safe-area padding',
  bar.includes('bottom-0 z-50') && bar.includes('pb-[env(safe-area-inset-bottom)]'),
);
check('bar: mobile-only (hidden at sm and up)', bar.includes('sm:hidden'));
check('bar: keeps its landmark label', bar.includes('aria-label="Driver tools"'));
check(
  'bar: icons are drawn 2px-stroke SVGs, hidden from AT',
  bar.includes('strokeWidth={2}') && bar.includes('aria-hidden="true"'),
);
check('bar: emoji icons retired', !/[\u{1F100}-\u{1FAFF}\u{2300}-\u{27BF}]/u.test(bar));

/* --------------------------------------------- sticky-bar stacking fix */

const sticky = read('src/components/preschool/StickyCta.tsx');
check(
  'sticky: rides above the tool bar by its exact height + safe area',
  sticky.includes('bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))]'),
);
check(
  'sticky: no longer docks at bottom-0 (the bar covered it there)',
  !sticky.includes('inset-x-0 bottom-0'),
);
check(
  'sticky: stays below the tool bar in z (no overlap now, no fight later)',
  sticky.includes('z-40'),
);
check(
  'lockstep: sticky offset 3.5rem === tool bar min-height 56px',
  sticky.includes('3.5rem') && bar.includes('min-h-[56px]'),
);
check(
  'sales page: reserved band covers the taller stack',
  read('src/app/(marketing)/cdl-pre-school/page.tsx').includes('h-32 sm:hidden'),
);
check(
  'root layout: body still reserves the tool-bar band on mobile',
  read('src/app/layout.tsx').includes('pb-16 sm:pb-0'),
);

console.log(`\nmobile-toolbar: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

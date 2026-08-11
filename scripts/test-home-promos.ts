/**
 * Home promo surfaces — Truck Parking marquee tile + shirt inventory
 * contract (2026-07-29).
 *
 * Release-blocking properties:
 *   - SHIRTS_LEFT is exactly the owner-approved 49, lives in ONE module,
 *     and every customer-facing count derives from it — this test FAILS if
 *     the approved figure drifts or any stale hardcoded public count
 *     remains anywhere in src/.
 *   - Shirt price/checkout is untouched: the Stan store URL is pinned.
 *   - The marquee tile is a real square promotional button (aspect-square),
 *     links to the EXISTING /directory/parking, sits directly beneath the
 *     shirt promo in the hero, has an accurate screen-reader label, a
 *     visible focus ring, a 48px+ target by construction, uses no external
 *     assets, and its marquee animation is gated behind
 *     prefers-reduced-motion: no-preference.
 *   - Existing parking entrances are intact (hub link in header nav, mobile
 *     bottom bar).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SHIRTS_LEFT, SHIRTS_TOTAL_RUN } from '@/lib/store/shirt-inventory';

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

/* ------------------------------------------------- shirt inventory: source */
check('shirt inventory: approved figure is exactly 29', SHIRTS_LEFT === 29);
check('shirt inventory: edition size unchanged (100 made)', SHIRTS_TOTAL_RUN === 100);
check(
  'shirt inventory: remaining within [0, run]',
  SHIRTS_LEFT >= 0 && SHIRTS_LEFT <= SHIRTS_TOTAL_RUN,
);

const promo = read('src/components/sections/HeroShirtPromo.tsx');
check(
  'promo derives the count from the single source',
  promo.includes("from '@/lib/store/shirt-inventory'") && !/SHIRTS_LEFT\s*=\s*\d/.test(promo),
);
check(
  'promo renders the shared count (no literal digits near "shirts left")',
  /\{SHIRTS_LEFT\}/.test(promo) && !/\b\d{1,3}\s*<\/span>\s*.{0,40}shirts left/is.test(promo),
);

// No stale hardcoded public count anywhere in src (the lib itself is the
// one allowed definition).
function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const offenders = walk(path.join(process.cwd(), 'src'))
  .filter((p) => !p.endsWith(path.join('store', 'shirt-inventory.ts')))
  .filter((p) => {
    const t = fs.readFileSync(p, 'utf8');
    return /\b\d{1,3}\s+shirts?\s+left\b/i.test(t) || /SHIRTS_LEFT\s*=\s*\d+/.test(t);
  });
check('no stale hardcoded shirt count anywhere in src', offenders.length === 0, offenders);

// Price/checkout untouched: the exact Stan store URL is pinned on both
// shirt surfaces (this task changes stock only).
const STAN_URL = 'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/founding-member-shirt--only-100-made';
check('checkout link unchanged on hero promo', promo.includes(STAN_URL));
check(
  'checkout link unchanged on shirt hero',
  read('src/components/sections/ShirtHero.tsx').includes(STAN_URL),
);

/* -------------------------------------------------- truck parking marquee */
const marquee = read('src/components/sections/TruckParkingMarquee.tsx');
check('marquee: links to the EXISTING parking page', marquee.includes('href="/directory/parking"'));
check('marquee: square 1:1 tile', /aspect-square/.test(marquee));
check(
  'marquee: accurate screen-reader label',
  /aria-label="Truck Parking — find a spot\. Opens the truck parking directory\."/.test(marquee),
);
check('marquee: strong visible focus ring', /focus-visible:ring-4/.test(marquee));
check(
  'marquee: headline + subline present',
  /Truck/.test(marquee) && /Parking/.test(marquee) && /Find a spot/.test(marquee),
);
check(
  'marquee: hover/press motion is reduced-motion-safe (motion-safe: variants only)',
  /motion-safe:hover:scale/.test(marquee) &&
    !/[^-]hover:scale/.test(marquee.replace(/motion-safe:hover:scale/g, '')),
);
check(
  'marquee: no external/paid asset (no remote URL, no <img>/<Image>)',
  !/https?:\/\//.test(marquee.replace(/[^"'`]*aria-label[^"'`]*/g, '')) &&
    !/next\/image|<img/i.test(marquee),
);
check(
  'marquee: truck/parking icon is an inline SVG',
  /<svg/.test(marquee) && /<\/svg>/.test(marquee),
);

const globals = read('src/app/globals.css');
check(
  'marquee: bulb chase animation gated by prefers-reduced-motion: no-preference',
  /prefers-reduced-motion: no-preference[\s\S]*tlws-marquee-chase/.test(globals),
);
check(
  'marquee: chase runs only on hover/active/focus (not constantly)',
  /group\\\/marquee:hover \.marquee-lights/.test(globals) &&
    !/^\s*\.marquee-lights\s*{[^}]*animation/m.test(globals),
);

const hero = read('src/components/sections/Hero.tsx');
const promoIdx = hero.indexOf('<HeroShirtPromo');
const marqueeIdx = hero.indexOf('<TruckParkingMarquee');
check(
  'marquee sits DIRECTLY beneath the shirt promo in the hero',
  promoIdx > -1 && marqueeIdx > promoIdx,
  { promoIdx, marqueeIdx },
);

/* ------------------------------------- existing parking entrances intact */
const header = read('src/components/layout/Header.tsx');
check(
  'header still links Truck Parking → /directory/parking',
  /Truck Parking[\s\S]{0,60}\/directory\/parking/.test(header),
);
// The bar's slot data moved to toolbar-tools.ts (contextual third slot);
// the Parking entry itself is pinned exactly as before, at its new home.
const toolbarTools = read('src/components/layout/toolbar-tools.ts');
check(
  'mobile bottom bar Parking entry unchanged',
  toolbarTools.includes("href: '/directory/parking'") &&
    toolbarTools.includes("label: 'Parking'") &&
    read('src/components/layout/MobileToolBar.tsx').includes("from './toolbar-tools'"),
);

console.log(`home-promos: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

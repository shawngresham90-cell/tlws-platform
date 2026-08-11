/**
 * Night Haul homepage signage contracts (offline).
 *
 * Guards the August 2026 Night Haul pass: the guide/brake token families and
 * their WCAG floors (computed from the config hexes, not trusted from
 * comments), the three signage primitives (GuideSignCard, MileMarker,
 * ReflectiveTapeDivider), their homepage applications (ProofBar mile-marker
 * posts, FourPaths guide-sign doors, TruckParking guide-sign entry), the
 * tape-divider hard cap of TWO on the page, the photo seams that must stay
 * honest (no fabricated image paths), and the focus-visible rings added to
 * the card grids, store tiles, and newsletter submit.
 *
 * Run:
 *   npx esbuild scripts/test-night-haul-home.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-night-haul-home.cjs && node /tmp/test-night-haul-home.cjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import config from '../tailwind.config';
import { MileMarker } from '@/components/ui/MileMarker';
import { ReflectiveTapeDivider } from '@/components/ui/ReflectiveTapeDivider';
import { GuideSignCard } from '@/components/ui/GuideSignCard';

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

/* ------------------------------------------------------------- tokens */

const colors = (config.theme?.extend?.colors ?? {}) as Record<
  string,
  string | Record<string, string>
>;
const guide = colors.guide as Record<string, string> | undefined;
const brake = colors.deadline as Record<string, string> | undefined;
check(
  'tokens: guide family exists with panel/edge/text shades',
  Boolean(guide?.DEFAULT && guide?.[700] && guide?.[300]),
  guide,
);
check(
  'tokens: deadline (brake-red) family exists with fill + text shades',
  Boolean(brake?.DEFAULT && brake?.[300]),
  brake,
);
check('tokens: guide green is the blueprint hex', guide?.DEFAULT === '#1B6B3A');
check('tokens: deadline red is the blueprint hex', brake?.DEFAULT === '#D7263D');

/* WCAG contrast, computed from the actual config hexes. */
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const ink = colors.ink as string;
const asphalt = (colors.asphalt as Record<string, string>).DEFAULT;
const cab = colors.cab as string;
check(
  'contrast: ink on guide panel ≥ 4.5 (sign text is AA)',
  contrast(ink, guide!.DEFAULT) >= 4.5,
  contrast(ink, guide!.DEFAULT).toFixed(2),
);
check('contrast: guide-300 on asphalt ≥ 4.5', contrast(guide![300], asphalt) >= 4.5);
check('contrast: deadline-300 on asphalt ≥ 4.5', contrast(brake![300], asphalt) >= 4.5);
check('contrast: deadline-300 on cab ≥ 4.5', contrast(brake![300], cab) >= 4.5);

/* -------------------------------------------------------- primitives */

const ui = read('src/components/ui/index.ts');
for (const name of ['GuideSignCard', 'MileMarker', 'ReflectiveTapeDivider']) {
  check(`ui: ${name} exported from the barrel`, ui.includes(name));
}

const signSrc = read('src/components/ui/GuideSignCard.tsx');
check('GuideSignCard: carries a real focus ring', /focus-visible:ring-2/.test(signSrc));
check(
  'GuideSignCard: no emoji dependency',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(signSrc),
);
const sign = renderToStaticMarkup(
  createElement(GuideSignCard, {
    href: '/directory/parking',
    title: 'Truck Parking',
    description: 'Free, paid, and reserved.',
    cta: 'Find parking',
    tab: 'I-75',
  }),
);
check(
  'GuideSignCard: renders an anchor with the destination',
  /<a[^>]+href="\/directory\/parking"/.test(sign),
);
check(
  'GuideSignCard: panel rides guide green, not amber',
  sign.includes('bg-guide') && !sign.includes('bg-signal'),
);
check('GuideSignCard: tab text joins the accessible content', sign.includes('I-75'));

const marker = renderToStaticMarkup(
  createElement(MileMarker, { value: '17', label: 'years on the road' }),
);
check(
  'MileMarker: value and label are plain readable text',
  marker.includes('17') && marker.includes('years on the road'),
);
check(
  'MileMarker: green post, no amber numeral',
  marker.includes('bg-guide') && !marker.includes('text-signal'),
);

const tape = renderToStaticMarkup(createElement(ReflectiveTapeDivider));
check('TapeDivider: decorative and hidden from AT', tape.includes('aria-hidden="true"'));
check('TapeDivider: 6px band per the blueprint', tape.includes('h-1.5'));
check(
  'TapeDivider: white/reflective stripes, never amber decoration',
  !read('src/components/ui/ReflectiveTapeDivider.tsx').includes('signal'),
);

/* -------------------------------------------- homepage applications */

const page = read('src/app/page.tsx');
check(
  'page: exactly TWO tape dividers (blueprint hard cap)',
  (page.match(/<ReflectiveTapeDivider \/>/g) ?? []).length === 2,
);

const proofBar = read('src/components/sections/ProofBar.tsx');
check('ProofBar: renders mile-marker posts', proofBar.includes('<MileMarker'));
check('ProofBar: amber numerals retired', !proofBar.includes('text-signal'));
check(
  'ProofBar: fail-soft live stats untouched (no invented numbers)',
  proofBar.includes('kc.count && kc.count > 0') && proofBar.includes('founders > 0'),
);

const fourPaths = read('src/components/sections/FourPaths.tsx');
check('FourPaths: free-door destinations are guide signs', fourPaths.includes('<GuideSignCard'));
check(
  'FourPaths: FREE_DOORS.map survives (preschool ordering contract)',
  fourPaths.includes('FREE_DOORS.map'),
);
check(
  'FourPaths: the amber text-link pattern is gone',
  !fourPaths.includes('font-semibold text-signal underline-offset-4'),
);
check(
  'FourPaths: mission-door links carry focus rings',
  (fourPaths.match(/focus-visible:ring-2/g) ?? []).length >= 2,
);

const parking = read('src/components/sections/TruckParking.tsx');
check(
  'TruckParking: directory entrance is a guide sign',
  parking.includes('<GuideSignCard') && parking.includes('/directory/parking'),
);
check('TruckParking: negative-margin heading hack removed', !parking.includes('className="-mt-6'));

/* ------------------------------------------------- honest photo seams */

const journey = read('src/components/sections/JourneyStrip.tsx');
check(
  'JourneyStrip: photo seam type exists for the three real frames',
  journey.includes('BeatPhoto'),
);
check(
  'JourneyStrip: renders through CinematicStill when a frame lands',
  journey.includes('CinematicStill'),
);
check('JourneyStrip: no beat fabricates a photo today', !/,\s*photo:\s*\{/.test(journey));
check('JourneyStrip: no invented image paths', !journey.includes("src: '/images/journey"));

const hero = read('src/components/sections/Hero.tsx');
check(
  'Hero: shot-#1 seam is documented, not faked',
  hero.includes('FUTURE PHOTO') && hero.includes('shot #1'),
);
check(
  'Hero: still type-led — no image element added',
  !hero.includes("from '@/components/media/CinematicStill'") && !hero.includes('next/image'),
);

/* -------------------------------------------------- focus + floors */

check(
  'FeatureGrid cards: focus ring added',
  read('src/components/sections/FeatureGrid.tsx').includes('focus-visible:ring-2'),
);
check(
  'Store tiles: focus ring added',
  read('src/components/sections/Store.tsx').includes('focus-visible:ring-2'),
);
check(
  'Newsletter submit: focus ring added',
  read('src/components/sections/NewsletterForm.tsx').includes('focus-visible:ring-2'),
);
check(
  'Button: 48px floor enforced in the base',
  read('src/components/ui/Button.tsx').includes('min-h-12'),
);
check(
  'Section: forwards aria-labelledby (ShirtHero was silently unlabeled)',
  read('src/components/ui/Section.tsx').includes("'aria-labelledby'"),
);
check(
  'Academy section: label and destination agree (/academy/apply)',
  read('src/components/sections/Academy.tsx').includes(
    '<Button href="/academy/apply">Apply to the Academy</Button>',
  ),
);

console.log(`\nnight-haul-home: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

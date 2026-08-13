/**
 * Guards the training-fleet photograph on /academy.
 *
 * The frame's whole point is that BOTH tractors are in it, with the TLWS
 * lettering legible on the blue sleeper. Every plausible regression here is a
 * cropping or aspect regression — an `object-cover`, a forced 16:9, a fixed
 * height — so that is what these checks are aimed at:
 *   1. the image renders through plain next/image at its natural 4:3, with the
 *      declared box matching the real file (zero CLS);
 *   2. nothing crops it: no object-cover, no aspect utility, no height class;
 *   3. no text or overlay is placed on top of the trucks;
 *   4. it is NOT the hero, and it did not displace anything;
 *   5. it sits between the founder story and the program journey;
 *   6. the brand reads "Trucking Life", never "Trucker Life".
 *
 * Filesystem only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-academy-training-fleet.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

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

const ACADEMY = 'src/app/(academy)/academy/page.tsx';
const FLEET_SRC = '/images/academy/academy-training-fleet.webp';
const FLEET_FILE = 'public/images/academy/academy-training-fleet.webp';
const FLEET_ALT = 'Blue and white Trucking Life Academy training trucks at sunset';

const academy = read(ACADEMY);
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const academyCode = codeOnly(academy);
const flat = academyCode.replace(/\s+/g, ' ');

/** The <Image …/> element for the fleet photograph, as written. */
const fleetImg =
  flat.match(/<Image[^>]*academy-training-fleet[^>]*\/>/)?.[0] ??
  flat.match(/<Image [^>]*\/>/)?.[0] ??
  '';

/* 1. the section, its copy, and the image ------------------------------ */

check('the fleet section eyebrow is present', flat.includes('<Eyebrow>Our equipment</Eyebrow>'));
check('the fleet heading is present', flat.includes('Meet the training fleet'));
check(
  'the supporting line is present, verbatim',
  flat.includes('Real trucks. Real-world training. Built by drivers for drivers.'),
);
check('the page imports next/image', /import Image from 'next\/image'/.test(academyCode));
check('the fleet image is rendered', flat.includes(`src="${FLEET_SRC}"`));
check('the fleet image carries the approved alt text', flat.includes(`alt="${FLEET_ALT}"`));
check('the alt text says Trucking Life', FLEET_ALT.includes('Trucking Life'));

/* 2. brand: never "Trucker Life" --------------------------------------- */

check('the academy page never says “Trucker Life”', !/Trucker Life/i.test(academy));

/* 3. natural aspect, nothing cropped ----------------------------------- */

check('the fleet image declares width 1280', /width=\{1280\}/.test(fleetImg), fleetImg);
check('the fleet image declares height 960', /height=\{960\}/.test(fleetImg), fleetImg);
check('the fleet image lays out at its own aspect (h-auto w-full)', /h-auto w-full/.test(fleetImg));
check('the fleet image is not object-cover cropped', !/object-cover/.test(fleetImg));
check('no aspect utility is forced on the fleet image', !/aspect-/.test(fleetImg));
check('no fixed height is forced on the fleet image', !/\bh-\d|\bh-\[/.test(fleetImg));
check('the fleet image declares responsive sizes', /sizes="[^"]+"/.test(fleetImg));

// Dimensions read from the WebP header, not taken on trust.
const buf = fs.readFileSync(path.join(root, FLEET_FILE));
const form = buf.subarray(12, 16).toString();
const [w, h] =
  form === 'VP8X'
    ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
    : [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
check('the real file is 1280×960 per its own WebP header', w === 1280 && h === 960, { w, h });
check('that is a true 4:3 landscape, the frame as shot', Math.abs(w / h - 4 / 3) < 0.001, w / h);
check('it is NOT 16:9', Math.abs(w / h - 16 / 9) > 0.1, w / h);
check(
  'the asset stays inside the ≤200 KB house budget',
  buf.length > 20_000 && buf.length <= 200_000,
  buf.length,
);

/* 4. the photograph carries no text on top ----------------------------- */

// The figure wraps the image and nothing else — no caption, no absolute
// overlay, no scrim that would sit on the trucks.
const figure = flat.match(/<figure className="mt-10[^>]*>.*?<\/figure>/)?.[0] ?? '';
check('the fleet figure was located', figure.length > 0);
check('the fleet figure contains no figcaption', !/<figcaption/.test(figure));
check('the fleet figure has no absolutely-positioned overlay', !/absolute/.test(figure));
check(
  'the fleet figure contains exactly one element — the image',
  (figure.match(/<Image/g) ?? []).length === 1,
);
check('the fleet figure has a rounded frame', /rounded-card/.test(figure));
check('the fleet figure has a border', /border/.test(figure));
check('the fleet figure has a shadow', /shadow/.test(figure));

/* 5. placement and the no-collateral-damage rules ---------------------- */

const iStory = flat.indexOf('From a $400 Pathfinder');
const iFleet = flat.indexOf(FLEET_SRC);
const iJourney = flat.indexOf('The program journey');
check('the fleet section sits after the founder story', iStory > -1 && iFleet > iStory, {
  iStory,
  iFleet,
});
check('the fleet section sits before the program journey', iJourney > -1 && iFleet < iJourney, {
  iFleet,
  iJourney,
});

// It must not have become the hero, and PageHero must be untouched.
check(
  'the fleet image is not used by the page hero',
  !/<PageHero[\s\S]{0,400}academy-training-fleet/.test(flat),
);
check('the hero still declares cinematic with no image src', /<PageHero cinematic/.test(flat));
check(
  'the page renders exactly one fleet image',
  (flat.match(/academy-training-fleet/g) ?? []).length === 1,
);
check(
  'the instructors page does not render the fleet image',
  !read('src/app/(academy)/academy/instructors/page.tsx').includes(FLEET_SRC),
);

// Everything that existed before is still here.
for (const copy of [
  'The mission',
  'Drivers helping drivers',
  'From a $400 Pathfinder to building a CDL school',
  'I don’t give up. Never have. Never will.',
  'This school isn’t for the businessman. It’s for the people.',
  'The program journey',
  'Being finalized',
  'Details published when finalized',
]) {
  check(`untouched copy still present: “${copy.slice(0, 44)}”`, academy.includes(copy));
}
check(
  'the mission portrait still renders',
  flat.includes('/images/journey/academy-instructor-portrait.webp'),
);
check('the founder-story milestone strip survives', flat.includes('STORY_MILESTONES'));
check(
  'academy keeps its 60s revalidate window',
  /^export const revalidate = 60;$/m.test(academyCode),
);
check(
  'academy keeps its course + breadcrumb schema',
  /courseSchema\(\)/.test(academyCode) && /breadcrumbSchema\(/.test(academyCode),
);
check('the fleet section introduced no new h1', !/<h1/.test(flat));
check(
  'the fleet heading is an h2, keeping the hierarchy flat',
  /<h2 className="display-section">Meet the training fleet<\/h2>/.test(flat),
);

console.log(`academy-training-fleet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

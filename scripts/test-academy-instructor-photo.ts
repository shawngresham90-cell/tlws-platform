/**
 * Guards the real instructor portrait on /academy.
 *
 * The Mission section ("Drivers helping drivers") was text-only: it named the
 * founder, listed his credentials, and asked the visitor to trust all of it
 * sight-unseen. The approved portrait was already in the repo, already shipping
 * on the homepage Journey strip — the Academy page just never showed it.
 *
 * These checks pin the fix and, more importantly, the honesty rules around it:
 *   1. the page renders the ONE approved asset, at the path it already had —
 *      a second copy under an /academy name would be the same photograph with
 *      two URLs, two downloads, and two chances to drift;
 *   2. the alt text is the already-approved factual sentence — no name, no
 *      invented credential, no keyword stuffing;
 *   3. the declared dimensions match the real WebP header, so the frame keeps
 *      its true 4:5 aspect and reserves the right box (zero CLS);
 *   4. the layout cannot silently crop the face or the Academy chest logo;
 *   5. the locked Mission copy and the /academy/instructors CTA are all still
 *      on the page — this was a photo task, not a copy rewrite.
 *
 * Filesystem only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-academy-instructor-photo.ts --bundle \
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
const JOURNEY = 'src/components/sections/JourneyStrip.tsx';
const PORTRAIT = '/images/journey/academy-instructor-portrait.webp';
const PORTRAIT_FILE = 'public/images/journey/academy-instructor-portrait.webp';
const ALT = 'Trucking Life Academy instructor wearing an Academy shirt.';

const academy = read(ACADEMY);

/** Source with comments stripped — what actually ships. */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const academyCode = codeOnly(academy);

/** The single <CinematicStill …/> element on the page, as written. */
const still = academyCode.match(/<CinematicStill[\s\S]*?\/>/)?.[0] ?? '';

/* 1. the approved asset, reused ---------------------------------------- */

check('academy renders a CinematicStill', still.length > 0);
check(
  'academy imports CinematicStill from the shared media component',
  /import\s*\{\s*CinematicStill\s*\}\s*from\s*'@\/components\/media\/CinematicStill'/.test(
    academyCode,
  ),
);
check(
  `academy points at the approved portrait path: ${PORTRAIT}`,
  still.includes(`src="${PORTRAIT}"`),
);
check(
  'academy renders exactly one photograph in the mission area',
  (academyCode.match(/<CinematicStill/g) ?? []).length === 1,
);

// No duplicate asset: the portrait exists once under public/, and the page
// references no /images/academy/ copy of it.
function webpsNamedLikeThePortrait(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/instructor-portrait/.test(e.name)) out.push(rel);
    }
  };
  walk('public');
  return out.sort();
}
const copies = webpsNamedLikeThePortrait();
check('exactly one instructor-portrait file exists under public/', copies.length === 1, copies);
check('that one file is the path the page renders', copies[0] === PORTRAIT_FILE, copies);
check(
  'academy does not reference an academy-local re-encode',
  !/\/images\/academy\/[^"']*instructor/.test(academyCode),
);

/* 2. factual alt text, unchanged from the approved sentence ------------ */

check('academy carries the approved factual alt text', still.includes(`alt="${ALT}"`));
check('alt text names no person', !/Shawn|Gresham/.test(still));
check(
  'alt text invents no credential, location, or claim',
  !/17|zero violation|CDL-A|Dalton|ELDT|certified|licensed/i.test(
    still.match(/alt="[^"]*"/)?.[0] ?? '',
  ),
);
// The same photograph must describe itself the same way in both places it
// ships; two different alt sentences for one frame is how a factual caption
// quietly becomes a marketing one.
check(
  'the homepage Journey strip still uses that identical sentence',
  read(JOURNEY).includes(`alt: '${ALT}'`),
);

/* 3. true dimensions, true 4:5 ----------------------------------------- */

check('academy declares width 1080', /width=\{1080\}/.test(still));
check('academy declares height 1350', /height=\{1350\}/.test(still));

// Dims come from the WebP header, not from trusting the component. Container
// forms: extended (VP8X: 24-bit LE minus-one fields) or simple lossy (`VP8 `:
// 14-bit LE fields after the 9D 01 2A start code).
const buf = fs.readFileSync(path.join(root, PORTRAIT_FILE));
const form = buf.subarray(12, 16).toString();
const [w, h] =
  form === 'VP8X'
    ? [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
    : [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
check('the real file is 1080×1350 per its own WebP header', w === 1080 && h === 1350, { w, h });
check(
  'declared dimensions match the file, so the box is reserved correctly',
  w === 1080 && h === 1350,
);
check('that is a true 4:5 portrait', Math.abs(w / h - 4 / 5) < 0.001, w / h);
check(
  'the asset stays inside the ≤200 KB house budget',
  buf.length > 20_000 && buf.length <= 200_000,
  buf.length,
);

/* 4. the layout cannot crop the face or the chest logo ----------------- */

// CinematicStill's <Image> is `h-full w-full object-cover`. In a stretched grid
// row the figure inherits the text column's height and object-cover crops the
// frame to fill it. items-start is what keeps the portrait its own shape.
const missionGrid = academyCode.match(/<div className="grid gap-10[^"]*"/)?.[0] ?? '';
check('the mission grid exists', missionGrid.length > 0);
check(
  'the mission grid starts its items rather than stretching them',
  missionGrid.includes('lg:items-start'),
  missionGrid,
);
check('the portrait is given no forced aspect that would re-crop it', !/aspect-\[/.test(still));
check('the portrait is not distorted by an explicit height class', !/\bh-\d|\bh-\[/.test(still));
check(
  'the portrait column can shrink rather than overflow',
  missionGrid.includes('minmax(0,20rem)'),
  missionGrid,
);
check(
  'the text column can shrink rather than overflow',
  missionGrid.includes('minmax(0,1fr)'),
  missionGrid,
);
check('the portrait declares responsive sizes', /sizes="[^"]+"/.test(still));
check('sizes matches the lg column width', /\(min-width:\s*1024px\)\s*20rem/.test(still));
check('the portrait is width-capped on phones', /max-w-sm/.test(still));
check('the phone cap is released at lg', /lg:max-w-none/.test(still));

/* 5. copy lock: nothing on the Academy page was rewritten -------------- */

for (const copy of [
  'The mission',
  'Drivers helping drivers',
  'The trucking industry is full of schools that treat students like a number',
  'Shawn Gresham has spent 17 years in the seat with zero violations',
  '17 years driving',
  'Zero violations',
  'CDL instructor',
  'Driver trainer',
]) {
  check(`mission copy intact: “${copy.slice(0, 48)}”`, academy.includes(copy));
}
check(
  'the /academy/instructors CTA is still present',
  academyCode.includes('href="/academy/instructors"'),
);
check('the CTA still reads “Meet the founder”', /Meet the founder/.test(academyCode));
check('the Free CDL resources CTA is untouched', academyCode.includes('href="/knowledge"'));
check(
  'the mission still renders both of its buttons',
  (academyCode.match(/<Button variant="ghost"/g) ?? []).length >= 2,
);
check(
  'the credibility strip is untouched',
  /17 yrs[\s\S]*Violations[\s\S]*CDL-A[\s\S]*ELDT/.test(academyCode),
);
check('tuition copy is untouched', academy.includes('Being finalized'));
check('licensing copy is untouched', academy.includes('Details published when finalized'));
check(
  'no placement or student-count claim was introduced',
  !/\b\d+\s*(graduates|students placed|placement rate)/i.test(academy),
);
check(
  'academy keeps its metadata export',
  /export const metadata = buildMetadata\(\{/.test(academyCode),
);
check(
  'academy keeps its 60s revalidate window',
  /^export const revalidate = 60;$/m.test(academyCode),
);
check(
  'academy keeps its course + breadcrumb schema',
  /courseSchema\(\)/.test(academyCode) && /breadcrumbSchema\(/.test(academyCode),
);
check(
  'heading hierarchy unchanged — the mission still leads with an h2',
  /<h2 className="display-section">Drivers helping drivers<\/h2>/.test(academyCode),
);
check(
  'no new heading was introduced for the photo',
  !/<h[1-6][^>]*>\s*(Your instructor|Meet)/i.test(academyCode),
);

console.log(`academy-instructor-photo: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

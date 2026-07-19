// THE ROAD AHEAD performance-budget gate (docs/road-ahead-engineering-plan.md §7).
//
// Run AFTER `next build`:
//   node scripts/check-road-ahead-budgets.mjs
//
// Asserts, from the real build output:
//   1. /road-ahead route-initial JS is within +30KB gz of the /founders
//      baseline — the cinematic systems (GSAP, footage, 3D) must never tax
//      first load;
//   2. the lazy cinematic chunk (conductor + footage layer, marked
//      `road-ahead-cinema`) exists and is ≤ 45KB gz;
//   3. the GSAP + ScrollTrigger footprint is lazy and ≤ 70KB gz.
//
// The reused three.js/R3F spine chunk is intentionally NOT re-counted here — it
// is shared with /founders-movement and already gated by check-fm-budgets.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const NEXT = '.next';
const INITIAL_DELTA_LIMIT = 30 * 1024;
const CINEMA_LIMIT = 45 * 1024;
const GSAP_LIMIT = 70 * 1024;

const manifest = JSON.parse(readFileSync(join(NEXT, 'app-build-manifest.json'), 'utf8')).pages;
const gz = (file) => gzipSync(readFileSync(join(NEXT, file))).length;
const sumRoute = (key) =>
  manifest[key].filter((f) => f.endsWith('.js')).reduce((n, f) => n + gz(f), 0);

const raKey = Object.keys(manifest).find((k) => k.includes('road-ahead/page'));
const baseKey = Object.keys(manifest).find(
  (k) => k.includes('founders/page') && !k.includes('movement') && !k.includes('admin'),
);
if (!raKey || !baseKey) {
  console.error('budget check: route manifests not found', { raKey, baseKey });
  process.exit(1);
}

const raInitial = sumRoute(raKey);
const baseInitial = sumRoute(baseKey);
const delta = raInitial - baseInitial;

// Classify lazy (non-initial) chunks. Exclude the shared three spine chunk.
const initialSet = new Set(manifest[raKey]);
const chunkDir = join(NEXT, 'static', 'chunks');
let cinema = 0;
let gsapBytes = 0;
const cinemaFiles = [];
const gsapFiles = [];
for (const f of readdirSync(chunkDir)) {
  if (!f.endsWith('.js')) continue;
  const rel = `static/chunks/${f}`;
  if (initialSet.has(rel)) continue;
  const src = readFileSync(join(chunkDir, f), 'utf8');
  const isThree = src.includes('WebGLRenderer') || src.includes('fm-spine');
  if (isThree) continue; // reused spine — counted by the FM gate, not here
  if (src.includes('road-ahead-cinema')) {
    cinema += gzipSync(src).length;
    cinemaFiles.push(f);
  } else if (src.includes('ScrollTrigger') || src.includes('registerPlugin')) {
    gsapBytes += gzipSync(src).length;
    gsapFiles.push(f);
  }
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(`route-initial gz: /road-ahead ${kb(raInitial)} vs /founders ${kb(baseInitial)}`);
console.log(`initial delta: ${kb(delta)} (limit ${kb(INITIAL_DELTA_LIMIT)})`);
console.log(`lazy cinema chunk(s): ${cinemaFiles.join(', ') || '(none)'} = ${kb(cinema)}`);
console.log(`lazy GSAP chunk(s): ${gsapFiles.join(', ') || '(none)'} = ${kb(gsapBytes)}`);

let failed = false;
if (delta > INITIAL_DELTA_LIMIT) {
  console.error(`FAIL: route-initial delta ${kb(delta)} exceeds ${kb(INITIAL_DELTA_LIMIT)}`);
  failed = true;
}
if (cinemaFiles.length === 0) {
  console.error('FAIL: no lazy cinema chunk found — is the dynamic import intact?');
  failed = true;
}
if (cinema > CINEMA_LIMIT) {
  console.error(`FAIL: cinema chunk ${kb(cinema)} exceeds ${kb(CINEMA_LIMIT)}`);
  failed = true;
}
if (gsapFiles.length === 0) {
  console.error('FAIL: no lazy GSAP chunk found — GSAP must be dynamically imported.');
  failed = true;
}
if (gsapBytes > GSAP_LIMIT) {
  console.error(`FAIL: GSAP footprint ${kb(gsapBytes)} exceeds ${kb(GSAP_LIMIT)}`);
  failed = true;
}
console.log(failed ? '\nRoad Ahead budgets: FAIL' : '\nRoad Ahead budgets: PASS');
process.exit(failed ? 1 : 0);

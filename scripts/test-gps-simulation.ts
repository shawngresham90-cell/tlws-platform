/**
 * Navigator milestone N2: synthetic GPS stream generators (docs/navigator
 * 09 §4), run against the real GPSSessionManager. Deterministic — a seeded
 * LCG stands in for randomness so two runs always agree, matching the
 * repo's no-clock/no-random test discipline.
 *
 * Phase 1 coverage note: the dropout rows assert health transitions only.
 * Dead-reckoning advancement and guidance muting are N5 engine behavior
 * and are deliberately absent here.
 *
 * Run:
 *   npx esbuild scripts/test-gps-simulation.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-gps-simulation.cjs && node /tmp/test-gps-simulation.cjs
 */
import { createGpsSession } from '@/lib/navigator/gps-session';
import type { RawGeoFix } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_754_000_000_000;
const MILE_LAT = 1 / 69.05;
const M_LAT = MILE_LAT / 1609.344; // ~degrees latitude per meter

/** Deterministic LCG in [-1, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x80000000 - 1;
  };
}

/** A northbound run at `mph`, 1 Hz, `seconds` samples. */
function trace(
  seconds: number,
  mph: number,
  mutate: (f: RawGeoFix, i: number, rnd: () => number) => RawGeoFix | null,
): RawGeoFix[] {
  const rnd = lcg(0x7157_a0d1);
  const perSecLat = (mph / 3600) * MILE_LAT;
  const out: RawGeoFix[] = [];
  for (let i = 0; i < seconds; i++) {
    const f: RawGeoFix = {
      lat: 35 + perSecLat * i,
      lng: -84,
      accuracyM: 10,
      speedMps: null,
      headingDeg: null,
      tMs: T0 + i * 1000,
    };
    const m = mutate(f, i, rnd);
    if (m) out.push(m);
  }
  return out;
}

// ------------------------------------------------------------ perfect trace
{
  const s = createGpsSession();
  let allGood = true;
  let accepted = 0;
  for (const f of trace(120, 60, (f) => f)) {
    const st = s.ingestFix(f);
    s.tick(f.tMs);
    if (st.health !== 'good') allGood = false;
    if (st.fix?.tMs === f.tMs) accepted++;
  }
  check('perfect: every fix accepted', accepted === 120, accepted);
  check('perfect: health good throughout', allGood);
  const final = s.state();
  check(
    'perfect: steady 60 mph derived',
    final.speedMph !== null && Math.abs(final.speedMph - 60) < 3,
    final.speedMph,
  );
  check(
    'perfect: due-north heading derived',
    final.headingDeg !== null && (final.headingDeg < 2 || final.headingDeg > 358),
    final.headingDeg,
  );
}

// ------------------------------------------------- gaussian-ish noise σ≈10 m
{
  const s = createGpsSession();
  let degradedOrWorse = 0;
  let discarded = 0;
  for (const f of trace(120, 60, (f, _i, rnd) => ({
    ...f,
    lat: f.lat + rnd() * 10 * M_LAT,
    lng: f.lng + rnd() * 10 * M_LAT,
    accuracyM: 10 + Math.abs(rnd()) * 5,
  }))) {
    const st = s.ingestFix(f);
    s.tick(f.tMs);
    if (st.health !== 'good') degradedOrWorse++;
    if (st.fix?.tMs !== f.tMs) discarded++;
  }
  check('noise σ=10m: no fixes discarded', discarded === 0, discarded);
  check('noise σ=10m: health never leaves good', degradedOrWorse === 0, degradedOrWorse);
}

// ------------------------------------------------ accuracy degradation 80 m
{
  const s = createGpsSession();
  let lastGoodT = 0;
  for (const f of trace(60, 60, (f, i) => (i >= 30 ? { ...f, accuracyM: 80 } : f))) {
    const st = s.ingestFix(f);
    s.tick(f.tMs);
    if (st.fix) lastGoodT = st.fix.tMs;
  }
  check('degradation: fixes past 30 s all discarded', lastGoodT === T0 + 29_000, lastGoodT);
  check(
    'degradation: ends degraded (held fix, not lost) until staleness',
    s.state().health === 'lost' || s.state().health === 'degraded',
  );
  // The tick at the last sample time is > 10 s after the last accepted fix,
  // so staleness has taken over by the end of the run:
  check(
    'degradation: staleness eventually wins over degraded',
    s.tick(T0 + 59_000).health === 'lost',
  );
}

// ------------------------------------------------------------ 30 s dropout
{
  const s = createGpsSession();
  const fixes = trace(90, 60, (f, i) => (i >= 30 && i < 60 ? null : f));
  let sawLost = false;
  let recovered = false;
  let t = T0;
  let fi = 0;
  for (let sec = 0; sec < 90; sec++) {
    t = T0 + sec * 1000;
    while (fi < fixes.length && fixes[fi].tMs <= t) s.ingestFix(fixes[fi++]);
    const st = s.tick(t);
    if (sec > 40 && sec < 60 && st.health === 'lost') sawLost = true;
    if (sec >= 61 && st.health === 'good') recovered = true;
  }
  check('dropout 30s: goes lost during the gap', sawLost);
  check('dropout 30s: recovers to good after the gap', recovered);
  check('dropout 30s: deadReckoning stays false in Phase 1', s.state().deadReckoning === false);
}

// ----------------------------------------------------------- 120 s dropout
{
  const s = createGpsSession();
  for (const f of trace(10, 60, (f) => f)) s.ingestFix(f);
  const st = s.tick(T0 + 10_000 + 120_000);
  check('dropout 120s: lost', st.health === 'lost');
  check('dropout 120s: last known fix still available for display', st.fix !== null);
}

// ---------------------------------------------------------------- teleport
{
  const s = createGpsSession();
  for (const f of trace(10, 60, (f) => f)) s.ingestFix(f);
  const before = s.state().fix;
  const st = s.ingestFix({
    lat: 36.5, // ~100 mi north in one second
    lng: -84,
    accuracyM: 10,
    speedMps: null,
    headingDeg: null,
    tMs: T0 + 10_000,
  });
  check('teleport: impossible fix rejected', st.fix?.tMs === before?.tMs);
  check('teleport: health unchanged', st.health === 'good');
}

// ------------------------------------------------------- stationary jitter
{
  const s = createGpsSession();
  let maxSpeed = 0;
  for (const f of trace(60, 0, (f, _i, rnd) => ({
    ...f,
    lat: 35 + rnd() * 0.5 * M_LAT, // ±0.5 m jitter around a parked truck
    lng: -84 + rnd() * 0.5 * M_LAT,
  }))) {
    const st = s.ingestFix(f);
    s.tick(f.tMs);
    if (st.speedMph !== null && st.speedMph > maxSpeed) maxSpeed = st.speedMph;
  }
  check('stationary: sub-meter jitter never fabricates motion (< 3 mph)', maxSpeed < 3, maxSpeed);
}

// ------------------------------------------------------------- 4 mph crawl
{
  const s = createGpsSession();
  let final: number | null = null;
  for (const f of trace(120, 4, (f) => f)) {
    final = s.ingestFix(f).speedMph;
    s.tick(f.tMs);
  }
  check('crawl: 4 mph derived within 1 mph', final !== null && Math.abs(final - 4) < 1, final);
}

console.log(`gps-simulation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

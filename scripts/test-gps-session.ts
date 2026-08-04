/**
 * Navigator milestone N2: GPSSessionManager gate tests. Pure — synthetic
 * fixes only, time supplied as data, no browser, no network.
 *
 * Gates under test (docs/navigator 04 §2, 05 §1):
 *   accuracy > 50 m -> discard + degraded (last good fix held)
 *   implied speed > 100 mph -> discard as spurious
 *   staleness > 10 s -> lost (via caller-driven tick)
 *   speed: device value preferred; derived needs TWO fixes; never from one
 *   heading: device value preferred; derived from consecutive fixes
 *   denied / unavailable / timeout normalization
 *   reset drops everything (position is ephemeral, AD-7)
 *
 * Run:
 *   npx esbuild scripts/test-gps-session.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-gps-session.cjs && node /tmp/test-gps-session.cjs
 */
import {
  createGpsSession,
  MAX_ACCURACY_M,
  MAX_IMPLIED_SPEED_MPH,
  STALE_AFTER_MS,
} from '@/lib/navigator/gps-session';
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

const T0 = 1_754_000_000_000; // fixed epoch base: no clock is ever read
const fix = (over: Partial<RawGeoFix> = {}): RawGeoFix => ({
  lat: 35.0,
  lng: -84.0,
  accuracyM: 10,
  speedMps: null,
  headingDeg: null,
  tMs: T0,
  ...over,
});

// One degree of longitude at 35°N ≈ 56.7 mi; 0.001° lat ≈ 0.069 mi.
const MILE_LAT = 1 / 69.05;

// ------------------------------------------------------------- constants
check('constants: accuracy gate is 50 m', MAX_ACCURACY_M === 50);
check('constants: staleness is 10 s', STALE_AFTER_MS === 10_000);
check('constants: jump gate is 100 mph', MAX_IMPLIED_SPEED_MPH === 100);

// ---------------------------------------------------------- initial state
{
  const s = createGpsSession();
  const st = s.state();
  check('initial: no fix', st.fix === null);
  check('initial: health unavailable', st.health === 'unavailable');
  check('initial: speed and heading null', st.speedMph === null && st.headingDeg === null);
  check('initial: deadReckoning false (Phase 1 constant)', st.deadReckoning === false);
}

// ---------------------------------------------------------- accuracy gate
{
  const s = createGpsSession();
  s.ingestFix(fix());
  const st = s.ingestFix(fix({ accuracyM: 51, tMs: T0 + 1000, lat: 35.001 }));
  check('accuracy: >50 m discarded', st.fix?.tMs === T0);
  check('accuracy: health degraded', st.health === 'degraded');
  check('accuracy: last good fix held', st.fix?.lat === 35.0);
  const back = s.ingestFix(fix({ accuracyM: 50, tMs: T0 + 2000 }));
  check('accuracy: exactly 50 m accepted (boundary)', back.fix?.tMs === T0 + 2000);
  check('accuracy: recovery to good', back.health === 'good');
}
{
  const s = createGpsSession();
  const st = s.ingestFix(fix({ accuracyM: 80 }));
  check('accuracy: first-ever fix over gate leaves no fix', st.fix === null);
  check('accuracy: first-ever fix over gate reports degraded', st.health === 'degraded');
}

// -------------------------------------------------------------- jump gate
{
  const s = createGpsSession();
  s.ingestFix(fix());
  // 2 miles in 10 s = 720 mph: teleport.
  const st = s.ingestFix(fix({ lat: 35.0 + 2 * MILE_LAT, tMs: T0 + 10_000 }));
  check('jump: teleport discarded', st.fix?.tMs === T0);
  check('jump: health untouched by spurious fix', st.health === 'good');
  // 0.2 mi in 10 s = 72 mph: plausible highway motion, accepted.
  const ok = s.ingestFix(fix({ lat: 35.0 + 0.2 * MILE_LAT, tMs: T0 + 20_000 }));
  check('jump: plausible speed accepted', ok.fix?.tMs === T0 + 20_000);
  check(
    'jump: derived speed near 36 mph over the 20 s window',
    ok.speedMph !== null && Math.abs(ok.speedMph - 36) < 3,
    ok.speedMph,
  );
}
{
  const s = createGpsSession();
  s.ingestFix(fix());
  const st = s.ingestFix(fix({ lat: 35.01, tMs: T0 })); // duplicate timestamp
  check('jump: non-advancing timestamp discarded', st.fix?.lat === 35.0);
  const st2 = s.ingestFix(fix({ lat: 35.01, tMs: T0 - 5000 })); // regression
  check('jump: past timestamp discarded', st2.fix?.lat === 35.0);
}

// ------------------------------------------------------- speed derivation
{
  const s = createGpsSession();
  const first = s.ingestFix(fix());
  check('speed: NEVER derived from one fix', first.speedMph === null);
  const second = s.ingestFix(fix({ lat: 35.0 + MILE_LAT, tMs: T0 + 60_000 }));
  check(
    'speed: derived from two consecutive fixes (1 mi/min ≈ 60 mph)',
    second.speedMph !== null && Math.abs(second.speedMph - 60) < 2,
    second.speedMph,
  );
}
{
  const s = createGpsSession();
  s.ingestFix(fix());
  const st = s.ingestFix(fix({ speedMps: 26.82, tMs: T0 + 1000, lat: 35.0001 }));
  check(
    'speed: device speed preferred over derivation (26.82 m/s ≈ 60 mph)',
    st.speedMph !== null && Math.abs(st.speedMph - 60) < 0.5,
    st.speedMph,
  );
  const neg = s.ingestFix(fix({ speedMps: -3, tMs: T0 + 2000, lat: 35.0002 }));
  check(
    'speed: negative device speed falls back to derivation',
    neg.speedMph !== null && neg.speedMph >= 0,
  );
}

// ---------------------------------------------------- heading derivation
{
  const s = createGpsSession();
  s.ingestFix(fix());
  const north = s.ingestFix(fix({ lat: 35.01, tMs: T0 + 30_000 }));
  check(
    'heading: derived due-north bearing ≈ 0°',
    north.headingDeg !== null && (north.headingDeg < 1 || north.headingDeg > 359),
    north.headingDeg,
  );
  const device = s.ingestFix(fix({ lat: 35.02, tMs: T0 + 60_000, headingDeg: 92 }));
  check('heading: device heading preferred', device.headingDeg === 92);
  const wrapped = s.ingestFix(fix({ lat: 35.03, tMs: T0 + 90_000, headingDeg: 450 }));
  check('heading: normalized into [0,360)', wrapped.headingDeg === 90);
}
{
  const s = createGpsSession();
  const only = s.ingestFix(fix());
  check('heading: null on a single fix', only.headingDeg === null);
}

// -------------------------------------------------------------- staleness
{
  const s = createGpsSession();
  s.ingestFix(fix());
  check('stale: within window stays good', s.tick(T0 + STALE_AFTER_MS).health === 'good');
  const lost = s.tick(T0 + STALE_AFTER_MS + 1);
  check('stale: past window goes lost', lost.health === 'lost');
  check('stale: last fix survives lost for display-as-last-known', lost.fix !== null);
  const rec = s.ingestFix(fix({ tMs: T0 + 60_000 }));
  check('stale: fresh fix recovers to good', rec.health === 'good');
}
{
  const s = createGpsSession();
  check('stale: tick with no fix stays unavailable', s.tick(T0 + 99_999).health === 'unavailable');
}

// ----------------------------------------------------------------- errors
{
  const s = createGpsSession();
  s.ingestFix(fix());
  const denied = s.ingestError('denied');
  check('denied: health denied', denied.health === 'denied');
  check('denied: position cleared outright (fail-safe)', denied.fix === null);
  const regrant = s.ingestFix(fix({ tMs: T0 + 5000 }));
  check('denied: re-granted fix recovers', regrant.health === 'good' && regrant.fix !== null);
}
{
  const s = createGpsSession();
  const st = s.ingestError('unavailable');
  check('unavailable: health unavailable', st.health === 'unavailable');
  s.ingestFix(fix());
  check('timeout with a fix in hand -> lost', s.ingestError('timeout').health === 'lost');
}
{
  const s = createGpsSession();
  check('timeout with no fix -> unavailable', s.ingestError('timeout').health === 'unavailable');
}

// ---------------------------------------------------------------- malformed
{
  const s = createGpsSession();
  const bads: Partial<RawGeoFix>[] = [
    { lat: Number.NaN },
    { lng: 181 },
    { lat: 91 },
    { accuracyM: -1 },
    { accuracyM: Number.NaN },
    { tMs: Number.NaN },
  ];
  for (const b of bads) s.ingestFix(fix(b));
  check('malformed: every invalid sample ignored', s.state().fix === null);
}

// -------------------------------------------------------------------- reset
{
  const s = createGpsSession();
  s.ingestFix(fix());
  s.ingestFix(fix({ tMs: T0 + 1000, lat: 35.001 }));
  const st = s.reset();
  check('reset: fix dropped', st.fix === null);
  check('reset: health back to unavailable', st.health === 'unavailable');
  check('reset: speed/heading cleared', st.speedMph === null && st.headingDeg === null);
}

console.log(`gps-session: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

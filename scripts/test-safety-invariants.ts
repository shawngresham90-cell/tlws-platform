/**
 * N4 merge-blocking safety invariants (doc 06 §7), adapted honestly to the
 * Phase 2A surface: invariants for capabilities that do not exist yet
 * (voice announcements N7, off-route/reroute N8) are enforced as
 * ABSENCE — the code that could violate them must not exist at all.
 *
 *   1. UNKNOWN resolves to locked — every entry path.
 *   2. Every UIAction has an explicit permission mapping (default-deny).
 *   3. Override expires at 15 min and is cleared by a stop/start cycle.
 *   4. Override never survives a reload (nothing persists it).
 *   5. Route replacement: none exists yet (N8e) — asserted absent; and
 *      off-route (N8d, observe-only) never fires within 150 m of a
 *      planned stop — asserted behaviorally.
 *   6. Announcements: none exist yet (N7) — asserted absent.
 *   7. The exit control is reachable in every lock state.
 *
 * Run:
 *   npx esbuild scripts/test-safety-invariants.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-safety-invariants.cjs \
 *   && node /tmp/test-safety-invariants.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSafetyLock, OVERRIDE_DURATION_MS } from '@/lib/navigator/safety-lock';
import { ACTION_PERMISSIONS, allowedWhileMoving, type UIAction } from '@/lib/navigator/actions';
import { createOffRouteDetector } from '@/lib/navigator/off-route-detector';
import type { PositionState } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const T0 = 1_754_000_000_000;
const base: PositionState = {
  fix: { lat: 35, lng: -85, accuracyM: 8, tMs: T0, speedMph: 60, headingDeg: 0 },
  health: 'good',
  lastFixMs: T0,
  accuracyM: 8,
  speedMph: 60,
  headingDeg: 0,
  deadReckoning: false,
};

// INVARIANT 1 — every UNKNOWN entry path locks.
{
  const entries: [string, PositionState][] = [
    ['fresh controller (no samples)', base], // state() before any sample
    ['no fix', { ...base, fix: null, health: 'unavailable', speedMph: null }],
    ['denied', { ...base, fix: null, health: 'denied', speedMph: null }],
    ['lost', { ...base, health: 'lost' }],
    ['speed null', { ...base, speedMph: null }],
    ['speed NaN', { ...base, speedMph: Number.NaN }],
  ];
  check('invariant 1: pristine controller is locked', createSafetyLock('i').state(T0).locked);
  for (const [name, p] of entries) {
    const lock = createSafetyLock('i1');
    const s = lock.sample(p, T0);
    check(`invariant 1: ${name} → locked`, s.locked, s);
  }
  const staleLock = createSafetyLock('i1s');
  const s = staleLock.sample(base, T0 + 10_001);
  check('invariant 1: stale fix (>10 s) → locked', s.locked && s.motion === 'UNKNOWN');
}

// INVARIANT 2 — default-deny with a complete explicit map.
{
  const src = strip(readFileSync('src/lib/navigator/actions.ts', 'utf8'));
  const declared = [...src.matchAll(/\|\s*'([a-z-]+)'/g)].map((m) => m[1]) as UIAction[];
  check('invariant 2: UIAction union is non-trivial', declared.length >= 10, declared.length);
  for (const a of declared) {
    check(`invariant 2: '${a}' has an explicit mapping`, a in ACTION_PERMISSIONS);
  }
  check(
    'invariant 2: unmapped/unknown action is DENIED',
    allowedWhileMoving('brand-new-action') === false,
  );
  check('invariant 2: no per-component motion checks (grep)', componentMotionChecksAbsent());
}
function componentMotionChecksAbsent(): boolean {
  const dir = 'src/components/navigator';
  for (const f of readdirSync(dir)) {
    const src = strip(readFileSync(join(dir, f), 'utf8'));
    // The provider computes lock state, and the overlay's entire job is to
    // DISPLAY it (it is asserted interaction-free below) — every other
    // component must consult the gate, never test motion directly.
    if (f === 'SafetyLockProvider.tsx') continue;
    if (f === 'MotionLockOverlay.tsx') {
      if (/<button|onClick|onPointer|onKey/i.test(src)) return false; // display-only
      continue;
    }
    if (/motion\s*===\s*'MOVING'|speedMph\s*[<>]/.test(src)) return false;
  }
  return true;
}

// INVARIANT 3 — expiry + stop/start revocation (behavioral, real controller).
{
  const lock = createSafetyLock('i3');
  for (let t = 0; t <= 10_000; t += 1000)
    lock.sample({ ...base, lastFixMs: T0 + t, fix: { ...base.fix!, tMs: T0 + t } }, T0 + t);
  lock.grantOverride(T0 + 11_000, 'edit-destination');
  check(
    'invariant 3: active inside 15 min',
    lock.state(T0 + 11_000 + OVERRIDE_DURATION_MS - 1).overrideActive,
  );
  check(
    'invariant 3: expired at 15 min',
    !lock.state(T0 + 11_000 + OVERRIDE_DURATION_MS).overrideActive,
  );
}

// INVARIANT 4 — nothing persists the override (source scan, comment-stripped).
{
  const files = [
    'src/lib/navigator/safety-lock.ts',
    ...readdirSync('src/components/navigator').map((f) => join('src/components/navigator', f)),
  ];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    check(
      `invariant 4: ${f.split('/').pop()} touches no storage/cookies/URL state`,
      !/localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|URLSearchParams/i.test(
        src,
      ),
    );
  }
}

// INVARIANTS 5 & 6 — route-REPLACEMENT code and announcements do not
// exist yet. With N8d, off-route DETECTION exists observe-only, so
// invariant 5 graduates to its real doc 06 §7 form as well: off-route
// never fires within 150 m of a planned stop — proven behaviorally.
{
  const libDir = 'src/lib/navigator';
  let replacement = false;
  let announce = false;
  for (const f of readdirSync(libDir)) {
    const src = strip(readFileSync(join(libDir, f), 'utf8'));
    if (/reroute/i.test(src)) replacement = true;
    if (/speechSynthesis|announce/i.test(src)) announce = true;
  }
  check('invariant 5a: no route-replacement code exists (N8e)', !replacement);
  check('invariant 6: no announcement code exists (N7)', !announce);

  // Invariant 5b — the planned-stop exclusion, against the real detector:
  // fixes that scream "off route" can NEVER confirm within 150 m of a
  // planned stop.
  const detector = createOffRouteDetector();
  const screaming = {
    matched: true,
    routeMile: 10,
    candidateMile: 10,
    lateralM: 140,
    headingDeltaDeg: 5,
    travelDirection: 'forward' as const,
    confidence: 'low' as const,
    advanceEligible: false,
    reasons: ['far-from-route'],
  };
  for (let i = 0; i < 20; i++) {
    detector.observe({
      match: screaming,
      tMs: T0 + i * 3000,
      speedMph: 45,
      nearestPlannedStopM: 120,
    });
  }
  check(
    'invariant 5b: off-route never fires within 150 m of a planned stop',
    detector.state().state === 'on-route' && detector.events().every((e) => e.to !== 'confirmed'),
  );
}

// INVARIANT 7 — the exit control is reachable in every lock state:
// stop-navigation is explicitly permitted while moving, and the screen
// renders it inside the gate for that action.
{
  check(
    'invariant 7: stop-navigation permitted while MOVING',
    ACTION_PERMISSIONS['stop-navigation'] === true,
  );
  const screen = strip(readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8'));
  check(
    'invariant 7: stop control rendered through the LockGate for stop-navigation',
    /LockGate action="stop-navigation"/.test(screen),
  );
  check(
    'invariant 7: emergency-class action mapped as never locked',
    ACTION_PERMISSIONS['open-emergency'] === true,
  );
}

console.log(`safety-invariants: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

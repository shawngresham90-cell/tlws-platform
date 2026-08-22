/**
 * N4 merge-blocking safety invariants (doc 06 §7). With N7 voice merged
 * on top of the N8 stack, every invariant is now BEHAVIORAL — enforced
 * against the real engines, not by asserting code absence.
 *
 *   1. UNKNOWN resolves to locked — every entry path.
 *   2. Every UIAction has an explicit permission mapping (default-deny).
 *   3. Override expires at 15 min and is cleared by a stop/start cycle.
 *   4. Override never survives a reload (nothing persists it).
 *   5. Off-route/reroute discipline (behavioral): 5a — replacement may
 *      spend ONLY from a CONFIRMED off-route state; 5b — off-route never
 *      fires within 150 m of a planned stop (doc 06 §7 item 5).
 *   6. Maneuvers never announce twice (real N7 announcer + guidance).
 *   7. The exit control is reachable in every lock state.
 *
 * Run:
 *   npx esbuild scripts/test-safety-invariants.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-safety-invariants.cjs \
 *   && node /tmp/test-safety-invariants.cjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSafetyLock } from '@/lib/navigator/safety-lock';
import { ACTION_PERMISSIONS, allowedWhileMoving, type UIAction } from '@/lib/navigator/actions';
import { createManeuverAnnouncer, createVoiceGuidance } from '@/lib/navigator/voice-guidance';
import { createOffRouteDetector } from '@/lib/navigator/off-route-detector';
import { createRerouteController } from '@/lib/navigator/reroute-controller';
import { createRouteSession } from '@/lib/navigator/route-session';
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
  check('invariant 1: pristine controller is locked', createSafetyLock().state(T0).locked);
  for (const [name, p] of entries) {
    const lock = createSafetyLock();
    const s = lock.sample(p, T0);
    check(`invariant 1: ${name} → locked`, s.locked, s);
  }
  const staleLock = createSafetyLock();
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

// INVARIANT 3 — THERE IS NO OVERRIDE TO EXPIRE (NAV-ENTRY-1).
/*
 * This invariant used to assert that a passenger override expired at exactly
 * fifteen minutes and was revoked by a stop/start cycle. The owner removed the
 * override, so the strongest available statement of the same safety property
 * is that nothing can grant one at all — an expiry test on a feature that does
 * not exist would pass forever while proving nothing.
 *
 * The behavioural half of the old invariant survives below it: a truck that is
 * observed moving reports locked, and stays locked for as long as it is
 * moving, with no API anywhere that can say otherwise.
 */
{
  const lock = createSafetyLock();
  check(
    'invariant 3: the controller has no grant function',
    !('grantOverride' in lock) && !('overrideLog' in lock),
  );
  for (let t = 0; t <= 10_000; t += 1000)
    lock.sample({ ...base, lastFixMs: T0 + t, fix: { ...base.fix!, tMs: T0 + t } }, T0 + t);
  const moving = lock.state(T0 + 11_000);
  check('invariant 3: a moving truck is locked', moving.locked && moving.motion === 'MOVING');
  check(
    'invariant 3: it is STILL locked fifteen minutes later — nothing timed out into permission',
    lock.state(T0 + 11_000 + 15 * 60_000).locked,
  );
  check(
    'invariant 3: no override field survives on the state',
    !('overrideActive' in (moving as Record<string, unknown>)) &&
      !('overrideRemainingMs' in (moving as Record<string, unknown>)),
  );
}

// INVARIANT 3b — no passenger vocabulary anywhere in the Navigator UI.
{
  const uiFiles = readdirSync('src/components/navigator')
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join('src/components/navigator', f));
  const banned = /passenger|press[- ]and[- ]hold|grantOverride|override countdown/i;
  for (const f of uiFiles) {
    // Stripped: a comment explaining what was removed is documentation, not
    // an affordance. The ban is on what a driver can read.
    check(
      `invariant 3b: ${f.split('/').pop()} carries no passenger-access vocabulary`,
      !banned.test(strip(readFileSync(f, 'utf8'))),
    );
  }
  check(
    'invariant 3b: the passenger dialog component is gone from the tree',
    !readdirSync('src/components/navigator').includes('PassengerOverrideDialog.tsx'),
  );
}

// INVARIANT 4 — the Navigator UI persists nothing but its sanctioned records.
{
  const files = [
    'src/lib/navigator/safety-lock.ts',
    ...readdirSync('src/components/navigator').map((f) => join('src/components/navigator', f)),
  ];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    // The override stays unpersistable everywhere. Two module kinds may
    // touch storage at all: the driving screen, which persists the
    // planned ROUTE and the confirmed truck (pilot round 3 item 4, and
    // the truck-route confidence milestone), and a `*-storage.ts`
    // preference module, which persists one versioned key of enum values
    // (region-storage.ts, Canada milestone). Neither persists the
    // override, the name, or a position — that is what this invariant
    // enforces, since the override token stays banned in the scrubbed
    // source too. Their harnesses (test-navigator-trip-restore,
    // test-navigator-canada) pin which keys exist; here the sanctioned
    // CALL SHAPES are scrubbed and everything else — every other storage
    // token, every other file — stays banned.
    /*
     * NavigatorSettings.tsx joins the sanctioned list (NAV-ENTRY-1). It READS
     * the trip snapshot — through the same parser the driving screen uses — to
     * decide whether to tell the driver that a change applies to their next
     * route. It never writes or clears it: the settings screen has no
     * lifecycle, which is the property that makes "opening Settings mid-trip
     * cannot destroy the trip" structural rather than remembered.
     */
    const storageSanctioned =
      f.endsWith('DrivingScreen.tsx') ||
      f.endsWith('NavigatorSettings.tsx') ||
      /-storage\.ts$/.test(f);
    const scrubbed = storageSanctioned
      ? src
          .replace(
            /(session|local)Storage\s*\.\s*(getItem|setItem|removeItem)\s*\(/g,
            'SANCTIONED_KEY_(',
          )
          .replace(/typeof (session|local)Storage/g, 'SANCTIONED_KEY_GUARD')
      : src;
    check(
      `invariant 4: ${f.split('/').pop()} touches no storage/cookies/URL state`,
      !/localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|URLSearchParams/i.test(
        scrubbed,
      ),
    );
  }
}

// INVARIANT 6 — maneuvers never announce twice (doc 06 §7 item 6), a
// BEHAVIORAL invariant against the real N7 announcer: the same maneuver
// tier can never fire two announcements no matter how many ticks see it,
// and the guidance module independently refuses a repeated id. The old
// absence pin retires WITH ITS TEETH KEPT: the pure module still may not
// touch the browser (purity gate), and speechSynthesis may appear ONLY
// in the sanctioned component adapter (checked here).
{
  const view = {
    next: { action: 'exit', instruction: 'Take exit 320', direction: 'right', mileMi: 100 },
    following: null,
    distanceMi: 0.4,
  };
  const announcer = createManeuverAnnouncer();
  const ids: string[] = [];
  for (let i = 0; i < 50; i++) {
    for (const r of announcer.collect({ ...view, distanceMi: 0.4 - i * 0.005 }, 60)) ids.push(r.id);
  }
  check(
    'invariant 6: 50 shrinking-distance ticks → every (maneuver, tier) at most once',
    new Set(ids).size === ids.length && ids.length <= 3,
    ids,
  );

  const spoken: string[] = [];
  const voice = createVoiceGuidance({
    supported: true,
    speak: (t) => spoken.push(t),
    cancel: () => {},
  });
  const req = { id: 'maneuver:x:approach', priority: 'normal' as const, text: 'Take exit 320' };
  voice.request(req);
  check(
    'invariant 6: guidance module refuses a repeated announcement id',
    voice.request(req) === 'dropped-repeat' && spoken.length === 1,
  );

  // speechSynthesis stays confined to the one sanctioned adapter.
  const offenders: string[] = [];
  for (const dir of ['src/lib/navigator', 'src/components/navigator']) {
    for (const f of readdirSync(dir)) {
      const src = strip(readFileSync(join(dir, f), 'utf8'));
      if (/speechSynthesis/i.test(src) && f !== 'speech-port.ts') offenders.push(f);
    }
  }
  check('invariant 6: speechSynthesis only in speech-port.ts', offenders.length === 0, offenders);
}

// INVARIANT 5 — off-route and replacement (N8d/N8e) enforced BEHAVIORALLY:
// confirmed-only spend and the doc 06 §7 planned-stop exclusion.
{
  // Invariant 5a — with N8e, route replacement exists but is CAGED:
  // only a CONFIRMED off-route state may spend a provider transaction,
  // and the trailing-hour budget is a hard stop. Proven against the real
  // controller with a counting port.
  {
    const geometry: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 200; i++) geometry.push({ lat: 35 + i * 0.001, lng: -85 });
    const made = createRouteSession({
      routeId: 'inv5a',
      truck: {
        lengthFt: 73,
        heightFt: 13.5,
        widthFt: 8.5,
        grossWeightLbs: 80_000,
        axles: 5,
        hazmatClass: null,
        tankGallons: 200,
        mpg: 6.5,
        fuelSafetyFactor: 0.8,
      },
      origin: geometry[0],
      destination: geometry[199],
      positions: geometry,
      distanceMiles: 13.7,
      durationSeconds: 900,
      maneuvers: [{ action: 'depart', instruction: 'Go.', direction: null, offset: 0 }],
      validationState: 'valid',
    });
    if (!made.ok) throw new Error('inv5a fixture failed');
    let calls = 0;
    const controller = createRerouteController(made.session, async () => {
      calls += 1;
      return { kind: 'failure', reason: 'inv5a-port' };
    });
    const pos = { lat: 35.05, lng: -85.002 };
    void controller.requestReroute({
      detectorState: 'suspected',
      currentPosition: pos,
      accuracyM: 8,
      tMs: T0,
    });
    void controller.requestReroute({
      detectorState: 'recovering',
      currentPosition: pos,
      accuracyM: 8,
      tMs: T0 + 1,
    });
    void controller.requestReroute({
      detectorState: 'on-route',
      currentPosition: pos,
      accuracyM: 8,
      tMs: T0 + 2,
    });
    check('invariant 5a: only CONFIRMED may spend — every other state refused free', calls === 0);
  }

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

// Invariant 5a (budget half) — sequential spends, awaited so nothing
// coalesces: with cooldowns elapsed, the 7th confirmed request in the
// trailing hour is refused unspent.
async function invariant5aBudget(): Promise<void> {
  const geometry: { lat: number; lng: number }[] = [];
  for (let i = 0; i < 200; i++) geometry.push({ lat: 35 + i * 0.001, lng: -85 });
  const made = createRouteSession({
    routeId: 'inv5a-budget',
    truck: {
      lengthFt: 73,
      heightFt: 13.5,
      widthFt: 8.5,
      grossWeightLbs: 80_000,
      axles: 5,
      hazmatClass: null,
      tankGallons: 200,
      mpg: 6.5,
      fuelSafetyFactor: 0.8,
    },
    origin: geometry[0],
    destination: geometry[199],
    positions: geometry,
    distanceMiles: 13.7,
    durationSeconds: 900,
    maneuvers: [{ action: 'depart', instruction: 'Go.', direction: null, offset: 0 }],
    validationState: 'valid',
  });
  if (!made.ok) throw new Error('inv5a budget fixture failed');
  let spent = 0;
  const budget = createRerouteController(
    made.session,
    async () => {
      spent += 1;
      return { kind: 'failure', reason: 'budget-port' };
    },
    { failureBackoffMs: [1], successCooldownMs: 1, duplicateWindowMs: 0 },
  );
  let t = T0;
  for (let i = 0; i < 7; i++) {
    t += 60_000 + i;
    await budget.requestReroute({
      detectorState: 'confirmed',
      currentPosition: { lat: 35.01 + i * 0.01, lng: -85.002 },
      accuracyM: 8,
      tMs: t,
    });
  }
  check('invariant 5a: trailing-hour budget refuses the 7th spend', spent === 6, spent);
}

void (async () => {
  await invariant5aBudget();
  console.log(`safety-invariants: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();

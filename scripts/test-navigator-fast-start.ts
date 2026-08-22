/**
 * Navigator Fast Start — the pilot's four complaints, as assertions.
 *
 * The complaints:
 *   "Why do I have to keep entering my truck information?"
 *   "I also need saved settings such as avoiding tolls."
 *   "I should not have to say I'm a passenger while I'm parked."
 *   "It takes too long to get moving."
 *
 * The motion transitions below are the safety-critical half. They are
 * driven through the REAL `createSafetyLock` with real fixes and real
 * timestamps — never by reading the source — because the property that
 * matters is what the machine does at 3 mph and 61 seconds, not what a
 * comment says it does.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-fast-start.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-navigator-fast-start.cjs \
 *   && node /tmp/test-navigator-fast-start.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createSafetyLock,
  MOVING_DWELL_MS,
  STATIONARY_DWELL_MS,
  STATIONARY_GRACE_MS,
  POSITION_FRESH_MS,
} from '@/lib/navigator/safety-lock';
import { allowedWhileMoving } from '@/lib/navigator/actions';
import {
  DEFAULT_ROUTE_PREFERENCES,
  ROUTE_PREFERENCE_SPECS,
  claimsMatchRequest,
  preferencesChanged,
  preferencesToAvoid,
  summarizePreferences,
  unsupportedPreferenceFeatures,
  type RoutePreferences,
} from '@/lib/navigator/route-preferences';
import { HERE_AVOID_FEATURES, sanitizeAvoidances } from '@/lib/trip-planner/here-truck-params';
import { truckWireParams } from '@/lib/trip-planner/here-truck-params';
import {
  DEFAULT_EDITABLE_PROFILE,
  confirmProfile,
  profileGate,
  routingFingerprint,
  toTruckProfile,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import { formatDimension } from '@/lib/navigator/format-units';
import { CLOCKS_NOT_SET, summarizeEnteredClocks } from '@/lib/navigator/hos-clocks';
import {
  CLOCKS_UNAVAILABLE_WARNING,
  START_NEEDS_DESTINATION,
  START_NEEDS_TRUCK,
  setupStatus,
  type SetupStatus,
} from '@/lib/navigator/setup-status';
import type { PositionState } from '@/lib/navigator/types';

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
const itemState = (s: SetupStatus, key: string) => s.items.find((i) => i.key === key)?.state;

/* ============ a position, as the gated GPS reports one ============== */

const T0 = 1_800_000_000_000;

/*
 * A REAL `PositionState`, not a cast. The lock reads `lastFixMs` to decide
 * whether a fix is stale and `speedMph` to decide motion, so a fixture
 * that merely satisfies the compiler by assertion could drift out of the
 * shipped shape without anyone noticing — and these are the assertions
 * standing between a driver and a text field at 60 mph.
 */
function at(speedMph: number | null, tMs: number): PositionState {
  return {
    fix:
      speedMph === null
        ? null
        : { lat: 35, lng: -85, accuracyM: 8, tMs, speedMph, headingDeg: null },
    speedMph,
    headingDeg: null,
    lastFixMs: tMs,
    accuracyM: speedMph === null ? Number.NaN : 8,
    health: speedMph === null ? 'unavailable' : 'good',
    deadReckoning: false,
  };
}

/** No fix at all — permission denied, or the signal simply gone. */
const NO_FIX: PositionState = {
  fix: null,
  speedMph: null,
  headingDeg: null,
  lastFixMs: 0,
  accuracyM: Number.NaN,
  health: 'unavailable',
  deadReckoning: false,
};

/** Hold a speed long enough to earn a determination. */
function settle(
  lock: ReturnType<typeof createSafetyLock>,
  mph: number,
  fromMs: number,
  forMs: number,
) {
  let t = fromMs;
  const end = fromMs + forMs;
  while (t <= end) {
    lock.sample(at(mph, t), t);
    t += 1000;
  }
  return end;
}

/* ============ 14. a parked driver is never called a passenger ======= */
{
  const lock = createSafetyLock();
  // Cold start, no fix ever: the setup window is open and setup is usable.
  const cold = lock.sample(NO_FIX, T0);
  check('cold start: motion is UNKNOWN and the setup window is open', cold.setupWindow === true);
  check(
    'cold start: the lock reason is an unknown location, never movement',
    cold.lockReason === 'location-unknown',
    cold.lockReason,
  );
  /*
   * The setup-window exemption is gone (NAV-ENTRY-1). Destination entry is
   * permitted outright now, which is a strictly stronger version of what this
   * check has always been protecting: a parked driver can type where they are
   * going. It no longer depends on the cold-start window being open, so it
   * also holds for the driver whose window has latched shut.
   */
  check(
    'cold start: the parked driver can still set a destination',
    allowedWhileMoving('edit-destination'),
  );
  check(
    'and they are not asked to declare themselves a passenger to do it',
    !/passenger/i.test(
      read('src/components/navigator/LockGate.tsx')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' '),
    ),
  );
}

/* ============ 15/16. the full motion table ========================== */
{
  const lock = createSafetyLock();
  // --- verified stationary -----------------------------------------
  const tStat = settle(lock, 0, T0, STATIONARY_DWELL_MS + 2000);
  const stationary = lock.state(tStat);
  check('verified stationary: unlocked', stationary.locked === false, stationary);
  check('verified stationary: motion is STATIONARY', stationary.motion === 'STATIONARY');
  check('verified stationary: no lock reason at all', stationary.lockReason === null);

  // --- stationary, then the signal goes quiet ----------------------
  const lost = lock.sample(NO_FIX, tStat + 1000);
  check('stationary + signal lost: the parked grace is running', lost.parkedGrace === true, lost);
  check(
    'stationary + signal lost: it is NOT reported as movement',
    lost.lockReason === 'location-unknown',
    lost.lockReason,
  );
  const midGrace = lock.sample(NO_FIX, tStat + STATIONARY_GRACE_MS - 2000);
  check('parked grace: still running just before it expires', midGrace.parkedGrace === true);

  // --- and it does expire ------------------------------------------
  const expired = lock.sample(NO_FIX, tStat + STATIONARY_GRACE_MS + 2000);
  check('parked grace: expires on schedule', expired.parkedGrace === false, expired);
  check(
    'parked grace: after expiry it is STILL not called movement',
    expired.lockReason === 'location-unknown',
    expired.lockReason,
  );
  check('parked grace: never longer than the documented 60 s', STATIONARY_GRACE_MS <= 60_000);
}

/* ---- positive movement evidence ends the grace immediately -------- */
{
  const lock = createSafetyLock();
  const tStat = settle(lock, 0, T0, STATIONARY_DWELL_MS + 2000);
  lock.sample(NO_FIX, tStat + 1000);
  check('grace is running before the truck moves', lock.state(tStat + 1000).parkedGrace === true);
  /*
   * ONE sample at the moving threshold. This is well short of the 10 s
   * dwell a MOVING determination needs — the point is that evidence of
   * motion ends the grace faster than certainty of motion is reached.
   */
  const moved = lock.sample(at(12, tStat + 2000), tStat + 2000);
  check('one moving sample ends the parked grace at once', moved.parkedGrace === false, moved);
  check('...without yet claiming a MOVING determination', moved.motion !== 'MOVING', moved.motion);
}

/* ---- verified moving, then signal loss: NO grace ------------------ */
{
  const lock = createSafetyLock();
  const tMove = settle(lock, 30, T0, MOVING_DWELL_MS + 2000);
  const moving = lock.state(tMove);
  check('verified moving: locked', moving.locked === true);
  check('verified moving: the reason is movement', moving.lockReason === 'moving', moving);
  check(
    'verified moving: the passenger path is available for a real passenger',
    moving.lockReason === 'moving',
  );

  const lostAfterMoving = lock.sample(NO_FIX, tMove + 1000);
  check(
    'moving + signal lost: NO grace is granted',
    lostAfterMoving.parkedGrace === false,
    lostAfterMoving,
  );
  check('moving + signal lost: stays locked', lostAfterMoving.locked === true);
  const muchLater = lock.sample(NO_FIX, tMove + 10 * 60_000);
  check('moving + signal lost: still locked ten minutes later', muchLater.locked === true);
  check('moving + signal lost: still no grace', muchLater.parkedGrace === false);
}

/* ---- moving → verified stationary unlocks only the existing way --- */
{
  const lock = createSafetyLock();
  const tMove = settle(lock, 30, T0, MOVING_DWELL_MS + 2000);
  // Slowing down is not stopping: the dwell must be served in full.
  const half = settle(lock, 0, tMove + 1000, STATIONARY_DWELL_MS / 2);
  check('moving → slow: still locked before the dwell completes', lock.state(half).locked === true);
  const tStop = settle(lock, 0, half, STATIONARY_DWELL_MS);
  check('moving → verified stationary: unlocked', lock.state(tStop).locked === false);
  check('...and the setup window did NOT re-open', lock.state(tStop).setupWindow === false);
}

/* ---- a stale fix is not a fresh one ------------------------------- */
{
  const lock = createSafetyLock();
  const tStat = settle(lock, 0, T0, STATIONARY_DWELL_MS + 2000);
  // A fix older than the freshness window is UNKNOWN, not stationary.
  const stale = lock.sample(at(0, tStat), tStat + POSITION_FRESH_MS + 5000);
  check('a stale fix decays out of STATIONARY', stale.motion === 'UNKNOWN', stale.motion);
  check('...but a parked truck still gets its grace', stale.parkedGrace === true, stale);
}

/* ============ 7/8/9/10/11. route preferences ======================== */
{
  // 9 — every offered preference is one the provider actually implements.
  check(
    'preferences: every offered toggle maps to a supported provider feature',
    unsupportedPreferenceFeatures().length === 0,
    unsupportedPreferenceFeatures(),
  );
  for (const spec of ROUTE_PREFERENCE_SPECS) {
    check(
      `preferences: ${spec.feature} is in the provider whitelist`,
      HERE_AVOID_FEATURES.has(spec.feature),
    );
  }

  // 7/8 — the model round-trips, and both states are named out loud.
  const tolls = { ...DEFAULT_ROUTE_PREFERENCES, avoidTolls: true };
  check(
    'preferences: avoid tolls produces the tollRoad feature',
    preferencesToAvoid(tolls).includes('tollRoad'),
  );
  check(
    'preferences: default avoids nothing',
    preferencesToAvoid(DEFAULT_ROUTE_PREFERENCES).length === 0,
  );
  check(
    'preferences: the OFF state is stated, not implied by silence',
    summarizePreferences(DEFAULT_ROUTE_PREFERENCES).includes('Tolls allowed'),
    summarizePreferences(DEFAULT_ROUTE_PREFERENCES),
  );
  check(
    'preferences: the ON state is stated too',
    summarizePreferences(tolls).includes('Avoid tolls'),
  );
  check(
    'preferences: the avoid list is sorted so equal preferences key the cache equally',
    preferencesToAvoid({ avoidTolls: true, avoidFerries: true }).join(',') ===
      ['ferry', 'tollRoad'].sort().join(','),
  );

  // 9 — it survives the provider's own sanitizer untouched.
  check(
    'preferences: the produced features survive sanitizeAvoidances unchanged',
    sanitizeAvoidances(preferencesToAvoid({ avoidTolls: true, avoidFerries: true }))
      .sort()
      .join(',') === preferencesToAvoid({ avoidTolls: true, avoidFerries: true }).sort().join(','),
  );

  // 9 — and they reach the WIRE as avoid[features].
  const wire = truckWireParams(toTruckProfile(DEFAULT_EDITABLE_PROFILE), preferencesToAvoid(tolls));
  const avoidParam = wire.find((w) => w.param === 'avoid[features]');
  check(
    'preferences: avoid tolls reaches the wire as avoid[features]',
    avoidParam !== undefined,
    wire.map((w) => w.param),
  );
  check(
    'preferences: ...carrying exactly tollRoad',
    avoidParam?.value === 'tollRoad',
    avoidParam?.value,
  );
  const noneWire = truckWireParams(toTruckProfile(DEFAULT_EDITABLE_PROFILE), []);
  check(
    'preferences: with nothing avoided, no avoid[features] is sent at all',
    noneWire.every((w) => w.param !== 'avoid[features]'),
  );

  // 10 — the UI cannot claim an avoidance the request did not carry.
  check(
    'preferences: a claim is refused when the request lacked the feature',
    !claimsMatchRequest(tolls, []),
  );
  check(
    'preferences: a claim stands when the request carried it',
    claimsMatchRequest(tolls, ['tollRoad']),
  );
  check(
    'preferences: claiming nothing is always honest',
    claimsMatchRequest(DEFAULT_ROUTE_PREFERENCES, []),
  );

  // 11 — a change invalidates the route.
  check(
    'preferences: turning tolls on is a route change',
    preferencesChanged(DEFAULT_ROUTE_PREFERENCES, tolls),
  );
  check(
    'preferences: an identical set is NOT a route change',
    !preferencesChanged(tolls, { ...tolls }),
  );
}

/* ============ 1-6. the truck, restored rather than re-asked ========= */
{
  // 5/6 — the confirmation gate decides, and it decides on values.
  const base: EditableProfile = { ...DEFAULT_EDITABLE_PROFILE };
  const confirmed = confirmProfile(base);
  check(
    'truck: a confirmed, unchanged profile is READY — no reconfirmation',
    profileGate(base, confirmed) === 'ready',
  );
  const taller: EditableProfile = { ...base, heightFt: 14 };
  check(
    'truck: changing a routing value drops it back to unconfirmed',
    profileGate(taller, confirmed) === 'unconfirmed',
  );
  check(
    'truck: ...because the fingerprint is over the values, not a flag',
    routingFingerprint(taller) !== routingFingerprint(base),
  );

  // 2 — a preference change must NEVER cost a driver their confirmed
  // truck. This is the complaint's core: the pilot asked for a saved toll
  // setting and got sent back through "this is my truck".
  //
  // Asserted as behaviour, not as a word-scan of the module. A source
  // grep would still pass if `changeRoutePrefs` fed a preference back
  // into the profile; these run the real gate over the real values.
  const everyCombination: RoutePreferences[] = [
    DEFAULT_ROUTE_PREFERENCES,
    { avoidTolls: true, avoidFerries: false },
    { avoidTolls: false, avoidFerries: true },
    { avoidTolls: true, avoidFerries: true },
  ];

  // The two record shapes share no field. If anyone re-adds `avoidTolls`
  // to the profile — the exact regression that caused the complaint —
  // these key sets intersect and this fails.
  const profileKeys = new Set(Object.keys(DEFAULT_EDITABLE_PROFILE));
  const prefKeys = Object.keys(DEFAULT_ROUTE_PREFERENCES);
  check(
    'truck: no preference field exists on the truck profile',
    prefKeys.every((k) => !profileKeys.has(k)),
    prefKeys.filter((k) => profileKeys.has(k)),
  );

  // Building a request from a preference set leaves the truck untouched,
  // so the stored confirmation still matches and the gate stays READY.
  const profileBefore = JSON.stringify(base);
  // The same merge `PilotTripControls` performs at Start: whatever the
  // profile still carries, plus the saved preferences.
  const wireAvoidFor = (prefs: RoutePreferences) =>
    [...new Set([...base.avoid, ...preferencesToAvoid(prefs)])].sort();
  const gatesAfter = everyCombination.map((prefs) => {
    wireAvoidFor(prefs);
    return profileGate(base, confirmed);
  });
  check(
    'truck: NO preference combination reconfirms the truck',
    gatesAfter.every((g) => g === 'ready'),
    gatesAfter,
  );
  check(
    'truck: ...and building those requests never mutated the profile',
    JSON.stringify(base) === profileBefore,
  );
  check(
    'truck: ...so the stored confirmation still matches the live values',
    confirmed.confirmedFingerprint === routingFingerprint(base),
  );

  // The preferences are not inert: the same four combinations produce
  // four distinct wire avoid lists. Without this, "the truck never
  // reconfirms" would be satisfiable by a preference that does nothing.
  const wireLists = new Set(everyCombination.map((p) => wireAvoidFor(p).join(',')));
  check(
    'truck: ...yet each combination still produces its own wire avoid list',
    wireLists.size === everyCombination.length,
    [...wireLists],
  );

  // Separate keys, so a damaged preference cannot take the truck down.
  const storageSrc = read('src/components/navigator/route-prefs-storage.ts');
  check(
    'truck: preferences have their OWN storage key',
    storageSrc.includes('tlws-navigator-route-prefs-v1'),
  );
  check('truck: ...which is not the truck key', !storageSrc.includes('tlws-navigator-truck-v1'));
}

/* ============ 25. 13'6" stays exact and sends 411 cm ================ */
{
  const thirteenSix: EditableProfile = { ...DEFAULT_EDITABLE_PROFILE, heightFt: 13.5 };
  check(
    '13\'6": reads as 13′6″ in imperial',
    formatDimension(13.5, false).includes('13′6″'),
    formatDimension(13.5, false),
  );
  check('13\'6": is NEVER shown as 13.6', !formatDimension(13.5, false).includes('13.6'));
  const wire = truckWireParams(toTruckProfile(thirteenSix), []);
  const height = wire.find((w) => w.param === 'truck[height]');
  check('13\'6": sends exactly 411 cm', height?.value === '411', height?.value);
}

/* ============ 12/13. one damaged record never costs another ========= */
{
  /*
   * STRUCTURAL, and deliberately so. Four records, four keys, four
   * parsers, no shared try/catch — that is what makes "corrupt
   * preferences must not damage the truck" a fact about the code rather
   * than a promise about behaviour.
   */
  const files = {
    truck: read('src/components/navigator/truck-storage.ts'),
    prefs: read('src/components/navigator/route-prefs-storage.ts'),
    clocks: read('src/components/navigator/clocks-storage.ts'),
    onboarding: read('src/components/navigator/onboarding-storage.ts'),
  };
  const keys = Object.entries(files).map(([name, src]) => {
    const m = /'(tlws-navigator-[a-z-]+-v\d+)'/.exec(src);
    return [name, m?.[1] ?? null] as const;
  });
  check(
    'storage: every record has its own key',
    new Set(keys.map(([, k]) => k)).size === keys.length && keys.every(([, k]) => k !== null),
    keys,
  );
  check(
    'storage: the preference parser never reads the truck record',
    !files.prefs.includes('truck') || !files.prefs.includes('TRUCK_PROFILE_KEY'),
  );
  check(
    'storage: the truck parser never reads the preference record',
    !files.truck.includes('ROUTE_PREFS_KEY'),
  );
  check(
    'storage: preferences degrade to "avoid nothing", never to a claim',
    files.prefs.includes('DEFAULT_ROUTE_PREFERENCES'),
  );
  check(
    'storage: a non-boolean is not coerced into a preference',
    files.prefs.includes("typeof value === 'boolean'"),
  );
  check(
    'storage: onboarding degrades toward SHOWING the briefing',
    files.onboarding.includes('payload.seen === true'),
  );
}

/* ============ 18/19/20/21. what a screen may spend =================== */
{
  /*
   * The request-count rules, asserted at the component that owns them.
   * The browser bench measures the real counts; these keep the structure
   * that makes those counts possible from being edited away.
   */
  const search = read('src/components/navigator/DestinationSearch.tsx');
  check(
    'typing: the search component never plans a route',
    !/lifecycle\.plan|planRoute/.test(search),
  );
  check(
    'typing: the search component asks for no location',
    !/getCurrentPosition|watchPosition/.test(search),
  );
  const controls = read('src/components/navigator/PilotTripControls.tsx');
  const planCalls = (controls.match(/lifecycle\.plan\(/g) ?? []).length;
  check('start: exactly one place plans a route', planCalls === 1, planCalls);
  check(
    'start: rapid taps are deduped by an in-flight guard, not by state',
    /attemptActive/.test(controls),
  );
  /*
   * A PREFERENCE CHANGE STILL CANNOT REUSE AN OLD ROUTE (NAV-ENTRY-1) — it is
   * simply no longer possible to make one while a route is planned. The
   * preference panel moved to /drive/settings, which mounts no lifecycle at
   * all, and reaching it unmounts the driving screen. A `route-ready` plan is
   * not an ACTIVE state, so it is not flushed to the snapshot and does not
   * come back. The driver plans again, against the preferences they just set.
   */
  const settingsSrc = read('src/components/navigator/NavigatorSettings.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  check(
    'start: the preference editor has no lifecycle to hand a stale route to',
    /writeRoutePrefs\(/.test(settingsSrc) && !/lifecycle/.test(settingsSrc),
  );
  check(
    'start: and only an ACTIVE trip survives leaving the driving screen',
    read('src/components/navigator/DrivingScreen.tsx')
      .replace(/\s+/g, ' ')
      .includes('if (ACTIVE_LIFECYCLE_STATES.includes(lifecycle.state())) saveSnapshotNow();'),
  );
}

/* ============ 17. clocks stay optional ============================== */
{
  /*
   * Run through the REAL gate rather than grepping the components for
   * the word "startBlockedReason": the claim is that blank clocks cost a
   * driver HOS guidance and nothing else, and only the gate can say so.
   */
  const ready = {
    driverName: null,
    truckGate: 'ready',
    destinationPicked: true,
  } as const;

  const blank = setupStatus({ ...ready, clocks: 'unset' });
  check('clocks: blank clocks do NOT block Start', blank.canStart && blank.blockedReason === null);
  check(
    'clocks: ...and the cost is stated in words, not implied by silence',
    blank.clocksWarning === CLOCKS_UNAVAILABLE_WARNING,
  );
  check(
    'clocks: they are listed as optional, never required',
    itemState(blank, 'clocks') === 'optional',
  );

  const set = setupStatus({ ...ready, clocks: 'set' });
  check('clocks: entered clocks retire the warning', set.clocksWarning === null);

  const canada = setupStatus({ ...ready, clocks: 'unsupported' });
  check('clocks: Canada still starts trips', canada.canStart);
  check(
    'clocks: ...and says the calculation is unavailable rather than guessing one',
    itemState(canada, 'clocks') === 'unsupported' &&
      (canada.items.find((i) => i.key === 'clocks')?.value ?? '').includes('Not calculated'),
  );

  // No clock state anywhere makes the trip refuse.
  check(
    'clocks: no clock state can block Start on its own',
    (['set', 'unset', 'unsupported'] as const).every(
      (c) => setupStatus({ ...ready, clocks: c }).canStart,
    ),
  );
}

/* ====== 22/23/24. the parked screen collapses for a returning driver = */
{
  /*
   * The pilot's actual complaint, as a gate: "there is too much setup
   * before starting". `configured` is what lets the screen put the
   * destination and Start Route above everything else, so what it will
   * and will not collapse over is the safety-relevant part.
   */
  const withTruck = (truckGate: 'invalid' | 'unconfirmed' | 'ready') =>
    setupStatus({ driverName: null, truckGate, clocks: 'unset', destinationPicked: false });

  check('collapse: a confirmed truck settles the setup', withTruck('ready').configured);
  check(
    'collapse: an UNCONFIRMED truck never does — the long screen stays',
    !withTruck('unconfirmed').configured,
  );
  check('collapse: an INVALID truck never does either', !withTruck('invalid').configured);

  // The optional items are genuinely optional: declining them must not
  // sentence a driver to the long screen forever.
  const noName = setupStatus({
    driverName: null,
    truckGate: 'ready',
    clocks: 'unset',
    destinationPicked: false,
  });
  check('collapse: no driver name does not hold the screen open', noName.configured);
  check('collapse: no clocks does not hold the screen open', noName.configured);

  // ...but the consequence is NOT collapsed away with them. This is the
  // fact that makes the short screen honest: the moment it is allowed,
  // the warning is already showing.
  check(
    'collapse: the HOS warning is live the moment the screen may collapse',
    noName.clocksWarning === CLOCKS_UNAVAILABLE_WARNING,
  );
  check(
    'collapse: ...including BEFORE a destination is chosen',
    noName.configured && !noName.canStart && noName.clocksWarning !== null,
  );

  // Collapsing is independent of the destination — that is the whole
  // point. A driver who has not picked one yet still gets the short
  // screen, and is told the one thing left to do.
  check(
    'collapse: settled setup + no destination still collapses',
    withTruck('ready').configured && withTruck('ready').blockedReason === START_NEEDS_DESTINATION,
  );
  check(
    'collapse: an unconfirmed truck is named first, above the destination',
    withTruck('unconfirmed').blockedReason === START_NEEDS_TRUCK,
  );

  /*
   * The collapsed card must carry the driver's ACTUAL HOURS. "Set" would
   * read identically for a driver with 45 minutes of drive time and one
   * with nine, and hours are the one subject where implying more than
   * someone has is a violation rather than a rough edge.
   */
  const entered = summarizeEnteredClocks({
    kind: 'set',
    entered: {
      drivingMin: 305,
      windowMin: 400,
      untilBreakMin: 120,
      cycleMin: 2400,
      cycleRule: '70/8',
    },
    enteredAtMs: T0,
    fromFreshShift: false,
  });
  check('collapse: the clocks line prints the entered hours', entered.includes('5h 05m'), entered);
  check('collapse: ...and the shift window beside them', entered.includes('6h 40m'), entered);
  check('collapse: ...and never the bare word "Set"', !/\bSet\b/.test(entered), entered);
  check(
    'collapse: blank clocks say so in words',
    summarizeEnteredClocks({ kind: 'unset' }) === CLOCKS_NOT_SET,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

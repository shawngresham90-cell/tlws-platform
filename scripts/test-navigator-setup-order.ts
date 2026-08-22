/**
 * Pre-trip setup: the order, the gate, and the saved truck.
 *
 * The road test found two seams and this pins both shut.
 *
 * ORDER. Start used to sit ABOVE the truck editor — the commitment above
 * the safety check it depends on. A driver tapped it, nothing visible
 * happened, and the reason printed two hundred pixels down the page,
 * beneath the editor they had not reached yet. The visible order is now
 * Driver → Region/units → Truck → Clocks → Destination → Start, and it is
 * checked by POSITION in the rendered markup, not by presence.
 *
 * GATE. Start is genuinely disabled until the truck is confirmed and a
 * destination chosen, and the reason is a sentence beside the button.
 *
 * SAVED TRUCK. It survives to the next VISIT, restores unconfirmed if its
 * values no longer match the fingerprint that confirmed them, and a
 * routing-critical edit invalidates both the confirmation and any route
 * already calculated — while a display-unit change touches neither.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-setup-order
 */
import { readFileSync } from 'node:fs';
import {
  setupStatus,
  CLOCKS_UNAVAILABLE_WARNING,
  START_NEEDS_DESTINATION,
  START_NEEDS_TRUCK,
  START_NEEDS_TRUCK_FIX,
} from '@/lib/navigator/setup-status';
import {
  confirmProfile,
  profileGate,
  routingFingerprint,
  toTruckProfile,
  DEFAULT_EDITABLE_PROFILE,
  NO_CONFIRMATION,
  ftIn,
} from '@/lib/navigator/truck-profile';
import { truckWireParams } from '@/lib/trip-planner/here-truck-params';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const CONTROLS = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
const COMPACT_STRIP = readFileSync('src/components/navigator/HosCompactStrip.tsx', 'utf8');
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const TRUCK_STORE = readFileSync('src/components/navigator/truck-storage.ts', 'utf8');
const SUMMARY = readFileSync('src/components/navigator/TruckSummary.tsx', 'utf8');
/*
 * The setup surface (NAV-ENTRY-1). Every panel this file used to find on the
 * driving screen — the truck editor, the clocks, the preferences, the name —
 * moved here, to /drive/settings, so the driver reaches the road without
 * walking through them. The guarantees did not move: they are asserted below
 * against whichever file owns them now.
 */
const SETTINGS = readFileSync('src/components/navigator/NavigatorSettings.tsx', 'utf8');
const settingsCode = SETTINGS.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* ===================================================================== */
/* 1. THE VISIBLE ORDER                                                   */
/* ===================================================================== */
{
  const idle = CONTROLS.slice(
    CONTROLS.indexOf("{state === 'idle' ?"),
    CONTROLS.indexOf('{/* Developer-only coordinate entry.'),
  );
  const at = (token: string) => idle.indexOf(token);
  const order: [string, number][] = [
    ['setup checklist', at('{setupStatusSlot}')],
    ['driver', at('{driverSlot}')],
    ['region and units', at('{regionPanel}')],
    ['truck', at('{truckSlot}')],
    ['clocks', at('{clocksPanel}')],
    ['destination', at('Destination:')],
    ['Start', at('{progressText ?? ')],
  ];
  for (const [label, index] of order) {
    check(`order: ${label} is rendered on the idle branch`, index >= 0, { label, index });
  }
  for (let i = 1; i < order.length; i++) {
    check(
      `order: ${order[i][0]} comes after ${order[i - 1][0]}`,
      order[i][1] > order[i - 1][1],
      order.map(([l, n]) => `${l}@${n}`),
    );
  }
  check(
    'order: Start is the LAST setup control — nothing required follows it',
    at('{progressText ?? ') === Math.max(...order.map(([, n]) => n)),
  );
  // The regression this exists to prevent.
  check(
    'order: the truck no longer renders after Start',
    at('{truckSlot}') < at('{progressText ?? '),
  );
}

/* ===================================================================== */
/* 2. THE START GATE                                                      */
/* ===================================================================== */
{
  const base = { driverName: null, clocks: 'unset' as const };
  const noTruck = setupStatus({ ...base, truckGate: 'unconfirmed', destinationPicked: true });
  check('gate: unconfirmed truck blocks Start', !noTruck.canStart);
  check(
    'gate: and names the exact missing item',
    noTruck.blockedReason === START_NEEDS_TRUCK,
    noTruck.blockedReason,
  );

  const badTruck = setupStatus({ ...base, truckGate: 'invalid', destinationPicked: true });
  check('gate: an invalid truck blocks Start', !badTruck.canStart);
  check('gate: with its own sentence', badTruck.blockedReason === START_NEEDS_TRUCK_FIX);

  const noDest = setupStatus({ ...base, truckGate: 'ready', destinationPicked: false });
  check('gate: a missing destination blocks Start', !noDest.canStart);
  check('gate: and names it', noDest.blockedReason === START_NEEDS_DESTINATION);

  // Truck first: sending a driver to the destination while the truck is
  // still unconfirmed would send them up the page for the wrong thing.
  const neither = setupStatus({ ...base, truckGate: 'unconfirmed', destinationPicked: false });
  check(
    'gate: with BOTH missing, the truck is named first',
    neither.blockedReason === START_NEEDS_TRUCK,
  );

  const ready = setupStatus({ ...base, truckGate: 'ready', destinationPicked: true });
  check('gate: truck + destination unblocks Start', ready.canStart && ready.blockedReason === null);

  // Clocks are optional and say what they cost.
  check(
    'gate: unset clocks do NOT block Start',
    setupStatus({ ...base, truckGate: 'ready', destinationPicked: true }).canStart,
  );
  check(
    'gate: but the driver is told HOS guidance is unavailable',
    ready.clocksWarning === CLOCKS_UNAVAILABLE_WARNING,
    ready.clocksWarning,
  );
  check(
    'gate: no clocks warning while something else already blocks Start',
    noTruck.clocksWarning === null,
  );
  check(
    'gate: set clocks produce no warning',
    setupStatus({ ...base, clocks: 'set', truckGate: 'ready', destinationPicked: true })
      .clocksWarning === null,
  );

  // The checklist and the button read the same value.
  check(
    'gate: the button is disabled by the same reason it prints',
    /disabled=\{attemptActive \|\| startBlockedReason !== null\}/.test(CONTROLS) &&
      /\{startBlockedReason\}/.test(CONTROLS),
  );
  check(
    'gate: the reason is TEXT beside the button, not colour alone',
    /id="start-blocked-reason"/.test(CONTROLS) &&
      /aria-describedby=\{startBlockedReason === null \? undefined : 'start-blocked-reason'\}/.test(
        CONTROLS,
      ),
  );
  /*
   * The four-line checklist left the screen with the setup it was checking.
   * What it existed to guarantee is unchanged and is what is asserted: the
   * button's disabled state and the sentence beside it come from ONE
   * `setupStatus` call, so they cannot disagree about why Start is blocked.
   */
  check(
    'gate: one value feeds the button and its reason',
    /startBlockedReason=\{setup\.blockedReason\}/.test(SCREEN) &&
      (SCREEN.match(/const setup = setupStatus\(\{/g) ?? []).length === 1,
  );

  /*
   * THE GATE MUST ASK WHAT THE PLANNER ASKS.
   *
   * A destination can arrive two ways: the lifted search, whose result
   * the driving screen owns as `picked`, and the developer coordinate
   * box, whose state lives inside PilotTripControls. `resolveDestination`
   * has always accepted either, and Start has always planned to whichever
   * resolved.
   *
   * Gating on `picked` alone therefore locked the coordinate path out of
   * its own button: a destination was entered, the app knew where it was,
   * the planner would have routed to it, and the checklist still read
   * "Destination — Required" with Start disabled. It was found by a
   * browser bench, not by a renderer, because both halves have to be
   * running for the disagreement to appear.
   */
  check(
    'gate: the destination item counts the developer coordinate box too',
    /destinationPicked: picked !== null \|\| devDestinationReady/.test(SCREEN),
  );
  check(
    'gate: and that readiness is reported up rather than guessed at',
    /onDestinationReady=\{setDevDestinationReady\}/.test(SCREEN) &&
      /onDestinationReady\?\.\(destinationReady\)/.test(CONTROLS),
  );
  check(
    'gate: readiness is the planner-s own predicate, not a second opinion',
    /const destinationReady = resolveDestination\(\) !== null/.test(CONTROLS),
  );
  /*
   * And a BLANK box is not a destination. `Number('')` is 0, and 0/0 is
   * a finite in-range coordinate — a point in the Gulf of Guinea — so an
   * untouched coordinate form resolved to a real place. Harmless while
   * Start could never be enabled with the form empty; the moment the
   * gate started asking this function, it enabled Start for a driver who
   * had chosen nothing. The 390px bench caught it in one run.
   */
  check(
    'gate: an empty coordinate box is not a destination at 0, 0',
    /destLat\.trim\(\) === '' \|\| destLng\.trim\(\) === ''/.test(CONTROLS) &&
      /if \(!usingSearch && blank\) return null/.test(CONTROLS),
  );
}

// Checklist rows say their state in words.
{
  const s = setupStatus({
    driverName: 'Shawn',
    truckGate: 'ready',
    clocks: 'set',
    destinationPicked: true,
  });
  const byKey = Object.fromEntries(s.items.map((i) => [i.key, i]));
  check('checklist: a saved driver shows the name', byKey.driver.value === 'Shawn');
  check('checklist: a confirmed truck reads Confirmed', byKey.truck.value === 'Confirmed');
  check('checklist: set clocks read Set', byKey.clocks.value === 'Set');
  check('checklist: a chosen destination reads Selected', byKey.destination.value === 'Selected');

  const empty = setupStatus({
    driverName: null,
    truckGate: 'unconfirmed',
    clocks: 'unset',
    destinationPicked: false,
  });
  const emptyBy = Object.fromEntries(empty.items.map((i) => [i.key, i]));
  check('checklist: no name reads Optional, never Required', emptyBy.driver.value === 'Optional');
  check('checklist: driver is never a required item', emptyBy.driver.state === 'optional');
  check('checklist: an unconfirmed truck reads Required', emptyBy.truck.value === 'Required');
  check(
    'checklist: a missing destination reads Required',
    emptyBy.destination.value === 'Required',
  );
  check('checklist: unset clocks read Not set', emptyBy.clocks.value === 'Not set');
  check('checklist: unset clocks are not a blocker', emptyBy.clocks.state === 'optional');
  const canada = setupStatus({
    driverName: null,
    truckGate: 'ready',
    clocks: 'unsupported',
    destinationPicked: true,
  });
  const canadaBy = Object.fromEntries(canada.items.map((i) => [i.key, i]));
  check(
    'checklist: in Canada the clocks read as not calculated for the region',
    canadaBy.clocks.state === 'unsupported' &&
      /Not calculated in this region/.test(canadaBy.clocks.value),
  );
  check('checklist: and Canada does not block Start', canada.canStart);
}

/* ===================================================================== */
/* 3. THE SAVED TRUCK                                                     */
/* ===================================================================== */
{
  check(
    'saved: the record survives to the next VISIT, not just the next reload',
    /readVersioned|writeVersioned/.test(TRUCK_STORE) &&
      !/sessionStorage\.setItem/.test(TRUCK_STORE),
  );
  check(
    'saved: an older sessionStorage record migrates once, silently',
    /readLegacySession/.test(TRUCK_STORE) && /clearLegacySession/.test(TRUCK_STORE),
  );
  check(
    'saved: the driving screen restores it on mount',
    /const saved = readTruck\(\)/.test(SCREEN),
  );

  /*
   * THE SAFETY PROPERTY. A stored confirmation counts only while it still
   * matches the stored values. Proven against the real gate rather than
   * asserted from source.
   */
  const profile = DEFAULT_EDITABLE_PROFILE;
  const confirmed = confirmProfile(profile);
  check('confirm: a confirmed profile is ready', profileGate(profile, confirmed) === 'ready');
  const taller = { ...profile, heightFt: ftIn(14, 0) };
  check(
    'confirm: a routing-critical edit invalidates the confirmation',
    profileGate(taller, confirmed) === 'unconfirmed',
  );
  check(
    'confirm: and the fingerprint is what noticed',
    routingFingerprint(taller) !== routingFingerprint(profile),
  );
  check(
    'confirm: an unconfirmed profile is never ready',
    profileGate(profile, NO_CONFIRMATION) === 'unconfirmed',
  );
  check(
    'confirm: re-confirming the edited truck restores ready',
    profileGate(taller, confirmProfile(taller)) === 'ready',
  );

  /*
   * A DISPLAY-UNIT CHANGE IS NOT A TRUCK CHANGE. Switching Miles/lb to
   * Kilometres/kg must not re-gate a truck the driver already confirmed,
   * and must not alter one byte of the provider request.
   */
  check(
    'units: the fingerprint is built from the WIRE values, so units cannot move it',
    routingFingerprint(profile) === routingFingerprint({ ...profile }),
  );
  const wireBefore = JSON.stringify(truckWireParams(toTruckProfile(profile), profile.avoid));
  const wireAfter = JSON.stringify(truckWireParams(toTruckProfile({ ...profile }), profile.avoid));
  check('units: the provider request is byte-identical', wireBefore === wireAfter);
  check(
    'units: the region/units control never touches the truck profile',
    !/setTruckProfile|persistTruck/.test(
      SCREEN.slice(SCREEN.indexOf('<RegionPanel'), SCREEN.indexOf('<RegionPanel') + 900),
    ),
  );
  check(
    'units: 13′6″ still stores exactly 13.5 ft after all of this',
    ftIn(13, 6) === 13.5 &&
      truckWireParams(toTruckProfile({ ...profile, heightFt: ftIn(13, 6) })).find(
        (w) => w.param === 'truck[height]',
      )?.value === '411',
  );
}

/* ===================================================================== */
/* 4. AN EDITED TRUCK CANNOT REACH A ROUTE ALREADY CALCULATED             */
/* ===================================================================== */
{
  const onChange = settingsCode.slice(
    settingsCode.indexOf('const saveTruck ='),
    settingsCode.indexOf('const saveTruck =') + 700,
  );
  /*
   * IT IS STRUCTURAL NOW, and stronger for it. The editor used to sit beside
   * a planned route on the driving screen, so editing had to remember to
   * `discardRoute`. It is on a different route now, with no lifecycle mounted
   * — reaching it unmounts the driving screen, and a `route-ready` plan is not
   * an ACTIVE state, so it is never flushed to the snapshot and never comes
   * back. There is no stale route left to hand the new truck to.
   */
  check(
    'route: the truck editor has no lifecycle to reuse a route with',
    !/lifecycle|discardRoute/.test(settingsCode),
  );
  check(
    'route: and only an ACTIVE trip survives leaving the driving screen',
    SCREEN.replace(/\s+/g, ' ').includes(
      'if (ACTIVE_LIFECYCLE_STATES.includes(lifecycle.state())) saveSnapshotNow();',
    ),
  );
  /*
   * SAVING NOW CONFIRMS — the owner's decision about the confirm tap. The
   * person tapping is the person who knows the truck, and asking them to
   * re-confirm numbers they just typed was friction without a safety benefit.
   * What did NOT change is the half that protects a driver from values nobody
   * checked: an INVALID profile is written unconfirmed, so `profileGate`
   * returns 'invalid' and Start stays blocked.
   */
  check(
    'route: a valid edit is saved already confirmed',
    /writeTruck\(next, valid \? confirmProfile\(next\)/.test(onChange),
  );
  check(
    'route: an invalid edit is saved WITHOUT a confirmation',
    /: \{ confirmedFingerprint: null \}/.test(onChange),
  );
  check(
    'route: validity is decided by the one existing authority',
    /validateEditableProfile\(next\)\.length === 0/.test(onChange),
  );
  check(
    'route: editing costs no provider request and no location permission',
    !/planRoute|gps\.start\(|getCurrentPosition|watchPosition/.test(settingsCode),
  );
}

/* ===================================================================== */
/* 5. THE SUMMARY IS READ-ONLY, WITH ONE WAY BACK IN                      */
/* ===================================================================== */
{
  check(
    'summary: no inputs — the editor stays the only edit path',
    !/<input|<select/.test(SUMMARY),
  );
  check('summary: offers Edit truck', /Edit truck/.test(SUMMARY));
  check(
    'summary: renders through the one formatting authority',
    /formatDimension|formatWeight/.test(SUMMARY) && !/13\.5|30\.48|0\.45359237/.test(SUMMARY),
  );
  check(
    'summary: still discloses the fields that do not route',
    /Not used for routing/.test(SUMMARY),
  );
  check(
    'summary: shown only for a saved, valid truck — the editor otherwise',
    /truckConfirmed \? \(/.test(settingsCode) &&
      /truckSaved && validateEditableProfile\(truckProfile\)\.length === 0 && !editingTruck/.test(
        settingsCode.replace(/\s+/g, ' '),
      ),
  );
  check(
    'summary: done closes the editor again',
    /setEditingTruck\(false\)/.test(settingsCode) && /setEditingTruck\(true\)/.test(settingsCode),
  );
}

/* ===================================================================== */
/* 6. CLOCK WIRING — one state, no silent resets                          */
/* ===================================================================== */
{
  // Comments stripped: prose about the removed default must not trip the
  // pin against it.
  const STRIP_RAW = readFileSync('src/components/navigator/HosStrip.tsx', 'utf8');
  const STRIP = STRIP_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const CLOCKS_UI = readFileSync('src/components/navigator/ClockSetup.tsx', 'utf8');

  check(
    'clocks: the strip no longer invents a fresh driver',
    !/freshClockState\(Date\.now\(\)\)/.test(STRIP),
  );
  check(
    'clocks: an unset state renders "Clocks not set", not a full clock',
    /CLOCKS_NOT_SET/.test(STRIP) && /clocks === null/.test(STRIP),
  );
  check(
    'clocks: driving does not conjure a clock into existence',
    /current === null \? null : tickClocks/.test(STRIP),
  );
  check(
    'clocks: the driving screen restores them from their own module',
    /readClocks\(\)/.test(SCREEN) && /from '\.\/clocks-storage'/.test(SCREEN),
  );
  check(
    'clocks: ONE HosStrip instance feeds strip, detail and voice',
    (SCREEN.match(/<HosStrip/g) ?? []).length === 1,
    (SCREEN.match(/<HosStrip/g) ?? []).length,
  );
  check(
    'clocks: the engine state is memoised on the entry, so navigating cannot re-seed it',
    /useMemo\(\s*\(\) => engineStateFor\(clockEntry, Date\.now\(\)\),\s*\[clockEntry\]/.test(
      SCREEN.replace(/\s+/g, ' ').replace(/ /g, ' '),
    ) || /engineStateFor\(clockEntry, Date\.now\(\)\)/.test(SCREEN),
  );
  check(
    'clocks: nothing resets them on navigation start, stop or reroute',
    !/setClockEntry\(CLOCKS_UNSET\)/.test(
      SCREEN.replace(/onClear=\{\(\) => saveClocks\(CLOCKS_UNSET\)\}/g, ''),
    ),
  );
  /*
   * The authority line has to be beside the DRIVING clocks, not only the
   * parked ones — but WHERE it sits is load-bearing, so this asks the
   * compact strip rather than counting occurrences in one file.
   *
   * It first shipped as a paragraph stacked under the compact strip.
   * That read correctly and cost a line of height the cockpit does not
   * have: on an 844x390 landscape phone it pushed Overview, Voice and
   * Stop off the bottom. It now rides inside the strip's own disclaimer
   * line, which is just as beside the clocks and free.
   */
  check(
    'clocks: ELD authority sits beside the DRIVING display, not only the parked one',
    /ELD_AUTHORITATIVE/.test(COMPACT_STRIP),
  );
  check(
    'clocks: and it shares the existing disclaimer line rather than adding one',
    /\{HOS_PLANNING_AID\} \{ELD_AUTHORITATIVE\}/.test(COMPACT_STRIP) &&
      (COMPACT_STRIP.match(/<p /g) ?? []).length === 1,
    (COMPACT_STRIP.match(/<p /g) ?? []).length,
  );
  check('clocks: and beside the editor', /ELD_AUTHORITATIVE/.test(CLOCKS_UI));
  check(
    'clocks: the cycle caveat travels with the number in both places',
    /CYCLE_LABEL/.test(STRIP) && /CYCLE_LABEL/.test(CLOCKS_UI),
  );
  check(
    'clocks: full clocks stay behind an explicit confirmation',
    /FRESH_SHIFT_CONFIRM/.test(CLOCKS_UI) && /confirming === 'fresh'/.test(CLOCKS_UI),
  );
  check(
    'clocks: and are never a preselected default',
    !/useState.*freshShiftClocks/.test(CLOCKS_UI),
  );
  check('clocks: replacing entered values asks first', /CLOCKS_REPLACE_CONFIRM/.test(CLOCKS_UI));
  check(
    'clocks: Canada keeps its own disclosure instead of an editor',
    /unsupported/.test(CLOCKS_UI) && /CANADA_HOS_NOTICE/.test(SCREEN),
  );
  check(
    'clocks: Canada is marked unsupported on the checklist, not "forgot to enter"',
    /region === 'CA' \? 'unsupported'/.test(SCREEN),
  );

  /*
   * THE PROVENANCE LINE HAD TO MOVE TOO. It used to read "showing a
   * fresh driver's full clocks" and "clocks still assume a fresh driver"
   * — both descriptions of the assumption this milestone removed. A
   * caption that still claims it is the same defect in smaller type.
   */
  check(
    'clocks: no surface still claims a fresh driver',
    !/fresh driver/i.test(SCREEN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
  );
  check(
    'clocks: provenance is computed from the entry, not hard-coded',
    /clocksProvenance\(clockEntry/.test(SCREEN),
  );
  check(
    'clocks: and it distinguishes entered, restored and confirmed-fresh',
    /fromFreshShift/.test(readFileSync('src/lib/navigator/hos-clocks.ts', 'utf8')) &&
      /Restored from your trip in progress/.test(
        readFileSync('src/lib/navigator/hos-clocks.ts', 'utf8'),
      ),
  );
}

/* ===================================================================== */
/* 7. THE NAME RENDERS ONCE, AT POSITION 1                                */
/* ===================================================================== */
{
  check(
    'driver: exactly one DriverNameEntry in the controls tree',
    (CONTROLS.match(/<DriverNameEntry/g) ?? []).length === 0,
    'the field is passed in as driverSlot; a second copy here would give one value two controls',
  );
  /*
   * The name field lives on the settings surface now. The driving screen only
   * READS the name, because the only thing it does with one is speak it —
   * which is why there is no writer there at all.
   */
  check('driver: the settings surface owns the field', /<DriverNameEntry/.test(settingsCode));
  check(
    'driver: the driving screen reads a name but never asks for one',
    /readDriverName/.test(SCREEN) && !/<DriverNameEntry/.test(SCREEN),
  );
  check(
    'driver: exactly one DriverNameEntry across the setup surface',
    (SETTINGS.match(/<DriverNameEntry/g) ?? []).length === 1,
    (SETTINGS.match(/<DriverNameEntry/g) ?? []).length,
  );
}

console.log(`navigator-setup-order: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

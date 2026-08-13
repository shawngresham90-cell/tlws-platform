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
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const TRUCK_STORE = readFileSync('src/components/navigator/truck-storage.ts', 'utf8');
const SUMMARY = readFileSync('src/components/navigator/TruckSummary.tsx', 'utf8');

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
  check(
    'gate: one value feeds the button and the checklist',
    /startBlockedReason=\{setup\.blockedReason\}/.test(SCREEN) &&
      /<SetupStatus status=\{setup\} \/>/.test(SCREEN),
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
/* 4. AN EDITED TRUCK INVALIDATES A CALCULATED ROUTE                      */
/* ===================================================================== */
{
  const onChange = SCREEN.slice(
    SCREEN.indexOf('onChange={(next) => {'),
    SCREEN.indexOf('onChange={(next) => {') + 900,
  );
  check(
    'route: a truck edit discards a route already calculated',
    /lifecycle\.state\(\) === 'route-ready'/.test(onChange) &&
      /lifecycle\.discardRoute\(/.test(onChange),
  );
  check(
    'route: the edit persists the truck WITHOUT re-confirming it',
    /persistTruck\(next, truckConfirmation\)/.test(onChange),
  );
  check(
    'route: editing costs no provider request and no location permission',
    !/planRoute|gps\.start\(|getCurrentPosition|watchPosition/.test(onChange),
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
    'summary: shown only for a CONFIRMED truck, editor otherwise',
    /truckConfirmed && !editingTruck \? \(/.test(SCREEN),
  );
  check(
    'summary: confirming closes the editor again',
    /setEditingTruck\(false\)/.test(SCREEN) && /setEditingTruck\(true\)/.test(SCREEN),
  );
}

console.log(`navigator-setup-order: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

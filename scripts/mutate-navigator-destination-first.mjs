#!/usr/bin/env node
/**
 * Mutation checks for NAV-ENTRY-2.
 *
 * A green suite proves nothing on its own. Each mutation below damages
 * exactly one thing this milestone promised, re-runs the harnesses that
 * should notice, and REQUIRES them to go red. A mutation that survives is
 * reported as a coverage hole, not as a pass.
 *
 * The ten come straight from the milestone's own list of ways this could
 * regress. Every one is a change someone could make next year with a
 * perfectly good reason — "the plan prompt should be asked first", "the
 * search belongs on the map", "a 48 px field fits better" — which is
 * exactly why each needs a test standing in front of it.
 *
 * NOTHING COSMETIC IS COUNTED. Each mutation changes BEHAVIOUR a driver
 * would meet: where the box is, how big it is, what it costs to touch it,
 * or whether a rail this milestone inherited is still standing.
 *
 * Every file is restored from its captured original, even if a run throws.
 *
 * Run:  node scripts/mutate-navigator-destination-first.mjs
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

const SCREEN = 'src/components/navigator/DrivingScreen.tsx';
const SEARCH = 'src/components/navigator/DestinationSearch.tsx';
const CONTRACT = 'src/lib/navigator/destination-first.ts';
const ACTIONS = 'src/lib/navigator/actions.ts';
const TRUCK_STORE = 'src/components/navigator/truck-storage.ts';
const GATE = 'src/components/navigator/LockGate.tsx';

const MUTATIONS = [
  {
    /*
     * The headline regression: put the search back under the map. This is
     * the shipped defect restored — the driver would have to scroll past
     * the whole map box to reach the box they came for.
     */
    name: '1. the destination search is moved back below the map (below the fold)',
    file: SCREEN,
    from: '        <div className={mapWrapCls}>{mapSlot}</div>',
    to: '        <div className={mapWrapCls}>{mapSlot}</div>\n        <div data-moved-search="">{mapSearchSlot}</div>',
    mustFail: 'navigator-destination-first navigator-map-search',
  },
  {
    name: '2. the search target is shrunk below the 44 px floor',
    file: SEARCH,
    from: "  'min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl text-ink';",
    to: "  'min-h-10 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl text-ink';",
    mustFail: 'navigator-destination-first',
  },
  {
    /*
     * Setup material reinserted above the destination box — the literal
     * shape of the problem this milestone exists to fix.
     */
    name: '3. the plan-your-stops prompt is reinserted above the destination search',
    file: SCREEN,
    from: '          {mapSearchSlot}\n        </div>',
    to: '          {parkedPlanSlot}\n          {mapSearchSlot}\n        </div>',
    mustFail: 'navigator-destination-first',
  },
  {
    /*
     * A route request on map load. The single most expensive regression
     * available: every parked visit would buy a route nobody asked for.
     */
    name: '4. the parked map requests a route on load',
    file: SCREEN,
    from: '  const fullScreen = ACTIVE_LIFECYCLE_STATES.includes(lcState);',
    to: "  const fullScreen = ACTIVE_LIFECYCLE_STATES.includes(lcState);\n  void fetch('/api/navigator/route', { method: 'POST' });",
    mustFail: 'navigator-destination-first navigator-purity',
  },
  {
    name: '5. focusing the destination field requests a route',
    file: SEARCH,
    from: '          aria-label={ariaLabel}',
    to: "          onFocus={() => void fetch('/api/navigator/route', { method: 'POST' })}\n          aria-label={ariaLabel}",
    mustFail: 'navigator-destination-first navigator-map-search',
  },
  {
    /*
     * The NAV-ENTRY-1 decision reversed: a moving truck loses the text
     * field. The owner's ruling is that motion never disables editing.
     */
    name: '6. the destination search is hidden while the truck is moving',
    file: ACTIONS,
    from: "  'edit-destination': true,",
    to: "  'edit-destination': false,",
    mustFail: 'navigator-destination-first navigator-entry safety-gating',
  },
  {
    /*
     * A saved custom truck silently replaced by the standard profile. The
     * driver's own 13'11" trailer becomes 13'6" and the route they get is
     * for a truck they are not driving.
     */
    name: '7. a saved custom truck is overwritten by the standard defaults',
    file: TRUCK_STORE,
    from: '  const current = readVersioned<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);\n  if (current.ok) return current.value;',
    to: '  const current = readVersioned<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);\n  if (current.ok) return null;',
    mustFail: 'navigator-destination-first navigator-truck-integrity',
  },
  {
    name: '8. Passenger Access is reintroduced on the parked surface',
    file: GATE,
    from: '      <p className="text-lg font-semibold text-ink">{lockedLabel} is paused</p>',
    to: '      <p className="text-lg font-semibold text-ink">{lockedLabel} is paused — passenger access</p>',
    mustFail: 'navigator-destination-first navigator-entry safety-gating',
  },
  {
    /*
     * The active trip stops surviving a visit to Settings: the snapshot is
     * never written, so coming back loses the trip and the driver has to
     * buy the route again.
     */
    name: '9. the active trip is not saved, so Settings loses it (and re-buys the route)',
    file: SCREEN,
    from: '      if (ACTIVE_LIFECYCLE_STATES.includes(lifecycle.state())) saveSnapshotNow();',
    to: '',
    mustFail: 'navigator-entry navigator-trip-restore navigator-truck-confidence',
  },
  {
    /*
     * The visibility RULE itself weakened: stop checking whether the box
     * is actually painted. This is the check that catches the shipped
     * defect, and without it the before-state passes.
     */
    name: '10. the visibility rule stops checking whether the box is actually painted',
    file: CONTRACT,
    from: '  if (m.visibleHeight < m.height - 1) {',
    to: '  if (false) {',
    mustFail: 'navigator-destination-first',
  },
];

function run(harnesses) {
  try {
    execSync(`node scripts/run-tests.mjs ${harnesses}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const originals = new Map();
for (const m of MUTATIONS) {
  if (!originals.has(m.file)) originals.set(m.file, fs.readFileSync(m.file, 'utf8'));
}
const restore = () => {
  for (const [file, text] of originals) fs.writeFileSync(file, text);
};
process.on('exit', restore);
process.on('SIGINT', () => process.exit(130));

const harnessSet = [...new Set(MUTATIONS.flatMap((m) => m.mustFail.split(' ')))].join(' ');
if (!run(harnessSet)) {
  console.error(`BASELINE IS RED (${harnessSet}). Mutation results would be meaningless.`);
  process.exit(1);
}
console.log(`baseline green: ${harnessSet}\n`);

let survived = 0;
for (const m of MUTATIONS) {
  const original = originals.get(m.file);
  if (!original.includes(m.from)) {
    console.log(`✗ NOT APPLIED  ${m.name}\n              (anchor text not found in ${m.file})`);
    survived += 1;
    continue;
  }
  const mutated = original.replace(m.from, m.to);
  if (mutated === original) {
    console.log(`✗ NO-OP EDIT   ${m.name}`);
    survived += 1;
    continue;
  }
  fs.writeFileSync(m.file, mutated);
  const green = run(m.mustFail);
  fs.writeFileSync(m.file, original);
  if (green) {
    console.log(
      `✗ SURVIVED     ${m.name}\n              (${m.mustFail} stayed green — coverage hole)`,
    );
    survived += 1;
  } else {
    console.log(`✓ caught       ${m.name}`);
  }
}

console.log(
  `\n${MUTATIONS.length - survived}/${MUTATIONS.length} mutations caught` +
    (survived > 0 ? ` — ${survived} SURVIVED` : ''),
);
process.exit(survived > 0 ? 1 : 0);

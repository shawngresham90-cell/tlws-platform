#!/usr/bin/env node
/**
 * Mutation checks for NAV-ENTRY-3.
 *
 * A green suite proves nothing on its own. Each mutation below damages
 * exactly one thing this milestone promised, re-runs the harnesses that
 * should notice, and REQUIRES them to go red. A mutation that survives is
 * reported as a coverage hole, not as a pass.
 *
 * The ten come straight from the milestone's own list of ways this could
 * regress. Every one is a change someone could make next year with a
 * perfectly good reason — "the map should come first", "Start should
 * confirm before it spends", "the summary reads better under the button" —
 * which is exactly why each needs a test standing in front of it.
 *
 * NOTHING COSMETIC IS COUNTED. Each mutation changes BEHAVIOUR a driver
 * would meet: where the primary action is, whether the selection is
 * acknowledged, what a tap costs, or whether a rail this milestone
 * inherited is still standing.
 *
 * Every file is restored from its captured original, even if a run throws.
 *
 * Run:  node scripts/mutate-navigator-route-start.mjs
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

const SCREEN = 'src/components/navigator/DrivingScreen.tsx';
const CONTROLS = 'src/components/navigator/PilotTripControls.tsx';
const SEARCH = 'src/components/navigator/DestinationSearch.tsx';
const ACTIONS = 'src/lib/navigator/actions.ts';
const TRUCK_STORE = 'src/components/navigator/truck-storage.ts';
const GATE = 'src/components/navigator/LockGate.tsx';
const CONTRACT = 'src/lib/navigator/route-start-contract.ts';

const MUTATIONS = [
  {
    /*
     * The headline regression: send the primary action back below the map
     * and the supporting blocks — which is precisely the state this
     * milestone measured on main, with Start 859-1182 px down and a
     * painted height of zero.
     */
    name: '1. the CTA is moved back below the map and the secondary blocks',
    file: SCREEN,
    from: "            primaryClassName={fullScreen ? '' : 'order-3 space-y-4'}",
    to: "            primaryClassName={fullScreen ? '' : 'order-12 space-y-4'}",
    mustFail: 'navigator-route-start navigator-destination-first',
  },
  {
    name: '2. a second destination search is added to the parked screen',
    file: SCREEN,
    from: '            <DestinationSearch\n              origin={searchOrigin}',
    to: '            <DestinationSearch origin={searchOrigin} onPick={() => {}} onClear={() => {}} />\n            <DestinationSearch\n              origin={searchOrigin}',
    mustFail: 'navigator-route-start navigator-destination-first',
  },
  {
    /*
     * The expensive one: selecting a search result buys a route. Every
     * driver browsing three candidates would pay for three routes.
     */
    name: '3. selecting a search result requests a route',
    file: SCREEN,
    from: '              onPick={(place) => {\n                setPicked(place);',
    to: "              onPick={(place) => {\n                void fetch('/api/navigator/route', { method: 'POST' });\n                setPicked(place);",
    mustFail: 'navigator-route-start navigator-destination-first',
  },
  {
    /*
     * One deliberate Start, two purchases. The ledger prices Start at
     * exactly one, so a second plan call has to be caught.
     */
    name: '4. one deliberate Start buys two routes',
    file: CONTROLS,
    from: '    const outcome = await lifecycle.plan(',
    to: '    await lifecycle.plan({ ...planRequest }, Date.now());\n    const outcome = await lifecycle.plan(',
    mustFail: 'navigator-entry navigator-route-start',
  },
  {
    /*
     * The driver taps a result and the screen says nothing back. This is
     * the "did that work?" defect in its purest form.
     */
    name: '5. the selected-destination confirmation is removed',
    file: CONTROLS,
    from: '              Destination: <span className="font-semibold">{picked.title}</span>',
    to: '              <span className="font-semibold">{null}</span>',
    mustFail: 'navigator-route-start',
  },
  {
    name: '6. the destination field is disabled while the truck is moving',
    file: ACTIONS,
    from: "  'edit-destination': true,",
    to: "  'edit-destination': false,",
    mustFail: 'navigator-route-start navigator-destination-first navigator-entry safety-gating',
  },
  {
    /*
     * A second mount point for the map means React tears the renderer down
     * and rebuilds it when the parked layout changes — a visible reload of
     * the map for no reason a driver could understand.
     */
    name: '7. the map gets a second mount point, so reordering remounts it',
    file: SCREEN,
    from: '        <div className={mapWrapCls}>{mapSlot}</div>',
    to: '        <div className={mapWrapCls}>{mapSlot}</div>\n        <div className="hidden">{mapSlot}</div>',
    mustFail: 'navigator-route-start navigation-map-ui navigator-map-search',
  },
  {
    name: '8. Passenger Access is reintroduced on the parked surface',
    file: GATE,
    from: '      <p className="text-lg font-semibold text-ink">{lockedLabel} is paused</p>',
    to: '      <p className="text-lg font-semibold text-ink">{lockedLabel} is paused — passenger access</p>',
    mustFail: 'navigator-entry safety-gating navigator-destination-first',
  },
  {
    /*
     * A driver's own 13'11" trailer silently becomes 13'6", and the route
     * they are given is for a truck they are not driving.
     */
    name: '9. a saved custom truck is overwritten by the standard defaults',
    file: TRUCK_STORE,
    from: '  const current = readVersioned<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);\n  if (current.ok) return current.value;',
    to: '  const current = readVersioned<StoredTruck>(TRUCK_PROFILE_KEY, TRUCK_VERSION, shapeTruck);\n  if (current.ok) return null;',
    mustFail: 'navigator-route-start navigator-destination-first navigator-truck-integrity',
  },
  {
    /*
     * The CTA is present, in the right place, and invisible: a max-height
     * clamp on the box that holds it. This is the exact mechanism that hid
     * the destination box before NAV-ENTRY-2 and the Start button before
     * this milestone, so the structural rail against it has to bite.
     */
    name: '10. the route-start cluster is clamped, hiding the CTA behind overflow',
    file: SCREEN,
    from: "            primaryClassName={fullScreen ? '' : 'order-3 space-y-4'}",
    to: "            primaryClassName={fullScreen ? '' : 'order-3 space-y-4 max-h-0 overflow-hidden'}",
    mustFail: 'navigator-route-start',
  },
  {
    /*
     * An eleventh, aimed at the RULE rather than the layout: stop pricing
     * the deliberate Start exactly. Without this the ledger would accept a
     * double purchase, and mutation 4 would have nothing to fail against.
     */
    name: '11. the ledger stops pricing the deliberate Start exactly',
    file: CONTRACT,
    from: '      if (step.routeRequests !== DELIBERATE_START_ROUTE_COST) {',
    to: '      if (false) {',
    mustFail: 'navigator-route-start',
  },
  {
    /*
     * A twelfth: stop treating an unmeasured step as a violation. A ledger
     * that silently passes a journey nobody walked is a ledger that proves
     * nothing, and that is the failure mode a green suite hides best.
     */
    name: '12. the ledger stops noticing steps that were never measured',
    file: CONTRACT,
    from: '    if (!covered.has(required)) violations.push(`${required} was never measured`);',
    to: '    if (false) violations.push(`${required} was never measured`);',
    mustFail: 'navigator-route-start',
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

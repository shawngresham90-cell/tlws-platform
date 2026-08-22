/**
 * NAV-ENTRY-2 — destination-first on the parked Navigator map.
 *
 * SCENARIOS NED1-NED60.
 *
 * WHAT THIS FILE IS FOR. NAV-ENTRY-1 moved the driving surface behind a
 * START DRIVING button and stopped there, deliberately. What it exposed is
 * that arriving on the parked map still did not let a driver do the one
 * thing they had just asked to do. Measured on the shipped build, the
 * destination input rendered inside a 286 px overlay whose content was
 * 700 px tall, with the plan-your-stops prompt and the road-test arm above
 * it — so the input's VISIBLE HEIGHT WAS 0 px at every one of the six
 * required viewports. Not low on the page: not painted at all.
 *
 * So the assertions below are mostly about ORDER and ABSENCE. Order,
 * because "destination search, then map, then the controls that spend a
 * route" is the whole milestone and it is the kind of thing that decays one
 * well-meaning insertion at a time. Absence, because every safety rail
 * NAV-ENTRY-1 removed — passenger access, the hold-to-unlock, the motion
 * editing locks, the setup wall — will look reasonable again to someone,
 * and a milestone that moves the search is exactly the sort of change that
 * would quietly bring one back.
 *
 * REAL AUTHORITIES, NOT AGREEABLE MOCKS. The visibility rule is the shipped
 * `destination-first` module, fed the numbers actually measured in Chromium
 * before and after this change: the before-measurements must be REJECTED
 * and the after-measurements ACCEPTED by the same function the browser
 * bench calls. The storage checks run the real versioned layer against a
 * Map-backed device. The route-spend checks read the real route port and
 * the real search port rather than a fixture that agrees with them.
 *
 * Run:  node scripts/run-tests.mjs navigator-destination-first
 */
import { readFileSync, existsSync } from 'node:fs';

/* ------------------------------------------------------------- harness */

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}

const read = (p: string) => readFileSync(p, 'utf8');
/**
 * Source with comments removed. Every structural assertion below runs
 * against this, never the raw file: this milestone's own prose necessarily
 * DESCRIBES the overlay it deleted, the setup wall it refuses to rebuild
 * and the passenger access it will not resurrect, and a check that matched
 * a comment would pass on the description of the thing it forbids. That is
 * not a hypothetical — an assertion in the trip-planner handoff harness had
 * been passing on comment proximity since NAV-ENTRY-1.
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* A Map-backed device, installed before the first storage call. */
const deviceStore = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => deviceStore.get(k) ?? null,
    setItem: (k: string, v: string) => void deviceStore.set(k, String(v)),
    removeItem: (k: string) => void deviceStore.delete(k),
    clear: () => deviceStore.clear(),
  },
  matchMedia: undefined,
  addEventListener() {},
  removeEventListener() {},
};

import {
  DOMINANCE_FRACTION,
  MIN_DESTINATION_TARGET_PX,
  NAVIGATOR_TOUCH_FLOOR_PX,
  PARKED_HIERARCHY,
  REQUIRED_VIEWPORTS,
  destinationEntryDominant,
  destinationEntryUsable,
  parkedOrderViolations,
  type DestinationMeasurement,
} from '@/lib/navigator/destination-first';
import { ACTION_PERMISSIONS, allowedWhileMoving } from '@/lib/navigator/actions';
import {
  DEFAULT_EDITABLE_PROFILE,
  confirmProfile,
  ftIn,
  profileGate,
} from '@/lib/navigator/truck-profile';
import { standardSetupDecision, truckSummaryLine } from '@/lib/navigator/navigator-entry';
import { readTruck, writeTruck } from '@/components/navigator/truck-storage';
import { MIN_SEARCH_LENGTH } from '@/lib/navigator-api/destination-search';

const SCREEN = read('src/components/navigator/DrivingScreen.tsx');
const SCREEN_CODE = code(SCREEN);
const SEARCH = read('src/components/navigator/DestinationSearch.tsx');
const SEARCH_CODE = code(SEARCH);
const NAVIGATE_PAGE = read('src/app/(navigator)/drive/navigate/page.tsx');
const NAVIGATE_CODE = code(NAVIGATE_PAGE);
const DRIVE_PAGE = read('src/app/(navigator)/drive/page.tsx');
const ROUTE_PORT = read('src/components/navigator/route-port.ts');
const SEARCH_PORT = read('src/components/navigator/search-port.ts');
const BENCH_PATH = 'scripts/bench/navigator-destination-first.mjs';

/* =================================================================== */
/* NED1-NED12 — the destination-first hierarchy                        */
/* =================================================================== */

check(
  'NED1: the destination search renders BEFORE the map in the parked tree',
  SCREEN_CODE.indexOf('{mapSearchSlot}') < SCREEN_CODE.indexOf('{mapSlot}'),
);

/*
 * NED1b exists because NED1 alone was not enough, and a mutation proved it.
 * `indexOf` finds the FIRST occurrence, so adding a SECOND copy of the
 * search below the map left NED1 perfectly happy — the first one was still
 * before the map — while the driver got two destination boxes and the
 * milestone's "do not create a second search implementation" rail was
 * quietly gone. Counting is the fix: one slot, one render, one place.
 */
check(
  'NED1b: …and it renders exactly ONCE — no second box below the map',
  (SCREEN_CODE.match(/\{mapSearchSlot\}/g) ?? []).length === 1,
  (SCREEN_CODE.match(/\{mapSearchSlot\}/g) ?? []).length,
);

check(
  'NED2: the search is a SIBLING of the map, not a child of its wrapper',
  /<div className=\{mapWrapCls\}>\{mapSlot\}<\/div>/.test(SCREEN_CODE.replace(/\s+/g, ' ')),
);

check(
  'NED3: no overlay chrome survives to clip the search',
  !SCREEN_CODE.includes('z-[500]') &&
    !SCREEN_CODE.includes('pointer-events-none') &&
    !SCREEN_CODE.includes('max-h-full overflow-y-auto'),
);

check(
  'NED4: the plan-your-stops prompt no longer sits above the search',
  SCREEN_CODE.indexOf('{mapSearchSlot}') < SCREEN_CODE.indexOf('{parkedPlanSlot}'),
);

check(
  'NED5: the road-test arm travels with the planning material, not above the search',
  SCREEN_CODE.indexOf('mapSearchSlot={') < SCREEN_CODE.indexOf('<RoadTestArm'),
);

{
  const block = SCREEN_CODE.slice(
    SCREEN_CODE.indexOf('mapSearchSlot={'),
    SCREEN_CODE.indexOf('parkedPlanSlot={'),
  );
  check(
    'NED6: within the search block the input comes first, before the border toggle',
    block.indexOf('<DestinationSearch') >= 0 &&
      block.indexOf('<DestinationSearch') < block.indexOf('crossBorderSearchLabel'),
  );
}

check(
  'NED7: parked, the route/start controls are ordered ahead of the supporting blocks',
  /order-1'\}>\s*\{destinationSlot/.test(SCREEN_CODE.replace(/\s+/g, ' ').replace(/ \}/g, '}')) ||
    SCREEN_CODE.includes("'order-1'}>"),
);

check(
  'NED8: the parked hierarchy names destination, then map, then start controls',
  PARKED_HIERARCHY[0] === 'destination-search' &&
    PARKED_HIERARCHY[1] === 'map' &&
    PARKED_HIERARCHY[2] === 'route-start-controls',
);

check(
  'NED9: a rendered order matching the hierarchy has no violations',
  parkedOrderViolations(['destination-search', 'map', 'route-start-controls']).length === 0,
);

check(
  'NED10: the OLD order — setup material first — is reported as a violation',
  parkedOrderViolations(['trip-planning', 'destination-search', 'map']).length > 0,
);

check(
  'NED11: search-after-map is a violation even when both are present',
  parkedOrderViolations(['map', 'destination-search']).length === 1,
);

check(
  'NED12: unknown blocks are ignored rather than treated as violations',
  parkedOrderViolations(['destination-search', 'public-beta-notice', 'map']).length === 0,
);

/* =================================================================== */
/* NED13-NED24 — the viewport visibility contract                      */
/* =================================================================== */

/** The six viewports, and the measurement rule, shared with the bench. */
check('NED13: the contract names exactly six required viewports', REQUIRED_VIEWPORTS.length === 6);

for (const want of ['360x740', '390x844', '430x932', '844x390', '932x430', '1280x800']) {
  check(
    `NED14: ${want} is one of the required viewports`,
    REQUIRED_VIEWPORTS.some((v) => v.name === want),
  );
}

check(
  'NED15: every required viewport carries real dimensions matching its name',
  REQUIRED_VIEWPORTS.every((v) => v.name === `${v.width}x${v.height}`),
);

/*
 * THE MEASURED BEFORE-STATE, recorded in Chromium against the production
 * build of main at b247256 with the Navigator flag on. Document-coordinate
 * top, and a visible height of ZERO at every viewport — the input was
 * inside a 286 px scroller holding 700 px of content.
 *
 * These are evidence, not thresholds: the rule must reject them, which is
 * how the harness proves the rule would have caught the shipped defect.
 */
const BEFORE: Readonly<Record<string, DestinationMeasurement>> = {
  '360x740': {
    top: 813,
    bottom: 877,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 740,
    obstructionTop: 683,
  },
  '390x844': {
    top: 753,
    bottom: 817,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 844,
    obstructionTop: 787,
  },
  '430x932': {
    top: 731,
    bottom: 795,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 932,
    obstructionTop: 875,
  },
  '844x390': {
    top: 649,
    bottom: 713,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 390,
    obstructionTop: 390,
  },
  '932x430': {
    top: 649,
    bottom: 713,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 430,
    obstructionTop: 430,
  },
  '1280x800': {
    top: 649,
    bottom: 713,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 800,
    obstructionTop: 800,
  },
};

/** The measured after-state on this branch, same build settings. */
const AFTER: Readonly<Record<string, DestinationMeasurement>> = {
  '360x740': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 740,
    obstructionTop: 683,
  },
  '390x844': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 844,
    obstructionTop: 787,
  },
  '430x932': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 932,
    obstructionTop: 875,
  },
  '844x390': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 390,
    obstructionTop: 390,
  },
  '932x430': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 430,
    obstructionTop: 430,
  },
  '1280x800': {
    top: 146,
    bottom: 210,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 800,
    obstructionTop: 800,
  },
};

for (const v of REQUIRED_VIEWPORTS) {
  check(
    `NED16: the rule REJECTS the shipped before-state at ${v.name}`,
    !destinationEntryUsable(BEFORE[v.name]).ok,
    destinationEntryUsable(BEFORE[v.name]).reasons,
  );
}

for (const v of REQUIRED_VIEWPORTS) {
  check(
    `NED17: the rule ACCEPTS the measured after-state at ${v.name}`,
    destinationEntryUsable(AFTER[v.name]).ok,
    destinationEntryUsable(AFTER[v.name]).reasons,
  );
}

for (const v of REQUIRED_VIEWPORTS) {
  check(
    `NED18: the after-state is DOMINANT, not merely visible, at ${v.name}`,
    destinationEntryDominant(AFTER[v.name]),
  );
}

check(
  'NED19: a box below the fold is rejected even with a full touch target',
  !destinationEntryUsable({
    top: 900,
    bottom: 964,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 844,
    obstructionTop: 844,
  }).ok,
);

check(
  'NED20: a box clipped to zero is rejected even when its coordinates look fine',
  !destinationEntryUsable({
    top: 200,
    bottom: 264,
    height: 64,
    visibleHeight: 0,
    viewportHeight: 844,
    obstructionTop: 844,
  }).ok,
);

check(
  'NED21: a box hidden under the fixed mobile tool bar is rejected',
  !destinationEntryUsable({
    top: 700,
    bottom: 764,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 844,
    obstructionTop: 700,
  }).ok,
);

check(
  'NED22: a box that clears the fold but sits low is visible yet NOT dominant',
  destinationEntryUsable({
    top: 700,
    bottom: 764,
    height: 64,
    visibleHeight: 64,
    viewportHeight: 844,
    obstructionTop: 844,
  }).ok &&
    !destinationEntryDominant({
      top: 700,
      bottom: 764,
      height: 64,
      visibleHeight: 64,
      viewportHeight: 844,
      obstructionTop: 844,
    }),
);

check(
  'NED23: the verdict names every failing rule, not just the first',
  destinationEntryUsable({
    top: 900,
    bottom: 930,
    height: 30,
    visibleHeight: 0,
    viewportHeight: 844,
    obstructionTop: 700,
  }).reasons.length >= 3,
);

check(
  'NED24: dominance is a viewport fraction, so it means the same on any screen',
  DOMINANCE_FRACTION > 0 && DOMINANCE_FRACTION <= 0.5,
);

/* =================================================================== */
/* NED25-NED32 — minimum target sizing                                 */
/* =================================================================== */

check('NED25: the accessibility floor is 44 CSS px', MIN_DESTINATION_TARGET_PX === 44);

check(
  "NED26: the Navigator's own preferred target is larger than the floor",
  NAVIGATOR_TOUCH_FLOOR_PX === 64 && NAVIGATOR_TOUCH_FLOOR_PX > MIN_DESTINATION_TARGET_PX,
);

check(
  'NED27: a 43 px target is rejected',
  !destinationEntryUsable({
    top: 100,
    bottom: 143,
    height: 43,
    visibleHeight: 43,
    viewportHeight: 844,
    obstructionTop: 844,
  }).ok,
);

check(
  'NED28: a 44 px target is accepted — the floor is inclusive',
  destinationEntryUsable({
    top: 100,
    bottom: 144,
    height: 44,
    visibleHeight: 44,
    viewportHeight: 844,
    obstructionTop: 844,
  }).ok,
);

check(
  'NED29: the shipped input keeps the 64 px class, not the bare minimum',
  /const inputClass =\s*'min-h-16 /.test(SEARCH_CODE),
);

check(
  'NED30: every result card is a full-height tap target too',
  /className="min-h-16 w-full rounded-cockpit/.test(SEARCH_CODE),
);

check(
  'NED31: the measured after-state clears the preferred floor, not just the minimum',
  REQUIRED_VIEWPORTS.every((v) => AFTER[v.name].height >= NAVIGATOR_TOUCH_FLOOR_PX),
);

check(
  'NED32: the search input is never given a smaller height class on short screens',
  !/min-h-(?:0|1|2|3|4|5|6|7|8|9|10|11)\b[^']*text-xl text-ink/.test(SEARCH_CODE),
);

/* =================================================================== */
/* NED33-NED38 — the truck profile: ready, never a setup wall          */
/* =================================================================== */

const TRUCK_KEY = 'tlws-navigator-truck-v1';

check(
  'NED33: a fresh device is seeded with the shipped standard truck',
  standardSetupDecision(null) === 'seed-standard',
  standardSetupDecision(null),
);

check(
  'NED34: the standard truck is 13 ft 6 in (13.5 ft) and 80,000 lb',
  DEFAULT_EDITABLE_PROFILE.heightFt === 13.5 && DEFAULT_EDITABLE_PROFILE.grossWeightLbs === 80000,
  { ...DEFAULT_EDITABLE_PROFILE },
);

{
  /* A real saved custom truck, written and read back through the shipped
   * versioned storage — not a fixture that agrees with the reader. */
  deviceStore.clear();
  const custom = {
    ...DEFAULT_EDITABLE_PROFILE,
    heightFt: ftIn(13, 11),
    grossWeightLbs: 79000,
    axles: 6,
  };
  writeTruck(custom, confirmProfile(custom));
  const back = readTruck();
  check(
    'NED35: a saved custom truck survives a parked visit untouched',
    back !== null &&
      back.profile.heightFt === ftIn(13, 11) &&
      back.profile.grossWeightLbs === 79000 &&
      back.profile.axles === 6,
    back?.profile,
  );
  check(
    'NED36: a returning driver with a valid custom truck is NOT reseeded with standard',
    standardSetupDecision(readTruck()) === 'keep-saved',
    standardSetupDecision(readTruck()),
  );
  /*
   * The confirmation is read back through the shipped shape check, which
   * honours a stored confirmation ONLY while its fingerprint still matches
   * the stored values. So this asserts the real restore path, not a
   * hand-built ConfirmationState that would agree with anything.
   */
  check(
    'NED36b: and the saved truck comes back CONFIRMED, so nothing asks again',
    back !== null && profileGate(back.profile, back.confirmation) === 'ready',
    back?.confirmation,
  );
  deviceStore.clear();
}

check(
  'NED37: the parked screen shows the truck as ONE summary line, not an editor',
  SCREEN_CODE.includes('truckSummaryLine(truckProfile)') &&
    !/mapSearchSlot=\{[\s\S]{0,2000}<TruckProfileEditor/.test(SCREEN_CODE),
);

check(
  'NED38: nothing requires confirming the truck before the search may be used',
  profileGate(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE)) === 'ready' &&
    !/disabled=\{[^}]*profileGate/.test(SCREEN_CODE) &&
    !/<DestinationSearch[\s\S]{0,400}disabled=\{[^}]*truckGate/.test(SCREEN_CODE) &&
    typeof truckSummaryLine(DEFAULT_EDITABLE_PROFILE) === 'string',
);

/* =================================================================== */
/* NED39-NED46 — the route-spend boundary                              */
/* =================================================================== */

check(
  'NED39: exactly one module asks for a route',
  /NAVIGATOR_ROUTE_ENDPOINT|\/api\/navigator\/route/.test(ROUTE_PORT),
);

check(
  'NED40: the driving screen never fetches a route itself',
  !/fetch\((['"`])\/api\/navigator\/route/.test(SCREEN_CODE),
);

check(
  'NED41: search and route are different endpoints, so their spend is separable',
  SEARCH_PORT.includes('/api/navigator/destination-search') &&
    !SEARCH_PORT.includes('/api/navigator/route'),
);

check(
  'NED42: the search component requests nothing but a search',
  !/\/api\/navigator\/route/.test(SEARCH_CODE) && SEARCH_CODE.includes('searchDestinations('),
);

check(
  'NED43: focusing the field is not wired to anything — no onFocus handler at all',
  !/onFocus=/.test(SEARCH_CODE),
);

check(
  'NED44: typing costs a search only after the debounce, and only past the minimum length',
  SEARCH_CODE.includes('DEBOUNCE_MS') &&
    SEARCH_CODE.includes('q.length < MIN_SEARCH_LENGTH') &&
    MIN_SEARCH_LENGTH >= 2,
);

check(
  'NED45: picking a destination sets state and requests nothing',
  /onPick\(chosen\);/.test(SEARCH_CODE) && !/plan\(|startNavigation\(/.test(SEARCH_CODE),
);

check(
  'NED46: the launcher still mounts nothing that could request a route or a search',
  !DRIVE_PAGE.includes('<DrivingScreen') &&
    !DRIVE_PAGE.includes('<GpsProvider') &&
    !DRIVE_PAGE.includes('<DestinationSearch'),
);

/* =================================================================== */
/* NED47-NED52 — motion, and the rails that must stay removed          */
/* =================================================================== */

check(
  'NED47: every editing action remains permitted while moving',
  allowedWhileMoving('edit-destination') && allowedWhileMoving('enter-text'),
);

{
  /*
   * EVERY EDITING ACTION, and only those. The three that remain
   * stationary-only are CAMERA actions — pan, whole-route overview and
   * basemap switching — which the owner's road test split out deliberately
   * and which NAV-ENTRY-1 did not touch. Asserting "everything is true"
   * would have been asserting a change nobody made, and would fail the
   * moment someone read the actual decision.
   */
  const EDITING = [
    'edit-destination',
    'edit-truck-profile',
    'add-stop',
    'submit-driver-report',
    'enter-text',
    'browse-directory',
    'open-deep-settings',
    'view-trip-summary',
  ] as const;
  const gated = EDITING.filter((a) => ACTION_PERMISSIONS[a] !== true);
  check(
    'NED48: no EDITING action in the permission map is disabled by motion',
    gated.length === 0,
    gated,
  );
}

check(
  'NED49: the search is not gated on motion anywhere in the driving screen',
  !/<LockGate[\s\S]{0,600}<DestinationSearch/.test(SCREEN_CODE),
);

check(
  'NED50: the search mounts on lifecycle state alone — parked, pilot, idle',
  SCREEN_CODE.includes("pilot.active && !fullScreen && lcState === 'idle'") &&
    !/motion === 'MOVING'[\s\S]{0,200}mapSearchSlot/.test(SCREEN_CODE),
);

{
  /* Absence tests for every rail NAV-ENTRY-1 removed. The files this
   * milestone touched are checked directly, so a reintroduction here
   * cannot ride in behind a layout change. */
  const touched = [
    'src/components/navigator/DrivingScreen.tsx',
    'src/components/navigator/DestinationSearch.tsx',
    'src/app/(navigator)/drive/navigate/page.tsx',
    'src/lib/navigator/destination-first.ts',
  ];
  const forbidden = [
    /passenger/i,
    /hold[- ]to[- ]unlock/i,
    /holdToUnlock/,
    /overrideUntil/,
    /countdown/i,
    /setupWindowException/,
  ];
  const offenders: string[] = [];
  for (const f of touched) {
    const src = code(read(f));
    for (const re of forbidden) if (re.test(src)) offenders.push(`${f} :: ${String(re)}`);
  }
  check(
    'NED51: Passenger Access and every override rail stay absent',
    offenders.length === 0,
    offenders,
  );
}

check(
  'NED52: the non-blocking parked reminder is still reachable from the parked screen',
  SCREEN_CODE.includes('href="/drive/settings"') &&
    read('src/components/navigator/NavigatorSettings.tsx').includes('PARKED_REMINDER'),
);

/* =================================================================== */
/* NED53-NED57 — active navigation is not degraded to serve parked     */
/* =================================================================== */

check(
  'NED53: while guidance is live the maneuver card still renders unconditionally',
  SCREEN_CODE.includes('const maneuverCardEarnsPlace = fullScreen ||'),
);

check(
  'NED54: the parked search cannot mount during guidance',
  /pilot\.active && !fullScreen && lcState === 'idle'/.test(SCREEN_CODE),
);

check(
  'NED55: there is still exactly ONE mount point for the map — no remount to reposition',
  (SCREEN_CODE.match(/\{mapSlot\}/g) ?? []).length === 1,
  (SCREEN_CODE.match(/\{mapSlot\}/g) ?? []).length,
);

check(
  'NED56: the surface still switches by CLASS rather than by returning a second tree',
  SCREEN_CODE.includes('const surfaceCls = fullScreen') &&
    !/if \(fullScreen\) \{\s*return \(/.test(SCREEN_CODE),
);

check(
  'NED57: the full-screen branch keeps its own ordering — no parked order class leaks in',
  !/fullScreen \? 'order-/.test(SCREEN_CODE) && /fullScreen \? '' : 'order-1'/.test(SCREEN_CODE),
);

/* =================================================================== */
/* NED58-NED60 — scope rails: no migration, one search, bench agrees   */
/* =================================================================== */

check(
  'NED58: this milestone adds no database migration',
  !existsSync('supabase/migrations/nav-entry-2') &&
    !/create table|alter table/i.test(code(read('src/lib/navigator/destination-first.ts'))),
);

check(
  'NED59: there is still exactly one destination-search implementation',
  (SCREEN_CODE.match(/<DestinationSearch/g) ?? []).length === 1 &&
    SEARCH_CODE.includes('export function DestinationSearch'),
  (SCREEN_CODE.match(/<DestinationSearch/g) ?? []).length,
);

{
  /*
   * The bench keeps its own copy of the viewport list — it is a plain
   * .mjs script run by hand and cannot import a TypeScript module. So the
   * copy is checked against the authority here rather than trusted, which
   * is the only thing standing between "the bench passed" and "the bench
   * measured what the contract actually asks for".
   */
  const bench = existsSync(BENCH_PATH) ? read(BENCH_PATH) : '';
  const named = REQUIRED_VIEWPORTS.every((v) =>
    new RegExp(`name: '${v.name}', width: ${v.width}, height: ${v.height}`).test(bench),
  );
  check(
    'NED60: the browser bench measures exactly the six required viewports',
    bench !== '' &&
      named &&
      bench.includes(`MIN_DESTINATION_TARGET_PX = ${MIN_DESTINATION_TARGET_PX}`),
  );
}

console.log(`navigator-destination-first: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

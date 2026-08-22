/**
 * NAV-ENTRY-3 — destination → route → drive on the parked Navigator map.
 *
 * SCENARIOS NER1-NER60.
 *
 * WHAT THIS FILE IS FOR. NAV-ENTRY-2 put the destination box in front of
 * the driver. It did not finish the sentence: a driver tapped a search
 * result and then had to work out on their own whether the tap had landed
 * and what to do next. Measured in Chromium on a production build of main
 * at 86b417e, after choosing a destination the confirmation sat 819-1114 px
 * down and Start 859-1182 px down — both with a PAINTED HEIGHT OF ZERO at
 * all six required viewports, behind 315-541 px of scrolling, past the map,
 * the status line, the 230 px clock card and the control row.
 *
 * So the assertions below are about ORDER, ACKNOWLEDGEMENT and PRICE.
 * Order, because "destination, then the thing that confirms it, then the
 * thing that acts on it" is the milestone. Acknowledgement, because a
 * selection the driver cannot see is indistinguishable from a tap that
 * missed. Price, because the one control this milestone makes easy to find
 * is also the only control on the screen that spends money, and making it
 * findable must not make it cheap to press twice.
 *
 * REAL AUTHORITIES, NOT AGREEABLE MOCKS. The ordering rule is the shipped
 * `destination-first` hierarchy data. The spend rule is the shipped
 * `route-start-contract` ledger, fed the counts the browser bench actually
 * observed. The storage checks run the real versioned layer against a
 * Map-backed device. Structural checks run against COMMENT-STRIPPED source,
 * so this milestone's own prose — which necessarily describes the layout it
 * replaced and the rails it refuses to rebuild — can never satisfy a check
 * about the thing that replaced them.
 *
 * Run:  node scripts/run-tests.mjs navigator-route-start
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

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
  DELIBERATE_START_ACTION,
  DELIBERATE_START_ROUTE_COST,
  MIN_CTA_TARGET_PX,
  ZERO_ROUTE_ACTIONS,
  routeSpendViolations,
  selectionAnswered,
  type JourneyStep,
  type SelectionState,
} from '@/lib/navigator/route-start-contract';
import { PARKED_HIERARCHY, parkedOrderViolations } from '@/lib/navigator/destination-first';
import { ACTION_PERMISSIONS } from '@/lib/navigator/actions';
import {
  DEFAULT_EDITABLE_PROFILE,
  confirmProfile,
  ftIn,
  profileGate,
} from '@/lib/navigator/truck-profile';
import { standardSetupDecision } from '@/lib/navigator/navigator-entry';
import { readTruck, writeTruck } from '@/components/navigator/truck-storage';
import { voiceEnabledByDefault, writeVoiceChoice } from '@/components/navigator/voice-storage';
import { LAUNCHER_ACTIONS } from '@/lib/navigator/navigator-entry';
import { DISPLAY_MODES } from '@/lib/navigator/display-mode';

const SCREEN = read('src/components/navigator/DrivingScreen.tsx');
const SCREEN_CODE = code(SCREEN);
const CONTROLS = read('src/components/navigator/PilotTripControls.tsx');
const CONTROLS_CODE = code(CONTROLS);
const SEARCH_CODE = code(read('src/components/navigator/DestinationSearch.tsx'));
const NAVIGATE_CODE = code(read('src/app/(navigator)/drive/navigate/page.tsx'));
const DRIVE_CODE = code(read('src/app/(navigator)/drive/page.tsx'));
const ROUTE_PORT = read('src/components/navigator/route-port.ts');
const SEARCH_PORT = read('src/components/navigator/search-port.ts');
const BENCH_PATH = 'scripts/bench/navigator-route-start.mjs';

/**
 * The parked order a given anchor carries, read out of the source.
 *
 * The cluster is anchored on `primaryClassName=` rather than on the
 * `data-route-start-cluster` wrapper: that wrapper generates no box when
 * parked (`display: contents`), so its order is not what positions
 * anything — the trip controls' own primary half is. Anchoring on the
 * wrapper read whatever order class happened to be nearest in the file and
 * reported 12.
 */
function orderOf(anchor: string): number | null {
  const at = SCREEN_CODE.indexOf(anchor);
  if (at < 0) return null;
  const win = SCREEN_CODE.slice(Math.max(0, at - 400), at + 200);
  const hits = [...win.matchAll(/order-(\d+)/g)].map((m) => Number(m[1]));
  return hits.length === 0 ? null : hits[hits.length - 1];
}
function mapOrder(): number | null {
  const at = SCREEN_CODE.indexOf('const mapWrapCls = fullScreen');
  if (at < 0) return null;
  const m = /order-(\d+)/.exec(SCREEN_CODE.slice(at, at + 900));
  return m === null ? null : Number(m[1]);
}

/**
 * The order the trip controls' PRIMARY half takes when parked, read from
 * the exact prop expression. A windowed search around an anchor is not good
 * enough here: `optionalClassName` is declared on the very next line, so a
 * window that reached forward reported 11 and a window that took the last
 * match reported 11 too. The expression itself is unambiguous.
 */
function primaryHalfOrder(): number | null {
  const m = /primaryClassName=\{[^}]*?'order-(\d+)/.exec(SCREEN_CODE);
  return m === null ? null : Number(m[1]);
}

/* =================================================================== */
/* NER1-NER10 — the parked hierarchy                                   */
/* =================================================================== */

check(
  'NER1: the shipped hierarchy puts the route-start cluster between search and map',
  PARKED_HIERARCHY.indexOf('destination-search') <
    PARKED_HIERARCHY.indexOf('route-start-cluster') &&
    PARKED_HIERARCHY.indexOf('route-start-cluster') < PARKED_HIERARCHY.indexOf('map'),
  [...PARKED_HIERARCHY],
);

check(
  'NER2: the rendered parked order matches it — search < cluster < map',
  (() => {
    const s = orderOf('data-parked-search');
    const c = primaryHalfOrder();
    const m = mapOrder();
    return s !== null && c !== null && m !== null && s < c && c < m;
  })(),
  {
    search: orderOf('data-parked-search'),
    cluster: primaryHalfOrder(),
    map: mapOrder(),
  },
);

check(
  'NER3: the route-start cluster is a real, findable element, not an idea',
  SCREEN_CODE.includes('data-route-start-cluster'),
);

check(
  'NER4: the clock card and the control row are ordered AFTER the map',
  (() => {
    const m = mapOrder();
    const hos = orderOf('data-hos-region');
    return m !== null && hos !== null && m < hos;
  })(),
  { map: mapOrder(), hos: orderOf('data-hos-region') },
);

check(
  'NER5: the old order — Start after the map — is reported as a violation',
  parkedOrderViolations(['destination-search', 'map', 'route-start-cluster']).length === 1,
);

check(
  'NER6: the new order is clean',
  parkedOrderViolations(['destination-search', 'route-start-cluster', 'map', 'trip-planning'])
    .length === 0,
);

check(
  'NER7: the supporting search-scope control is ordered after the map',
  (() => {
    const m = mapOrder();
    const scope = orderOf('parkedSearchScopeSlot}</div>');
    return m !== null && scope !== null && m < scope;
  })(),
  { map: mapOrder(), scope: orderOf('parkedSearchScopeSlot}</div>') },
);

check(
  'NER8: parked ordering is achieved by CLASS, never by a second tree',
  SCREEN_CODE.includes('const surfaceCls = fullScreen') &&
    !/if \(fullScreen\) \{\s*return \(/.test(SCREEN_CODE),
);

check(
  'NER9: no order class leaks into the full-screen branch',
  !/fullScreen \? (?:'[^']*order-|`[^`]*order-)/.test(SCREEN_CODE),
);

check(
  'NER10: the parked shell is one ordering context, so both blocks can interleave',
  /flex flex-col gap-4/.test(SCREEN_CODE) && /'contents'/.test(SCREEN_CODE),
);

/* =================================================================== */
/* NER11-NER20 — the map is not remounted to achieve any of this        */
/* =================================================================== */

check(
  'NER11: there is still exactly ONE map mount point',
  (SCREEN_CODE.match(/\{mapSlot\}/g) ?? []).length === 1,
  (SCREEN_CODE.match(/\{mapSlot\}/g) ?? []).length,
);

check(
  'NER12: the map wrapper is still a single element with no mode-conditional JSX',
  /<div className=\{mapWrapCls\}>\{mapSlot\}<\/div>/.test(SCREEN_CODE.replace(/\s+/g, ' ')),
);

check(
  'NER13: the trip-control cluster has ONE mount point too — Start survives the transition',
  (SCREEN_CODE.match(/\{destinationSlot/g) ?? []).length === 1,
  (SCREEN_CODE.match(/\{destinationSlot/g) ?? []).length,
);

check(
  'NER14: the parked search slot still has exactly one mount point',
  (SCREEN_CODE.match(/\{mapSearchSlot\}/g) ?? []).length === 1,
);

check(
  'NER15: the map is still the full-bleed background while guidance is live',
  SCREEN_CODE.includes("? 'absolute inset-0 z-0 overflow-hidden'"),
);

check(
  'NER16: the loading placeholder still promises the box the map will take',
  (SCREEN_CODE.match(/h-\[38dvh\]/g) ?? []).length >= 2 &&
    (SCREEN_CODE.match(/min-h-\[200px\]/g) ?? []).length >= 2,
);

check(
  'NER17: the parked search still precedes the map',
  SCREEN_CODE.indexOf('{mapSearchSlot}') < SCREEN_CODE.indexOf('{mapSlot}'),
);

check(
  'NER18: nothing overlays or clips the parked column',
  !SCREEN_CODE.includes('z-[500]') &&
    !SCREEN_CODE.includes('pointer-events-none') &&
    !SCREEN_CODE.includes('max-h-full overflow-y-auto'),
);

check(
  /*
   * A deterministic harness cannot see a clipped control — that is the
   * browser bench's job. What it CAN refuse is the mechanism: a max-height
   * or an overflow clamp on the box that carries the confirmation and
   * Start. Every clipping defect this milestone found on main came from
   * exactly such a clamp one level up.
   */
  'NER18b: nothing clamps the route-start cluster with overflow or a max height',
  !/primaryClassName=\{[^}]*(?:overflow-hidden|overflow-y-|max-h-)/.test(SCREEN_CODE) &&
    !/data-route-start-cluster[\s\S]{0,120}(?:overflow-hidden|max-h-)/.test(SCREEN_CODE),
);

check(
  'NER19: the camera inset is still reported as zero while parked',
  /if \(!fullScreen \|\| el === null/.test(SCREEN_CODE),
);

check(
  'NER20: guidance still decides the surface, not the parked layout',
  SCREEN_CODE.includes('ACTIVE_LIFECYCLE_STATES.includes(lcState)'),
);

/* =================================================================== */
/* NER21-NER32 — the selection is acknowledged                          */
/* =================================================================== */

check(
  'NER21: choosing a destination names it back to the driver',
  /Destination:/.test(CONTROLS_CODE) && /picked\.title/.test(CONTROLS_CODE),
);

check(
  'NER22: the confirmation sits immediately above the Start it commits to',
  CONTROLS_CODE.indexOf('picked.title') < CONTROLS_CODE.indexOf('onClick={startTrip}'),
);

check(
  'NER23: with nothing chosen, the screen says what to do instead of showing a bare button',
  /Search for a destination/.test(CONTROLS_CODE),
);

check(
  'NER24: the primary action keeps a glove-sized target well above the floor',
  /min-h-\[4\.5rem\]/.test(CONTROLS_CODE) && 72 >= MIN_CTA_TARGET_PX,
);

check(
  'NER25: Start is genuinely disabled when it cannot work, and says why',
  /disabled=\{attemptActive \|\| startBlockedReason !== null\}/.test(CONTROLS_CODE) &&
    /id="start-blocked-reason"/.test(CONTROLS_CODE),
);

check(
  'NER26: the destination stays changeable — editing the text drops the old pick',
  /if \(settled\) \{/.test(SEARCH_CODE) && /onClear\(\)/.test(SEARCH_CODE),
);

check(
  'NER27: …and choosing does not clear the box, so nothing must be retyped',
  /setQuery\(chosen\.title\)/.test(SEARCH_CODE),
);

check(
  'NER28: there is exactly ONE destination-search implementation',
  (SCREEN_CODE.match(/<DestinationSearch/g) ?? []).length === 1 &&
    /export function DestinationSearch/.test(
      read('src/components/navigator/DestinationSearch.tsx'),
    ),
  (SCREEN_CODE.match(/<DestinationSearch/g) ?? []).length,
);

check(
  'NER29: there is exactly ONE primary route-start control',
  (CONTROLS_CODE.match(/onClick=\{startTrip\}/g) ?? []).length === 1,
  (CONTROLS_CODE.match(/onClick=\{startTrip\}/g) ?? []).length,
);

check(
  'NER30: no competing GO / ROUTE button was invented alongside it',
  !/>\s*(GO|Go now|Route it|Begin route)\s*</.test(SCREEN_CODE + CONTROLS_CODE),
);

{
  const good: SelectionState = {
    confirmationVisible: true,
    confirmationFullyPainted: true,
    ctaInViewport: true,
    ctaFullyPainted: true,
    ctaHeight: 72,
    ctaUncovered: true,
    ctaFreeOfScrollTrap: true,
    destinationStillEditable: true,
  };
  check('NER31: a fully answered selection passes the rule', selectionAnswered(good).ok);
  check(
    'NER32: the measured BEFORE state — CTA below the fold, unpainted — is rejected',
    !selectionAnswered({ ...good, ctaInViewport: false, ctaFullyPainted: false }).ok,
  );
}

/* =================================================================== */
/* NER33-NER40 — the rule has teeth in every direction                  */
/* =================================================================== */

{
  const good: SelectionState = {
    confirmationVisible: true,
    confirmationFullyPainted: true,
    ctaInViewport: true,
    ctaFullyPainted: true,
    ctaHeight: 72,
    ctaUncovered: true,
    ctaFreeOfScrollTrap: true,
    destinationStillEditable: true,
  };
  check(
    'NER33: a missing confirmation is rejected',
    !selectionAnswered({ ...good, confirmationVisible: false }).ok,
  );
  check(
    'NER34: a clipped confirmation is rejected',
    !selectionAnswered({ ...good, confirmationFullyPainted: false }).ok,
  );
  check('NER35: a 43px target is rejected', !selectionAnswered({ ...good, ctaHeight: 43 }).ok);
  check(
    'NER36: a 44px target is accepted — the floor is inclusive',
    selectionAnswered({ ...good, ctaHeight: 44 }).ok,
  );
  check(
    'NER37: a covered CTA is rejected',
    !selectionAnswered({ ...good, ctaUncovered: false }).ok,
  );
  check(
    'NER38: a CTA inside an inner scroller is rejected',
    !selectionAnswered({ ...good, ctaFreeOfScrollTrap: false }).ok,
  );
  check(
    'NER39: a destination that can no longer be changed is rejected',
    !selectionAnswered({ ...good, destinationStillEditable: false }).ok,
  );
  check(
    'NER40: the verdict names every missing half, not just the first',
    selectionAnswered({ ...good, confirmationVisible: false, ctaInViewport: false, ctaHeight: 10 })
      .violations.length >= 3,
  );
}

/* =================================================================== */
/* NER41-NER50 — the route-spend ledger                                 */
/* =================================================================== */

check('NER41: the ledger names ten zero-cost actions', ZERO_ROUTE_ACTIONS.length === 10, [
  ...ZERO_ROUTE_ACTIONS,
]);

check(
  'NER42: one deliberate Start is priced at exactly one route request',
  DELIBERATE_START_ROUTE_COST === 1,
);

/** The journey the browser bench actually walks, priced correctly. */
const CLEAN_JOURNEY: JourneyStep[] = [
  ...ZERO_ROUTE_ACTIONS.map((action) => ({ action, routeRequests: 0, searchRequests: 0 })),
  { action: DELIBERATE_START_ACTION, routeRequests: 1, searchRequests: 0 },
];

check(
  'NER43: a clean journey has no violations',
  routeSpendViolations(CLEAN_JOURNEY).ok,
  routeSpendViolations(CLEAN_JOURNEY).violations,
);

check(
  'NER44: a route bought when a result is SELECTED is a violation',
  !routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === 'select a destination result' ? { ...s, routeRequests: 1 } : s,
    ),
  ).ok,
);

check(
  'NER45: a route bought merely by opening /drive/navigate is a violation',
  !routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === 'open /drive/navigate' ? { ...s, routeRequests: 1 } : s,
    ),
  ).ok,
);

check(
  'NER46: a DOUBLE purchase on one deliberate Start is a violation',
  !routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === DELIBERATE_START_ACTION ? { ...s, routeRequests: 2 } : s,
    ),
  ).ok,
);

check(
  'NER47: a Start that buys nothing is a violation too — the contract is exact',
  !routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === DELIBERATE_START_ACTION ? { ...s, routeRequests: 0 } : s,
    ),
  ).ok,
);

check(
  'NER48: returning from Settings during a trip may not buy a replacement route',
  !routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === 'return from Settings' ? { ...s, routeRequests: 1 } : s,
    ),
  ).ok,
);

check(
  'NER49: a journey that skipped a required step is a violation, not a pass',
  !routeSpendViolations(CLEAN_JOURNEY.filter((s) => s.action !== 'open Plan My Trip')).ok,
);

check(
  'NER50: typing may spend SEARCH requests without spending a route',
  routeSpendViolations(
    CLEAN_JOURNEY.map((s) =>
      s.action === 'type a destination query' ? { ...s, searchRequests: 3 } : s,
    ),
  ).ok,
);

/* =================================================================== */
/* NER51-NER60 — the contracts this milestone inherits                  */
/* =================================================================== */

check(
  'NER51: search and route remain different endpoints, so their budgets stay separable',
  SEARCH_PORT.includes('/api/navigator/destination-search') &&
    !SEARCH_PORT.includes('/api/navigator/route') &&
    /\/api\/navigator\/route/.test(ROUTE_PORT),
);

check(
  'NER52: the driving screen never fetches a route itself',
  !/fetch\((['"`])\/api\/navigator\/route/.test(SCREEN_CODE),
);

check(
  'NER53: focusing the destination field is still wired to nothing',
  !/onFocus=/.test(SEARCH_CODE),
);

check(
  'NER54: the launcher still offers exactly three actions',
  LAUNCHER_ACTIONS.length === 3,
  LAUNCHER_ACTIONS.map((a) => a.id),
);

check(
  'NER55: the launcher still mounts nothing that could spend a route or a search',
  !DRIVE_CODE.includes('<DrivingScreen') &&
    !DRIVE_CODE.includes('<GpsProvider') &&
    !DRIVE_CODE.includes('<DestinationSearch'),
);

check(
  'NER56: display still offers Automatic, Night and Day',
  DISPLAY_MODES.length === 3 && DISPLAY_MODES.includes('automatic'),
  [...DISPLAY_MODES],
);

{
  /*
   * Written through the SHIPPED writer, not a hand-built record. The first
   * draft of this check invented an envelope shape (`{v, value:{...}}`) that
   * the real versioned layer does not use, so the record was unreadable and
   * the assertion failed for a reason that had nothing to do with voice. A
   * fixture that has to guess the storage format is testing the guess.
   */
  deviceStore.clear();
  check('NER57a: a new device defaults voice On', voiceEnabledByDefault() === true);
  writeVoiceChoice(false);
  check('NER57b: …and a saved Off is respected, not overridden', voiceEnabledByDefault() === false);
  writeVoiceChoice(true);
  check('NER57c: …and a saved On round-trips too', voiceEnabledByDefault() === true);
  deviceStore.clear();
}

{
  deviceStore.clear();
  check(
    'NER58a: a fresh device is seeded with the standard truck',
    standardSetupDecision(null) === 'seed-standard',
  );
  const custom = {
    ...DEFAULT_EDITABLE_PROFILE,
    heightFt: ftIn(13, 11),
    grossWeightLbs: 79000,
    axles: 6,
  };
  writeTruck(custom, confirmProfile(custom));
  const back = readTruck();
  check(
    'NER58b: a saved custom truck survives this milestone untouched and confirmed',
    back !== null &&
      back.profile.heightFt === ftIn(13, 11) &&
      back.profile.grossWeightLbs === 79000 &&
      profileGate(back.profile, back.confirmation) === 'ready',
    back?.profile,
  );
  check(
    'NER58c: …and is not reseeded with the standard one',
    standardSetupDecision(readTruck()) === 'keep-saved',
  );
  deviceStore.clear();
}

{
  const EDITING = [
    'edit-destination',
    'edit-truck-profile',
    'add-stop',
    'enter-text',
    'open-deep-settings',
    'view-trip-summary',
  ] as const;
  const gated = EDITING.filter((a) => ACTION_PERMISSIONS[a] !== true);
  check('NER59a: motion still disables no editing action', gated.length === 0, gated);
  check(
    'NER59b: the destination search carries no motion gate',
    !/<LockGate[\s\S]{0,600}<DestinationSearch/.test(SCREEN_CODE),
  );
  const touched = [
    'src/components/navigator/DrivingScreen.tsx',
    'src/lib/navigator/route-start-contract.ts',
    'src/lib/navigator/destination-first.ts',
  ];
  const forbidden = [/passenger/i, /hold[- ]to[- ]unlock/i, /countdown/i, /overrideUntil/];
  const offenders: string[] = [];
  for (const f of touched) {
    const src = code(read(f));
    for (const re of forbidden) if (re.test(src)) offenders.push(`${f} :: ${String(re)}`);
  }
  check(
    'NER59c: Passenger Access and every override rail stay absent',
    offenders.length === 0,
    offenders,
  );
}

{
  /*
   * NO MIGRATION — asserted against THIS MILESTONE'S BASE, not against a
   * fixed number.
   *
   * NAV-ENTRY-1 wrote "nothing above 056 exists", which was true when it
   * shipped and became false the moment REVENUE-2 added 057 for reasons of
   * its own. A scope assertion that breaks when a DIFFERENT milestone does
   * its job is an assertion that gets edited under time pressure until it
   * means nothing. What this milestone can honestly claim is that IT added
   * none, so the base set is named and only additions beyond it count.
   */
  const BASE_MIGRATIONS = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
  const NAV_ENTRY_3_ADDED: string[] = [];
  check(
    'NER60a: NAV-ENTRY-3 adds no migration of its own',
    NAV_ENTRY_3_ADDED.length === 0 &&
      BASE_MIGRATIONS.every((f) => !/route.start|nav.entry.3/i.test(f)),
    BASE_MIGRATIONS.filter((f) => /route.start|nav.entry.3/i.test(f)),
  );
  check(
    'NER60b: and no migration present mentions a Navigator object',
    BASE_MIGRATIONS.filter((f) => Number(f.slice(0, 3)) > 56).every((f) => {
      const sql = read(`supabase/migrations/${f}`)
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n');
      return !/navigator/i.test(sql);
    }),
  );
  check(
    'NER60c: no Navigator surface writes to a database',
    !/supabase|postgrest/i.test(SCREEN_CODE) && !/supabase|postgrest/i.test(CONTROLS_CODE),
  );
  check(
    'NER60d: HERE routing semantics are untouched by this milestone',
    !/HERE|hereApi|transportMode|truckProfile\s*=/.test(
      code(read('src/lib/navigator/route-start-contract.ts')),
    ),
  );
  check(
    'NER60e: the browser bench measures the six required viewports',
    existsSync(BENCH_PATH) &&
      ['360x740', '390x844', '430x932', '844x390', '932x430', '1280x800'].every((v) =>
        read(BENCH_PATH).includes(`name: '${v}'`),
      ),
  );
  check(
    'NER60f: …and prices the journey with the shipped ledger, not its own copy',
    existsSync(BENCH_PATH) && read(BENCH_PATH).includes('DELIBERATE_START_ACTION'),
  );
}

check(
  'NER60: the navigate page still gates on the server before rendering anything',
  NAVIGATE_CODE.includes("requireNavigatorAccess('/drive/navigate')") &&
    NAVIGATE_CODE.includes('navigatorAccessGranted'),
);

console.log(`navigator-route-start: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

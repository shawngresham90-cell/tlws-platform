/**
 * Navigator Design Blueprint — Phase 3 invariants: the Route Preview
 * flight briefing.
 *
 * The briefing's contract: it reads route state that already exists —
 * the picked destination, the provider's numbers, the session's own
 * truck profile, the provider's road names at their exact route miles,
 * the warnings the validator let through — and presents it. It owns no
 * navigation state, makes no claims the code cannot stand behind (no
 * "truck-safe", no "verified", no invented alternatives), collapses its
 * warning area when there is nothing real to warn about, and hands Start
 * to the SAME lifecycle transition that always ran.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-route-briefing.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-route-briefing.cjs \
 *   && node /tmp/test-route-briefing.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RouteBriefing } from '@/components/navigator/RouteBriefing';
import { summarizeRouteRoads } from '@/lib/navigator/route-brief';
import {
  createNavigationLifecycle,
  type PlanFetchResult,
  type RouteBrief,
} from '@/lib/navigator/navigation-lifecycle';
import { createPilotLog } from '@/lib/navigator/pilot-mode';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';

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

const BRIEFING_SRC = readFileSync('src/components/navigator/RouteBriefing.tsx', 'utf8');
const CONTROLS_SRC = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
const MAP_SRC = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const LIFECYCLE_SRC = readFileSync('src/lib/navigator/navigation-lifecycle.ts', 'utf8');
const DOC = readFileSync('docs/operations/navigator-design-blueprint-phase-3.md', 'utf8').replace(
  /\s+/g,
  ' ',
);

/* ==================== 1. the corridor summarizer ========================= */
{
  const m = (instruction: string, mileMi: number) => ({ instruction, mileMi });
  const roads = summarizeRouteRoads(
    [
      m('Head east.', 0), // no road named — contributes nothing
      m('Turn right onto Cobb Pkwy.', 0.5),
      m('Take the ramp toward I-75 North', 4.6),
      m('Turn left onto Dock Street.', 20.0),
      m('Arrive at your destination.', 20.7),
    ],
    20.7,
  );
  check(
    'roads: named in DRIVING order, not by size',
    roads.length === 2 && roads[0].name === 'Cobb Pkwy' && roads[1].name === 'I-75 North',
    roads,
  );
  check(
    'roads: miles are the provider mile deltas',
    roads[0].miles === 4.1 && roads[1].miles === 15.4,
    roads,
  );
  check(
    'roads: sub-mile connectors stay out (Dock Street)',
    !roads.some((r) => r.name === 'Dock Street'),
  );

  const revisit = summarizeRouteRoads(
    [
      m('Turn right onto US-41.', 0),
      m('Turn left onto Service Rd.', 5),
      m('Turn left onto US-41.', 6.5),
      m('Arrive at your destination.', 10),
    ],
    10,
  );
  check(
    'roads: revisits aggregate under one name',
    revisit.length === 2 && revisit[0].name === 'US-41' && revisit[0].miles === 8.5,
    revisit,
  );

  const many = summarizeRouteRoads(
    Array.from({ length: 8 }, (_, i) => m(`Turn right onto Road ${i}.`, i * 5)),
    40,
  );
  check('roads: capped at four', many.length === 4, many.length);

  check('roads: empty in, empty out', summarizeRouteRoads([], 10).length === 0);
  check(
    'roads: unknown total means the last leg claims nothing',
    summarizeRouteRoads([m('Turn right onto Lone Rd.', 0)], null).length === 0,
  );
}

/* ==================== 2. routeBrief() is a read, and honest ============== */
const ORIGIN: LatLng = { lat: 33.9, lng: -84.5 };
const DEST: LatLng = { lat: 34.2, lng: -84.5 };
const POSITIONS: LatLng[] = Array.from({ length: 31 }, (_, i) => ({
  lat: 33.9 + i * 0.01,
  lng: -84.5,
}));
const PLAN_OK: PlanFetchResult = {
  kind: 'route',
  routeId: 'route-briefing-test',
  positions: POSITIONS,
  distanceMiles: 20.7,
  durationSeconds: 1800,
  maneuvers: [
    { action: 'depart', instruction: 'Head north.', direction: null, offset: 0 },
    { action: 'turn', instruction: 'Turn right onto Cobb Pkwy.', direction: 'right', offset: 2 },
    {
      action: 'turn',
      instruction: 'Take the ramp toward I-75 North',
      direction: 'right',
      offset: 8,
    },
    { action: 'arrive', instruction: 'Arrive at your destination.', direction: null, offset: 30 },
  ],
  validationState: 'valid-with-warning',
  warnings: ['Provider flagged a seasonal restriction it could not evaluate.'],
};

async function makeLifecycle() {
  const life = createNavigationLifecycle({
    planPort: async () => PLAN_OK,
    replacementPort: async () => PLAN_OK,
    log: createPilotLog(),
  });
  return life;
}

const T0 = 1_754_000_000_000;

async function behavioralChecks(): Promise<void> {
  const life = await makeLifecycle();
  check('brief: null before any route exists', life.routeBrief() === null);

  const out = await life.plan(
    { origin: ORIGIN, destination: DEST, truck: DEFAULT_TRUCK_PROFILE, departAtMs: T0 },
    { position: DEST, facility: 'warehouse', positionSource: 'unknown' },
    T0,
  );
  check('brief: the fixture plan lands at route-ready', out.ok && life.state() === 'route-ready');

  const brief = life.routeBrief();
  check('brief: available at route-ready', brief !== null);
  if (brief !== null) {
    check(
      'brief: the truck is the profile the request carried',
      brief.truck.grossWeightLbs === DEFAULT_TRUCK_PROFILE.grossWeightLbs &&
        brief.truck.heightFt === DEFAULT_TRUCK_PROFILE.heightFt,
    );
    check(
      'brief: provider numbers pass through untouched',
      brief.distanceMiles === 20.7 && brief.durationSeconds === 1800,
    );
    check(
      'brief: the validator-passed warning is surfaced',
      brief.warnings.length === 1 && brief.warnings[0].includes('seasonal restriction'),
    );
    check(
      'brief: maneuvers carry instruction + resolved route mile only',
      brief.maneuvers.length === 4 &&
        typeof brief.maneuvers[1].mileMi === 'number' &&
        Object.keys(brief.maneuvers[1]).sort().join(',') === 'instruction,mileMi',
    );
    check(
      'brief: frozen copies — a briefing cannot mutate the route',
      Object.isFrozen(brief) &&
        Object.isFrozen(brief.truck) &&
        Object.isFrozen(brief.maneuvers) &&
        Object.isFrozen(brief.maneuvers[0]) &&
        Object.isFrozen(brief.warnings),
    );
  }

  // The start path is the SAME transition it always was, and the brief
  // stays readable while the trip is live (the active session).
  check('brief: startNavigation still starts', life.startNavigation(T0 + 1000) === true);
  check('brief: still readable mid-trip', life.routeBrief() !== null);
  life.cancel(T0 + 2000);
  life.complete(T0 + 3000);

  const life2 = await makeLifecycle();
  await life2.plan(
    { origin: ORIGIN, destination: DEST, truck: DEFAULT_TRUCK_PROFILE, departAtMs: T0 },
    { position: DEST, facility: 'warehouse', positionSource: 'unknown' },
    T0,
  );
  life2.discardRoute(T0 + 1000);
  check('brief: discarding the route clears it', life2.routeBrief() === null);
}

/* ==================== 3. the rendered briefing =========================== */
const FIXTURE_BRIEF: RouteBrief = Object.freeze({
  truck: Object.freeze({ ...DEFAULT_TRUCK_PROFILE }),
  maneuvers: Object.freeze([
    Object.freeze({ instruction: 'Turn right onto Cobb Pkwy.', mileMi: 0.5 }),
    Object.freeze({ instruction: 'Take the ramp toward I-75 North', mileMi: 4.6 }),
    Object.freeze({ instruction: 'Arrive at your destination.', mileMi: 128.4 }),
  ]),
  warnings: Object.freeze([]) as readonly string[],
  distanceMiles: 128.4,
  durationSeconds: 7500,
});
const DESTINATION = {
  id: 'fixture',
  title: 'Southeast Distribution Center',
  address: '2200 Commerce Way, Marietta, GA',
  facility: 'distribution-center',
  position: DEST,
} as never;

function renderBriefing(over: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(RouteBriefing, {
      destination: DESTINATION,
      totalMi: 128.4,
      etaText: '3:45 PM',
      brief: FIXTURE_BRIEF,
      onStart: () => {},
      onDiscard: () => {},
      ...over,
    }),
  );
}

{
  const html = renderBriefing();
  check('render: destination name leads', html.includes('Southeast Distribution Center'));
  check('render: address beneath it', html.includes('2200 Commerce Way, Marietta, GA'));
  check('render: facility stated plainly', html.includes('distribution center'));
  check(
    'render: the entrance fact is stated, quietly',
    html.includes('Entrance unverified') &&
      !/border-l-nav-warn[^"]*"[^>]*>[^<]*Entrance/.test(html),
  );
  check('render: distance in driver units', html.includes('128.4 mi'));
  check('render: duration in the HOS strip format', html.includes('2:05'));
  check('render: arrival clock time', html.includes('3:45 PM'));
  check(
    'render: the numbers are tabular data-face numerals',
    (html.match(/num-data[^"]*font-data|font-data[^"]*num-data/g) ?? []).length === 3,
  );
  check(
    'render: major roads in driving order',
    html.indexOf('Cobb Pkwy') > 0 && html.indexOf('Cobb Pkwy') < html.indexOf('I-75 North'),
  );
  check(
    'render: the truck panel shows the session profile with its disclosure',
    html.includes('Truck used for this route') &&
      html.includes('Pilot defaults') &&
      html.includes('Not routed around:'),
  );
  check('render: Start keeps its pinned words', html.includes('Start navigation'));
  check('render: Discard stays available, quieter', html.includes('Discard route'));

  // Touch floors: the primary is the blueprint's 72px, nothing tappable
  // under 64px on this surface.
  const buttons = [...html.matchAll(/<button\b[^>]*class="([^"]*)"/g)].map((m) => m[1]);
  check('touch: exactly the two actions', buttons.length === 2, buttons.length);
  check(
    'touch: primary start is 72px and green-with-words',
    buttons[0].includes('min-h-[4.5rem]') && buttons[0].includes('bg-nav-good'),
  );
  check('touch: secondary keeps the 64px floor', buttons[1].includes('min-h-16'));

  // Collapse: nothing amber when nothing is wrong.
  check('collapse: no warning chrome on a clean route', !html.includes('border-l-nav-warn'));

  // Honesty: no claims the code cannot stand behind, no invented
  // alternatives, no coordinates.
  check(
    'honesty: no safety-verdict language',
    !/truck[- ]safe|truck approved|route verified|verified route|legal route|safety score|route confidence|% confident/i.test(
      html,
    ),
  );
  check(
    'honesty: no invented alternative routes',
    !/fastest|easiest|avoid tolls|best route|truck preferred/i.test(html),
  );
  check('honesty: no raw coordinates', !/-?\d{1,3}\.\d{4}/.test(html));
  check('honesty: no TLWS yellow as meaning', !/nav-brand|#FFEB00/i.test(html));

  // A provider warning renders amber BESIDE its words.
  const warned = renderBriefing({
    brief: { ...FIXTURE_BRIEF, warnings: ['Provider flagged a seasonal restriction.'] },
  });
  check(
    'warnings: amber edge beside the provider sentence',
    warned.includes('border-l-nav-warn') &&
      warned.includes('Provider flagged a seasonal restriction.') &&
      /<span aria-hidden="true">⚠\s*<\/span>/.test(warned),
  );

  // Coordinate entry states itself; it never fakes a place.
  const coords = renderBriefing({ destination: null });
  check(
    'render: coordinate entry is honest about itself',
    coords.includes('Destination set by coordinates') &&
      coords.includes('Developer coordinate entry'),
  );

  // No live regions: a parked briefing is not an emergency stream.
  check('a11y: no aria-live on the briefing', !renderBriefing().includes('aria-live'));
}

/* ==================== 4. the wiring changes no behavior ================== */
{
  const controls = strip(CONTROLS_SRC);
  /*
   * Two callers since the startup simplification, SAME transition: the
   * briefing's Start button (warned routes — the driver commits after
   * reading) and the one-tap flow's starting effect (clean routes —
   * commits on the route-ready render). Anything beyond these two would
   * be a third way to start a trip and must fail here.
   */
  check(
    'wiring: startNavigation has exactly its two sanctioned callers',
    (controls.match(/lifecycle\.startNavigation\(Date\.now\(\)\)/g) ?? []).length === 2,
  );
  check(
    'wiring: Discard is the one existing lifecycle transition',
    (controls.match(/lifecycle\.discardRoute\(Date\.now\(\)\)/g) ?? []).length === 1,
  );
  check(
    'wiring: the briefing receives them as callbacks',
    /onStart=\{\(\) => act\(\(\) => lifecycle\.startNavigation/.test(CONTROLS_SRC) &&
      /onDiscard=\{\(\) => act\(\(\) => lifecycle\.discardRoute/.test(CONTROLS_SRC),
  );
  check(
    // Still the SAME component, in the same slot; it now also reads the
    // driver's units (Canada milestone), which changes the sentence and
    // not the measurement.
    'wiring: the plausibility advisory rides along, in the driver’s units',
    /plausibilitySlot=\{<RouteCheck lifecycle=\{lifecycle\} metric=\{metric\} \/>\}/.test(
      CONTROLS_SRC,
    ),
  );

  const briefing = strip(BRIEFING_SRC);
  check(
    'purity: the briefing component owns no navigation, voice, or network',
    !/createNavigationLifecycle|startNavigation|voice|speech|geolocation|fetch\s*\(|https?:\/\/|setTimeout|setInterval/.test(
      briefing,
    ),
  );
  check(
    'purity: routeBrief hands out frozen copies only',
    /function routeBrief\(\)[\s\S]{0,600}Object\.freeze/.test(LIFECYCLE_SRC) &&
      !/routeBrief\(\)[\s\S]{0,600}return (?:routeSession|active);/.test(LIFECYCLE_SRC),
  );
}

/* ==================== 5. the parked map overview ========================= */
{
  const code = strip(MAP_SRC);
  check(
    'map: the whole-route fit exists and runs only before guidance is live',
    /if \(!navigating && geometry\.length >= 2\)[\s\S]{0,220}fitBounds/.test(code),
  );
  check(
    // The briefing is a whole-route question, so the fit is north-up and
    // instant — no animation, and no heading-up bearing on a map the
    // truck is not driving yet.
    'map: the fit never animates, and frames the route north-up',
    /fitBounds\(boundsOf\(geometry\), \{ padding: 40, animate: false, bearing: 0 \}\)/.test(code),
  );
  check(
    'map: guidance going live hands the camera back to the truck',
    /navigating && !wasNavigatingRef\.current[\s\S]{0,80}lastCenteredRef\.current = null/.test(
      code,
    ),
  );
}

/* ==================== 6. the record keeps its promises =================== */
{
  for (const promise of [
    'Route alternatives',
    'HOS fit indicator',
    'Deferred rather than faked',
    'designed cleanly around the one real route',
  ]) {
    check(`record: documents "${promise}"`, DOC.includes(promise));
  }
}

behavioralChecks().then(
  () => {
    console.log(`navigator-route-briefing: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  },
  (err) => {
    console.log(`FAIL: the harness itself threw — ${String(err)}`);
    process.exit(1);
  },
);

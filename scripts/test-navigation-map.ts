/**
 * Pilot round 1 — live navigation map. The first road test was text-only:
 * the driver could not see where they were, what road they were on, or
 * where they were going.
 *
 * Covers the pure map geometry (maneuver interpolation, navigation zoom,
 * recenter hysteresis), the lifecycle's read-only map projection
 * (including redraw-on-reroute), and the component's structural rules —
 * SSR safety, read-only-ness, and that the maneuver card still outranks
 * the map on screen.
 *
 * Run: npx esbuild scripts/test-navigation-map.ts --bundle --platform=node \
 *   --format=cjs --alias:@=./src --outfile=/tmp/test-navigation-map.cjs \
 *   && node /tmp/test-navigation-map.cjs
 */
import { readFileSync } from 'node:fs';
import { positionAtRouteMile, navigationZoom, shouldRecenter } from '@/lib/navigator/map-view';
import { normalizeGeometry } from '@/lib/navigator/route-geometry';
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

// A due-north corridor: 0.001° of latitude ≈ 0.069 mi per step.
const LAT0 = 35;
const LNG0 = -85;
function northRoute(n = 200) {
  const positions: LatLng[] = [];
  for (let i = 0; i < n; i++) positions.push({ lat: LAT0 + i * 0.001, lng: LNG0 });
  const norm = normalizeGeometry(positions, Number(((n - 1) * 0.0690937).toFixed(1)));
  if (norm.problems.length > 0) throw new Error('fixture failed');
  return norm.points;
}

// ------------------------------------------------- maneuver interpolation
{
  const route = northRoute();
  const last = route[route.length - 1];

  check('maneuver marker: empty route yields no marker', positionAtRouteMile([], 1) === null);
  check(
    'maneuver marker: NaN mile yields no marker',
    positionAtRouteMile(route, Number.NaN) === null,
  );

  const atStart = positionAtRouteMile(route, 0);
  check('maneuver marker: mile 0 is the route start', atStart?.lat === route[0].position.lat);

  const mid = positionAtRouteMile(route, route[10].routeMile);
  check(
    'maneuver marker: an exact route mile lands on its point',
    mid !== null && Math.abs(mid.lat - route[10].position.lat) < 1e-9,
    mid,
  );

  const between = positionAtRouteMile(route, (route[10].routeMile + route[11].routeMile) / 2);
  check(
    'maneuver marker: a mile between points interpolates between them',
    between !== null &&
      between.lat > route[10].position.lat &&
      between.lat < route[11].position.lat,
    between,
  );

  check(
    'maneuver marker: a mile past the end clamps to the end (never off-route)',
    positionAtRouteMile(route, last.routeMile + 500)?.lat === last.position.lat,
  );
  check(
    'maneuver marker: a negative mile clamps to the start',
    positionAtRouteMile(route, -10)?.lat === route[0].position.lat,
  );
  const copy = positionAtRouteMile(route, 0);
  if (copy) copy.lat = 0;
  check('maneuver marker: the caller cannot mutate route geometry', route[0].position.lat === LAT0);
}

// ------------------------------------------------------------- zoom rules
{
  check('zoom: parked shows the lot', navigationZoom(0) === 17);
  check('zoom: null speed is treated as parked', navigationZoom(null) === 17);
  check('zoom: yard/city speed', navigationZoom(20) === 16);
  check('zoom: secondary road speed', navigationZoom(40) === 15);
  check('zoom: highway speed shows the next mile', navigationZoom(65) === 14);
  check('zoom: NaN speed falls back to the closest view', navigationZoom(Number.NaN) === 17);
  const zooms = [0, 10, 30, 60, 80].map(navigationZoom);
  check(
    'zoom: never increases with speed (monotonic, so it cannot flap)',
    zooms.every((z, i) => i === 0 || z <= zooms[i - 1]),
    zooms,
  );
}

// -------------------------------------------------------- recenter rules
{
  const here = { lat: 35, lng: -85 };
  check('recenter: the first fix always centers', shouldRecenter(here, null));
  check(
    'recenter: GPS jitter while parked does not drag the map',
    !shouldRecenter({ lat: 35.00005, lng: -85 }, here),
  );
  check('recenter: real movement recenters', shouldRecenter({ lat: 35.0005, lng: -85 }, here));
  check(
    'recenter: threshold is configurable for tuning',
    shouldRecenter({ lat: 35.00005, lng: -85 }, here, 1),
  );
}

// ------------------------------------- lifecycle map projection (read-only)
{
  const src = readFileSync('src/lib/navigator/navigation-lifecycle.ts', 'utf8');
  check('lifecycle: exposes a map projection', src.includes('mapData(): MapData'));
  check(
    'lifecycle: the map follows the CURRENT route, so a reroute redraws',
    src.includes('nav?.currentSession() ?? routeSession'),
  );
  check(
    'lifecycle: positions are copied, never handed out by reference',
    src.includes('active.geometry.map((p) => ({ ...p.position }))') &&
      src.includes('{ ...destinationInfo.position }'),
  );
  check(
    'lifecycle: routeId rides along as the redraw trigger',
    /routeId: active === null \? null : active\.routeId/.test(src),
  );
  const session = readFileSync('src/lib/navigator/navigation-session.ts', 'utf8');
  check(
    'session: exposes the replacement route (not the one it was built with)',
    session.includes('currentSession: () => reroute?.currentSession() ?? null'),
  );
}

// ----------------------------------------------------- component structure
{
  const map = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
  check('map: client component', map.startsWith("'use client'"));
  check(
    // A `import type` is erased at compile time and is SSR-safe; a VALUE
    // import of leaflet would execute browser-only code during SSR.
    'map: Leaflet is imported inside an effect (never a value import at module scope)',
    map.includes("await import('leaflet')") &&
      !/^import\s+(?!type\b)[^;]*from\s+'leaflet';$/m.test(map),
  );
  check('map: no API key, no key-bearing tile host', !/apiKey|access_token/i.test(map));
  check(
    'map: uses the platform tile source already in production',
    map.includes('tile.openstreetmap.org'),
  );
  check('map: draws the route line', map.includes('L.polyline('));
  check(
    'map: shows truck, next maneuver, and destination',
    map.includes("'Your truck'") &&
      map.includes("'Next maneuver'") &&
      map.includes("'Destination'"),
  );
  check('map: truck marker rotates with heading', map.includes('rotate(${rotate}deg)'));
  check(
    'map: follows the truck using the pure helper',
    map.includes('shouldRecenter(') && map.includes('navigationZoom('),
  );
  check(
    'map: redraws only when the route identity changes',
    map.includes('drawnRouteRef') && map.includes('routeId ?? '),
  );
  check(
    'map: cannot be panned or zoomed by a braced hand while driving',
    map.includes('dragging: false') &&
      map.includes('scrollWheelZoom: false') &&
      map.includes('touchZoom: false'),
  );
  check('map: cleans up its Leaflet instance on unmount', map.includes('mapRef.current?.remove()'));
  check(
    'map: read-only — owns no engine and cannot mutate a route',
    !/lifecycle|createNavigation|requestReroute|\.ingest\(/.test(map),
  );
  check(
    'map: a Leaflet failure degrades to text, never a broken screen',
    map.includes('Map unavailable') && map.includes('setFailed(true)'),
  );

  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'screen: the map is dynamically imported with SSR disabled',
    screen.includes('dynamic(') && screen.includes('ssr: false'),
  );
  check(
    'screen: the maneuver card still outranks the map on screen',
    screen.indexOf('aria-label="Next maneuver"') < screen.indexOf('{mapSlot}'),
  );
  check(
    'screen: the map receives live position, heading and speed',
    screen.includes('position={truckPosition}') &&
      screen.includes('headingDeg={position.headingDeg}') &&
      screen.includes('speedMph={view.speedMph}'),
  );
  check(
    'screen: no map before a fix or a route (nothing to show, so nothing shown)',
    screen.includes('watching || mapData.geometry.length > 0'),
  );
}

// ====== ROUND-2 REGRESSION: Start Trip left the driver on the controls ====
// Live report: after Start Trip the mobile UI stayed on the pilot
// controls/debug section instead of presenting the navigation experience.
// The start button lives at the BOTTOM (inside the stationary-only gate)
// while the maneuver card and map are at the TOP, and nothing moved the
// viewport.
{
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');

  check(
    'start-fix: the view accepts a focus token for trip start',
    screen.includes('focusNavigationKey') && screen.includes('navTopRef'),
  );
  check(
    'start-fix: the token scrolls the guidance into view',
    /navTopRef\.current[\s\S]{0,200}scrollIntoView/.test(screen),
  );
  check(
    'start-fix: the scroll target is the maneuver card (the top of guidance)',
    /ref=\{navTopRef\}[\s\S]{0,120}aria-label="Next maneuver"/.test(screen),
  );
  check(
    'start-fix: scrollIntoView is feature-detected (never throws in a test/older runtime)',
    screen.includes("typeof el.scrollIntoView === 'function'"),
  );
  check(
    'start-fix: fires only on the route-ready → navigating transition',
    screen.includes("lcState === 'navigating' && prev === 'route-ready'"),
  );
  check(
    'start-fix: later guidance states do NOT re-scroll the driver',
    // The token derives from a tick bumped only by that one transition —
    // not from routeId or lcState, which change during reroutes.
    screen.includes('focusTick === 0 ? null : `trip-start-${focusTick}`') &&
      !/focusNavigationKey = .*routeId/.test(screen),
  );
  check(
    'start-fix: the effect keys on the token, so one start scrolls once',
    /}, \[focusNavigationKey\]\)/.test(screen),
  );
  check(
    'start-fix: guidance still precedes the pilot controls in document order',
    // Anchor on the JSX USAGE, not the prop declarations at the top.
    screen.indexOf('aria-label="Next maneuver"') < screen.indexOf('{mapSlot}') &&
      screen.indexOf('{mapSlot}') < screen.indexOf('{destinationSlot ??'),
  );

  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  check(
    'start-fix: the pilot debug log stays collapsed by default',
    controls.includes('<details') && !/<details\s+open/.test(controls),
  );
  check(
    'start-fix: destination entry is hidden once a trip is underway',
    controls.includes("{state === 'idle' ? ("),
  );
}

console.log(`navigation-map: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

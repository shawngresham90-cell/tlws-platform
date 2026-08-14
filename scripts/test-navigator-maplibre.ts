/**
 * The MapLibre migration + heading-up camera — renderer harness.
 *
 * The previous milestone measured that Leaflet cannot rotate a map and
 * refused to fake it (docs/operations/navigator-heading-up-blocker.md).
 * The owner then authorized owner decision 6, path B: MapLibre GL becomes
 * the Navigator's renderer so the CAMERA can carry a real bearing and the
 * whole picture — tiles, road labels, route line, markers — turns as one.
 *
 * This harness pins the migration's structural claims, the ones a
 * screenshot cannot show and a browser bench cannot pin cheaply:
 *
 *   1. MapLibre is the Navigator's renderer, and no Leaflet code remains
 *      in it — while the DIRECTORY maps keep theirs untouched;
 *   2. the forbidden fake never returns: no CSS rotation of a map
 *      container anywhere in the Navigator;
 *   3. the tile source is the SAME approved OSM raster, translated to
 *      MapLibre's syntax, with attribution riding on the source itself;
 *   4. ONE map instance per mount: nothing recreates it — not a route
 *      becoming ready, not navigation starting, not a bearing change, not
 *      overview, not recenter, not a reroute — and Strict Mode's
 *      double-invoked effect cannot produce a second map;
 *   5. route geometry updates as DATA on a persistent source;
 *   6. the camera rules: heading-up follow with the truck low, north-up
 *      overview, recenter restoring both, and no provider request from
 *      any camera change;
 *   7. gestures: pan and zoom gated by the shared lock, rotation refused
 *      outright, controls upright above the rotating world;
 *   8. the #301 resize protection survives the renderer swap;
 *   9. cleanup removes the map, its markers and its observers.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-maplibre
 */
import { readFileSync } from 'node:fs';
import {
  maplibreRasterStyle,
  resolveMapStyle,
  tileUrlsFor,
  MAP_STYLES,
  RASTER_SATURATION,
} from '@/lib/navigator/map-style';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: ${name}${detail === undefined ? '' : ` — ${String(JSON.stringify(detail)).slice(0, 220)}`}`,
    );
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MAP = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const MAP_CODE = strip(MAP);
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const STYLE = readFileSync('src/lib/navigator/map-style.ts', 'utf8');
const PKG = readFileSync('package.json', 'utf8');
const CSS = readFileSync('src/app/(navigator)/navigator-design.css', 'utf8');

/* ============ 1. MapLibre is the renderer; Leaflet is gone from it ====== */
{
  check(
    'renderer: MapLibre is imported by the Navigator map',
    MAP.includes("import('maplibre-gl')"),
  );
  check(
    'renderer: it is imported INSIDE an effect — never a value import at module scope (SSR)',
    !/^import\s+(?!type\b)[^;]*from\s+'maplibre-gl';$/m.test(MAP),
  );
  check(
    'renderer: a real MapLibre map is constructed',
    MAP_CODE.includes('new maplibre.Map(') && MAP_CODE.includes('container: containerRef.current'),
  );
  check(
    'renderer: no Leaflet API survives in the Navigator map',
    !/L\.(map|marker|polyline|tileLayer|layerGroup|divIcon|latLngBounds)\(/.test(MAP) &&
      !/from 'leaflet'|leaflet\/dist/.test(MAP),
  );
  check(
    'renderer: no Leaflet API survives on the driving screen either',
    !/leaflet/i.test(strip(SCREEN)),
  );
  check('deps: maplibre-gl is a real dependency', /"maplibre-gl":\s*"/.test(PKG));
  check(
    // The directory and parking maps still run on Leaflet. Removing it
    // would break features this milestone never touched.
    'deps: Leaflet stays for the DIRECTORY maps that still use it',
    /"leaflet":\s*"/.test(PKG) &&
      readFileSync('src/components/map/LeafletMap.tsx', 'utf8').includes("import('leaflet')"),
  );
  check(
    'deps: no keyed, metered or paid map provider was added',
    !/mapbox-gl|@react-google-maps|arcgis|"esri|@maptiler/i.test(PKG),
  );
}

/* ============ 2. the forbidden fake never returns ======================= */
{
  check(
    'no-fake: the map container is never CSS-rotated',
    !/style\.transform/.test(MAP) && !/transform:[^\n]*rotate\(/.test(MAP),
  );
  check(
    'no-fake: no rotation is applied to the map wrapper in CSS either',
    !/\.nav-map[^{]*\{[^}]*transform:[^}]*rotate/.test(CSS),
  );
  check(
    "no-fake: rotation is the CAMERA's bearing, the renderer's own",
    MAP_CODE.includes('bearing,') && MAP_CODE.includes('map.easeTo('),
  );
  check(
    'no-fake: no device-orientation or motion permission is requested',
    !/DeviceOrientation|deviceorientation|requestPermission|DeviceMotion/.test(MAP + SCREEN),
  );
  check(
    'no-fake: no browser Fullscreen API',
    !/requestFullscreen|webkitRequestFullscreen/.test(MAP + SCREEN),
  );
}

/* ============ 3. the SAME approved tiles, translated ==================== */
{
  const standard = resolveMapStyle('standard');
  const urls = tileUrlsFor(standard);
  check('tiles: the {s} placeholder is expanded, never sent literally', urls.length === 3);
  check(
    'tiles: every URL is the approved OSM host',
    urls.every((u) =>
      /^https:\/\/[abc]\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png$/.test(u),
    ),
    urls,
  );
  check(
    'tiles: no {s} survives into a request URL',
    urls.every((u) => !u.includes('{s}')),
  );
  check(
    'tiles: no API key, no token, anywhere in the style seam',
    !/apiKey|access_token|key=/i.test(STYLE),
  );

  const style = maplibreRasterStyle(standard) as Record<string, never> | null;
  check('style: a valid MapLibre style document is produced', style !== null);
  const sources = (style?.sources ?? {}) as Record<string, Record<string, unknown>>;
  check('style: version 8', (style as unknown as { version: number }).version === 8);
  check('style: one raster source carrying the tiles', sources.basemap?.type === 'raster');
  check(
    'style: ATTRIBUTION rides on the source, so it cannot be lost in a component edit',
    String(sources.basemap?.attribution ?? '').includes('OpenStreetMap'),
  );
  check(
    'style: the attribution keeps its copyright LINK',
    String(sources.basemap?.attribution ?? '').includes('openstreetmap.org/copyright'),
  );
  check("style: the source respects the style's max zoom", sources.basemap?.maxzoom === 19);
  const layers = ((style as unknown as { layers: Record<string, unknown>[] })?.layers ??
    []) as Record<string, unknown>[];
  check('style: a background and the basemap raster layer', layers.length === 2);
  check(
    'style: the cockpit desaturation is a renderer paint property',
    JSON.stringify(layers[1]).includes('raster-saturation') && RASTER_SATURATION < 0,
  );
  check(
    'style: attribution is never switched off in the component',
    !/attributionControl:\s*false/.test(MAP),
  );

  const satellite = MAP_STYLES.find((s) => s.id === 'satellite');
  check(
    'style: the unapproved satellite style still yields NO style document',
    maplibreRasterStyle(satellite!) === null,
  );
  check(
    'style: and the component keeps what is drawn rather than blanking',
    MAP_CODE.includes('if (next === null) return'),
  );
}

/* ============ 4. ONE map instance, never remounted ====================== */
{
  // The creation effect, from its first line to its dependency array.
  // (Sliced out of the COMMENT-STRIPPED source, so the landmarks have to
  // be code, not the section banners.)
  const createStart = MAP_CODE.indexOf('let cancelled = false');
  const createEffect = MAP_CODE.slice(
    createStart,
    MAP_CODE.indexOf('}, [dispatch]);', createStart) + '}, [dispatch]);'.length,
  );
  check('lifecycle: the creation effect exists', createEffect.length > 0);
  check(
    'lifecycle: it depends ONLY on the stable dispatch — not on route, bearing or navigating',
    /\}, \[dispatch\]\);/.test(MAP_CODE),
  );
  for (const dep of [
    'routeId',
    'navigating',
    'position',
    'geometry',
    'headingDeg',
    'overviewToggleKey',
  ]) {
    check(
      `lifecycle: the map is NOT recreated when ${dep} changes`,
      !new RegExp(`\\}, \\[[^\\]]*${dep}[^\\]]*\\]\\);`).test(createEffect),
    );
  }
  check(
    "lifecycle: a guard makes Strict Mode's double-invoked effect a no-op, not a second map",
    createEffect.includes('|| mapRef.current) return'),
  );
  check(
    'lifecycle: an unmount racing the async import cannot leave an orphan map',
    createEffect.includes('if (cancelled') && MAP_CODE.includes('cancelled = true'),
  );
  check(
    'lifecycle: only ONE map is ever constructed in the file',
    (MAP_CODE.match(/new maplibre\.Map\(/g) ?? []).length === 1,
  );
  check(
    'lifecycle: the style CHANGES in place — setStyle, never a new map',
    MAP_CODE.includes('map.setStyle(') && !/new maplibre\.Map\([\s\S]{0,400}styleId/.test(MAP_CODE),
  );
  check(
    'cleanup: the map, its markers and the observer are all released',
    MAP_CODE.includes('mapRef.current?.remove()') &&
      MAP_CODE.includes('truckRef.current?.remove()') &&
      MAP_CODE.includes('destMarkerRef.current?.remove()') &&
      MAP_CODE.includes('maneuverMarkerRef.current?.remove()') &&
      MAP_CODE.includes('observer.disconnect()'),
  );
  check(
    'cleanup: the heading state is reset with the instance',
    MAP_CODE.includes('headingRef.current = INITIAL_HEADING_STATE'),
  );
}

/* ============ 5. route geometry updates as DATA ========================= */
{
  check('route: one persistent GeoJSON source', MAP_CODE.includes("addSource('route'"));
  check(
    'route: exactly two line layers (casing + line), added once',
    (MAP_CODE.match(/addLayer\(/g) ?? []).length === 2,
  );
  check(
    'route: a reroute calls setData — layers are never removed and re-added',
    MAP_CODE.includes('source.setData(data)') &&
      MAP_CODE.includes('applyRouteData(map, routeDataRef.current)') &&
      !/removeLayer|removeSource/.test(MAP_CODE),
  );
  check(
    'route: geometry is converted to GeoJSON lng/lat order',
    MAP_CODE.includes('geometry.map((p) => [p.lng, p.lat])'),
  );
  check(
    'route: redraw is keyed on route identity, so a tick cannot churn it',
    MAP_CODE.includes('drawnRouteRef') && MAP_CODE.includes("routeId ?? 'none'"),
  );
  check(
    'route: a replacement route returns the camera to the truck',
    /drawnRouteRef\.current !== null[\s\S]{0,140}route-replaced/.test(MAP_CODE),
  );
}

/* ============ 6. the camera: follow, overview, recenter ================= */
{
  check(
    'camera: the bearing comes from the pure heading controller',
    MAP_CODE.includes('cameraBearing(headingRef.current, navigating)') &&
      MAP_CODE.includes('headingStep(headingRef.current'),
  );
  check(
    'camera: the route bearing is supplied as the fallback evidence',
    MAP_CODE.includes('routeBearingDeg: navigating ? routeBearingAt(geometry, position) : null'),
  );
  check(
    'camera: the truck rides the lower middle while guidance is live',
    MAP_CODE.includes('padding: followPadding(height, navigating, bottomInsetPx)'),
  );
  check(
    // The band height is MEASURED by the layout and handed down, not
    // guessed here: a constant put the truck under the trip strip at
    // 360x740, 1280x800 and 844x390 in Chromium.
    'camera: the bottom band it must stay above is measured, not assumed',
    readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8').includes(
      'onBottomInset={setBottomInset}',
    ) && MAP_CODE.includes('bottomInsetPx'),
  );
  check(
    'camera: a tiny bearing change is not worth moving the camera for',
    MAP_CODE.includes('BEARING_DEADBAND_DEG') && MAP_CODE.includes('shortestDelta('),
  );
  check(
    'camera: rotation eases rather than snapping, and only while navigating',
    MAP_CODE.includes('duration: navigating ? CAMERA_EASE_MS : 0'),
  );
  check(
    'overview: fits the whole route, north-up, without animation',
    /follow\.mode !== 'overview'[\s\S]{0,400}fitBounds\(boundsOf\(geometry\), \{[\s\S]{0,120}bearing: 0/.test(
      MAP_CODE,
    ),
  );
  check(
    'overview: the follow padding stands down so the route is centred',
    /overview[\s\S]{0,600}setPadding\(\{ top: 0/.test(MAP_CODE),
  );
  check(
    'overview: the next fix does not silently slide the camera back',
    /overview[\s\S]{0,700}lastCenteredRef\.current = null/.test(MAP_CODE),
  );
  check(
    'recenter: restores the truck, the follow padding AND the heading-up bearing',
    /const recenter = \(\) => \{[\s\S]{0,700}cameraBearing\(headingRef\.current, navigating\)[\s\S]{0,400}padding: followPadding\(/.test(
      MAP_CODE,
    ),
  );
  check(
    'recenter: dispatches the shared follow event, not a private mode',
    /const recenter = \(\) => \{[\s\S]{0,120}dispatch\(\{ kind: 'recenter' \}\)/.test(MAP_CODE),
  );
  check(
    'trip end: the heading is reset and the camera returned to north-up',
    /!navigating && wasNavigatingRef\.current[\s\S]{0,260}resetHeading\(\)[\s\S]{0,200}setBearing\(0\)/.test(
      MAP_CODE,
    ),
  );
  // No camera change may ever cost a provider transaction.
  check(
    'spend: the map component makes no network request of any kind',
    !/fetch\(|XMLHttpRequest|axios|\/api\//.test(MAP_CODE),
  );
  check(
    'spend: and owns no engine that could plan or replace a route',
    !/lifecycle|createNavigation|requestReroute|planPort/.test(MAP_CODE),
  );
}

/* ============ 7. gestures, locks and upright controls =================== */
{
  check(
    'gestures: every handler starts disabled at construction',
    MAP_CODE.includes('dragPan: false') &&
      MAP_CODE.includes('scrollZoom: false') &&
      MAP_CODE.includes('touchZoomRotate: false') &&
      MAP_CODE.includes('doubleClickZoom: false'),
  );
  check(
    'gestures: pan and zoom are gated SEPARATELY by the shared lock',
    MAP_CODE.includes('if (canZoom)') && MAP_CODE.includes('if (canPan)'),
  );
  check(
    'gestures: the driver can never rotate or pitch the map by hand',
    MAP_CODE.includes('dragRotate: false') &&
      MAP_CODE.includes('touchPitch: false') &&
      MAP_CODE.includes('pitchWithRotate: false') &&
      (MAP_CODE.match(/disableRotation\(\)/g) ?? []).length >= 1,
  );
  check(
    'gestures: the map still makes NO motion decision of its own',
    !/isMoving|motionState|MOVING_SPEED/.test(MAP_CODE) && !/speedMph\s*[<>]=?\s*\d/.test(MAP_CODE),
  );
  check(
    'gestures: a driver pan detaches follow; a programmatic move never does',
    MAP_CODE.includes("map.on('dragstart'") && MAP_CODE.includes('if (selfMoveRef.current) return'),
  );
  check(
    'controls: the zoom/recenter stack is SCREEN furniture, outside the rotating canvas',
    /className="pointer-events-none absolute right-3 flex flex-col justify-center gap-2"/.test(
      MAP,
    ) && MAP.indexOf('ref={containerRef}') < MAP.indexOf('aria-label="Zoom in"'),
  );
  /*
   * AND IT IS CENTRED IN THE MAP THE DRIVER CAN SEE, not in the viewport.
   *
   * `top-1/2` centred the column on the whole surface, so the lower half
   * of it sat under the cockpit band. Measured in Chromium during
   * guidance, the zoom-out button's centre hit the band and not the
   * button at 320x568, 844x390 and 932x430 — a driver could not zoom out
   * on either landscape shape or the smallest phone. The container is
   * bounded by the SAME measured reserve the camera uses, so the control
   * column and the followed truck are placed from one number.
   */
  check(
    'controls: bounded by the measured bottom reserve, not by the viewport',
    MAP.includes("top: '0.5rem'") &&
      MAP.includes('bottom: `calc(${bottomInsetPx}px + 0.5rem)`') &&
      !/absolute right-3 top-1\/2/.test(MAP),
  );
  check(
    'controls: still glove-sized and labelled',
    MAP.includes('min-h-16 min-w-16') &&
      MAP.includes('aria-label="Recenter the map on your truck"') &&
      MAP.includes('aria-label="Zoom in"') &&
      MAP.includes('aria-label="Zoom out"'),
  );
  check(
    'controls: the map region keeps its accessible name',
    MAP.includes('aria-label="Navigation map showing your truck, its route, and the destination"'),
  );
}

/* ============ 8. the #301 resize protection survives ==================== */
{
  check(
    'resize: a ResizeObserver still watches the container',
    MAP_CODE.includes('new ResizeObserver') && MAP_CODE.includes('observer.observe(el)'),
  );
  check('resize: it re-measures the renderer', MAP_CODE.includes('map.resize()'));
  const ro = MAP_CODE.slice(
    MAP_CODE.indexOf('new ResizeObserver'),
    MAP_CODE.indexOf('observer.observe'),
  );
  check(
    'resize: the resize path touches no camera and no follow state',
    ro.length > 0 && !/easeTo|jumpTo|fitBounds|setZoom|setBearing|dispatch\(/.test(ro),
  );
  check(
    'resize: no arbitrary delay is used to repair sizing',
    !/setTimeout\([^)]*resize|requestAnimationFrame\([^)]*resize/.test(MAP_CODE),
  );
}

/* ============ 9. the milestone's own record ============================= */
{
  const limits = readFileSync('docs/operations/navigator-known-limitations.md', 'utf8').replace(
    /\s+/g,
    ' ',
  );
  check(
    'record: the north-up limitation is retired now that heading-up ships',
    !/north-up, not heading-up/.test(limits),
  );
  check(
    'record: owner decision 6 is marked resolved, naming the path taken',
    /\| 6 \|[\s\S]{0,400}Resolved/i.test(limits) && /MapLibre GL migration/.test(limits),
  );
  const blocker = readFileSync('docs/operations/navigator-heading-up-blocker.md', 'utf8');
  check(
    'record: the blocker memo survives as history, marked resolved',
    /RESOLVED/.test(blocker) && blocker.includes('"hasBearing":false'),
  );
}

console.log(`navigator-maplibre: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

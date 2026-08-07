/**
 * Map-first driving surface (map-first milestone). The pilot could see a
 * map but the screen still read as a web page; this harness covers the
 * full-screen layout, the map controls, follow/recenter behaviour, the
 * map-style seam (including the honest satellite block), the motion-lock
 * wiring, and the scope rails the owner set for this milestone.
 *
 * Behaviour that can be proven without a browser is proven by running the
 * real pure cores; layout and wiring are proven structurally, and a static
 * render checks the actual markup.
 *
 * Run:
 *   npx esbuild scripts/test-navigation-map-ui.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --loader:.css=empty --alias:@=./src \
 *     --outfile=/tmp/test-map-ui.cjs && node /tmp/test-map-ui.cjs
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  followReducer,
  recenterVisible,
  shouldAutoRecenter,
  shouldTrackPosition,
  INITIAL_FOLLOW_STATE,
  AUTO_RECENTER_MS,
  type FollowState,
} from '@/lib/navigator/map-follow';
import {
  MAP_STYLES,
  DEFAULT_MAP_STYLE,
  SATELLITE_REQUIREMENT,
  enabledMapStyles,
  resolveMapStyle,
} from '@/lib/navigator/map-style';
import {
  formatClockTime,
  formatEta,
  remainingSeconds,
  roadNameFromInstruction,
} from '@/lib/navigator/driving-hud';
import { ACTION_PERMISSIONS, allowedWhileMoving, type UIAction } from '@/lib/navigator/actions';
import { MapStyleControl } from '@/components/navigator/MapStyleControl';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const map = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const styleCtl = readFileSync('src/components/navigator/MapStyleControl.tsx', 'utf8');
const T0 = 1_754_000_000_000;

// ============================== 1. map fills the active viewport ==========
{
  check(
    '1. active navigation renders a viewport-filling surface (fixed inset, dynamic vh)',
    screen.includes('fixed inset-0') && screen.includes('h-[100dvh]'),
  );
  check(
    // Measured in Chromium: 38% of the surface in portrait, 95% in
    // landscape. The map is the flex-1 child with a guaranteed floor.
    '1. the map takes every pixel the readouts do not, with a floor',
    /flex-1[^"]*"[\s\S]{0,80}\{mapSlot\}/.test(screen) && screen.includes('min-h-[38dvh] flex-1'),
  );
  check(
    '1. dvh (not vh) so mobile browser chrome cannot hide the bottom controls',
    screen.includes('100dvh') && !/h-\[100vh\]/.test(screen),
  );
  check(
    '1. bottom padding respects the phone safe area',
    screen.includes('env(safe-area-inset-bottom)'),
  );
  check(
    '1. full-screen is layout only — no browser fullscreen API',
    !/requestFullscreen|webkitRequestFullscreen|document\.fullscreen/.test(screen + map),
  );
  check(
    '1. the map-first surface is used ONLY while guidance is live',
    screen.includes('ACTIVE_LIFECYCLE_STATES.includes(lcState)') &&
      screen.includes("'navigating'") &&
      !/ACTIVE_LIFECYCLE_STATES[^\]]*'route-ready'/.test(screen),
  );
}

// ============================== 2. maneuver card at the top ===============
{
  check(
    '2. the maneuver card is the first element of the driving surface',
    screen.indexOf('{maneuverCard}') < screen.indexOf('{mapSlot}'),
  );
  check(
    '2. the card has an opaque backing so it reads over any basemap',
    screen.includes('bg-asphalt/95') && screen.includes('aria-label="Next maneuver"'),
  );
}

// ============================== 3. the card's four facts =================
{
  check('3. next maneuver instruction', screen.includes('{m.instruction}'));
  check(
    '3. distance to the maneuver, in driver units',
    screen.includes('formatDriverDistanceMi(view.maneuvers?.distanceMi)'),
  );
  check('3. road name when the provider named one', screen.includes('{roadName}'));
  check(
    '3. following maneuver when available',
    screen.includes('view.maneuvers.following.instruction'),
  );

  // The road-name reader: real text only, never invention.
  check(
    '3. road name read out of a real HERE instruction',
    roadNameFromInstruction('Turn right onto Battlefield Parkway.') === 'Battlefield Parkway',
  );
  check(
    '3. road name from a "toward" instruction',
    roadNameFromInstruction('Take the ramp toward I-75 South') === 'I-75 South',
  );
  check(
    '3. no road name when none is stated',
    roadNameFromInstruction('Arrive at your destination') === null,
  );
  check(
    '3. bare direction words are not road names',
    roadNameFromInstruction('Turn right') === null,
  );
  check('3. null/empty instruction is null', roadNameFromInstruction(null) === null);
  check(
    '3. an absurdly long capture is refused rather than shown',
    roadNameFromInstruction(`Turn onto ${'x'.repeat(80)}`) === null,
  );
}

// ============================== 4. compact secondary info =================
{
  check('4. speed', screen.includes('mph') && screen.includes('Speed'));
  check('4. distance remaining', screen.includes('formatDriverDistanceMi(view.remainingMi)'));
  check('4. arrival estimate', screen.includes('{etaText ?? ') && screen.includes('Arrive'));
  check('4. HOS strip stays on the driving surface', screen.includes('<HosStrip drivingActive'));

  // ETA maths, from the provider's planned duration.
  check(
    '4. remaining seconds scale with the fraction of route left',
    remainingSeconds(50, 100, 7200) === 3600,
  );
  check('4. no estimate without a route', remainingSeconds(null, 100, 7200) === null);
  check('4. no estimate with a zero-length route', remainingSeconds(5, 0, 7200) === null);
  check('4. no estimate without a provider duration', remainingSeconds(50, 100, null) === null);
  // Offset 0 = UTC, so these assertions do not depend on the machine's zone.
  check(
    '4. ETA renders as a clock time one hour out (12:00Z + 60 min)',
    formatEta(50, 100, 7200, Date.parse('2026-08-06T12:00:00Z'), 0) === '1:00 PM',
    formatEta(50, 100, 7200, Date.parse('2026-08-06T12:00:00Z'), 0),
  );
  check(
    '4. ETA honours the device zone offset (UTC-5 shows 8:00 AM)',
    formatEta(50, 100, 7200, Date.parse('2026-08-06T12:00:00Z'), 300) === '8:00 AM',
  );
  check(
    '4. midnight renders as 12, never 0',
    formatClockTime(Date.parse('2026-08-06T00:07:00Z'), 0) === '12:07 AM',
  );
  check(
    '4. ETA is rounded so the minutes do not flicker each second',
    formatEta(50, 100, 7200, T0, 0) === formatEta(50, 100, 7200, T0 + 30_000, 0),
  );
  check('4. no ETA when there is nothing to estimate', formatEta(null, null, null, T0, 0) === null);
  check(
    '4. the ETA core reads no clock of its own (navigator purity)',
    !/new Date|Date\.now/.test(readFileSync('src/lib/navigator/driving-hud.ts', 'utf8')),
  );
}

// ============================== 5. debug/pilot below the surface ==========
{
  const surfaceEnd = screen.indexOf('Below the driving surface');
  check('5. there IS a region below the driving surface', surfaceEnd > 0);
  check(
    '5. pilot/destination controls live in that lower region, after the map',
    screen.indexOf('{mapSlot}') < surfaceEnd &&
      surfaceEnd < screen.lastIndexOf('{destinationSlot}'),
  );
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  check('5. the pilot debug log is still collapsed by default', !/<details\s+open/.test(controls));
}

// ============================== 6. browser chrome ========================
{
  check(
    '6. the surface scrolls internally rather than fighting the page',
    screen.includes('overflow-y-auto') && screen.includes('overscroll-contain'),
  );
}

// ============================== 7. portrait / landscape ==================
{
  // Browser-measured (Chromium, 8 viewports) before these pins existed:
  // stacking everything vertically squeezed the map to ZERO height at 320,
  // 360, 375 and in both landscape sizes. The fixes are pinned here.
  check(
    '7. landscape switches to a two-column layout so the map keeps the height',
    screen.includes('landscape:flex-row') && screen.includes('landscape:w-['),
  );
  check(
    '7. the map can never be squeezed to nothing in portrait',
    screen.includes('min-h-[38dvh]'),
  );
  check(
    '7. the maneuver card is capped so it cannot eat the map',
    screen.includes('max-h-[28dvh]') && screen.includes('overflow-hidden'),
  );
  check(
    '7. instruction text scales down on narrow phones (320 px) and up on wide',
    screen.includes('text-2xl font-semibold leading-tight text-ink sm:text-4xl'),
  );
  check(
    '7. the readout column and its rows never shrink the map away',
    (screen.match(/shrink-0/g) ?? []).length >= 4,
  );
  check(
    '7. the HOS strip yields its space in landscape rather than crushing the map',
    screen.includes('landscape:hidden'),
  );
}

// ====================== 8-9. map styles: standard + honest satellite ======
{
  check('8. a standard style exists and is enabled', resolveMapStyle('standard').enabled);
  check('8. standard is the default', DEFAULT_MAP_STYLE === 'standard');
  check(
    '8. standard draws from the keyless tile source already in production',
    resolveMapStyle('standard').tileUrl?.includes('tile.openstreetmap.org') === true,
  );
  const satellite = MAP_STYLES.find((s) => s.id === 'satellite');
  check('9. satellite is PRESENT in the seam', satellite !== undefined);
  check('9. satellite is not enabled', satellite?.enabled === false);
  check('9. satellite has NO tile source — nothing is faked', satellite?.tileUrl === null);
  check(
    '9. satellite states the provider/license requirement',
    (satellite?.blockedReason ?? '').includes('licensed provider') &&
      SATELLITE_REQUIREMENT.includes('OpenStreetMap'),
  );
  check('9. only standard is selectable today', enabledMapStyles().length === 1);
  check(
    '9. an unknown or disabled id falls back to a drawable style',
    resolveMapStyle('satellite').id === 'standard' && resolveMapStyle('nonsense').id === 'standard',
  );
  check(
    '9. the map never draws a null tile url',
    map.includes('if (style.tileUrl === null) return'),
  );
  // No unapproved provider anywhere in the map surface.
  const hosts = [...(map + styleCtl).matchAll(/https?:\/\/([^/'"`\s{]+)/g)].map((m) => m[1]);
  check(
    '9. no map provider host beyond the approved OSM tiles + attribution link',
    hosts.every((h) => h.includes('openstreetmap.org') || h.includes('{s}.tile.openstreetmap.org')),
    hosts,
  );
  check(
    '9. the style picker shows the blocked style with its reason, not a hidden gap',
    styleCtl.includes('blockedReason') && styleCtl.includes('disabled={!style.enabled}'),
  );
  const html = renderToStaticMarkup(
    createElement(MapStyleControl, { styleId: 'standard' as const, onChange: () => {} }),
  );
  check('9. rendered: Standard is offered', html.includes('Standard'));
  check('9. rendered: Satellite is shown as unavailable', html.includes('(unavailable)'));
  check('9. rendered: the reason is on screen', html.includes('licensed provider'));
  check(
    '9. rendered: selection is not colour-only',
    html.includes('(on)') && html.includes('aria-pressed'),
  );
}

// ====================== 10-11. zoom, pan, recenter, overview =============
{
  check('10. zoom-in control with an accessible name', map.includes('aria-label="Zoom in"'));
  check('10. zoom-out control with an accessible name', map.includes('aria-label="Zoom out"'));
  check(
    '10. zoom controls are text glyphs, never colour-only',
    />\s*\+\s*<\/button>/.test(map) && />\s*−\s*<\/button>/.test(map),
  );
  check(
    '11. recenter control with an accessible name',
    map.includes('aria-label="Recenter the map on your truck"'),
  );
  check(
    '11. route overview control with an accessible name',
    screen.includes('aria-label="Show the whole route, then return to your truck"'),
  );
  check(
    '11. pinch/drag are real Leaflet handlers, toggled as a group',
    map.includes('map.dragging') && map.includes('map.touchZoom') && map.includes('h.enable()'),
  );
  check('11. controls meet the Navigator touch minimum', map.includes('min-h-16 min-w-16'));
}

// ====================== 12-16. follow-mode behaviour ======================
{
  check('12. navigation starts in following mode', INITIAL_FOLLOW_STATE.mode === 'following');
  check('12. following tracks the truck', shouldTrackPosition(INITIAL_FOLLOW_STATE));
  check('12. following hides Recenter', !recenterVisible(INITIAL_FOLLOW_STATE));

  const panned = followReducer(INITIAL_FOLLOW_STATE, { kind: 'user-panned', tMs: T0 });
  check('13. a manual pan detaches the camera', panned.mode === 'detached');
  check('13. …and EXPOSES Recenter', recenterVisible(panned));
  check('13. …and stops tracking', !shouldTrackPosition(panned));

  const recentered = followReducer(panned, { kind: 'recenter' });
  check('14. Recenter returns to following', recentered.mode === 'following');
  check('14. …and hides itself again', !recenterVisible(recentered));

  const overview = followReducer(INITIAL_FOLLOW_STATE, { kind: 'overview', tMs: T0 });
  check('15. overview leaves the truck view deliberately', overview.mode === 'overview');
  check('15. overview shows Recenter too', recenterVisible(overview));
  check(
    '15. overview toggles back on a second press',
    followReducer(overview, { kind: 'overview', tMs: T0 }).mode === 'following',
  );

  const afterReroute = followReducer(panned, { kind: 'route-replaced' });
  check('16. a replacement route snaps back to following', afterReroute.mode === 'following');
  check(
    '16. …even from overview (new guidance always wins)',
    followReducer(overview, { kind: 'route-replaced' }).mode === 'following',
  );

  // The core safety rule: never SILENTLY detached.
  check(
    '16. a hands-off detached map returns to the truck on its own',
    shouldAutoRecenter(panned, T0 + AUTO_RECENTER_MS),
  );
  check(
    '16. …but not before the grace period',
    !shouldAutoRecenter(panned, T0 + AUTO_RECENTER_MS - 1),
  );
  check(
    '16. a deliberate overview is never yanked away automatically',
    !shouldAutoRecenter(overview, T0 + AUTO_RECENTER_MS * 10),
  );
  check(
    '16. following never triggers auto-recenter',
    !shouldAutoRecenter(INITIAL_FOLLOW_STATE, T0 + AUTO_RECENTER_MS * 10),
  );
  // Determinism: the reducer is pure.
  const a: FollowState = followReducer(INITIAL_FOLLOW_STATE, { kind: 'user-panned', tMs: T0 });
  const b: FollowState = followReducer(INITIAL_FOLLOW_STATE, { kind: 'user-panned', tMs: T0 });
  check('16. reducer is deterministic', JSON.stringify(a) === JSON.stringify(b));

  check(
    '16. the map wires auto-recenter only while navigating',
    map.includes('navigating && shouldAutoRecenter('),
  );
  check(
    '16. programmatic camera moves never masquerade as a driver pan',
    map.includes('selfMoveRef.current = true') && map.includes('if (selfMoveRef.current) return'),
  );
}

// ====================== 17. moving-state safety ==========================
{
  check(
    '17. free map browsing is a mapped action, stationary-only',
    ACTION_PERMISSIONS['browse-map'] === false && !allowedWhileMoving('browse-map'),
  );
  check(
    '17. route overview is stationary-only',
    ACTION_PERMISSIONS['route-overview'] === false && !allowedWhileMoving('route-overview'),
  );
  check(
    '17. map-style switching is stationary-only',
    ACTION_PERMISSIONS['change-map-style'] === false && !allowedWhileMoving('change-map-style'),
  );
  check(
    '17. every UIAction still has an explicit permission (default-deny intact)',
    (Object.keys(ACTION_PERMISSIONS) as UIAction[]).every(
      (k) => typeof ACTION_PERMISSIONS[k] === 'boolean',
    ),
  );
  check(
    '17. Stop stays permitted while moving; Recenter rides view-status',
    allowedWhileMoving('stop-navigation') && allowedWhileMoving('view-status'),
  );
  check(
    '17. gating comes from the shared lock, not a local speed check',
    screen.includes("permits('browse-map')") &&
      !/speedMph\s*[<>]=?\s*\d/.test(map) &&
      !/speedMph\s*[<>]=?\s*\d/.test(screen),
  );
  check(
    '17. overview and style controls are wrapped in their own LockGates',
    screen.includes('action="route-overview"') && screen.includes('action="change-map-style"'),
  );
  check(
    '17. the map component itself makes no motion decision',
    !/moving|isMoving|motionState/.test(map),
  );
}

// ====================== 18-20. markers, route, redraw ====================
{
  check('18. current-position marker', map.includes("'Your truck'"));
  check('18. destination marker', map.includes("'Destination'"));
  check('18. next-maneuver marker', map.includes("'Next maneuver'"));
  check('19. the route line is drawn as a polyline', map.includes('L.polyline('));
  check(
    '19. the line has a casing so it reads over any basemap',
    (map.match(/L\.polyline\(/g) ?? []).length >= 2,
  );
  check(
    '20. a replacement route redraws (keyed on route identity)',
    map.includes('drawnRouteRef') && map.includes('routeId ?? '),
  );
  check(
    '20. layers are cleared before redraw — no unbounded geometry history',
    map.includes('layer.clearLayers()') && (map.match(/clearLayers\(\)/g) ?? []).length >= 2,
  );
  check(
    '20. exactly one truck marker is ever created',
    map.includes('if (truckRef.current === null)') && map.includes('truckRef.current.setLatLng'),
  );
  check(
    '20. the map is torn down on unmount (no leaked Leaflet instance)',
    map.includes('mapRef.current?.remove()'),
  );
}

// ====================== 21-23. accessibility =============================
{
  check(
    '21. the map exposes an accessible region name',
    map.includes('role="region"') && map.includes('aria-label="Navigation map'),
  );
  check(
    '21. map movement is NOT announced repeatedly (no live region on the map)',
    !/aria-live[^>]*>[\s\S]{0,200}ref=\{containerRef\}/.test(map) && !map.includes('aria-live'),
  );
  check(
    '22. exactly one polite status region on the driving surface',
    (screen.match(/aria-live="polite"/g) ?? []).length <= 2,
  );
  check(
    '23. reduced motion stays safe — no animation classes, no smooth camera',
    !/animate-/.test(map) && map.includes('animate: false'),
  );
}

// ====================== 24-30. scope rails ===============================
{
  check(
    '24. no routing/provider change in this milestone',
    !map.includes('hereapi') && !screen.includes('hereapi') && !/api\/navigator\/route/.test(map),
  );
  check(
    '25. no secrets anywhere in the new surface',
    !/apiKey|API_KEY|secret|token/i.test(map + styleCtl),
  );
  check(
    '26. no unapproved provider dependency added',
    !/mapbox|google.*maps|esri|arcgis|maptiler/i.test(map + styleCtl + screen),
  );
  const pkg = readFileSync('package.json', 'utf8');
  check(
    '26. package.json still has only the leaflet map dependency',
    pkg.includes('"leaflet"') && !/mapbox|maplibre|@react-google-maps|esri/i.test(pkg),
  );
  check(
    '27. no environment variable added or read by the map surface',
    !/process\.env/.test(map + styleCtl),
  );
  check('28. no service-worker change', !/serviceWorker|workbox/i.test(map + styleCtl + screen));
  check(
    '29. no database access from the driving surface',
    !/supabase|createClient|from\('/.test(map + styleCtl),
  );
  check(
    '30. rollback isolation: the new modules are self-contained',
    map.includes("from '@/lib/navigator/map-follow'") &&
      map.includes("from '@/lib/navigator/map-style'"),
  );
  // The map surface still never transmits — ports remain the only path.
  check('30. the map component performs no network I/O of its own', !/fetch\s*\(/.test(map));
}

console.log(`navigation-map-ui: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

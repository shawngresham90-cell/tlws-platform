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
  followZoom,
  type FollowState,
} from '@/lib/navigator/map-follow';
import {
  MAP_STYLES,
  DEFAULT_MAP_STYLE,
  SATELLITE_REQUIREMENT,
  enabledMapStyles,
  resolveMapStyle,
} from '@/lib/navigator/map-style';
import { formatClockTime, formatEta, remainingSeconds } from '@/lib/navigator/driving-hud';
import { normalizeInstruction, roadNameFromInstruction } from '@/lib/navigator/maneuver-text';
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
    // Full-screen map (pilot round 3): measured in Chromium at ≥95%
    // viewport coverage in BOTH orientations — the map is the absolute
    // z-0 background of the whole surface, not a flex child with a
    // floor.
    '1. the map IS the surface: full-bleed background, single wrapper',
    screen.includes("? 'absolute inset-0 z-0 overflow-hidden'") &&
      screen.includes('<div className={mapWrapCls}>{mapSlot}</div>'),
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
  // The transition defect this pins: two separate return trees made React
  // unmount and rebuild the whole subtree at route-ready → navigating,
  // tearing down and recreating the Leaflet instance mid-trip.
  check(
    '1. ONE tree for both modes — the map has a single mount point',
    (screen.match(/\{mapSlot\}/g) ?? []).length === 1,
    (screen.match(/\{mapSlot\}/g) ?? []).length,
  );
  check(
    '1. the surface switches by CLASS, not by returning a different tree',
    screen.includes('const shellCls = fullScreen') &&
      screen.includes('const surfaceCls = fullScreen') &&
      !/if \(fullScreen\) \{\s*return \(/.test(screen),
  );
  check(
    // Full-screen map (pilot round 3): the map is ALWAYS the whole
    // surface, so landscape no longer needs a second layout system —
    // the overlays cap their width to the old rail fraction and the DOM
    // order never changes. The invariant this pins is unchanged: no
    // reordering, no alternate tree for landscape.
    '1. landscape re-arranges by capping overlay width, never by reordering the DOM',
    screen.includes('landscape:max-w-[38vw]') && !screen.includes('landscape:grid'),
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
  check(
    '3. next maneuver instruction, normalized before it is shown',
    screen.includes('normalizeInstruction(m.instruction) ?? m.instruction'),
  );
  check(
    '3. the "then" line is normalized too',
    screen.includes('normalizeInstruction(view.maneuvers.following.instruction)'),
  );
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

  // Block 2 / priority C. Every string below is HERE v8 `instructions`
  // phrasing with units=imperial — the shape the pilot actually receives.

  // The defect: the capture ran to the sentence end, so a trailing
  // signage clause became part of the road name and the card read
  // "on Old Mill Road toward the receiving gate" under the very
  // instruction it came from (observed at 568x320 in Chromium).
  check(
    '3. a trailing "toward" clause is not part of the road name',
    roadNameFromInstruction('Turn right onto Old Mill Road toward the receiving gate.') ===
      'Old Mill Road',
  );
  check(
    '3. interstate signage clause dropped, route number kept',
    roadNameFromInstruction('Keep left onto I-75 N toward Chattanooga.') === 'I-75 N',
  );
  check(
    '3. HERE\'s "Go for" tail never reaches the road name',
    roadNameFromInstruction('Head northwest on Chestnut St. Go for 0.2 mi.') === 'Chestnut St',
  );
  check(
    '3. a "for" clause in the same sentence is dropped',
    roadNameFromInstruction('Continue on I-24 W for 12.4 mi') === 'I-24 W',
  );
  check(
    '3. abbreviation dots stay inside the name',
    roadNameFromInstruction('Turn left onto U.S. 41 toward Ringgold.') === 'U.S. 41',
  );
  // The arrival sentence is the reason only the FIRST sentence is read.
  check(
    '3. "It will be on the right" is not a road name',
    roadNameFromInstruction('Arrive at your destination. It will be on the right.') === null,
  );
  check(
    '3. a bare side-of-road phrase is refused',
    roadNameFromInstruction('Your destination is on the right') === null,
  );

  // Instruction normalization: HERE appends the length of the road AFTER
  // the turn, while the card's line above it shows the distance TO the
  // turn. Two different distances, one glance.
  check(
    '3. the trailing segment length is stripped from the instruction',
    normalizeInstruction('Turn right onto Broad St. Go for 1.3 mi.') ===
      'Turn right onto Broad St.',
  );
  check(
    '3. stripping survives the decimal point in the distance',
    normalizeInstruction('Keep left onto I-75 N. Go for 0.4 mi.') === 'Keep left onto I-75 N.',
  );
  check(
    '3. metric wording is stripped as well (live pilot saw "Go for 33 m")',
    normalizeInstruction('Take the ramp. Go for 33 m.') === 'Take the ramp.',
  );
  check(
    '3. feet are stripped',
    normalizeInstruction('Turn right onto Dock St. Go for 300 ft.') === 'Turn right onto Dock St.',
  );
  check(
    '3. an instruction with no distance tail is returned unchanged',
    normalizeInstruction('Arrive at your destination.') === 'Arrive at your destination.',
  );
  check(
    '3. a distance INSIDE the instruction is left alone',
    normalizeInstruction('Take exit 350 toward US-41') === 'Take exit 350 toward US-41',
  );
  check(
    '3. whitespace is collapsed so the clamp counts real characters',
    normalizeInstruction('  Turn   right\n onto Broad St.  ') === 'Turn right onto Broad St.',
  );
  // Never leave the maneuver line blank: a redundant instruction beats
  // no instruction.
  check(
    '3. an instruction that is ONLY the distance keeps its text',
    normalizeInstruction('Go for 1.3 mi.') === 'Go for 1.3 mi.',
  );
  check('3. null/empty normalizes to null', normalizeInstruction(null) === null);
  check('3. blank normalizes to null', normalizeInstruction('   ') === null);
}

// ============================== 4. compact secondary info =================
{
  check('4. speed', screen.includes('mph') && screen.includes('Speed'));
  check('4. distance remaining', screen.includes('formatDriverDistanceMi(view.remainingMi)'));
  check('4. arrival estimate', screen.includes('{etaText ?? ') && screen.includes('Arrive'));
  check(
    '4. HOS strip stays on the driving surface',
    screen.includes('<HosStrip') && screen.includes('drivingActive={'),
  );

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
  check(
    '4. the maneuver-text core is clock-free and I/O-free too',
    !/new Date|Date\.now|fetch\(|localStorage/.test(
      readFileSync('src/lib/navigator/maneuver-text.ts', 'utf8'),
    ),
  );
}

// ============================== 5. debug/pilot below the surface ==========
{
  const surfaceEnd = screen.indexOf('Below the driving surface');
  check('5. there IS a region below the driving surface', surfaceEnd > 0);
  check(
    '5. pilot/destination controls live in that lower region, after the map',
    screen.indexOf('{mapSlot}') < surfaceEnd &&
      surfaceEnd < screen.lastIndexOf('{destinationSlot ??'),
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
    // Both orientations now share one mechanism: the map is an absolute
    // z-0 background filling the whole surface, so it keeps full height
    // in landscape AND cannot be squeezed in portrait — by construction,
    // not by a minimum.
    '7. the map is the full-bleed background in every orientation',
    screen.includes("? 'absolute inset-0 z-0 overflow-hidden'"),
  );
  check(
    '7. overlays are explicitly layered above the map (z-10 over z-0)',
    screen.includes('relative z-10') && screen.includes('inset-0 z-0'),
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
    // With the map out of flow the overlays cannot shrink it at all;
    // shrink-0 still keeps each overlay honest about its own height.
    '7. the overlay rows keep their own height (and cannot touch the map)',
    screen.includes("const colOne = fullScreen ? 'relative z-10 shrink-0") &&
      (screen.match(/shrink-0/g) ?? []).length >= 3,
  );
  check(
    // The landscape judgment ("the map needs the height more than the
    // clocks need the space") now covers the whole full-screen cockpit:
    // the measured strip was ~230 px tall and reached the followed
    // truck's marker on a phone. Mounted but display:none, so the clocks
    // keep counting and the HOS VOICE thresholds still fire mid-trip.
    '7. the HOS strip yields the cockpit to the map, but stays mounted and counting',
    /\{fullScreen \? 'hidden' : ''\}/.test(screen) && screen.includes('<HosStrip'),
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
    '11. pinch and drag are real Leaflet handlers, gated SEPARATELY',
    map.includes('map.touchZoom') &&
      map.includes('map.dragging.enable()') &&
      map.includes('map.dragging.disable()') &&
      map.includes('if (canZoom)') &&
      map.includes('if (canPan)'),
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

/* ============ 16b. zoom while moving does not detach the camera ==========
 *
 * Owner decision: a driver may zoom out for road context WITHOUT the map
 * letting go of the truck. The trap this guards is subtle — without a
 * remembered zoom, the very next GPS fix calls setView with the
 * speed-derived navigation zoom and silently undoes the gesture a second
 * later. That is the map fighting the driver, which is the complaint.
 */
{
  const z = followReducer(INITIAL_FOLLOW_STATE, { kind: 'user-zoomed', zoom: 11 });
  check('16b. zooming keeps follow mode', z.mode === 'following');
  check('16b. zooming shows no Recenter prompt', !recenterVisible(z));
  check('16b. the camera still tracks the truck', shouldTrackPosition(z));
  check('16b. the driver zoom is remembered', z.zoomOverride === 11);
  check('16b. and it wins over the speed zoom', followZoom(z, 16) === 11);
  check(
    '16b. with no override the speed zoom is used',
    followZoom(INITIAL_FOLLOW_STATE, 16) === 16,
  );
  check(
    '16b. zooming never starts the auto-recenter timer',
    z.detachedAtMs === null && !shouldAutoRecenter(z, T0 + AUTO_RECENTER_MS * 10),
  );
  const rec = followReducer(z, { kind: 'recenter' });
  check(
    '16b. Recenter restores the navigation zoom',
    rec.zoomOverride === null && followZoom(rec, 16) === 16,
  );
  const replaced = followReducer(z, { kind: 'route-replaced' });
  check('16b. a replacement route also restores it', replaced.zoomOverride === null);
  // Panning is a different intent and still detaches, but the driver's zoom
  // rides along until they recenter.
  const panned2 = followReducer(z, { kind: 'user-panned', tMs: T0 });
  check(
    '16b. panning still detaches, keeping the chosen zoom',
    panned2.mode === 'detached' && panned2.zoomOverride === 11,
  );
  check(
    '16b. zooming while detached does not silently re-attach',
    followReducer(panned2, { kind: 'user-zoomed', zoom: 9 }).mode === 'detached',
  );
}

// ====================== 17. moving-state safety ==========================
{
  /*
   * OWNER DECISION (road test): the single 'browse-map' permission split
   * into zoom and pan. Zooming out for road context keeps the camera on the
   * truck, so it is allowed while moving; dragging the camera somewhere the
   * truck is not remains the attention sink doc 06 locks.
   *
   * The property the old single assertion protected — free map BROWSING is
   * not available while moving — is preserved by the pan half.
   */
  check(
    '17. panning the camera off the truck is stationary-only',
    ACTION_PERMISSIONS['pan-map'] === false && !allowedWhileMoving('pan-map'),
  );
  check(
    '17. zoom is a mapped action, allowed while moving',
    ACTION_PERMISSIONS['zoom-map'] === true && allowedWhileMoving('zoom-map'),
  );
  check(
    '17. zoom and pan are separate permissions, not one',
    ACTION_PERMISSIONS['zoom-map'] !== ACTION_PERMISSIONS['pan-map'],
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
    screen.includes("permits('zoom-map')") &&
      screen.includes("permits('pan-map')") &&
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
  /*
   * 22 used to cap polite live regions at two, under the name "exactly
   * one" — the count and the name already disagreed. The count was
   * standing in for the thing that actually matters, which is CADENCE: a
   * live region attached to something that changes every tick is one a
   * driver turns off, and then hears nothing at all.
   *
   * Block 2 / priority K added a third, deliberately: the maneuver
   * instruction. Voice starts muted by design, so a screen-reader user
   * with voice off was never told a turn was coming. Instruction text
   * changes once per maneuver — the same cadence voice announces at.
   *
   * So the rule is stated as what it is. The bound stays tight enough to
   * catch a sprinkling of live regions, and the per-tick fields are named
   * explicitly. `navigator-accessibility` proves the distance line — the
   * one field that changes every second — is NOT live.
   */
  check(
    '22. few polite regions, and none of them per-tick',
    (screen.match(/aria-live="polite"/g) ?? []).length <= 3,
    (screen.match(/aria-live="polite"/g) ?? []).length,
  );
  check(
    '22. the per-second distance and speed are never live regions',
    !/aria-live[^>]{0,40}>\s*\n?\s*(In \{formatDriverDistanceMi|\{view\.speedMph)/.test(screen),
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

// ====================== 31-34. the canvas follows its container ==========
{
  // Pilot round 3: "half the map, half blank." Reproduced in Chromium at
  // 390x844 by walking the real pilot path (scripts/bench/
  // navigator-half-map.mjs): at trip start the container grows from the
  // parked box to the cockpit with NO window resize, and Leaflet — which
  // re-measures on its own only for a window resize — kept the stale
  // canvas: tiles covered 43% of the driving map and the route line's
  // SVG believed the map was 0px tall. One synthetic window resize
  // healed everything, proving the cure is a re-measure and nothing else.
  check(
    '31. a ResizeObserver watches the map container',
    map.includes('new ResizeObserver') && map.includes('observer.observe(el)'),
  );
  check('31. the observer is disconnected on cleanup', map.includes('observer.disconnect()'));
  check(
    '32. a container change re-measures the canvas, instantly',
    map.includes('map.invalidateSize({ animate: false })'),
  );
  // The resize path may re-measure and NOTHING else: no camera move, no
  // zoom, no follow-state dispatch rides along with it.
  const roBody = map.slice(map.indexOf('new ResizeObserver'), map.indexOf('observer.observe'));
  check(
    '33. the resize path touches no camera and no follow state',
    roBody.length > 0 && !/setView|fitBounds|setZoom|dispatch\(/.test(roBody),
  );
  // The stale size was BORN in the parked page: the map wrapper there was
  // a bare auto-height div, so the mounted map computed to 0px tall and
  // that 0 was the canvas Leaflet measured. Parked, the wrapper now
  // grants the same box the dynamic-import placeholder promises — and
  // only while a map is actually mounted, so no empty bordered box
  // renders before Enable location.
  check(
    '34. parked, the map wrapper grants the placeholder box only while a map is mounted',
    screen.includes('mapSlot !== null') &&
      screen.includes(
        'relative h-72 w-full overflow-hidden rounded-cockpit border border-line sm:h-96',
      ) &&
      (screen.match(/h-72/g) ?? []).length >= 2 &&
      (screen.match(/sm:h-96/g) ?? []).length >= 2,
  );
}

console.log(`navigation-map-ui: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

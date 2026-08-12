/**
 * Navigator Design Blueprint — Phase 2 invariants: the warning rail and
 * the map refinement.
 *
 * The rail's contract: it READS existing states and dresses existing
 * lines — collapsed to nothing while healthy, amber beside words for
 * degraded states, red beside words only where guidance genuinely is not
 * running, a distinct shape at every level so color never stands alone.
 * It owns no state, speaks nothing, adds no live region, opens no modal.
 * The map's contract: same provider, same tiles, same behavior — a
 * saturation-only quieting of the raster (no invert, no hue-rotate, no
 * fake night map), a styled-but-present OSM attribution, and a 36px pin
 * floor. Zoom gating ships as an AUDIT, not code: the drive map's three
 * markers are all navigation-critical, and none may ever hide by zoom.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-warning-rail.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-warning-rail.cjs \
 *   && node /tmp/test-warning-rail.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { HosWarningLine } from '@/components/navigator/HosWarningLine';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { statusSeverity, severityGlyph } from '@/lib/navigator/status-severity';
import { createVoiceGuidance, type SpeechPort } from '@/lib/navigator/voice-guidance';
import type { DrivingView } from '@/lib/navigator/navigation-controller';

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

const SEVERITY_SRC = readFileSync('src/lib/navigator/status-severity.ts', 'utf8');
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const MAP = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const TOKENS = readFileSync('src/app/(navigator)/navigator-design.css', 'utf8');
const DOC = readFileSync('docs/operations/navigator-design-blueprint-phase-2.md', 'utf8');

/* ==================== 1. the severity mapping is total and honest ======== */
{
  const cases: [DrivingView['status'], string][] = [
    ['no-route', 'quiet'],
    ['acquiring', 'quiet'],
    ['navigating', 'quiet'],
    ['arrived', 'quiet'],
    ['position-degraded', 'advisory'],
    ['position-lost', 'advisory'],
    ['position-unavailable', 'critical'],
    ['denied', 'critical'],
  ];
  for (const [status, want] of cases) {
    check(`severity: ${status} → ${want}`, statusSeverity(status) === want);
  }
  check('severity: quiet has no badge', severityGlyph('quiet') === null);
  check(
    'severity: advisory and critical wear distinct shapes',
    severityGlyph('advisory') === '⚠' && severityGlyph('critical') === '⛔',
  );

  // Read-only by construction: no state, no clock, no voice, no I/O.
  const code = strip(SEVERITY_SRC);
  check(
    'severity: the module is a pure read — no voice, state, timer, or I/O',
    !/voice|speech|announc|useState|useEffect|setTimeout|setInterval|fetch\s*\(|Date\b/.test(code),
  );
}

/* ==================== 2. rendered rail states ============================ */
const silent: SpeechPort = { supported: true, speak: (_t, d) => d(), cancel: () => {} };
const baseView = {
  status: 'navigating' as const,
  maneuvers: {
    next: {
      action: 'turn',
      instruction: 'Turn right onto Old Mill Road toward the receiving gate.',
      direction: 'right',
      mileMi: 4.6,
    },
    following: null,
    distanceMi: 0.4,
  },
  remainingMi: 12.3,
  routeMile: 4.2,
  totalMi: 16.5,
  speedMph: 58,
  lastKnown: false,
};

function render(over: Partial<DrivingView>, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(
      GpsProvider,
      null,
      createElement(
        SafetyLockProvider,
        null,
        createElement(DrivingScreenView, {
          view: { ...baseView, ...over } as never,
          watching: true,
          onStart: () => {},
          onStop: () => {},
          voice: createVoiceGuidance(silent),
          mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
          fullScreen: true,
          roadName: 'Old Mill Road',
          etaText: '3:45 PM',
          ...extra,
        }),
      ),
    ),
  );
}
const surfaceOf = (html: string) => {
  const foldAt = html.indexOf('class="space-y-4 p-4"');
  return foldAt > 0 ? html.slice(0, foldAt) : html;
};

{
  // HEALTHY: the rail does not exist. No warn/danger chrome, no badge —
  // the only status presence is the quiet pinned honesty line.
  const healthy = surfaceOf(render({}));
  check(
    'rail: collapsed in the ordinary healthy state',
    !/border-l-nav-warn|border-l-nav-danger/.test(healthy),
    healthy.match(/border-l-nav-\w+/g),
  );
  check('rail: no badge glyphs while healthy', !/⚠|⛔/.test(healthy));
  check(
    'rail: the honest status line still stands',
    /role="status"/.test(healthy) && healthy.includes('Navigating'),
  );

  // ADVISORY: degraded position — amber edge beside the unchanged words,
  // plus the aria-hidden shape.
  const advisory = surfaceOf(render({ status: 'position-degraded' }));
  check(
    'rail: degraded position wears the amber advisory edge',
    advisory.includes('border-l-nav-warn'),
  );
  check(
    'rail: the advisory keeps its full sentence',
    advisory.includes('Position approximate — guidance continues'),
  );
  check(
    'rail: advisory shape present and aria-hidden',
    /<span aria-hidden="true">⚠\s*<\/span>/.test(advisory),
  );
  check('rail: advisory is not red', !advisory.includes('border-l-nav-danger'));

  // CRITICAL: navigation genuinely not running — red edge, distinct shape,
  // words intact.
  const critical = surfaceOf(render({ status: 'denied' }));
  check('rail: denied wears the red critical edge', critical.includes('border-l-nav-danger'));
  check(
    'rail: the critical keeps its full sentence',
    critical.includes('Location permission denied — navigation cannot run'),
  );
  check('rail: critical shape present', critical.includes('⛔'));

  // OFFLINE: renders only when real, always advisory, words + shape.
  const offline = surfaceOf(
    render({}, { offlineText: 'Offline — guidance continues on the route you have.' }),
  );
  check(
    'rail: offline is amber beside its sentence',
    offline.includes('border-l-nav-warn') && offline.includes('Offline — guidance continues'),
  );

  // OFF ROUTE: the #272 line keeps its pinned words under the amber edge.
  const offroute = surfaceOf(
    render({}, { offRouteText: 'OFF ROUTE · Rerouting — continue safely.' }),
  );
  check(
    'rail: off-route keeps its exact state wording',
    offroute.includes('OFF ROUTE · Rerouting — continue safely.') &&
      offroute.includes('border-l-nav-warn'),
  );

  // The rail adds NOTHING to the live-region budget, in every state. The
  // pre-Phase-2 counts: instruction + status + the HOS calm line = 3, and
  // the offline sentence has been its own pinned polite region since it
  // shipped — so offline states carry 4. The rail's glyphs and edges add
  // zero to either number.
  for (const [name, html, expected] of [
    ['healthy', healthy, 3],
    ['advisory', advisory, 3],
    ['critical', critical, 3],
    ['offline', offline, 4],
    ['offroute', offroute, 3],
  ] as const) {
    check(
      `rail: the live-region count is unchanged (${name})`,
      (html.match(/aria-live="polite"/g) ?? []).length === expected,
      html.match(/aria-live="polite"/g)?.length,
    );
    check(`rail: no modal in any state (${name})`, !/role="(?:alert)?dialog"/.test(html));
    check(`rail: no TLWS yellow treatment (${name})`, !/nav-brand|#FFEB00/i.test(html));
  }

  // Never a new cluster: sections and dls unchanged in the loudest state.
  const loud = surfaceOf(
    render(
      { status: 'position-degraded' },
      {
        offlineText: 'Offline — guidance continues on the route you have.',
        offRouteText: 'OFF ROUTE · Rerouting — continue safely.',
      },
    ),
  );
  check(
    'rail: still two sections in the loudest state',
    (loud.match(/<section\b/g) ?? []).length <= 2,
  );
  check(
    'rail: no more than two dls in the loudest state',
    (loud.match(/<dl\b/g) ?? []).length <= 2,
  );
  // Full-screen map: nothing stretches — the map is the absolute
  // background and even the loudest rail state floats above it.
  check(
    'rail: nothing competes with the full-bleed map',
    (loud.match(/flex-1/g) ?? []).length === 0,
  );
  check('rail: the map is still the full-bleed background', loud.includes('absolute inset-0 z-0'));
}

/* ==================== 3. the rail changes no behavior ==================== */
{
  const code = strip(SCREEN);
  check(
    'behavior: severity is computed from view.status and nowhere else',
    code.includes('statusSeverity(view.status)') &&
      (code.match(/statusSeverity\(/g) ?? []).length === 1,
  );
  check(
    'behavior: the source live-region budget is untouched — exactly three',
    (SCREEN.match(/aria-live="polite"/g) ?? []).length === 3,
  );
  check('behavior: no timer was added for rail theatrics', !/setTimeout|setInterval/.test(code));
}

/* ==================== 4. HOS warning line ================================ */
{
  const calm = renderToStaticMarkup(
    createElement(HosWarningLine, {
      warning: { severity: 'none' as const, text: null, clock: null },
    }),
  );
  check('hos: calm state has no rail chrome', !/border-l-nav-warn|border-l-nav-danger/.test(calm));
  check('hos: calm state keeps its sentence', calm.includes('Clocks are comfortable.'));

  const warn = renderToStaticMarkup(
    createElement(HosWarningLine, {
      warning: {
        severity: 'warning' as const,
        text: 'Break required in 0:28',
        clock: 'break' as const,
      },
    }),
  );
  check(
    'hos: warning is amber beside its pinned words',
    warn.includes('border-l-nav-warn') && warn.includes('Warning: Break required in 0:28'),
  );
  check('hos: warning stays polite', warn.includes('aria-live="polite"'));

  const urgent = renderToStaticMarkup(
    createElement(HosWarningLine, {
      warning: {
        severity: 'critical' as const,
        text: 'Break required now',
        clock: 'break' as const,
      },
    }),
  );
  check(
    'hos: critical is red beside its pinned words',
    urgent.includes('border-l-nav-danger') && urgent.includes('Urgent: Break required now'),
  );
  check(
    'hos: critical stays assertive — the pinned escalation',
    urgent.includes('aria-live="assertive"'),
  );
}

/* ==================== 5. map refinement stays honest ===================== */
{
  // The tile treatment is saturation-only: quieter, never a fake night
  // map, never a repaint that could read as data. It moved from a CSS
  // filter to the renderer's own raster paint property in the MapLibre
  // migration — MapLibre draws tiles, route and markers onto ONE canvas,
  // so a CSS filter would have repainted the route line and the truck
  // along with the roads.
  const styleSrc = readFileSync('src/lib/navigator/map-style.ts', 'utf8');
  check(
    'map: the tile treatment exists and is saturation-only',
    /'raster-saturation': RASTER_SATURATION/.test(styleSrc) &&
      /export const RASTER_SATURATION = -0\.\d+/.test(styleSrc),
  );
  const sat = Number(/RASTER_SATURATION = (-0\.\d+)/.exec(styleSrc)?.[1] ?? 0);
  check('map: desaturation is conservative (equivalent to 0.7–1.0)', sat <= -0.05 && sat >= -0.3, sat);
  check(
    'map: no invert / hue-rotate / grayscale / brightness games',
    // Read the CODE, not the prose: the comment beside the paint property
    // explains that nothing is inverted, and must not itself trip this.
    !/raster-(?:hue-rotate|brightness|contrast)|invert|grayscale|sepia/.test(strip(styleSrc)),
  );
  check(
    'map: and the old CSS tile filter is gone with the old renderer',
    !/\.nav-map \.leaflet-tile/.test(TOKENS),
  );

  // Attribution: styled, present, readable — never hidden. display:none
  // or visibility tricks on the credit would violate the tile license.
  check(
    'map: attribution is styled on the cockpit surface',
    /\.maplibregl-ctrl-attrib\s*\{[^}]*var\(--nav-surface\)/.test(TOKENS) &&
      /\.maplibregl-ctrl-attrib\s*\{[^}]*var\(--nav-text-dim\)/.test(TOKENS),
  );
  check(
    'map: attribution is never hidden',
    !/\.maplibregl-ctrl-attrib[^}]*display:\s*none/.test(TOKENS) &&
      !/\.maplibregl-ctrl-attrib[^}]*visibility:\s*hidden/.test(TOKENS) &&
      !/attributionControl:\s*false/.test(MAP),
  );
  check(
    // The OSM credit travels with the tile source itself, so it cannot be
    // lost by editing the component: MapLibre renders whatever the style
    // declares.
    'map: the OSM credit rides on the tile source in the style document',
    /attribution: style\.attribution/.test(styleSrc) &&
      /openstreetmap\.org\/copyright/.test(styleSrc),
  );

  // The scope class is on the map component; the provider is untouched.
  check('map: the nav-map scope class is applied', MAP.includes('nav-map'));
  check('map: still exactly the OSM tile seam', MAP.includes("from '@/lib/navigator/map-style'"));

  // 36px pin floor, and exactly the three known navigation markers.
  check(
    'map: pins meet the 36px floor',
    /width:36px;height:36px/.test(MAP) && !/width:(?:[12]\d|3[0-5])px;height:/.test(MAP),
  );
  const markerCtors = [...MAP.matchAll(/new maplibre\.Marker\(/g)].length;
  check(
    'map: exactly three marker constructions — truck, maneuver, destination',
    markerCtors === 3,
    markerCtors,
  );
  for (const t of ["'Your truck'", "'Next maneuver'", "'Destination'"]) {
    check(`map: marker ${t} still present`, MAP.includes(t));
  }

  // Zoom gating: audited, not simulated. No marker may hide by zoom, and
  // the record says why there is nothing else to gate.
  check(
    'zoom: no marker visibility is conditioned on zoom level',
    !/getZoom\(\)[^\n]*(?:pin|marker|layer\.clear)/.test(strip(MAP)) &&
      !/(?:pin|marker)[^\n]*getZoom\(\)/.test(strip(MAP)),
  );
  const flatDoc = DOC.replace(/\s+/g, ' ');
  check(
    'zoom: the audit is recorded instead of faked',
    flatDoc.includes('no POI pins on the drive map') && flatDoc.includes('no gating code ships'),
  );

  // The rail did not sprout fake data layers.
  for (const fake of ['restriction', 'clearance', 'speedLimit', 'satellite', 'hillshade']) {
    check(
      `map: no fabricated ${fake} layer`,
      !strip(MAP).toLowerCase().includes(fake.toLowerCase()),
    );
  }
}

/* ==================== 6. the record keeps its promises =================== */
{
  const flat = DOC.replace(/\s+/g, ' ');
  for (const promise of [
    'Wrong-way as its own banner',
    'Provider/reroute failure as its own banner',
    'saturate(0.78)',
    'Barlow Semi Condensed',
    'Amber TL vehicle marker',
  ]) {
    check(`record: documents "${promise}"`, flat.includes(promise));
  }
}

console.log(`navigator-warning-rail: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

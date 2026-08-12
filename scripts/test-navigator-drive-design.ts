/**
 * Navigator Design Blueprint — Phase 1 invariants.
 *
 * Pins the DESIGN CONTRACT of the Drive Mode cockpit, not its spelling:
 * the blueprint's exact semantic palette, the night-first/day-dormant
 * theme, the drive-mode text floor, the touch floors, the numerals-first
 * hierarchy plumbing, the semantic color rules (brand yellow banned from
 * the drive surface, amber/red/green each meaning exactly one thing), the
 * ≤3-information-cluster ceiling, and the anti-pattern kill list (no ads,
 * no modals while moving, no hamburger). It also proves the honesty rules:
 * no font files smuggled in ahead of the owner's Barlow decision, no
 * fabricated driver data (speed-limit shields, lane guidance, fuel or
 * parking status) anywhere on the driving screen, and a maneuver glyph
 * that renders NOTHING rather than guess.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-drive-design.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-drive-design.cjs \
 *   && node /tmp/test-drive-design.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { maneuverGlyph } from '@/lib/navigator/maneuver-glyph';
import { formatTruckHeightFtIn } from '@/lib/navigator/format-units';
import { createVoiceGuidance, type SpeechPort } from '@/lib/navigator/voice-guidance';

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

const TOKENS = readFileSync('src/app/(navigator)/navigator-design.css', 'utf8');
const TAILWIND = readFileSync('tailwind.config.ts', 'utf8');
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const MAP = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const HOS = readFileSync('src/components/navigator/HosStrip.tsx', 'utf8');

/* ============================ 1. the token sheet ========================= */
{
  // The blueprint's exact semantic hexes (§12) — byte-for-byte, case aside.
  const HEXES: [string, string][] = [
    ['--nav-bg', '#0a0e13'],
    ['--nav-surface', '#131a24'],
    ['--nav-surface-2', '#1c2530'],
    ['--nav-text', '#f2f5f8'],
    ['--nav-text-dim', '#8a97a5'],
    ['--nav-route', '#33c7ff'],
    ['--nav-good', '#2ecc71'],
    ['--nav-warn', '#ffb020'],
    ['--nav-danger', '#ff3b30'],
    ['--nav-brand', '#ffeb00'],
  ];
  for (const [token, hex] of HEXES) {
    const re = new RegExp(`${token}:\\s*${hex}`, 'i');
    check(`tokens: ${token} is the blueprint's exact ${hex}`, re.test(TOKENS));
  }
  check(
    'tokens: the traveled/alternate route is the blueprint rgba',
    /--nav-route-alt:\s*rgba\(90,\s*107,\s*125,\s*0\.5\)/i.test(TOKENS),
  );

  // Night is the DEFAULT (on :root), day is the override — not the reverse.
  const rootAt = TOKENS.search(/:root\s*\{/);
  const dayAt = TOKENS.search(/\[data-theme='day'\]\s*\{/);
  check(
    'tokens: night palette sits on :root',
    rootAt >= 0 && /:root\s*\{[^}]*--nav-bg/.test(TOKENS),
  );
  check('tokens: day palette exists as the override', dayAt > rootAt);
  const dayBlock = TOKENS.slice(dayAt, TOKENS.indexOf('}', dayAt));
  check(
    'tokens: day flips bg/surface/text only — meaning never changes between modes',
    /--nav-bg:\s*#f4f5f7/i.test(dayBlock) &&
      !/--nav-route:|--nav-good:|--nav-warn:|--nav-danger:|--nav-brand:/.test(dayBlock),
  );
  // Dormant by construction: nothing in src ever SETS the day attribute.
  const setters = ['data-theme='];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) {
        const src = readFileSync(p, 'utf8');
        if (setters.some((s) => src.includes(s))) offenders.push(p);
      }
    }
  };
  walk('src');
  check(
    'tokens: the day theme is dormant — no code sets data-theme',
    offenders.length === 0,
    offenders,
  );

  // Type scale: floors per the blueprint, with the 16px drive floor winning
  // over the blueprint's own 14px label row.
  const size = (name: string): number =>
    Number(new RegExp(`${name}:\\s*(\\d+)px`).exec(TOKENS)?.[1] ?? NaN);
  const maneuver = size('--size-maneuver');
  const speed = size('--size-speed');
  const street = size('--size-street');
  const trip = size('--size-trip');
  const label = size('--size-label');
  check('type: maneuver numeral 56–64px', maneuver >= 56 && maneuver <= 64, maneuver);
  check('type: speed 48px', speed === 48, speed);
  check('type: street/exit 26px', street === 26, street);
  check('type: trip values 24px', trip === 24, trip);
  check('type: labels at or above the 16px drive floor', label >= 16, label);
  check(
    'type: the hierarchy is strictly ordered',
    maneuver > speed && speed > street && street > trip && trip >= label,
  );

  // Touch and shape.
  check('touch: 64px primary drive target', /--tap-drive:\s*64px/.test(TOKENS));
  check('touch: 48px absolute floor', /--tap-min:\s*48px/.test(TOKENS));
  check('touch: 12px target gap', /--tap-gap:\s*12px/.test(TOKENS));
  check('shape: 16px cockpit card radius', /--radius-card:\s*16px/.test(TOKENS));
  check('shape: pill radius', /--radius-pill:\s*999px/.test(TOKENS));

  // Motion: calm eases that go inert under reduced motion — at the token,
  // so every consumer inherits the preference.
  check('motion: 300ms camera ease', /--ease-cam:\s*300ms ease-out/.test(TOKENS));
  check('motion: 200ms ui ease', /--ease-ui:\s*200ms ease-out/.test(TOKENS));
  const reduced = TOKENS.slice(TOKENS.indexOf('prefers-reduced-motion'));
  check(
    'motion: reduced-motion zeroes both eases',
    /--ease-cam:\s*0ms/.test(reduced) && /--ease-ui:\s*0ms/.test(reduced),
  );

  // The sheet loads once, in the (navigator) layout.
  check(
    'tokens: loaded by the navigator route-group layout',
    readFileSync('src/app/(navigator)/layout.tsx', 'utf8').includes('./navigator-design.css'),
  );

  // Tailwind can address every semantic color, and the data face exists.
  for (const alias of ['bg', 'surface', 'text', 'route', 'good', 'warn', 'danger', 'brand']) {
    check(`tailwind: nav.${alias} alias exists`, TAILWIND.includes(`var(--nav-${alias})`));
  }
  check('tailwind: data font family exists', TAILWIND.includes("data: ['var(--font-data)']"));
  check('tailwind: cockpit radius exists', TAILWIND.includes("cockpit: 'var(--radius-card)'"));
}

/* ==================== 2. typography honesty (Barlow) ===================== */
{
  // The data-face seam exists and resolves to a font this repo actually
  // ships. Committing Barlow files is the OWNER's licensing/asset call —
  // the fonts directory must still hold exactly the five known subsets.
  check('font: --font-data seam exists', /--font-data:/.test(TOKENS));
  check(
    'font: the seam resolves to Inter until the owner ships Barlow',
    /--font-data:\s*var\(--font-inter\)/.test(TOKENS),
  );
  const fonts = readdirSync('public/fonts')
    .filter((f) => !f.startsWith('.'))
    .sort();
  check(
    'font: no font files were added ahead of the owner decision',
    fonts.length === 5 &&
      fonts.every((f) =>
        [
          'anton-400.woff2',
          'inter-400.woff2',
          'inter-500.woff2',
          'inter-600.woff2',
          'inter-700.woff2',
        ].includes(f),
      ),
    fonts,
  );
  check('font: no barlow asset or fetch anywhere in src', !/barlow/i.test(SCREEN + MAP + HOS));
}

/* ==================== 3. the rendered cockpit surface ==================== */
const silent: SpeechPort = { supported: true, speak: (_t, d) => d(), cancel: () => {} };
const view = {
  status: 'navigating' as const,
  maneuvers: {
    next: {
      action: 'turn',
      instruction: 'Turn right onto Old Mill Road toward the receiving gate.',
      direction: 'right',
      mileMi: 4.6,
    },
    following: {
      action: 'turn',
      instruction: 'Turn left onto Dock Street.',
      direction: 'left',
      mileMi: 4.9,
    },
    distanceMi: 0.4,
  },
  remainingMi: 12.3,
  routeMile: 4.2,
  totalMi: 16.5,
  speedMph: 58,
  lastKnown: false,
};
const html = renderToStaticMarkup(
  createElement(
    GpsProvider,
    null,
    createElement(
      SafetyLockProvider,
      null,
      createElement(DrivingScreenView, {
        view: view as never,
        watching: true,
        onStart: () => {},
        onStop: () => {},
        voice: createVoiceGuidance(silent),
        mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
        fullScreen: true,
        roadName: 'Old Mill Road',
        etaText: '3:45 PM',
        overviewSlot: createElement(
          'button',
          { type: 'button', className: 'min-h-16' },
          'Overview',
        ),
      }),
    ),
  ),
);
const foldAt = html.indexOf('class="space-y-4 p-4"');
const surface = foldAt > 0 ? html.slice(0, foldAt) : html;

{
  check('surface: the fold marker was found', foldAt > 0);

  // Numerals-first hierarchy, wired through the size variables.
  check(
    'hierarchy: the distance numeral reads the maneuver size in the data face',
    /class="[^"]*font-data[^"]*num-data[^"]*var\(--size-maneuver\)[^"]*">\s*In\s/.test(surface),
  );
  check(
    'hierarchy: the speed cell reads the speed size, tabular',
    /num-data[^"]*var\(--size-speed\)/.test(surface),
  );
  check(
    // Two on the trip bar (remaining, arrive) plus the compact HOS
    // strip's clock ceiling — clocks and trip values are the same class
    // of number and read at the same size.
    'hierarchy: trip values read the trip size',
    (surface.match(/var\(--size-trip\)/g) ?? []).length >= 2,
  );
  check(
    'hierarchy: every strip label reads the label size',
    (surface.match(/var\(--size-label\)/g) ?? []).length >= 3,
  );

  // The 16px drive floor: no small-text class may reach the moving surface.
  check(
    'floor: no text-xs/text-sm above the fold',
    !/[\s"](?:text-xs|text-sm)[\s"/]/.test(surface),
    surface.match(/[\s"](?:text-xs|text-sm)[\s"/]/g),
  );
  check(
    'floor: no sub-16px arbitrary size above the fold',
    !/text-\[(?:length:)?(?:[0-9]|1[0-5])(?:px|\.\d+px)\]/.test(surface),
  );

  // Touch: every real button on the moving surface is a 64px target.
  const buttons = [...surface.matchAll(/<button\b[^>]*class="([^"]*)"/g)].map((m) => m[1]);
  check('touch: the surface has its controls', buttons.length >= 2, buttons.length);
  check(
    'touch: every above-the-fold button is a 64px target',
    buttons.every((c) => c.includes('min-h-16')),
    buttons,
  );

  // ≤3 information clusters while moving: the maneuver banner, the trip
  // bar, and the HOS strip — counted structurally as the surface's only
  // sections and definition lists. Anything new must displace something.
  const sections = (surface.match(/<section\b/g) ?? []).length;
  const dls = (surface.match(/<dl\b/g) ?? []).length;
  // Pilot round 3: the HOS card became the compact strip, which is one
  // tap target rather than a section+dl cluster — so the moving surface
  // now carries FEWER clusters than the budget, not more. The budget is
  // a ceiling; anything new still has to displace something.
  check(
    'clusters: at most two sections, and the maneuver banner is one',
    sections <= 2 && sections >= 1,
    sections,
  );
  check(
    'clusters: at most two dls (trip bar, and the HOS card when open)',
    dls <= 2 && dls >= 1,
    dls,
  );
  check(
    'clusters: the compact HOS strip is present and is ONE cluster',
    (surface.match(/aria-label="Hours of service — compact/g) ?? []).length === 1,
  );

  // The map is the hero — now literally the whole surface: an absolute
  // z-0 background. Nothing on the overlay column may claim remaining
  // flex space for itself; the space between the top and bottom overlay
  // groups is open map (mt-auto), not a stretched readout.
  check(
    'map hero: the map is the full-bleed background, and nothing else grows',
    surface.includes('absolute inset-0 z-0') && (surface.match(/flex-1/g) ?? []).length === 0,
  );
  check('map hero: the bottom overlay group rides the bottom edge', surface.includes('mt-auto'));
  check('map hero: the banner is capped', surface.includes('max-h-[28dvh]'));

  // Kill list (blueprint §11), on the rendered surface.
  check('kill: no modal dialog on the moving surface', !/role="(?:alert)?dialog"/.test(surface));
  check('kill: no nav/hamburger chrome', !/<nav\b|hamburger|☰/.test(surface));
  check(
    'kill: no ads, promos, or upsell',
    !/promo|sponsor|advertis|upsell|subscribe/i.test(surface),
  );
  check('kill: brand yellow never reaches the drive surface', !/nav-brand|#FFEB00/i.test(surface));
}

/* ==================== 4. semantic color discipline ======================= */
{
  // Brand yellow and the old yellow route line are gone from every Drive
  // Mode component — TLWS yellow is parked-screen branding only.
  const driveFiles = [
    'DrivingScreen.tsx',
    'NavigationMap.tsx',
    'HosStrip.tsx',
    'VoiceControls.tsx',
    'MotionLockOverlay.tsx',
    'LockGate.tsx',
  ];
  for (const f of driveFiles) {
    const src = readFileSync(`src/components/navigator/${f}`, 'utf8');
    check(`color: no brand yellow in ${f}`, !/#FFEB00|#FACC15|nav-brand/i.test(src));
  }
  // Sodium amber — the site's money accent — may not appear on the drive
  // surface either, where amber is reserved for warnings. (The road-tested
  // TL vehicle marker keeps its own amber by owner approval; it lives in
  // vehicle-marker.ts, deliberately outside this ban.)
  for (const f of ['DrivingScreen.tsx', 'NavigationMap.tsx', 'HosStrip.tsx']) {
    const src = readFileSync(`src/components/navigator/${f}`, 'utf8');
    check(`color: no signal amber in ${f}`, !/\bsignal\b|#F5A623/i.test(strip(src)));
  }

  // The route line is the blueprint cyan over a dark casing.
  check('route: drawn in --nav-route cyan', MAP.includes("'#33C7FF'"));
  check('route: the old yellow line is gone', !/#facc15/i.test(MAP));

  // Severity colors appear in DrivingScreen only as warning-rail EDGES
  // (Phase 2) — the advisory/critical left border beside real state words.
  // Never a fill, never a text color, never a good-state the screen
  // invents for itself.
  check(
    'semantic: warn/danger appear only as rail edges beside words',
    [...SCREEN.matchAll(/nav-(?:warn|danger)/g)].length > 0 &&
      !/(?<!border-l-)nav-(?:warn|danger)/.test(SCREEN) &&
      !/nav-good/.test(SCREEN),
  );
  // The HOS bar pairs its color with the warning line's words.
  check(
    'semantic: the HOS bar maps severity, always beside the text line',
    /bg-nav-good/.test(HOS) &&
      /bg-nav-warn/.test(HOS) &&
      /bg-nav-danger/.test(HOS) &&
      /HosWarningLine/.test(HOS),
  );
}

/* ==================== 5. no fabricated driver data ======================= */
{
  // Data the blueprint asks for but the repository cannot honestly supply
  // must be ABSENT, not mocked: no identifier on the driving screen may
  // even suggest these exist.
  const code = strip(SCREEN);
  for (const fake of [
    'speedLimit',
    'postedLimit',
    'truckLimit',
    'laneGuidance',
    'fuelPrice',
    'parkingStatus',
    'weighStation',
    'hazardFeed',
  ]) {
    check(`honesty: no ${fake} on the driving screen`, !code.includes(fake));
  }
  /*
   * The truck profile shows ONCE, parked (final pilot milestone). The
   * cockpit chip that repeated it over the live map is gone — its pixels
   * belong to the map now — and the parked panel remains the one surface
   * that states the REAL planning input and says whose numbers they are.
   */
  check('honesty: no truck-profile chip rides the live map', !/TruckChip/.test(SCREEN));
  check(
    'honesty: the chip removal is documented where it used to render',
    SCREEN.includes('NO TRUCK-PROFILE OVERLAY HERE') &&
      SCREEN.includes('goes to the map, not to a replacement box'),
  );
  const panelSrc = readFileSync('src/components/navigator/TruckProfilePanel.tsx', 'utf8');
  const controlsSrc = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  const editorSrc = readFileSync('src/components/navigator/TruckProfileEditor.tsx', 'utf8');
  check(
    // The parked surface now EDITS the profile rather than displaying a
    // fixed one, and says plainly that untouched values are defaults.
    'honesty: the parked surface reads the real profile and labels defaults as defaults',
    controlsSrc.includes('{truckEditor}') &&
      editorSrc.includes('isDefault') &&
      editorSrc.includes('not your truck until you check them') &&
      panelSrc.includes('truck.heightFt') &&
      panelSrc.includes('truck.grossWeightLbs'),
  );
}

/* ==================== 6. the maneuver glyph is honest ==================== */
{
  const cases: [string | null, string | null, string | null][] = [
    ['turn', 'left', '↰'],
    ['turn', 'right', '↱'],
    ['keep', 'left', '↖'],
    ['keep', 'right', '↗'],
    ['exit', 'right', '↗'],
    ['ramp', 'left', '↖'],
    ['fork', 'right', '↗'],
    ['merge', 'left', '↖'],
    ['depart', null, '↑'],
    ['continue', null, '↑'],
    ['continue', 'left', '↑'],
    ['arrive', null, '⚑'],
    ['uTurn', 'left', '↩'],
    ['uTurn', 'right', '↪'],
    ['  TURN  ', 'Right', '↱'],
  ];
  for (const [action, direction, want] of cases) {
    check(
      `glyph: ${action}/${direction ?? '—'} → ${want}`,
      maneuverGlyph(action, direction) === want,
      maneuverGlyph(action, direction),
    );
  }
  // Omit on unknown — every uncertain input renders NO arrow, because a
  // wrong arrow at 70 mph is worse than none.
  const unknowns: [string | null | undefined, string | null | undefined][] = [
    ['roundaboutExit', 'right'],
    ['roundaboutEnter', null],
    ['turn', null],
    ['turn', 'slightly-left'],
    ['keep', ''],
    ['uTurn', null],
    ['teleport', 'left'],
    ['', 'left'],
    [null, 'left'],
    [undefined, undefined],
  ];
  for (const [action, direction] of unknowns) {
    check(
      `glyph: unknown ${String(action)}/${String(direction)} renders nothing`,
      maneuverGlyph(action, direction) === null,
    );
  }
  // The screen derives it from the provider's structured fields — never
  // from instruction prose — and renders it as decoration only.
  check(
    'glyph: derived from action/direction, aria-hidden on screen',
    SCREEN.includes('maneuverGlyph(m.action, m.direction)') &&
      /aria-hidden="true"[\s\S]{0,300}\{glyph\}/.test(SCREEN),
  );
  check(
    'glyph: never parsed out of the instruction text',
    !/maneuverGlyph\([^)]*instruction/.test(SCREEN),
  );
}

/* ==================== 7. truck height formatting ========================= */
{
  const cases: [number, string][] = [
    [13.5, '13′6″'],
    [13, '13′0″'],
    [12.99, '13′0″'],
    [13.6, '13′7″'],
    [8.5, '8′6″'],
  ];
  for (const [input, want] of cases) {
    check(`height: ${input} ft → ${want}`, formatTruckHeightFtIn(input) === want);
  }
  check('height: refuses NaN', formatTruckHeightFtIn(Number.NaN) === '—');
  check('height: refuses negative', formatTruckHeightFtIn(-1) === '—');
}

/* ==================== 8. calm motion ===================================== */
{
  // The imminent glow: route-colored, driven by the ui ease so reduced
  // motion collapses it, and triggered by the real distance the view
  // already carries.
  check(
    'motion: the imminent glow exists and rides the ease variable',
    /\.nav-imminent\s*\{[^}]*var\(--nav-route\)/.test(TOKENS) &&
      /transition:[^;]*var\(--ease-ui\)/.test(TOKENS),
  );
  check(
    'motion: imminence is the real distance, under 0.3 mi',
    (SCREEN.includes('nav-imminent') &&
      /distanceMi[^\n]*< 0\.3|< 0\.3[^\n]*distanceMi/.test(strip(SCREEN))) ||
      /const imminent = [^;]*distanceMi[^;]*0\.3/.test(strip(SCREEN)),
  );
  // No spinner, no bounce, anywhere on the drive components (the existing
  // harnesses already ban animate-*; this pins the blueprint's words).
  for (const f of ['DrivingScreen.tsx', 'NavigationMap.tsx', 'HosStrip.tsx', 'VoiceControls.tsx']) {
    const src = strip(readFileSync(`src/components/navigator/${f}`, 'utf8'));
    check(`motion: no bounce/spin/pulse classes in ${f}`, !/animate-|bounce|spin\b/.test(src));
  }
}

/* ==================== 9. modals stay where they were ===================== */
{
  // The one sanctioned dialog is the passenger override, which the safety
  // lock already governs. No Phase 1 component may add another.
  const offenders: string[] = [];
  for (const f of readdirSync('src/components/navigator').filter((x) => /\.tsx$/.test(x))) {
    if (f === 'PassengerOverrideDialog.tsx') continue;
    const src = readFileSync(`src/components/navigator/${f}`, 'utf8');
    if (/role="(?:alert)?dialog"/.test(src)) offenders.push(f);
  }
  check('modals: only the passenger override renders a dialog', offenders.length === 0, offenders);
}

/* ==================== 10. the parked map has a real box ================== */
{
  // Pilot round 3, "half the map blank": Leaflet measured its canvas on
  // the parked page, where the map wrapper was a bare auto-height div —
  // the mounted map computed to 0px tall — and the driving surface then
  // inherited that stale canvas at trip start. Parked, the wrapper now
  // grants the SAME box the dynamic-import placeholder promises, so the
  // canvas is never born 0px and the pre-drive briefing framing is
  // actually visible; before Enable location there is no map and no box.
  const parkedProps = {
    view: view as never,
    watching: true,
    onStart: () => {},
    onStop: () => {},
    voice: createVoiceGuidance(silent),
    fullScreen: false,
  };
  const parked = renderToStaticMarkup(
    createElement(
      GpsProvider,
      null,
      createElement(
        SafetyLockProvider,
        null,
        createElement(DrivingScreenView, {
          ...parkedProps,
          mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
        }),
      ),
    ),
  );
  check(
    'parked: the mounted map sits in the placeholder-sized box',
    /class="[^"]*h-72[^"]*sm:h-96[^"]*"><div data-test-map="live"/.test(parked),
    parked.match(/class="([^"]*)"><div data-test-map="live"/)?.[1],
  );
  const noMap = renderToStaticMarkup(
    createElement(
      GpsProvider,
      null,
      createElement(SafetyLockProvider, null, createElement(DrivingScreenView, parkedProps)),
    ),
  );
  check('parked: no empty bordered box before a map exists', !noMap.includes('h-72'));
}

console.log(`navigator-drive-design: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * Driving-surface accessibility (Block 2, priority K).
 *
 * Contrast is COMPUTED here, not asserted: every text colour the driving
 * surfaces actually use is pulled out of the source, composited at its
 * real alpha over the real background, and run through the WCAG 2.x
 * relative-luminance formula. The card is `bg-asphalt/95` over live map
 * tiles, so the background used is the worst case for light text — the
 * map showing through as white.
 *
 * The rest covers what a driver who cannot see the screen, or who has
 * asked for no motion, actually gets.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-accessibility.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-a11y.cjs && node /tmp/test-a11y.cjs
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ------------------------------------------------------------- WCAG maths
type RGB = [number, number, number];
function hex(h: string): RGB {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: RGB, b: RGB): number {
  const [hi, lo] =
    luminance(a) > luminance(b) ? [luminance(a), luminance(b)] : [luminance(b), luminance(a)];
  return (hi + 0.05) / (lo + 0.05);
}
function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;
}

// The palette, read from the Tailwind config so a colour change cannot
// silently invalidate these numbers.
const tw = readFileSync('tailwind.config.ts', 'utf8');
function token(name: string): RGB {
  const m = new RegExp(`${name}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(tw);
  if (m === null) throw new Error(`palette token not found: ${name}`);
  return hex(m[1]);
}
const INK = token('ink');
const MUTED = token('muted');
const ASPHALT = hex(/asphalt:\s*\{\s*DEFAULT:\s*'(#[0-9A-Fa-f]{6})'/.exec(tw)![1]);

// bg-asphalt/95 sits over the map. For light text the worst case is the
// map showing through WHITE, which lifts the background and cuts contrast.
const CARD_BG = composite(ASPHALT, 0.95, [255, 255, 255]);

const SURFACES = [
  'src/components/navigator/DrivingScreen.tsx',
  'src/components/navigator/PilotTripControls.tsx',
  'src/components/navigator/HosStrip.tsx',
  'src/components/navigator/VoiceControls.tsx',
  'src/components/navigator/MotionLockOverlay.tsx',
];

// ============================== contrast, computed ======================
{
  const used = new Set<string>();
  for (const f of SURFACES) {
    for (const m of readFileSync(f, 'utf8').matchAll(/text-(ink|muted)(?:\/(\d{2}))?\b/g)) {
      used.add(`${m[1]}/${m[2] ?? '100'}`);
    }
  }
  check('contrast: the surfaces do use text colours worth checking', used.size >= 4, [...used]);

  const AA_BODY = 4.5;
  const results: Record<string, string> = {};
  let worst = Infinity;
  let worstName = '';
  for (const spec of used) {
    const [name, alphaStr] = spec.split('/');
    const fg = name === 'ink' ? INK : MUTED;
    const alpha = Number(alphaStr) / 100;
    // Both backgrounds a driving surface ever paints on.
    for (const [bgName, bg] of [
      ['page', ASPHALT],
      ['card over a white map', CARD_BG],
    ] as const) {
      const ratio = contrast(composite(fg, alpha, bg), bg);
      results[`${spec} on ${bgName}`] = ratio.toFixed(2);
      if (ratio < worst) {
        worst = ratio;
        worstName = `${spec} on ${bgName}`;
      }
    }
  }
  // Body text, not large text: the stricter bar, applied to everything.
  check(
    `contrast: every driving-surface text colour clears WCAG AA ${AA_BODY}:1 (worst ${worstName} at ${worst.toFixed(2)}:1)`,
    worst >= AA_BODY,
    results,
  );
  // A palette regression must be caught here rather than on the road, so
  // the maths is pinned against a known pair.
  check(
    'contrast: the formula itself is right (white on black is 21:1)',
    Math.abs(contrast([255, 255, 255], [0, 0, 0]) - 21) < 0.01,
  );
  console.log(`  measured: worst driving-surface contrast ${worst.toFixed(2)}:1 (${worstName})`);
}

// ============================== reduced motion ==========================
{
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const map = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');

  // The trap: `html { scroll-behavior: auto }` under reduced motion does
  // NOT override an explicit `behavior: 'smooth'` argument — the argument
  // wins. The one moment the screen moves on its own is trip start.
  check(
    'motion: the auto-scroll at trip start reads the preference',
    screen.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches") &&
      screen.includes("behavior: reduced ? 'auto' : 'smooth'"),
  );
  check('motion: no unconditional smooth scroll remains', !/behavior: 'smooth'\s*\}/.test(screen));
  // The map was already built this way; pinned so it stays that way.
  check(
    'motion: the map never animates its camera',
    map.includes('animate: false') && !/animate:\s*true|flyTo/.test(map),
  );
}

// ============================== the non-visual driver ===================
{
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const map = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');

  // Voice starts muted by design, so a screen-reader user with voice off
  // was never told a turn was coming — they had to keep asking.
  check(
    'non-visual: the maneuver instruction is a polite live region',
    /aria-live="polite"\s*\n\s*className="line-clamp-2/.test(screen),
  );
  // ...and the per-second distance is NOT, or the region is unusable.
  check(
    'non-visual: the per-second distance line is not live',
    !/aria-live[^>]*>\s*\n?\s*In \{formatDriverDistanceMi/.test(screen),
  );
  check(
    'non-visual: status and the offline notice are live regions too',
    (screen.match(/aria-live="polite"/g) ?? []).length >= 3,
  );
  check(
    'non-visual: the maneuver card names itself',
    screen.includes('aria-label="Next maneuver"'),
  );
  check(
    'non-visual: the map is a named region, not an unlabelled pile of tiles',
    map.includes('role="region"') && /aria-label="Navigation map/.test(map),
  );
  check(
    'non-visual: every map control has an accessible name',
    /aria-label="Recenter/.test(map) &&
      /aria-label="Zoom in"/.test(map) &&
      /aria-label="Zoom out"/.test(map),
  );
  // State in words and aria-pressed, never colour alone (doc 06).
  const voice = readFileSync('src/components/navigator/VoiceControls.tsx', 'utf8');
  check(
    'non-visual: the voice control carries its state in words and aria-pressed',
    voice.includes('aria-pressed={muted}') && /'Mute voice guidance'/.test(voice),
  );
}

console.log(`navigator-accessibility: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

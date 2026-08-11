/**
 * Navigator mobile usability hardening — regression pins.
 *
 * A source audit rendered every statically renderable Navigator surface at
 * 320/360/390/430px portrait, short landscape, and 200% browser text
 * scaling, under hostile content (a 1250-mile route, 115 mph, a
 * 50-character road name, a destination title that fills two lines). The
 * one genuine defect class it found: cockpit numerals and the drive-row
 * controls were sized in `rem`, so large browser text scaling wrapped the
 * distance numeral and pushed the Overview/Voice/Stop row past the
 * viewport at narrow widths. The fix is px floors on the numerals and
 * `min-w-0` + `truncate` on the shrinkable controls (height, not width, is
 * their touch floor — every one stays min-h-16). These pins lock that in;
 * layout behavior is verified live by the audit rig, not re-simulated here.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-mobile-hardening.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-mobile-hardening.cjs \
 *   && node /tmp/test-mobile-hardening.cjs
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

const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const VOICE = readFileSync('src/components/navigator/VoiceControls.tsx', 'utf8');
const BRIEFING = readFileSync('src/components/navigator/RouteBriefing.tsx', 'utf8');

/* ==================== 1. numerals have px floors ======================== */
{
  // A clamp whose MINIMUM is a rem unit scales with the user's browser
  // text size and can wrap; a px minimum holds a floor the layout was
  // measured against. Every cockpit numeral clamp must floor in px.
  const clamps = [
    ...SCREEN.matchAll(/text-\[length:clamp\(([^,]+),/g),
    ...BRIEFING.matchAll(/text-\[length:clamp\(([^,]+),/g),
  ].map((m) => m[1].trim());
  check(
    'numerals: every clamp floor is a px value',
    clamps.length > 0 && clamps.every((c) => /px$/.test(c)),
    clamps,
  );
  check(
    'numerals: no rem-floored clamp survives on a cockpit numeral',
    !/text-\[length:clamp\(\d+(?:\.\d+)?rem,/.test(SCREEN + BRIEFING),
  );
}

/* ==================== 2. drive-row controls can shrink ================== */
{
  // The Overview / Voice / Stop row lays three full-width buttons side by
  // side. Without min-w-0 the flexbox cannot shrink them below their text
  // width, and three text-xl labels overflow a 320px row (and any row
  // under large text scaling). min-w-0 + truncate lets a label elide; the
  // 64px height is the real touch floor and is untouched.
  const rowButtons = [...SCREEN.matchAll(/className="(min-h-16[^"]*bg-nav-surface-2[^"]*)"/g)].map(
    (m) => m[1],
  );
  check('controls: the shrinkable drive controls exist', rowButtons.length >= 3, rowButtons.length);
  check(
    'controls: every drive-row control can shrink and truncate',
    rowButtons.every((c) => c.includes('min-w-0') && c.includes('truncate')),
    rowButtons,
  );
  check(
    'controls: every drive-row control keeps its 64px height floor',
    rowButtons.every((c) => c.includes('min-h-16')),
  );
  check(
    'controls: the voice control shrinks and truncates too',
    /className="min-h-16 min-w-0 w-full truncate/.test(VOICE),
  );
  check(
    'controls: no NON-ZERO min-w floor was left that would block the shrink',
    !/min-h-16 min-w-(?!0\b)[1-9]/.test(SCREEN) && !/min-h-16 min-w-(?!0\b)[1-9]/.test(VOICE),
  );
}

/* ==================== 3. the primary actions keep their weight ========== */
{
  // Shrinking must not have touched the two committed primaries: the
  // briefing's 72px green Start and 64px Discard.
  check(
    'briefing: Start stays the 72px green primary',
    BRIEFING.includes('min-h-[4.5rem] w-full rounded-cockpit bg-nav-good'),
  );
  check(
    'briefing: Discard keeps its 64px floor',
    /min-h-16 w-full rounded-cockpit border/.test(BRIEFING),
  );
}

console.log(`navigator-mobile-hardening: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

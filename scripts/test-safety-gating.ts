/**
 * N4 gating surface — LockGate/override/overlay rendering, verified with
 * static renders (locked is the DEFAULT state: a fresh provider has no
 * fix, which is UNKNOWN, which is treated as MOVING) plus structural
 * assertions for what a static render cannot reach (press-and-hold
 * semantics, cleanup).
 *
 * Run:
 *   npx esbuild scripts/test-safety-gating.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-safety-gating.cjs && node /tmp/test-safety-gating.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allowedWhileMoving } from '@/lib/navigator/actions';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { LockGate } from '@/components/navigator/LockGate';
import { MotionLockOverlay } from '@/components/navigator/MotionLockOverlay';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 140)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function inProviders(child: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(
    createElement(GpsProvider, null, createElement(SafetyLockProvider, null, child)),
  );
}

/*
 * Default state (no fix → UNKNOWN). ONE regime since NAV-ENTRY-1:
 *
 *   - every EDITING action renders, always. Destination, truck, clocks,
 *     preferences, settings — the owner's decision is that a driver may
 *     change their own trip whenever they like, so these are permitted
 *     outright rather than exempted by a cold-start window.
 *
 *   - the three CAMERA actions keep default-deny: UNKNOWN is treated as
 *     MOVING and children are not rendered. 'route-overview' proves it here.
 *     There is no passenger path out of it, because there is no passenger
 *     path left anywhere.
 */
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'edit-destination', lockedLabel: 'Destination entry' },
      createElement('p', null, 'SETUP-WINDOW-CONTENT'),
    ),
  );
  check(
    'destination entry renders at a cold start — and at every other motion state',
    html.includes('SETUP-WINDOW-CONTENT'),
  );
}
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'route-overview', lockedLabel: 'Route overview' },
      createElement('p', null, 'SHOULD-NOT-RENDER'),
    ),
  );
  check(
    'locked action: children NOT rendered under default-deny',
    !html.includes('SHOULD-NOT-RENDER'),
  );
  /*
   * The remaining gate is the CAMERA, and its copy says what is true without
   * asking the driver anything. This render has never had a fix, so motion is
   * UNKNOWN and the lock reason is `location-unknown`: the app cannot see the
   * vehicle, and it says exactly that rather than claiming movement nobody
   * observed — or asking whoever is holding the phone to declare they are not
   * driving, which is what it used to do.
   */
  check(
    'locked action: an unknown location is named as exactly that',
    html.includes('confirm this vehicle') && html.includes('location'),
    html.slice(0, 400),
  );
  check(
    'locked action: it does NOT claim the vehicle is moving',
    !html.includes('locked while the vehicle is moving'),
  );
  check(
    'locked action: and offers no passenger declaration, at any motion state',
    !/passenger/i.test(html) && !html.includes('I am not the driver'),
  );
  check(
    'locked action: the reason is machine-readable for the bench',
    html.includes('data-lock-reason="location-unknown"'),
  );
}
/*
 * THE COCKPIT ROW KEEPS ITS SHAPE — a regression this milestone actually
 * caused and then fixed.
 *
 * The `location-unknown` branch above was first written to return the
 * block card unconditionally, ignoring `compact`. On a full-screen map
 * that turned three row-sized controls into three stacked cards: the
 * buttons stretched to 51x486, the route-overview control disappeared,
 * the guidance surface overflowed itself by up to 252 px, and the map's
 * unobstructed share fell from 39% to 14% at 320x568.
 * `navigator-viewports` went from 0 failures to 97.
 *
 * A browser bench caught it, and a browser bench is expensive to run. So
 * the invariant is pinned here too, where it costs milliseconds: the
 * compact variant must stay ONE row-sized element and must not carry the
 * block card's paragraphs.
 */
{
  const compactHtml = inProviders(
    createElement(LockGate, {
      // A control the driving screen genuinely renders compact AND that
      // is genuinely locked while moving — `stop-navigation` is allowed
      // while moving, so it would render its children and prove nothing.
      action: 'route-overview',
      lockedLabel: 'Route overview',
      compact: true,
    }),
  );
  check(
    'compact lock: an unknown location still says so',
    compactHtml.includes('data-lock-reason="location-unknown"'),
  );
  check(
    'compact lock: it is ONE element, not a stacked card',
    (compactHtml.match(/<p[ >]/g) ?? []).length === 0,
    compactHtml.slice(0, 300),
  );
  check(
    'compact lock: it keeps the cockpit row height class',
    compactHtml.includes('min-h-16') && compactHtml.includes('rounded-cockpit'),
    compactHtml.slice(0, 300),
  );
  check(
    'compact lock: and still never offers a passenger declaration',
    !compactHtml.includes('Passenger access'),
  );
  // The same reason, both variants — the policy is one rule with two
  // layouts, not two rules.
  const blockHtml = inProviders(
    createElement(LockGate, { action: 'route-overview', lockedLabel: 'Route overview' }),
  );
  check(
    'compact lock: the block variant reports the identical reason',
    blockHtml.includes('data-lock-reason="location-unknown"'),
  );
  check(
    'compact lock: ...and the block variant is NOT row-shaped',
    blockHtml.includes('rounded-card') && !blockHtml.includes('rounded-cockpit'),
  );
}
// The permission map is where the owner's decision lives, so it is asserted
// directly: editing is permitted at speed, the camera is not, and there is no
// second map that could quietly exempt anything.
{
  const src = strip(readFileSync('src/lib/navigator/actions.ts', 'utf8'));
  check(
    'the setup-window exemption map is GONE, not merely emptied',
    !/SETUP_WINDOW_PERMISSIONS/.test(src) && !/allowedDuringSetupWindow/.test(src),
  );
  for (const action of [
    'edit-destination',
    'edit-truck-profile',
    'add-stop',
    'enter-text',
    'open-deep-settings',
    'view-trip-summary',
  ]) {
    check(`permission map: ${action} is available while moving`, allowedWhileMoving(action));
  }
  for (const action of ['pan-map', 'route-overview', 'change-map-style']) {
    check(`permission map: ${action} stays stationary-only`, !allowedWhileMoving(action));
  }
  const lockSrc = strip(readFileSync('src/lib/navigator/safety-lock.ts', 'utf8'));
  check(
    'setup window: latches shut on the FIRST determination and never re-opens',
    (lockSrc.match(/everDetermined = true/g) ?? []).length === 2 &&
      !/everDetermined = false/.test(lockSrc.replace(/let everDetermined = false/, '')),
  );
  check(
    'the controller can no longer grant anything',
    !/grantOverride/.test(lockSrc) && !/overrideUntilMs/.test(lockSrc),
  );
}

// Allowed-while-moving action renders even in the locked default state.
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'stop-navigation', lockedLabel: 'Stop navigation' },
      createElement('p', null, 'STOP-CONTROL'),
    ),
  );
  check('stop-navigation renders while locked (invariant 7)', html.includes('STOP-CONTROL'));
}

// Unknown action name → default-deny.
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'not-in-the-map', lockedLabel: 'Mystery feature' },
      createElement('p', null, 'MYSTERY'),
    ),
  );
  check('unmapped action is denied by default', !html.includes('MYSTERY'));
}

// Overlay: status as text, aria-live.
{
  const html = inProviders(createElement(MotionLockOverlay));
  check(
    'overlay: aria-live status region',
    html.includes('aria-live="polite"') && html.includes('role="status"'),
  );
  /*
   * The overlay reports what the app can SEE, and no longer what the driver
   * may do — because motion no longer decides what the driver may do. A
   * cold-start render says location checks start when they do.
   */
  check(
    'overlay: cold start says when location checks begin',
    html.includes('Location checks begin when you start'),
  );
  const overlaySrc = readFileSync('src/components/navigator/MotionLockOverlay.tsx', 'utf8');
  check(
    'overlay: it never tells the driver their controls are limited',
    !/controls limited/i.test(strip(overlaySrc)) && !/passenger/i.test(strip(overlaySrc)),
  );
  check(
    'overlay: a parked truck that lost signal is not reported as moving',
    overlaySrc.includes('Parked — location signal lost'),
  );
}

// THE OVERRIDE DIALOG IS GONE — asserted as an absence across the whole tree.
/*
 * This block used to check the dialog's wording, its two-second hold, its
 * pointer-cancel handling and its 64px targets. All of that was correct work
 * on a control the owner has now removed, so the test that replaces it asks
 * the only remaining useful question: can anything in the Navigator still ask
 * a driver to declare they are a passenger?
 */
{
  check(
    'the dialog component no longer exists',
    !readdirSync('src/components/navigator').includes('PassengerOverrideDialog.tsx'),
  );
  const navFiles = readdirSync('src/components/navigator').filter(
    (f) => f.endsWith('.tsx') || f.endsWith('.ts'),
  );
  for (const f of navFiles) {
    /*
     * COMMENTS ARE STRIPPED FIRST, deliberately. Several files explain in
     * prose what passenger access WAS and why it is gone — that history is
     * the most useful thing a future reader can find, and banning the word
     * from comments would delete the explanation along with the feature.
     * What must not survive is the word reaching a DRIVER, which is what the
     * scrubbed source proves.
     */
    const src = strip(readFileSync(join('src/components/navigator', f), 'utf8'));
    check(
      `no passenger vocabulary reaches the screen in ${f}`,
      !/passenger|press[- ]and[- ]hold|I am not the driver/i.test(src),
    );
  }
  const provider = strip(readFileSync('src/components/navigator/SafetyLockProvider.tsx', 'utf8'));
  check('the provider exposes no way to grant an exception', !/grantOverride/.test(provider));
  const gate = strip(readFileSync('src/components/navigator/LockGate.tsx', 'utf8'));
  check(
    'the gate has no hold timer, countdown, or grant path',
    !/setInterval|setTimeout|grantOverride|HOLD_MS/.test(gate),
  );
}

// Provider structure: single evaluate interval, cleanup, no persistence.
{
  const src = strip(readFileSync('src/components/navigator/SafetyLockProvider.tsx', 'utf8'));
  check(
    'provider: 1 Hz evaluation interval',
    /EVALUATE_MS = 1000/.test(
      readFileSync('src/components/navigator/SafetyLockProvider.tsx', 'utf8'),
    ),
  );
  check('provider: interval cleared on unmount', /clearInterval\(tick\)/.test(src));
  check(
    'provider: consumes the ONE GpsProvider (no second watcher)',
    /useGps\(\)/.test(src) && !/watchPosition/.test(src),
  );
  const gateSrc = strip(readFileSync('src/components/navigator/LockGate.tsx', 'utf8'));
  check(
    'gate: consults the shared permission map only (no motion math)',
    /permits\(action\)/.test(gateSrc) && !/speedMph|motion ===/.test(gateSrc),
  );
}

console.log(`safety-gating: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

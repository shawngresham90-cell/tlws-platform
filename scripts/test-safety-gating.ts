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
import { readFileSync } from 'node:fs';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { LockGate } from '@/components/navigator/LockGate';
import { MotionLockOverlay } from '@/components/navigator/MotionLockOverlay';
import { PassengerOverrideDialog, HOLD_MS } from '@/components/navigator/PassengerOverrideDialog';

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
 * Default state (no fix → UNKNOWN). Two regimes since the startup
 * simplification (doc 06 §1a):
 *
 *   - 'edit-destination' is the ONE setup-window action: at a cold start
 *     (motion UNKNOWN since the lock was created, no determination ever
 *     made) it renders, because the simplified flow chooses a
 *     destination BEFORE location exists. The window latches shut on the
 *     first motion determination — the moving-lock case is exercised
 *     with real fixes in test-safety-lock/test-navigator-startup, which
 *     a static render cannot reach.
 *
 *   - every OTHER stationary-only action keeps the plain default-deny:
 *     UNKNOWN is treated as MOVING, children are not rendered, and the
 *     locked copy + passenger path stand. 'edit-truck-profile' proves it
 *     here — deliberately an action absent from SETUP_WINDOW_PERMISSIONS.
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
    'setup window: destination entry renders at a cold start (doc 06 §1a)',
    html.includes('SETUP-WINDOW-CONTENT'),
  );
}
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'edit-truck-profile', lockedLabel: 'Truck profile' },
      createElement('p', null, 'SHOULD-NOT-RENDER'),
    ),
  );
  check(
    'locked action: children NOT rendered under default-deny',
    !html.includes('SHOULD-NOT-RENDER'),
  );
  /*
   * THE COPY CHANGED WITH THE POLICY (Fast Start milestone), and these
   * assertions changed with it rather than being deleted.
   *
   * This render has never had a fix, so motion is UNKNOWN and the lock
   * reason is `location-unknown`. The old screen said "locked while the
   * vehicle is moving … or motion is unknown" and offered a PASSENGER
   * ACCESS button. That is the exact thing the pilot reported: a parked
   * driver asked to declare they are not driving, because the app could
   * not see them.
   *
   * The new rule is narrower and more honest: a passenger override is
   * offered ONLY for confirmed motion. An unknown location says the app
   * cannot see the vehicle, and says nothing about who is driving.
   */
  check(
    'locked action: an unknown location is named as exactly that',
    html.includes("can't confirm this vehicle's location") ||
      html.includes('can&#x27;t confirm this vehicle&#x27;s location'),
    html.slice(0, 400),
  );
  check(
    'locked action: it does NOT claim the vehicle is moving',
    !html.includes('locked while the vehicle is moving'),
  );
  check(
    'locked action: and NEVER offers a passenger declaration to a driver who has not moved',
    !html.includes('Passenger access') && !html.includes('I am not the driver'),
  );
  check(
    'locked action: the reason is machine-readable for the bench',
    html.includes('data-lock-reason="location-unknown"'),
  );
}
// The setup-window map itself stays exactly one action wide: widening it
// is an owner decision this harness makes loud.
{
  const src = strip(readFileSync('src/lib/navigator/actions.ts', 'utf8'));
  const mapBody = /SETUP_WINDOW_PERMISSIONS[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
  const entries = mapBody.split(',').filter((line) => line.includes(':'));
  check(
    'setup window: exactly ONE action is exempt, and it is edit-destination',
    entries.length === 1 && /'edit-destination':\s*true/.test(mapBody),
    mapBody.trim(),
  );
  const lockSrc = strip(readFileSync('src/lib/navigator/safety-lock.ts', 'utf8'));
  check(
    'setup window: latches shut on the FIRST determination and never re-opens',
    (lockSrc.match(/everDetermined = true/g) ?? []).length === 2 &&
      !/everDetermined = false/.test(lockSrc.replace(/let everDetermined = false/, '')),
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
   * A cold-start render is inside the setup window, so the overlay says
   * setup is available — claiming "controls limited" there would be a
   * lie, and claiming "Parked" would invent motion knowledge. The
   * post-determination UNKNOWN label survives in source for the state a
   * static render cannot reach.
   */
  check(
    'overlay: cold start reads as the setup window, honestly',
    html.includes('Trip setup available — motion checks begin when location starts'),
  );
  const overlaySrc = readFileSync('src/components/navigator/MotionLockOverlay.tsx', 'utf8');
  check(
    'overlay: post-determination UNKNOWN still reads as limited controls',
    overlaySrc.includes('Motion unknown — controls limited for safety'),
  );
}

// Override dialog: verbatim architecture wording, hold semantics, targets.
{
  const html = renderToStaticMarkup(
    createElement(PassengerOverrideDialog, {
      actionClass: 'edit-destination',
      onConfirm: () => undefined,
      onCancel: () => undefined,
    }),
  );
  check(
    'dialog: the acknowledgment wording is the architecture document’s, verbatim',
    html.includes('Only a passenger may use this. I am not the driver of this vehicle.'),
  );
  check(
    'dialog: press-and-hold affordance, not a tap',
    html.includes('Press and hold (2 seconds)'),
  );
  check('dialog: role alertdialog with an accessible name', html.includes('role="alertdialog"'));
  check('dialog: cancel path present', html.includes('Cancel passenger access'));
  check('dialog: 64px minimum targets', (html.match(/min-h-16/g) ?? []).length >= 2);
  check('dialog: 2000 ms hold constant', HOLD_MS === 2000);
  const src = strip(readFileSync('src/components/navigator/PassengerOverrideDialog.tsx', 'utf8'));
  check(
    'dialog: hold wired to pointer down/up/leave/CANCEL (a cancelled touch must end the hold)',
    /onPointerDown/.test(src) &&
      /onPointerUp/.test(src) &&
      /onPointerLeave/.test(src) &&
      /onPointerCancel/.test(src),
  );
  check(
    'dialog: keyboard hold (Enter/Space down + up)',
    /onKeyDown/.test(src) && /onKeyUp/.test(src),
  );
  check('dialog: hold timer cleaned up on unmount', /clearInterval/.test(src));
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

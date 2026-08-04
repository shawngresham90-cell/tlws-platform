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

// Default state (no fix → UNKNOWN → locked): stationary-only actions gate.
{
  const html = inProviders(
    createElement(
      LockGate,
      { action: 'edit-destination', lockedLabel: 'Destination entry' },
      createElement('p', null, 'SHOULD-NOT-RENDER'),
    ),
  );
  check(
    'locked action: children NOT rendered under default-deny',
    !html.includes('SHOULD-NOT-RENDER'),
  );
  check(
    'locked action: explains the lock as text',
    html.includes('locked while the vehicle is moving'),
  );
  check('locked action: UNKNOWN motion named honestly', html.includes('or motion is unknown'));
  check(
    'locked action: passenger path offered on attempt only (button present, dialog not)',
    html.includes('Passenger access') && !html.includes('I am not the driver'),
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
  check(
    'overlay: unknown motion reads as limited controls',
    html.includes('Motion unknown — controls limited for safety'),
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
    'dialog: hold wired to pointer down/up/leave',
    /onPointerDown/.test(src) && /onPointerUp/.test(src) && /onPointerLeave/.test(src),
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

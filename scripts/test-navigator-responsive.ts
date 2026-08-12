/**
 * N5 driving screen — responsive/mobile/a11y/flag structural checks plus a
 * static render of the screen's view component in its principal states.
 * The 320 px rule is enforced the way this codebase can honestly enforce
 * it without a browser: no fixed pixel widths, single-column layout
 * primitives, and the same two-column dl the 320px-verified Phase 1
 * status page uses.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-responsive.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-navigator-responsive.cjs && node /tmp/test-navigator-responsive.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import type { DrivingView } from '@/lib/navigator/navigation-controller';

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
const noop = () => undefined;

function render(view: DrivingView, watching = true): string {
  return renderToStaticMarkup(
    createElement(
      GpsProvider,
      null,
      createElement(
        SafetyLockProvider,
        null,
        createElement(DrivingScreenView, { view, watching, onStart: noop, onStop: noop }),
      ),
    ),
  );
}

const baseView: DrivingView = {
  status: 'navigating',
  routeMile: 1.2,
  totalMi: 5,
  remainingMi: 3.8,
  maneuvers: {
    next: {
      action: 'exit',
      instruction: 'Take exit 369 toward Watt Rd',
      direction: null,
      mileMi: 2,
    },
    following: { action: 'arrive', instruction: 'Arrive', direction: null, mileMi: 5 },
    distanceMi: 0.8,
  },
  lastKnown: false,
  speedMph: 61.4,
};

// Principal states render as text.
{
  const html = render(baseView);
  check(
    'navigating: maneuver instruction shown large',
    html.includes('Take exit 369 toward Watt Rd') && html.includes('text-4xl'),
  );
  check('navigating: distance to maneuver', html.includes('In 0.8'));
  check('navigating: then-preview', html.includes('then Arrive'));
  check('navigating: route progress text', html.includes('mile 1.2 of 5.0'));
  check('navigating: distance remaining', html.includes('3.8 mi'));
  check('navigating: speed rendered', html.includes('61 mph'));
  check('navigating: aria-live status', html.includes('aria-live="polite"'));
}
{
  const states: [DrivingView['status'], string][] = [
    ['no-route', 'Route unavailable'],
    ['acquiring', 'Waiting for location permission and first fix'],
    ['denied', 'Location permission denied'],
    ['position-unavailable', 'Location unavailable from this device'],
    ['position-lost', 'Position unknown — showing last known position'],
    ['position-degraded', 'Position approximate'],
    ['arrived', 'Arrived'],
  ];
  for (const [status, text] of states) {
    const html = render({
      ...baseView,
      status,
      maneuvers: status === 'no-route' ? null : baseView.maneuvers,
    });
    check(`state '${status}' rendered as text`, html.includes(text), text);
  }
  const lastKnown = render({ ...baseView, status: 'position-lost', lastKnown: true });
  check("held position labeled '(last known)'", lastKnown.includes('(last known)'));
}

// Mobile / a11y / reduced motion — structural.
{
  const screenSrc = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const src = strip(screenSrc);
  check('64px targets on the driving screen', (screenSrc.match(/min-h-16/g) ?? []).length >= 2);
  check(
    'maneuver text ≥32px (text-4xl) and body ≥20px (text-xl)',
    /text-4xl/.test(screenSrc) && /text-xl/.test(screenSrc),
  );
  check(
    'no text input exists on the driving screen',
    !/<input|<textarea|contentEditable/i.test(src),
  );
  check('no animation classes (reduced-motion safe)', !/animate-/.test(src));
  check('no fixed pixel widths (320 px safe)', !/w-\[\d+px\]|min-w-\[\d+px\]/.test(src));
  check('two-column dl matches the 320px-verified Phase 1 pattern', /grid-cols-2/.test(screenSrc));
  const html = render(baseView);
  check(
    'both controls carry accessible names starting with visible text',
    html.includes('aria-label="Stop navigation and discard position"'),
  );
  const idle = render(baseView, false);
  check(
    'idle: enable-location accessible name',
    idle.includes('aria-label="Enable location and start the driving preview"'),
  );
}

// Flag + reachability: 404 by default, no menu/sitemap presence.
{
  const page = readFileSync('src/app/(navigator)/drive/page.tsx', 'utf8');
  check(
    'drive page: opt-in flag, default OFF',
    page.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'"),
  );
  check('drive page: 404 when the flag is off', page.includes('if (!ENABLED) notFound()'));
  check('drive page: noindex', page.includes('noindex: true'));
  check('drive page: says it is not turn-by-turn', page.includes('not turn-by-turn navigation'));
  const sitemap = readFileSync('src/app/sitemap.ts', 'utf8');
  check('sitemap has no /drive entry', !/\/drive/.test(sitemap));
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  for (const f of readdirSync('src/components/layout').filter((x: string) => x.endsWith('.tsx'))) {
    const nav = readFileSync(`src/components/layout/${f}`, 'utf8');
    check(`no nav entry in ${f}`, !nav.includes('/drive'));
  }
}

// Privacy bans on every NEW component (same bans Phase 1 enforces).
{
  for (const f of [
    'SafetyLockProvider.tsx',
    'LockGate.tsx',
    'MotionLockOverlay.tsx',
    'PassengerOverrideDialog.tsx',
    'DrivingScreen.tsx',
  ]) {
    const src = strip(readFileSync(`src/components/navigator/${f}`, 'utf8'));
    // Trip restore (pilot round 3, item 4): the driving screen's one
    // sanctioned storage path — the planned ROUTE in sessionStorage,
    // discipline pinned in test-navigator-trip-restore. Sanctioned call
    // shapes scrubbed; every other banned token stands.
    const scrubbed =
      f === 'DrivingScreen.tsx'
        ? src
            .replace(/sessionStorage\s*\.\s*(getItem|setItem|removeItem)\s*\(/g, 'TRIP_RESTORE_(')
            .replace(/typeof sessionStorage/g, 'TRIP_RESTORE_GUARD')
        : src;
    check(
      `privacy ${f}: no console/fetch/storage/analytics`,
      !/console\s*\.\s*(log|info|warn|error|debug)|\bfetch\s*\(|localStorage|sessionStorage|indexedDB|analytics|plausible/i.test(
        scrubbed,
      ),
    );
  }
}

console.log(`navigator-responsive: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * Navigator Phase 1 UI harness: the GpsProvider (single watchPosition
 * owner) and the flag-gated position-preview surface. Static renders via
 * react-dom/server (no DOM, no browser) plus structural source assertions
 * for the invariants a static render cannot reach: single-watch ownership,
 * unmount cleanup, the privacy bans, the opt-in flag gate, and the
 * untouched PWA policy.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-ui.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:next/link=./scripts/shims/next-link.tsx \
 *     --outfile=/tmp/test-navigator-ui.cjs && node /tmp/test-navigator-ui.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NavigatorStatusView } from '@/components/navigator/NavigatorStatus';
import type { PositionHealth, PositionState } from '@/lib/navigator/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 160)}`}`);
  }
}

const noop = () => undefined;
const state = (over: Partial<PositionState> = {}): PositionState => ({
  fix: {
    lat: 35.1234567,
    lng: -84.7654321,
    accuracyM: 8,
    tMs: 1_754_000_000_000,
    speedMph: 61.2,
    headingDeg: 2.4,
  },
  health: 'good',
  lastFixMs: 1_754_000_000_000,
  accuracyM: 8,
  speedMph: 61.2,
  headingDeg: 2.4,
  deadReckoning: false,
  ...over,
});

function render(props: {
  position: PositionState;
  watching: boolean;
  supported: boolean;
  acquiring?: boolean;
}): string {
  return renderToStaticMarkup(
    createElement(NavigatorStatusView, {
      acquiring: false,
      ...props,
      onStart: noop,
      onStop: noop,
    }),
  );
}

// ------------------------------------------------------------ idle state
{
  const html = render({
    position: state({ fix: null, health: 'unavailable' }),
    watching: false,
    supported: true,
  });
  check(
    'idle: explains before asking (permission on user action only)',
    html.includes('asks your browser for location permission'),
  );
  check('idle: privacy promise in plain words', html.includes('never saved'));
  check(
    'idle: enable button with aria-label',
    html.includes('aria-label="Enable location and start the position preview"'),
  );
  check('idle: no coordinates rendered', !html.includes('35.12'));
}

// ------------------------------------------------------- unsupported state
{
  const html = render({ position: state({ fix: null }), watching: false, supported: false });
  check(
    'unsupported: explains as status text',
    html.includes('role="status"') && html.includes('does not expose location services'),
  );
  check('unsupported: no enable button offered', !html.includes('Enable location'));
}

// ---------------------------------------------------------- watching states
{
  const html = render({ position: state(), watching: true, supported: true });
  check(
    'watching: health announced via aria-live status',
    html.includes('aria-live="polite"') && html.includes('role="status"'),
  );
  check('watching: health as TEXT (never color alone)', html.includes('Good fix'));
  check('watching: coordinates displayed for the driver', html.includes('35.1235, -84.7654'));
  check('watching: coordinates rounded to 4 dp on screen', !html.includes('35.1234567'));
  check('watching: speed and heading rendered', html.includes('61 mph') && html.includes('2°'));
  check(
    'watching: accuracy rendered in FEET (US driver UI, pilot round 1)',
    html.includes('±30 ft'),
  );
  check(
    'watching: stop button accessible name STARTS with its visible text (WCAG 2.5.3)',
    html.includes('aria-label="Stop preview and discard position"'),
  );
}
{
  const labels: [PositionHealth, string][] = [
    ['degraded', 'Position approximate'],
    ['lost', 'Position unknown'],
    ['denied', 'Location permission denied'],
  ];
  for (const [health, text] of labels) {
    const html = render({ position: state({ health }), watching: true, supported: true });
    check(`watching: '${health}' rendered as text`, html.includes(text));
  }
  const unavailableHeld = render({
    position: state({ health: 'unavailable' }),
    watching: true,
    supported: true,
  });
  check(
    "watching: 'unavailable' with a held fix rendered as text",
    unavailableHeld.includes('Location unavailable'),
  );
  check(
    "watching: 'unavailable' fix also labeled '(last known)' — never silently current",
    unavailableHeld.includes('(last known)'),
  );
  const lost = render({ position: state({ health: 'lost' }), watching: true, supported: true });
  check(
    "watching: lost fix labeled '(last known)' — never silently current",
    lost.includes('(last known)'),
  );
  // Audit fix: denial tears the watch down, so the recovery path renders in
  // the IDLE branch, right next to the Enable button it refers to.
  const deniedIdle = render({
    position: state({ health: 'denied', fix: null }),
    watching: false,
    supported: true,
  });
  check('denied (idle): status announced', deniedIdle.includes('Location permission denied'));
  check(
    'denied (idle): recovery path explained NEXT TO a real Enable button',
    deniedIdle.includes('Re-allow location') && deniedIdle.includes('Enable location'),
  );
  // Audit fix + critic fix: acquisition is PROVIDER state (first response
  // not yet received), so a pending permission prompt reads as waiting —
  // while a genuine POSITION_UNAVAILABLE (OS location off) is NOT masked.
  const noFix = render({
    position: state({ fix: null, health: 'unavailable', speedMph: null, headingDeg: null }),
    watching: true,
    supported: true,
    acquiring: true,
  });
  check(
    'watching: pre-first-response presented as acquiring, not as an error',
    noFix.includes('Waiting for location permission and first fix') &&
      !noFix.includes('Location unavailable'),
  );
  check(
    'watching: pre-first-fix placeholders',
    noFix.includes('Waiting for first fix') && noFix.includes('Needs two fixes'),
  );
  const realUnavailable = render({
    position: state({ fix: null, health: 'unavailable', speedMph: null, headingDeg: null }),
    watching: true,
    supported: true,
    acquiring: false,
  });
  check(
    'watching: a REAL unavailable error (post-first-response) is never masked as acquiring',
    realUnavailable.includes('Location unavailable') &&
      !realUnavailable.includes('Waiting for location permission'),
  );
}

// ------------------------------------------------------ structural: provider
const provider = readFileSync('src/components/navigator/GpsProvider.tsx', 'utf8');
{
  check('provider: client component', provider.startsWith("'use client'"));
  check(
    'provider: exactly one watchPosition callsite',
    (provider.match(/watchPosition\(/g) ?? []).length === 1,
  );
  check('provider: clearWatch wired into the cancel', provider.includes('clearWatch'));
  check(
    'provider: unmount cleanup stops the watch',
    /useEffect\(\(\) => stop, \[stop\]\)/.test(provider),
  );
  check(
    'provider: watch options match the architecture package',
    provider.includes('maximumAgeMs: 1000') &&
      provider.includes('timeoutMs: 15_000') &&
      provider.includes('enableHighAccuracy: true'),
  );
  check(
    'provider: start guards against a second watch',
    provider.includes('if (activeRef.current) return'),
  );
  check('provider: staleness tick cleared on stop', provider.includes('clearInterval'));
  check(
    'provider: denial tears the dead watch down (audit fix)',
    /denied[\s\S]{0,400}teardown\(\);[\s\S]{0,80}setWatching\(false\)/.test(provider),
  );
  check(
    'provider: callbacks guarded against contract-violating ports',
    (provider.match(/if \(!activeRef\.current\) return;/g) ?? []).length === 2,
  );
  check(
    'provider: permission errors normalized (denied/timeout/unavailable)',
    provider.includes("'denied'") &&
      provider.includes("'timeout'") &&
      provider.includes("'unavailable'"),
  );
}

// -------------------------------------------- structural: privacy (AD-7)
{
  const dir = 'src/components/navigator';
  for (const f of readdirSync(dir)) {
    // Comments may TALK about the bans ("never sent to analytics"); only
    // code may not touch them.
    const src = readFileSync(join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    check(
      `privacy ${f}: no console logging at all`,
      !/console\s*\.\s*(log|info|warn|error|debug)/.test(src),
    );
    // Storage is sanctioned by MODULE KIND, the same way the network
    // carve-out below is, so the surface that can persist anything stays
    // small, named and reviewable:
    //
    //   DrivingScreen.tsx     — the trip snapshot (pilot round 3, item 4)
    //                           under its own versioned key;
    //   *-storage.ts          — a record module whose whole job is one
    //                           versioned key, its envelope and its
    //                           parsing, so two screens reading the same
    //                           record cannot disagree about it.
    //
    // Since the pre-trip setup milestone the actual browser APIs live in
    // exactly ONE of those modules — `versioned-storage.ts` — and the
    // rest (driver, truck, clocks, region) call through it. That is what
    // makes "corrupt clocks must not destroy a valid truck" structural
    // rather than promised: three records, three parsers, one try/catch
    // that cannot span them. The pin below enforces that concentration.
    //
    // Everything stored is a route, a preference, a verified truck, a
    // first name the driver typed, or four integers of clock time. Never
    // a position, never a position trail, never a searched address, never
    // a credential. Their own harnesses (test-navigator-trip-restore,
    // test-navigator-canada, test-navigator-pretrip) pin which keys exist
    // and what may go in them; here the sanctioned call shapes are
    // scrubbed and every other storage token stays banned.
    /*
     * NavigatorSettings.tsx joins the sanctioned list (NAV-ENTRY-1): it READS
     * the trip snapshot, through the same parser the driving screen uses, to
     * decide whether a routing edit needs the "applies to your next route"
     * notice. It never writes or clears it — the settings route has no
     * lifecycle at all, which is what makes "opening Settings mid-trip cannot
     * destroy the trip" a fact about the file rather than a promise.
     */
    const storageSanctioned =
      f === 'DrivingScreen.tsx' || f === 'NavigatorSettings.tsx' || /-storage\.ts$/.test(f);
    const scrubbed = storageSanctioned
      ? src
          .replace(
            /(session|local)Storage\s*\.\s*(getItem|setItem|removeItem)\s*\(/g,
            'SANCTIONED_KEY_(',
          )
          .replace(/typeof (session|local)Storage/g, 'SANCTIONED_KEY_GUARD')
      : src;
    check(
      `privacy ${f}: no storage APIs`,
      !/localStorage|sessionStorage|indexedDB/i.test(scrubbed),
    );
    check(
      `privacy ${f}: no analytics import (no coordinate leakage path)`,
      !/analytics|trackEvent|plausible/i.test(src),
    );
    // The network carve-out is by MODULE KIND, not by file name: only
    // `*-port.ts` modules may reach outside the component layer, so the
    // surface that can send anything stays small, named, and reviewable,
    // and every COMPONENT stays fetch-free.
    //
    // Ports come in two kinds, and conflating them is how a rail rots:
    //
    //   NETWORK ports transmit. They must talk ONLY to first-party,
    //   flag-gated /api/navigator endpoints, and never to an absolute
    //   URL:
    //     route-port.ts  — the driver-initiated route request (N8a)
    //     search-port.ts — destination search (pilot round 1); sends the
    //                      typed query and the truck position, because
    //                      results must be biased to where the truck is
    //
    //   DEVICE ports touch a browser capability and transmit NOTHING:
    //     speech-port.ts — browser speech synthesis (N7), output only
    //
    // The kind is decided by what the module DOES (does it call fetch?),
    // not by its name, because a name cannot be verified. A device port
    // is then held to the same fetch-free standard as a component — so
    // the day someone adds a request to speech-port.ts, this fails.
    // Endpoint exclusivity is additionally pinned in
    // test-navigator-pilot.ts, and `speechSynthesis` is pinned to
    // speech-port.ts alone in test-safety-invariants.ts.
    const isPort = /-port\.ts$/.test(f);
    const transmits = /\bfetch\s*\(/.test(src);
    if (!isPort) {
      check(`privacy ${f}: no fetch in a COMPONENT (transmission lives in ports only)`, !transmits);
    } else if (transmits) {
      check(
        `privacy ${f}: fetch aimed only at a first-party /api/navigator endpoint`,
        /['"`]\/api\/navigator\//.test(src) && !/https?:\/\//.test(src),
      );
    } else {
      // A DEVICE port earns no network budget just by being named a port.
      check(
        `privacy ${f}: device port transmits nothing (no fetch, no remote URL)`,
        !transmits && !/https?:\/\//.test(src) && !/XMLHttpRequest|WebSocket|EventSource/.test(src),
      );
    }
    if (isPort) {
      check(
        `privacy ${f}: transmits nothing beyond the request (no storage, no forwarding)`,
        !/localStorage|sessionStorage|indexedDB|navigator\.sendBeacon/i.test(src),
      );
    }
    check(
      `motion ${f}: no animation classes (reduced-motion safe by construction)`,
      !/animate-/.test(src),
    );
  }
}

// ------------------------------------------------- structural: page + flag
{
  const page = readFileSync('src/app/(navigator)/navigator/page.tsx', 'utf8');
  check(
    'page: opt-in flag, default OFF',
    page.includes("process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED === 'true'"),
  );
  check('page: 404 when the flag is off', page.includes('if (!ENABLED) notFound()'));
  check('page: noindex while a preview', page.includes('noindex: true'));
  check(
    'page: says what it is not (no turn-by-turn, no offline routing)',
    page.includes('not turn-by-turn navigation'),
  );
}

// ------------------------------------- structural: nothing else touched
{
  const layoutFiles = readdirSync('src/components/layout').filter((f) => f.endsWith('.tsx'));
  for (const f of layoutFiles) {
    const src = readFileSync(join('src/components/layout', f), 'utf8');
    check(`no nav entry: ${f}`, !src.includes('/navigator'));
  }
  const sw = readFileSync('public/sw.js', 'utf8');
  check('sw.js untouched by Phase 1 (no navigator special-casing)', !sw.includes('/navigator'));
  const policy = readFileSync('src/lib/pwa/route-policy.ts', 'utf8');
  check('route-policy untouched by Phase 1', !policy.includes('navigator'));
}

console.log(`navigator-ui: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

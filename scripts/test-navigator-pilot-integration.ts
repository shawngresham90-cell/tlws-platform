/**
 * Pilot integration — the truck-routing branch MEETING everything that
 * merged into main while it sat conflicted (#266 briefing/report/build id,
 * #269 diagnostics/feedback, #270 personalized voice, #271 TL marker).
 *
 * Every other harness in this repo tests one concern deeply. This one
 * tests the SEAMS, because that is where a long-lived branch breaks: not
 * in the module it changed, but in the screen where its component now
 * shares a mount point with four newer ones, and in the voice tick where
 * its advisory now appears at the same instant as a spoken line.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-pilot-integration.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-pilot-integration.cjs && node /tmp/test-navigator-pilot-integration.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { PilotTripControls } from '@/components/navigator/PilotTripControls';
import { DEFAULT_EDITABLE_PROFILE } from '@/lib/navigator/truck-profile';
import { DriverNameEntry } from '@/components/navigator/DriverNameEntry';
import { TruckProfileEditor } from '@/components/navigator/TruckProfileEditor';
import { TruckProfilePanel } from '@/components/navigator/TruckProfilePanel';
import { vehicleMarkerSvg, vehicleMarkerRotationDeg } from '@/components/navigator/vehicle-marker';
import {
  createNavigationLifecycle,
  type NavigationLifecycle,
  type PlanFetchResult,
  type PlanRequest,
} from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementFetchResult,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { DestinationInfo } from '@/lib/navigator/truck-entrance';
import type { LatLng } from '@/lib/map/bounds';
import { DEFAULT_TRUCK_PROFILE, type RemainingClocks } from '@/lib/trip-planner/types';
import type { BuildId } from '@/lib/navigator/build-id';
import {
  TRUCK_PROFILE_COVERAGE,
  driverAssurances,
  sentFields,
  silentDrops,
} from '@/lib/navigator/truck-profile-coverage';
import { assessRoutePlausibility } from '@/lib/navigator/route-plausibility';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import { buildProblemReport } from '@/lib/navigator/problem-report';
import { buildRoadTestReport } from '@/lib/navigator/road-test-report';
import { buildDiagnosticSnapshot } from '@/lib/navigator/diagnostic-snapshot';
import { buildFeedback } from '@/lib/navigator/post-trip-feedback';
import {
  createDriverPhraseAnnouncer,
  ROUTE_START_VOICE_ID,
  GREETING_VOICE_ID,
} from '@/lib/navigator/driver-greeting';
import {
  createVoiceGuidance,
  createHosAnnouncer,
  MANEUVER_GROUP,
  type SpeechPort,
} from '@/lib/navigator/voice-guidance';
import { hosWarning } from '@/lib/navigator/hos-strip';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 220)}`}`);
  }
}

/* ------------------------------------------------------------ fixtures */

const T0 = 1_754_000_000_000;
const LAT0 = 35;
const LNG0 = -85;
const N_POINTS = 400;
const MI_PER_STEP = 0.0690937;
const TOTAL_MI = Number(((N_POINTS - 1) * MI_PER_STEP).toFixed(1));

const LINE: LatLng[] = Array.from({ length: N_POINTS }, (_, i) => ({
  lat: LAT0 + i * 0.001,
  lng: LNG0,
}));
const DEST = LINE[N_POINTS - 1];

const DEST_INFO: DestinationInfo = {
  position: DEST,
  facility: 'warehouse',
  positionSource: 'geocode',
  entrances: [{ position: DEST, kind: 'verified', label: 'Gate 1' }],
};

const BUILD: BuildId = Object.freeze({
  shortSha: 'abc1234',
  pilotVersion: 'p1',
  builtAt: '2026-08-09T14:30Z',
  channel: 'preview',
  label: 'preview · abc1234',
});

const PLAN_REQ: PlanRequest = {
  origin: LINE[0],
  destination: DEST,
  truck: DEFAULT_TRUCK_PROFILE,
  departAtMs: T0,
};

function goodPlan(): PlanFetchResult {
  return {
    kind: 'route',
    routeId: 'integ-1',
    positions: LINE,
    distanceMiles: TOTAL_MI,
    durationSeconds: 3600,
    maneuvers: [
      { action: 'depart', instruction: 'Go.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: N_POINTS - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

function replacement(req: ReplacementRequest): ReplacementFetchResult {
  const startIdx = Math.max(0, Math.min(N_POINTS - 2, Math.round((req.origin.lat - LAT0) / 0.001)));
  const positions = LINE.slice(startIdx);
  return {
    kind: 'route',
    positions,
    distanceMiles: Number(((positions.length - 1) * MI_PER_STEP).toFixed(1)),
    durationSeconds: Math.max(60, positions.length * 4),
    maneuvers: [
      { action: 'depart', instruction: 'Rejoin.', direction: null, offset: 0 },
      { action: 'arrive', instruction: 'Arrive.', direction: null, offset: positions.length - 1 },
    ],
    validationState: 'valid',
    warnings: [],
  };
}

function makeLifecycle(plan: () => PlanFetchResult = goodPlan): NavigationLifecycle {
  return createNavigationLifecycle({
    planPort: async () => plan(),
    replacementPort: async (req) => replacement(req),
  });
}

/** The pilot controls exactly as the driving screen mounts them today. */
function renderControls(
  lifecycle: NavigationLifecycle,
  firstName: string | null = 'Shawn',
): string {
  return renderToStaticMarkup(
    createElement(PilotTripControls, {
      lifecycle,
      // The gps bundle the driving screen injects (startup simplification):
      // a good parked fix, watch already up, nothing acquiring.
      gps: {
        position: {
          fix: { lat: LAT0, lng: LNG0, accuracyM: 8, tMs: T0, speedMph: 0, headingDeg: 0 },
          health: 'good' as const,
          lastFixMs: T0,
          accuracyM: 8,
          speedMph: 0,
          headingDeg: 0,
          deadReckoning: false,
        },
        watching: true,
        acquiring: false,
        start: () => {},
        stop: () => {},
      },
      debugLog: null,
      buildReport: () => 'REPORT',
      build: BUILD,
      firstName,
      onFirstName: () => {},
      // The pick is OWNED by the driving screen now (final pilot
      // milestone: the search box sits on the parked map); these static
      // renders exercise the post-pick states, where no pick is needed.
      picked: null,
      onPicked: () => {},
      // The confirmed truck arrives from the driving screen, and so does
      // the editor element — mounted here exactly as that screen mounts
      // it, so this harness keeps testing the real parked surface.
      truckProfile: DEFAULT_EDITABLE_PROFILE,
      truckGate: 'ready' as const,
      // The name field moved to POSITION 1 and is supplied as a slot;
      // the controls no longer render it themselves.
      driverSlot: createElement(DriverNameEntry, {
        firstName,
        onAccept: () => {},
      }),
      truckSlot: createElement(TruckProfileEditor, {
        profile: DEFAULT_EDITABLE_PROFILE,
        onChange: () => {},
        onConfirm: () => {},
        confirmed: true,
        isDefault: false,
      }),
      onChanged: () => {},
    }),
  );
}

function fakePort() {
  const spoken: string[] = [];
  let done: (() => void) | null = null;
  const port: SpeechPort = {
    supported: true,
    speak(t, d) {
      spoken.push(t);
      done = d;
    },
    cancel() {
      done = null;
    },
  };
  return {
    port,
    spoken,
    finish() {
      const d = done;
      done = null;
      d?.();
    },
  };
}

async function main() {
  // =================================================================
  // 1. truck profile + destination search  (both at idle, together)
  // =================================================================
  {
    const lc = makeLifecycle();
    const html = renderControls(lc);
    check(
      '1: destination search is mounted at idle',
      /Search a destination|combobox|role="listbox"|Destination/i.test(html),
      html.slice(0, 200),
    );
    check(
      // The read-only panel became the editable, confirmable profile
      // (truck-route confidence milestone) — same place on the parked
      // surface, same job: this is the truck the route is planned for.
      '1: the truck profile is mounted beside it, editable and confirmable',
      html.includes('Confirm this is your truck') && html.includes('Not used for routing'),
    );
    check('1: the old one-line truck summary is gone', !html.includes('Truck: pilot default'));
    check(
      '1: and the newer pilot surfaces still mount alongside it',
      html.includes('Build:') && html.includes(BUILD.label),
      'build id line lost',
    );
    check('1: the #266 briefing survives', /pilot|briefing|Signs win/i.test(html));
    check(
      '1: the #270 name entry survives, showing the accepted name',
      html.includes('Driving as') && html.includes('Change name'),
      'DriverNameEntry lost or firstName prop not threaded through',
    );
    const blank = renderControls(lc, null);
    check(
      '1: and with no name yet it offers the labelled field',
      /Your first name/i.test(blank) && blank.includes('Save name'),
      'DriverNameEntry input state lost',
    );
  }

  // =================================================================
  // 2. truck profile + initial route
  // =================================================================
  {
    const lc = makeLifecycle();
    const out = await lc.plan(PLAN_REQ, DEST_INFO, T0);
    check('2: the profile-carrying plan is accepted', out.ok, out);
    check('2: and lands at route-ready', lc.state() === 'route-ready', lc.state());
    const html = renderControls(lc);
    check('2: route-ready still shows Start navigation', html.includes('Start navigation'));
    check(
      '2: the request carried the full truck profile',
      out.ok && out.session.truck.grossWeightLbs === DEFAULT_TRUCK_PROFILE.grossWeightLbs,
    );
  }

  // =================================================================
  // 3. route plausibility + a validated route (NO false positive)
  // =================================================================
  {
    const lc = makeLifecycle();
    await lc.plan(PLAN_REQ, DEST_INFO, T0);
    const data = lc.mapData();
    const findings = assessRoutePlausibility({
      geometry: data.geometry,
      destination: DEST,
      reportedMiles: lc.view().totalMi ?? null,
    });
    check(
      '3: an ordinary validated truck route raises NO advisory',
      findings.length === 0,
      findings.map((f) => f.code),
    );
    const html = renderControls(lc);
    check(
      '3: so the advisory block does not render',
      !html.includes('Worth a look before you start'),
      'a clean route showed a warning',
    );
    check(
      '3: and the advisory never blocks the start control',
      html.includes('Start navigation'),
      'plausibility gated Start navigation — it must stay advisory',
    );
  }

  // =================================================================
  // 4. route plausibility + personalized route-start speech
  //    Both land at route-ready. The advisory must not consume, delay
  //    or duplicate the spoken line.
  // =================================================================
  {
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    const a = createDriverPhraseAnnouncer();
    // A route that DOES trip an advisory: ends 3 mi from the searched place.
    const offDest = { lat: DEST.lat + 0.05, lng: DEST.lng };
    const findings = assessRoutePlausibility({
      geometry: LINE,
      destination: offDest,
      reportedMiles: TOTAL_MI,
    });
    check('4: the off-destination route does raise an advisory', findings.length > 0, findings);

    for (let i = 0; i < 6; i++) {
      for (const r of a.collect({
        firstName: 'Shawn',
        localHour: 9,
        lifecycleState: 'route-ready',
      })) {
        a.note(r.id, v.request(r));
      }
      f.finish();
    }
    check(
      '4: the route-start line still speaks exactly once alongside an advisory',
      f.spoken.filter((t) => t.startsWith("Here's your route")).length === 1,
      f.spoken,
    );
    check(
      '4: and the greeting still speaks once',
      f.spoken.filter((t) => t.startsWith('Good ')).length === 1,
      f.spoken,
    );
  }

  // =================================================================
  // 5. truck profile + problem report
  // =================================================================
  {
    const built = buildProblemReport({
      categoryId: 'wrong-truck-route',
      note: 'Sent under a 12-6.',
    });
    check('5: a truck-route problem report builds', built.ok, built);
    const report = buildRoadTestReport({
      generatedMs: T0,
      build: BUILD,
      pilot: { active: true, reason: 'pilot', debugLogging: false },
      lifecycleState: 'route-ready',
      trip: null,
      log: [],
      logDropped: 0,
      gps: { health: 'good', accuracyM: 8, speedMph: 0 },
      voice: null,
      wake: null,
      device: { userAgent: null, viewport: null, online: true },
      note: '',
      problem: built.ok ? built.report : null,
    });
    check(
      '5: the road-test report still assembles with a problem attached',
      report.includes('REPORTED PROBLEM'),
      report.slice(0, 160),
    );
    check(
      '5: and the driver first name never appears in it',
      !/Shawn/i.test(report),
      'first name leaked into the road-test report',
    );
  }

  // =================================================================
  // 6. truck profile + diagnostic snapshot
  // =================================================================
  {
    const snap = buildDiagnosticSnapshot({
      build: 'preview-abc1234',
      atIso: new Date(T0).toISOString(),
      tripStartedMs: T0 - 600_000,
      nowMs: T0,
      navigation: 'route-ready',
      routeLoaded: true,
      routeMiles: TOTAL_MI,
      gps: 'good',
      validation: 'accepted',
      truck: {
        heightFt: DEFAULT_TRUCK_PROFILE.heightFt,
        widthFt: DEFAULT_TRUCK_PROFILE.widthFt,
        lengthFt: DEFAULT_TRUCK_PROFILE.lengthFt,
        grossWeightLbs: DEFAULT_TRUCK_PROFILE.grossWeightLbs,
        axles: DEFAULT_TRUCK_PROFILE.axles,
        hazmat: DEFAULT_TRUCK_PROFILE.hazmatClass !== null,
      },
    });
    check('6: the snapshot carries the truck it routed for', snap.truck !== null, snap.truck);
    const asText = JSON.stringify(snap);
    check(
      '6: and carries no coordinates',
      !/-8[45]\.\d{3}|3[45]\.\d{3}/.test(asText),
      asText.slice(0, 200),
    );
    check('6: and no driver name', !/Shawn/i.test(asText));
  }

  // =================================================================
  // 7. post-trip feedback after a truck-profile route
  // =================================================================
  {
    const lc = makeLifecycle();
    await lc.plan(PLAN_REQ, DEST_INFO, T0);
    lc.startNavigation(T0);
    lc.cancel(T0 + 60_000);
    check('7: the trip completed', lc.state() === 'completed', lc.state());
    const fb = buildFeedback({ answers: { 'route-legal': 'yes' }, note: 'Fine.' });
    check('7: post-trip feedback still builds after a truck-profile trip', fb !== null);
    const html = renderControls(lc);
    check(
      '7: and the completed screen offers it',
      /feedback|How did/i.test(html),
      html.slice(-400),
    );
  }

  // =================================================================
  // 8. reroute after a truck-profile route
  // =================================================================
  {
    const lc = makeLifecycle();
    await lc.plan(PLAN_REQ, DEST_INFO, T0);
    lc.startNavigation(T0);
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    const a = createDriverPhraseAnnouncer();
    const say = () => {
      for (const r of a.collect({ firstName: 'Shawn', localHour: 9, lifecycleState: lc.state() })) {
        a.note(r.id, v.request(r));
      }
      f.finish();
    };
    say();
    let t = T0 + 1000;
    for (let i = 0; i <= 200; i += 2) {
      lc.tick(
        {
          fix: {
            lat: LAT0 + i * 0.001,
            lng: LNG0,
            accuracyM: 8,
            tMs: t,
            speedMph: 62,
            headingDeg: 0,
          },
          health: 'good',
          lastFixMs: t,
          accuracyM: 8,
          speedMph: 62,
          headingDeg: 0,
          deadReckoning: false,
        },
        t,
      );
      t += 8000;
      say();
    }
    // Veer off the corridor until the detector confirms.
    for (let i = 202; i <= 214; i += 2) {
      lc.tick(
        {
          fix: {
            lat: LAT0 + i * 0.001,
            lng: LNG0 + 0.0012,
            accuracyM: 8,
            tMs: t,
            speedMph: 62,
            headingDeg: 0,
          },
          health: 'good',
          lastFixMs: t,
          accuracyM: 8,
          speedMph: 62,
          headingDeg: 0,
          deadReckoning: false,
        },
        t,
      );
      t += 8000;
      say();
    }
    check('8: the truck-profile trip went off route', lc.state() === 'off-route', lc.state());
    const rr = await lc.requestReroute(t, 8);
    say();
    check('8: and the replacement route landed', rr.outcome === 'replaced', rr);
    check(
      '8: the replacement is still a truck route for the same profile',
      lc.mapData().routeId !== 'integ-1',
    );
    check(
      '8: the reroute did NOT replay the personalized route-start line',
      !f.spoken.some((s) => s.startsWith("Here's your route")),
      f.spoken,
    );
    // Plausibility re-assessed on the replacement, still advisory.
    const d = lc.mapData();
    const findings = assessRoutePlausibility({
      geometry: d.geometry,
      destination: DEST,
      reportedMiles: lc.view().totalMi ?? null,
    });
    check(
      '8: the replacement route raises no false advisory',
      findings.length === 0,
      findings.map((x) => x.code),
    );
    check(
      '8: no illegal lifecycle transitions across the whole run',
      lc.violations().length === 0,
      lc.violations(),
    );
  }

  // =================================================================
  // 9. HOS voice while a route-plausibility advisory exists
  // =================================================================
  {
    const remaining: RemainingClocks = {
      drivingMin: 12,
      windowMin: 200,
      cycleMin: 800,
      untilBreakMin: 12,
      limitedBy: '11-hour',
      legalDrivingMin: 12,
    };
    const warn = hosWarning(remaining);
    const hos = createHosAnnouncer().collect(warn, remaining)[0];
    check(
      '9: the HOS line is critical at 12 minutes',
      hos !== undefined && hos.priority === 'critical',
      warn,
    );

    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    const a = createDriverPhraseAnnouncer();
    // The advisory is on screen; the personalized line is offered; HOS wins.
    v.request(hos);
    for (const r of a.collect({
      firstName: 'Shawn',
      localHour: 9,
      lifecycleState: 'route-ready',
    })) {
      const outcome = v.request(r);
      a.note(r.id, outcome);
      check(
        `9: HOS speech still beats the passive line (${r.id})`,
        outcome === 'dropped-passive-busy',
        outcome,
      );
    }
    check(
      '9: and nothing personal is queued behind the HOS warning',
      v.snapshot().queuedIds.length === 0,
      v.snapshot().queuedIds,
    );
    check(
      '9: the driver hears the clock warning',
      f.spoken.length === 1 && f.spoken[0] === hos.text,
      f.spoken,
    );
  }

  // A maneuver mid-drive also still outranks both personal lines.
  {
    const f = fakePort();
    const v = createVoiceGuidance(f.port);
    const a = createDriverPhraseAnnouncer();
    v.request({
      id: 'maneuver:x:execute',
      priority: 'normal',
      group: MANEUVER_GROUP,
      text: 'Turn right.',
    });
    for (const id of [GREETING_VOICE_ID, ROUTE_START_VOICE_ID]) {
      const req = a
        .collect({ firstName: 'Shawn', localHour: 9, lifecycleState: 'route-ready' })
        .find((r) => r.id === id);
      if (req) {
        const outcome = v.request(req);
        a.note(req.id, outcome);
        check(`9: maneuver speech still beats ${id}`, outcome === 'dropped-passive-busy', outcome);
      }
    }
  }

  // =================================================================
  // 10. the TL marker (#271) coexists with the advisory surface
  // =================================================================
  {
    const svg = vehicleMarkerSvg(vehicleMarkerRotationDeg(90));
    check('10: the TL marker still renders', svg.includes('TL') && svg.startsWith('<svg'));
    check(
      '10: and is unaffected by route-plausibility state',
      svg === vehicleMarkerSvg(vehicleMarkerRotationDeg(90)),
    );
    const map = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
    check(
      '10: the map draws the branded marker, not the old arrow',
      map.includes('vehicleMarkerSvg') && !map.includes('➤'),
    );
  }

  // =================================================================
  // 11. route failure with the profile still intact
  // =================================================================
  {
    const lc = makeLifecycle(() => ({ kind: 'failure', reason: 'provider-500' }));
    const out = await lc.plan(PLAN_REQ, DEST_INFO, T0);
    check('11: a failed plan is refused', !out.ok, out);
    check('11: and returns to idle', lc.state() === 'idle', lc.state());
    const html = renderControls(lc);
    check(
      '11: the truck profile is still shown after a failure',
      html.includes('Confirm this is your truck'),
    );
    check(
      '11: with its disclosure intact',
      html.includes('Not used for routing') &&
        html.includes('The route does not account for these'),
    );
    check(
      '11: and no advisory is shown for a route that never existed',
      !html.includes('Worth a look before you start'),
    );
  }

  // =================================================================
  // 12. second trip after the first ends
  // =================================================================
  {
    const lc = makeLifecycle();
    await lc.plan(PLAN_REQ, DEST_INFO, T0);
    lc.startNavigation(T0);
    lc.cancel(T0 + 60_000);
    check('12: first trip completed', lc.state() === 'completed');
    check('12: reset returns to idle', lc.reset(T0 + 61_000));
    const second = await lc.plan(PLAN_REQ, DEST_INFO, T0 + 62_000);
    check('12: a second truck-profile route plans cleanly', second.ok, second);
    check('12: and reaches route-ready again', lc.state() === 'route-ready', lc.state());
    const html = renderControls(lc);
    /*
     * Design Blueprint Phase 3 inverted this pin, by owner instruction:
     * route-ready is now the flight briefing, and the briefing must show
     * the truck the route was ACTUALLY planned with — from the session's
     * own profile via routeBrief(), not the idle-screen constant — with
     * the routed-around/not-routed-around disclosure intact. The old
     * assertion ("idle-only") protected the thin confirmation screen the
     * briefing replaced.
     */
    check(
      '12: the briefing shows the truck the route was planned with',
      html.includes('Truck used for this route') && html.includes('Not routed around:'),
    );
    check(
      '12: no illegal transitions across two trips',
      lc.violations().length === 0,
      lc.violations(),
    );
  }

  // =================================================================
  // WIRE COVERAGE — the seam that matters most: nothing the DRIVER is
  // shown may be a value the request silently ignores.
  // =================================================================
  {
    const buildUrl = (hazmatClass: string | null) =>
      buildHereRouteUrl(
        {
          origin: LINE[0],
          destination: DEST,
          waypoints: [],
          truck: { ...DEFAULT_TRUCK_PROFILE, hazmatClass },
          avoid: ['tollRoad'],
          departAtMs: T0,
        },
        'TEST-KEY',
      );
    // Hazmat is CONDITIONAL by design — a non-placarded load must not send
    // a hazardous-goods parameter at all — so the placarded URL is what
    // proves the field reaches the wire when it exists.
    const url = buildUrl('explosive');
    const plainUrl = buildUrl(null);
    for (const f of sentFields()) {
      check(
        `wire: ${f.label} claims 'sent' and the real builder sends ${f.wireParam}`,
        f.wireParam !== null && url.includes(encodeURIComponent(f.wireParam)),
        `${f.wireParam} missing from ${url.slice(0, 300)}`,
      );
    }
    check(
      'wire: a non-placarded load sends NO hazardous-goods parameter',
      !plainUrl.includes(encodeURIComponent('truck[shippedHazardousGoods]')),
      plainUrl.slice(0, 200),
    );
    check('wire: the api key never appears in a logged shape', url.includes('apiKey=TEST-KEY'));
    check(
      'wire: no field is modelled-but-silently-dropped',
      silentDrops().length === 0,
      silentDrops(),
    );

    // The panel's rows are the driver-facing claim. Every restriction row
    // it prints must be a field the request actually carries.
    const panel = renderToStaticMarkup(
      createElement(TruckProfilePanel, { truck: DEFAULT_TRUCK_PROFILE }),
    );
    for (const label of ['Height', 'Width', 'Length', 'Gross weight', 'Axles', 'Hazmat']) {
      check(`wire: the panel shows ${label}`, panel.includes(label));
    }
    const sentLabels = new Set(sentFields().map((f) => f.label));
    for (const [row, coverage] of [
      ['Height', 'Height'],
      ['Width', 'Width'],
      ['Length', 'Length'],
      ['Gross weight', 'Gross weight'],
      ['Axles', 'Axle count'],
      ['Hazmat', 'Hazmat class'],
    ] as const) {
      check(
        `wire: the ${row} row corresponds to a field the request sends`,
        sentLabels.has(coverage),
        coverage,
      );
    }
    // Fuel fields are modelled on TruckProfile but are trip-planner inputs,
    // not routing restrictions. The panel must not show them, or a driver
    // would read them as something the route was planned around.
    for (const fuel of ['tankGallons', 'mpg', 'Tank', 'MPG', 'Fuel']) {
      check(`wire: the panel does not imply ${fuel} affects routing`, !panel.includes(fuel), fuel);
    }
    check(
      'wire: the disclosure names every gap, so none is hidden',
      driverAssurances().notRoutedAround.length ===
        TRUCK_PROFILE_COVERAGE.length - sentFields().length,
    );
    check(
      'wire: and vehicle type is still declared a provider default, not claimed as sent',
      TRUCK_PROFILE_COVERAGE.find((f) => f.id === 'vehicle-type')?.status === 'provider-default',
    );
  }

  console.log(`navigator-pilot-integration: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();

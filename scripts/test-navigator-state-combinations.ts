/**
 * Adversarial STATE COMBINATIONS — the pairs, not the parts.
 *
 * Every module here is already tested on its own. What none of those
 * tests ask is what happens when two ordinary states arrive together: a
 * pilot session that expires in the same minute the truck goes off route;
 * a driver who has not enabled voice yet reaching route-ready; an HOS
 * warning landing on the same tick as a personalised greeting.
 *
 * Those are the ones that reach a real driver, because a trip is a
 * sequence of overlapping states and never a single one. Each block below
 * drives the REAL modules through the REAL ports with a scripted fake at
 * the seam, rather than asserting on source text — a combination test
 * that only reads code cannot tell you what the combination does.
 *
 * One block pins behaviour this file considers WRONG, deliberately:
 * an expired session costs reroute budget even though the request never
 * reached the provider. That lives in a file PR #272 owns and it is not a
 * P0, so it is recorded and pinned rather than changed — see the block
 * for the reasoning and the proposed fix.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-state-combinations.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-state-combinations.cjs && node /tmp/test-navigator-state-combinations.cjs
 */
import { readFileSync } from 'node:fs';
import { createNavigatorReplacementPort } from '@/components/navigator/route-port';
import { createRerouteController, REROUTE_DEFAULTS } from '@/lib/navigator/reroute-controller';
import { createRouteSession } from '@/lib/navigator/route-session';
import {
  createVoiceGuidance,
  type SpeechPort,
  type VoiceRequest,
} from '@/lib/navigator/voice-guidance';
import {
  createDriverPhraseAnnouncer,
  GREETING_VOICE_ID,
  ROUTE_START_VOICE_ID,
} from '@/lib/navigator/driver-greeting';
import { driverAssurances, gapFields, sentFields } from '@/lib/navigator/truck-profile-coverage';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import type { LatLng } from '@/lib/map/bounds';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

/* ------------------------------------------------------------ fixtures */

// esbuild targets CJS for these harnesses, which has no top-level await.
// One async entry point keeps the blocks below reading in order.
async function main(): Promise<void> {
  /** A short straight route, enough for a session to exist and be kept. */
  const LINE: LatLng[] = Array.from({ length: 40 }, (_, i) => ({
    lat: 33.75 + i * 0.002,
    lng: -84.4,
  }));

  function session() {
    const created = createRouteSession({
      routeId: 'combo-1',
      truck: DEFAULT_TRUCK_PROFILE,
      origin: LINE[0],
      destination: LINE[LINE.length - 1],
      positions: LINE,
      distanceMiles: 5,
      durationSeconds: 600,
      maneuvers: [
        { action: 'depart', instruction: 'Head north', direction: null, offset: 0 },
        { action: 'arrive', instruction: 'Arrive', direction: null, offset: LINE.length - 1 },
      ],
      validationState: 'valid',
      avoid: [],
    });
    if (!created.ok) throw new Error(`fixture route rejected: ${JSON.stringify(created.problems)}`);
    return created.session;
  }

  /** A fetch that always answers with one scripted HTTP response. */
  function scriptedFetch(status: number, body: unknown) {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { status, json: async () => body };
    };
    return { fn, calls: () => calls };
  }

  // The controller takes the truck, destination and avoidances from the
  // SESSION, never from the caller — only the position and the clock vary.
  const CONFIRMED = {
    detectorState: 'confirmed' as const,
    currentPosition: { lat: 33.78, lng: -84.41 },
    accuracyM: 10,
  };

  /* ============================================================ COMBO 1 */
  /* Pilot session expires mid-trip, and the truck goes off route.        */
  {
    const scripted = scriptedFetch(401, {
      ok: false,
      state: 'unauthorized',
      problems: [{ code: 'pilot-access-required' }],
    });
    const controller = createRerouteController(
      session(),
      createNavigatorReplacementPort(scripted.fn as never),
    );

    const result = await controller.requestReroute({ ...CONFIRMED, tMs: 60_000 });
    check(
      'expiry+reroute: the reroute fails rather than throwing into the driving screen',
      result.outcome === 'provider-failure',
      result.outcome,
    );
    check(
      'expiry+reroute: the reason names the real cause, not a generic error',
      result.outcome === 'provider-failure' &&
        result.reason === 'unauthorized:pilot-access-required',
      result.outcome === 'provider-failure' ? result.reason : result.outcome,
    );
    check(
      'expiry+reroute: the current route is untouched — the driver keeps navigating',
      controller.currentSession().routeId === 'combo-1',
      controller.currentSession().routeId,
    );

    /*
     * RECORDED, NOT FIXED.
     *
     * A 401 is charged against the reroute budget. The refund set is
     * {network, port-threw} — transport failures — and an expired session
     * is neither: the request reached OUR server and was refused there.
     *
     * But it never reached the PROVIDER, and the budget exists to cap
     * provider spend. So a driver whose 12-hour session lapses mid-trip
     * burns reroute tokens on requests that cost nothing, and after
     * re-entering the password finds fewer reroutes left for the rest of
     * the trip than they should have.
     *
     * The fix is one line — treat an `unauthorized:` reason as refundable —
     * and it belongs in `reroute-controller.ts`, which PR #272 owns and is
     * mid-road-test. This is not a P0 and the practical harm is bounded
     * (an expired session cannot reroute at all until re-auth), so the
     * behaviour is PINNED here rather than changed. When someone fixes it,
     * this assertion fails and says why.
     */
    check(
      'expiry+reroute: [PINNED, see comment] an expired session is NOT refunded today',
      controller.stats().budgetRefunds === 0 && controller.stats().providerCalls === 1,
      JSON.stringify(controller.stats()),
    );
  }

  /* ============================================================ COMBO 2 */
  /* A dead-signal stretch: the same off-route, but nothing reaches us.   */
  {
    const controller = createRerouteController(session(), async () => {
      throw new Error('offline');
    });
    const result = await controller.requestReroute({ ...CONFIRMED, tMs: 60_000 });
    check('offline+reroute: reported as a provider failure', result.outcome === 'provider-failure');
    check(
      'offline+reroute: and IS refunded, because it never reached the provider',
      controller.stats().budgetRefunds === 1 && controller.stats().providerCalls === 0,
      JSON.stringify(controller.stats()),
    );
    check(
      'offline+reroute: the contrast with combo 1 is the whole point',
      controller.stats().budgetRefunds === 1,
    );
  }

  /* ============================================================ COMBO 3 */
  /* A malformed provider response arrives while off route.               */
  {
    for (const [what, body] of [
      ['no route object', { ok: true, state: 'valid' }],
      [
        'geometry is not an array',
        {
          ok: true,
          state: 'valid',
          route: { routeId: 'x', distanceMiles: 3, seconds: 300, geometry: 'nope' },
        },
      ],
      [
        'a geometry point is not a pair',
        {
          ok: true,
          state: 'valid',
          route: {
            routeId: 'x',
            distanceMiles: 3,
            seconds: 300,
            geometry: [
              [1, 2],
              ['a', 'b'],
            ],
          },
        },
      ],
      [
        'duration missing',
        { ok: true, state: 'valid', route: { routeId: 'x', distanceMiles: 3, geometry: [[1, 2]] } },
      ],
      ['not an object at all', 'a string'],
    ] as const) {
      const scripted = scriptedFetch(200, body);
      const controller = createRerouteController(
        session(),
        createNavigatorReplacementPort(scripted.fn as never),
      );
      const result = await controller.requestReroute({ ...CONFIRMED, tMs: 60_000 });
      check(
        `malformed+reroute: "${what}" never becomes guidance`,
        result.outcome !== 'replaced',
        result.outcome,
      );
      check(
        `malformed+reroute: "${what}" keeps the current route`,
        controller.currentSession().routeId === 'combo-1',
      );
      check(
        `malformed+reroute: "${what}" is charged, because it DID reach the provider`,
        controller.stats().budgetRefunds === 0,
        JSON.stringify(controller.stats()),
      );
    }
  }

  /* ============================================================ COMBO 4 */
  /* Voice not yet enabled, and the first route becomes ready.            */
  {
    const spoken: string[] = [];
    const port: SpeechPort = {
      supported: true,
      speak: (text, onDone) => {
        spoken.push(text);
        onDone();
      },
      cancel: () => {},
    };
    const voice = createVoiceGuidance(port, { startMuted: true });
    const announcer = createDriverPhraseAnnouncer();

    const offer = (lifecycleState: string) => {
      const reqs = announcer.collect({
        lifecycleState: lifecycleState as never,
        firstName: 'Shawn',
        localHour: 9,
      });
      for (const r of reqs) announcer.note(r.id, voice.request(r));
      return reqs.map((r) => r.id);
    };

    const first = offer('route-ready');
    check('muted+route-ready: the phrase is offered', first.includes(ROUTE_START_VOICE_ID), first);
    check('muted+route-ready: and nothing is spoken while muted', spoken.length === 0, spoken);

    // THE POINT OF THE COMBINATION. A phrase dropped because the browser
    // was not yet allowed to speak must NOT be burned. The driver enables
    // voice at the next stop and should still hear it.
    voice.unmute();
    const second = offer('route-ready');
    check(
      'muted+route-ready: after unmuting it is offered again, not silently given up on',
      second.includes(ROUTE_START_VOICE_ID),
      second,
    );
    check(
      'muted+route-ready: and now it is spoken',
      spoken.some((t) => t.includes("Here's your route")),
      spoken,
    );

    const third = offer('route-ready');
    check(
      'muted+route-ready: and exactly once — a spoken phrase settles',
      third.length === 0,
      third,
    );
  }

  /* ============================================================ COMBO 5 */
  /* An HOS warning and the personalised greeting on the same tick.       */
  {
    const spoken: string[] = [];
    // Held on an object: a bare `let` assigned only inside the callback
    // narrows to `null` for the checker, and the release below stops
    // type-checking as a call.
    const pending: { done: (() => void) | null } = { done: null };
    const port: SpeechPort = {
      supported: true,
      speak: (text, onDone) => {
        spoken.push(text);
        pending.done = onDone;
      },
      cancel: () => {},
    };
    const voice = createVoiceGuidance(port);
    voice.unmute();
    const announcer = createDriverPhraseAnnouncer();

    // HOS speaks first, as a critical announcement, and is still speaking.
    const hos: VoiceRequest = {
      id: 'hos-critical-1',
      text: 'Thirty minutes of drive time remain.',
      priority: 'critical',
    };
    check('hos+greeting: the HOS warning speaks', voice.request(hos) === 'spoken');

    const reqs = announcer.collect({ lifecycleState: 'idle', firstName: 'Shawn', localHour: 9 });
    check(
      'hos+greeting: the greeting is offered',
      reqs.some((r) => r.id === GREETING_VOICE_ID),
    );
    const outcomes = reqs.map((r) => {
      const o = voice.request(r);
      announcer.note(r.id, o);
      return o;
    });
    check(
      'hos+greeting: the greeting is DROPPED, not queued behind a safety announcement',
      outcomes.every((o) => o === 'dropped-passive-busy'),
      outcomes,
    );
    check(
      'hos+greeting: the HOS warning is not interrupted',
      voice.snapshot().speakingId === 'hos-critical-1',
      voice.snapshot(),
    );
    check(
      'hos+greeting: nothing is queued behind it either',
      voice.snapshot().queuedIds.length === 0,
    );
    check('hos+greeting: only the HOS line was ever spoken', spoken.length === 1, spoken);

    // And the dropped greeting is not burned — it is still eligible once
    // the channel is free, until the window closes.
    pending.done?.();
    const again = announcer.collect({ lifecycleState: 'idle', firstName: 'Shawn', localHour: 9 });
    check(
      'hos+greeting: the greeting survives being dropped for a safety warning',
      again.some((r) => r.id === GREETING_VOICE_ID),
      again.map((r) => r.id),
    );
  }

  /* ============================================================ COMBO 6 */
  /* The greeting window closes when guidance starts, even unheard.       */
  {
    const announcer = createDriverPhraseAnnouncer();
    const first = announcer.collect({
      lifecycleState: 'navigating',
      firstName: 'Shawn',
      localHour: 9,
    });
    check(
      'late+greeting: a greeting is never offered once guidance is live',
      !first.some((r) => r.id === GREETING_VOICE_ID),
      first.map((r) => r.id),
    );
    const back = announcer.collect({ lifecycleState: 'idle', firstName: 'Shawn', localHour: 9 });
    check(
      'late+greeting: and the window does not reopen when the state goes quiet again',
      !back.some((r) => r.id === GREETING_VOICE_ID),
      back.map((r) => r.id),
    );
  }

  /* ============================================================ COMBO 7 */
  /* No name entered, in every state.                                     */
  {
    const announcer = createDriverPhraseAnnouncer();
    for (const state of ['idle', 'planning', 'route-ready', 'navigating'] as const) {
      const reqs = announcer.collect({ lifecycleState: state, firstName: null, localHour: 9 });
      check(
        `no-name: nothing is offered in "${state}"`,
        reqs.length === 0,
        reqs.map((r) => r.id),
      );
    }
  }

  /* ============================================================ COMBO 8 */
  /* The limitations screen and the truck profile must agree.             */
  {
    const a = driverAssurances();
    check(
      'limits+profile: both halves are returned',
      a.routedAround.length > 0 && a.notRoutedAround.length > 0,
    );
    check(
      'limits+profile: routedAround is exactly what reaches the wire',
      a.routedAround.join('|') ===
        sentFields()
          .map((f) => f.label)
          .join('|'),
      a.routedAround,
    );
    check(
      'limits+profile: notRoutedAround is exactly what does not',
      a.notRoutedAround.join('|') ===
        gapFields()
          .map((f) => f.label)
          .join('|'),
      a.notRoutedAround,
    );
    check(
      'limits+profile: no field is claimed on both sides',
      a.routedAround.every((l) => !a.notRoutedAround.includes(l)),
    );
    // A screen that lists only what works reads as a guarantee. The
    // disclosure half must never be empty while gaps exist.
    check(
      'limits+profile: a screen cannot show only the good half',
      gapFields().length === 0 || a.notRoutedAround.length === gapFields().length,
    );
  }

  /* ============================================================ COMBO 9 */
  /* A trip of nothing but failures, and what actually bounds it.         */
  /*                                                                      */
  /* FINDING, recorded rather than changed. `maxPerSession` counts        */
  /* SUCCESSFUL REPLACEMENTS, not attempts — the counter increments only  */
  /* on the success path. So a session that never gets a usable route     */
  /* never advances it, and the only thing bounding provider calls is the */
  /* rolling hourly budget plus the failure cooldown ladder.              */
  /*                                                                      */
  /* That is defensible — the hourly cap is the money rail and the        */
  /* session cap is the route-churn rail — but it means the per-driver    */
  /* ceiling scales with TRIP LENGTH, not with a fixed number per trip.   */
  /* Both facts are pinned below so neither can drift unnoticed, and the  */
  /* volume model is built on the hourly figure because of it.            */
  {
    const scripted = scriptedFetch(500, {
      ok: false,
      state: 'provider-failure',
      problems: [{ code: 'upstream' }],
    });
    const controller = createRerouteController(
      session(),
      createNavigatorReplacementPort(scripted.fn as never),
      { failureBackoffMs: [0] },
    );
    // Forty minutes of pathological off-route events, two minutes apart —
    // faster than the hourly rail allows, which is the point.
    for (let i = 0; i < 20; i += 1) {
      await controller.requestReroute({
        ...CONFIRMED,
        currentPosition: { lat: 33.78 + i * 0.01, lng: -84.41 },
        tMs: 60_000 + i * 120_000,
      });
    }
    const stats = controller.stats();
    check(
      'failure-only: the ROLLING HOURLY budget is what bounds a failing session',
      stats.refused['hourly-budget'] > 0,
      JSON.stringify(stats.refused),
    );
    check(
      'failure-only: the per-session budget never fires, because nothing succeeded',
      stats.refused['session-budget'] === 0 && stats.sessionCount === 0,
      JSON.stringify(stats),
    );
    check(
      'failure-only: nothing was ever charged against the per-session rail',
      stats.sessionCount === 0 && stats.providerCalls > 0,
      JSON.stringify(stats),
    );
    check(
      'failure-only: and stay within the hourly rate across the window',
      stats.providerCalls <= REROUTE_DEFAULTS.maxPerHour + 1,
      stats.providerCalls,
    );
    check(
      'failure-only: the original route survives every one of them',
      controller.currentSession().routeId === 'combo-1',
    );
  }

  /* ============================================================ COMBO 9b */
  /* The same finding, read off the counter itself.                       */
  /*                                                                      */
  /* A behavioural version of this would need a replacement fixture that  */
  /* passes full session validation from a moving origin, and a test that */
  /* silently produced zero successes would assert "successes <= 12" and  */
  /* pass for entirely the wrong reason. The counter's increment site is  */
  /* the fact that matters, so that is what is pinned.                    */
  {
    const SRC = readFileSync('src/lib/navigator/reroute-controller.ts', 'utf8');
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const increments = [...code.matchAll(/sessionCount \+= 1/g)].length;
    check(
      'budget semantics: the session counter is incremented in exactly one place',
      increments === 1,
      increments,
    );

    // That one place must be the SUCCESS path — the swap, the epoch bump
    // and the charge, contiguous and in that order.
    //
    // The right-hand side of the swap is deliberately NOT pinned. An earlier
    // version required the literal `session = created.session;`, which named
    // one particular way of spelling "the replacement we accepted". #272
    // introduces a second accepted candidate (the forward-anchor retry) and
    // assigns through a local instead — same invariant, different spelling,
    // and the assertion failed on a change that did not break it. Pinning
    // the ORDER of the three statements is both stronger than the old
    // proximity window and indifferent to what the accepted session is
    // called.
    const at = code.indexOf('sessionCount += 1');
    const before = code.slice(Math.max(0, at - 400), at);
    check(
      'budget semantics: and it is on the success path, after the swap',
      /session = [^;\n]+;\s*epoch \+= 1;\s*$/.test(before),
      before.slice(-160),
    );
    check(
      'budget semantics: the failure paths do not touch it',
      !/rejectedReplacements \+= 1;[\s\S]{0,200}sessionCount \+= 1/.test(code) &&
        !/providerFailures \+= 1;[\s\S]{0,300}sessionCount \+= 1/.test(code),
    );
    check(
      'budget semantics: so `maxPerSession` caps ROUTE CHURN and `maxPerHour` caps SPEND',
      /sessionCount >= cfg\.maxPerSession/.test(code) &&
        /callTimes\.length >= cfg\.maxPerHour/.test(code),
    );
  }

  /* =========================================================== COMBO 10 */
  /* First name is session-only: a reload cannot restore it.              */
  {
    const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    const NAME = readFileSync('src/components/navigator/DriverNameEntry.tsx', 'utf8');
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(
      'reload+name: the name is component state and nothing else',
      /useState<string \| null>\(null\)/.test(code(SCREEN)),
    );
    for (const [what, re] of [
      ['local storage', /localStorage/],
      ['session storage', /sessionStorage/],
      ['a cookie', /document\.cookie/],
      ['a database', /supabase/i],
      ['a url parameter', /searchParams|URLSearchParams/],
    ] as const) {
      check(
        `reload+name: the name never reaches ${what}`,
        !re.test(code(SCREEN)) && !re.test(code(NAME)),
        what,
      );
    }
  }
}

main().then(
  () => {
    console.log(`navigator-state-combinations: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  },
  (err) => {
    console.log(`FAIL: the harness itself threw — ${String(err)}`);
    process.exit(1);
  },
);

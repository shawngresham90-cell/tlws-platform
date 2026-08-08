/**
 * N7 voice guidance — the doc 06 §3 output rules against the pure module
 * with a scripted SpeechPort: priority preemption, passive drop, queue
 * order, announce-once, one-touch mute, silent degradation when speech is
 * unsupported; the doc 05 §3 maneuver tiers with speed scaling, chaining,
 * and never-twice fired flags; HOS threshold speech; status transitions;
 * and the OUTPUT-ONLY boundary — no microphone or recognition API may
 * appear anywhere in the milestone's code.
 *
 * Run:
 *   npx esbuild scripts/test-voice-guidance.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-voice-guidance.cjs && node /tmp/test-voice-guidance.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  createVoiceGuidance,
  createManeuverAnnouncer,
  createHosAnnouncer,
  createStatusAnnouncer,
  tripVoiceRequest,
  tierThresholdMi,
  speakableMinutes,
  hosVoiceText,
  MANEUVER_THRESHOLDS_MI,
  MANEUVER_GROUP,
  STUCK_UTTERANCE_MS,
  type SpeechPort,
  type VoiceRequest,
} from '@/lib/navigator/voice-guidance';
import { VoiceControls } from '@/components/navigator/VoiceControls';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import type { RemainingClocks } from '@/lib/trip-planner/types';

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

/** Scripted port: utterances end only when the test says so. */
function fakePort() {
  const spoken: string[] = [];
  let cancels = 0;
  let pendingDone: (() => void) | null = null;
  const port: SpeechPort = {
    supported: true,
    speak(text, onDone) {
      spoken.push(text);
      pendingDone = onDone;
    },
    cancel() {
      cancels++;
    },
  };
  return {
    port,
    spoken,
    cancels: () => cancels,
    finish() {
      const done = pendingDone;
      pendingDone = null;
      done?.();
    },
  };
}
const req = (id: string, priority: VoiceRequest['priority'], text = id): VoiceRequest => ({
  id,
  priority,
  text,
});

// ------------------------------------------------- queue + priority rules
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  check('idle normal speaks immediately', v.request(req('n1', 'normal')) === 'spoken');
  check('busy normal queues in order', v.request(req('n2', 'normal')) === 'queued');
  check('second busy normal queues behind it', v.request(req('n3', 'normal')) === 'queued');
  check('only the first has been spoken so far', f.spoken.join(',') === 'n1');
  f.finish();
  f.finish();
  check('queue drains in FIFO order', f.spoken.join(',') === 'n1,n2,n3');
  f.finish();
  check(
    'drained queue goes idle',
    v.snapshot().speakingId === null && !v.snapshot().queuedIds.length,
  );
}

// critical preemption of an ORDINARY line. These ids used to be called
// "maneuver-a"/"maneuver-b", which read as if this covered turns; they
// carry no maneuver group and never did. Renamed so the distinction from
// the block below is visible.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request(req('line-a', 'normal'));
  v.request(req('line-b', 'normal'));
  check('critical preempts mid-utterance', v.request(req('alert', 'critical')) === 'spoken');
  check('preemption cancelled the engine once', f.cancels() === 1);
  check('critical spoke without waiting', f.spoken.join(',') === 'line-a,alert');
  f.finish(); // alert ends
  check('queued normal resumes after the critical', f.spoken.join(',') === 'line-a,alert,line-b');
  check('the preempted utterance is NOT replayed', !f.spoken.slice(1).includes('line-a'));
}

// A critical line must NOT cut a turn out of the driver's ear. The
// maneuver's announce-once flag is already set by the time it is
// speaking, so a preempted turn is gone for good — the driver hears
// "Turn right onto Old M—" and then a clock warning, and misses the
// turn. An HOS crossing can wait the two seconds the turn takes.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const turn: VoiceRequest = {
    id: 'maneuver:3@Turn right onto Old Mill Road.:execute',
    priority: 'normal',
    group: MANEUVER_GROUP,
    text: 'Turn right onto Old Mill Road.',
  };
  check('the turn starts speaking', v.request(turn) === 'spoken');
  const hos = req('hos:drive:critical', 'critical');
  check('an HOS critical waits for the turn', v.request(hos) === 'queued');
  check('nothing was cancelled', f.cancels() === 0);
  check('the turn is still the one being spoken', v.snapshot().speakingId === turn.id);
  check('only the turn has been spoken so far', f.spoken.length === 1, f.spoken);
  f.finish(); // the turn completes normally
  check(
    'the critical speaks the moment the turn finishes',
    f.spoken.join(',') === 'Turn right onto Old Mill Road.,hos:drive:critical',
    f.spoken,
  );
  check(
    'the turn was never replayed',
    f.spoken.filter((t) => t.startsWith('Turn right')).length === 1,
  );
}

// The critical still goes FIRST among things waiting: it jumps ahead of
// queued normal lines, it just does not cut the turn already speaking.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request({
    id: 'maneuver:1@Turn left.:execute',
    priority: 'normal',
    group: MANEUVER_GROUP,
    text: 'Turn left.',
  });
  v.request(req('status-line', 'normal'));
  v.request(req('hos:break:imminent', 'critical'));
  f.finish(); // the turn ends
  check(
    'the critical jumped ahead of the queued normal',
    f.spoken[1] === 'hos:break:imminent',
    f.spoken,
  );
  f.finish();
  check(
    'the normal line follows',
    f.spoken.join(',') === 'Turn left.,hos:break:imminent,status-line',
  );
}

// A stuck turn must not hold a critical hostage forever: the watchdog
// retires it and the critical is next out.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request({
    id: 'maneuver:2@Turn right.:execute',
    priority: 'normal',
    group: MANEUVER_GROUP,
    text: 'Turn right.',
  });
  v.request(req('hos:drive:imminent', 'critical'));
  const T = 1_700_000_000_000;
  v.tick(T);
  v.tick(T + STUCK_UTTERANCE_MS + 1000);
  check(
    'a never-ending turn does not trap the critical',
    f.spoken.join(',') === 'Turn right.,hos:drive:imminent',
    f.spoken,
  );
}

// passive drop
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  check('idle passive speaks', v.request(req('p1', 'passive')) === 'spoken');
  check(
    'passive dropped while speaking',
    v.request(req('p2', 'passive')) === 'dropped-passive-busy',
  );
  f.finish();
  v.request(req('n1', 'normal'));
  v.request(req('n2', 'normal'));
  check(
    'passive dropped while queue is non-empty',
    v.request(req('p3', 'passive')) === 'dropped-passive-busy',
  );
  check('dropped passives never spoke', !f.spoken.includes('p2') && !f.spoken.includes('p3'));
}

// announce-once (no double-speak), including after completion
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request(req('once', 'normal'));
  f.finish();
  check(
    'same id after completion → dropped-repeat',
    v.request(req('once', 'normal')) === 'dropped-repeat',
  );
  check(
    'repeat drop even at critical priority',
    v.request(req('once', 'critical')) === 'dropped-repeat',
  );
  check('spoken exactly once', f.spoken.filter((s) => s === 'once').length === 1);
  check(
    'a dropped passive id MAY retry later (it was never announced)',
    (() => {
      v.request(req('busy', 'normal')); // occupy
      const first = v.request(req('later', 'passive'));
      f.finish(); // 'busy' done, idle
      return first === 'dropped-passive-busy' && v.request(req('later', 'passive')) === 'spoken';
    })(),
  );
}

// one-touch mute
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  v.request(req('m1', 'normal'));
  v.request(req('m2', 'normal'));
  v.mute();
  check('mute cancels the current utterance', f.cancels() === 1);
  check('mute clears the queue', v.snapshot().queuedIds.length === 0);
  check('muted requests are dropped', v.request(req('m3', 'critical')) === 'dropped-muted');
  const stale = f.spoken.length;
  f.finish(); // engine may still fire the cancelled utterance's callback
  check('stale engine callback after mute does not resurrect the queue', f.spoken.length === stale);
  v.unmute();
  check('unmute restores speech', v.request(req('m4', 'normal')) === 'spoken');
  check('m2 (cleared by mute) never spoke', !f.spoken.includes('m2'));
}

// unavailable path — silent degradation
{
  let touched = 0;
  const v = createVoiceGuidance({
    supported: false,
    speak: () => {
      touched++;
    },
    cancel: () => {
      touched++;
    },
  });
  check(
    'unsupported: every request drops silently',
    v.request(req('u1', 'critical')) === 'dropped-unavailable' &&
      v.request(req('u2', 'normal')) === 'dropped-unavailable' &&
      v.request(req('u3', 'passive')) === 'dropped-unavailable',
  );
  check('unsupported: the engine is never touched', touched === 0);
  check('unsupported: snapshot says so honestly', v.snapshot().supported === false);
}

// --------------------------------------------------- maneuver announcer
{
  check(
    'thresholds match doc 05 §3 (fast set)',
    MANEUVER_THRESHOLDS_MI.prepare[0] === 2.0 &&
      MANEUVER_THRESHOLDS_MI.approach[0] === 0.5 &&
      MANEUVER_THRESHOLDS_MI.execute[0] === 0.1,
  );
  check(
    'thresholds match doc 05 §3 (slow set, execute = 200 ft)',
    MANEUVER_THRESHOLDS_MI.prepare[1] === 0.5 &&
      MANEUVER_THRESHOLDS_MI.approach[1] === 0.15 &&
      Math.abs(MANEUVER_THRESHOLDS_MI.execute[1] - 200 / 5280) < 1e-9,
  );
  check(
    'speed scaling: 2.0 mi prepare at highway speed, 0.5 below 50',
    tierThresholdMi('prepare', 62) === 2.0 &&
      tierThresholdMi('prepare', 35) === 0.5 &&
      tierThresholdMi('prepare', null) === 0.5,
  );

  const exit = { action: 'exit', instruction: 'Take exit 320', direction: 'right', mileMi: 50 };
  const a = createManeuverAnnouncer();
  check(
    'beyond every threshold → silent',
    a.collect({ next: exit, following: null, distanceMi: 3 }, 60).length === 0,
  );
  const prep = a.collect({ next: exit, following: null, distanceMi: 1.8 }, 60);
  check('prepare fires once inside 2 mi', prep.length === 1 && prep[0].id.endsWith(':prepare'));
  check('prepare text carries distance', prep[0].text === 'In 1.8 miles, Take exit 320');
  check(
    'same tier never re-fires',
    a.collect({ next: exit, following: null, distanceMi: 1.7 }, 60).length === 0,
  );
  const appr = a.collect({ next: exit, following: null, distanceMi: 0.45 }, 60);
  check('approach tier fires inside 0.5 mi', appr.length === 1 && appr[0].id.endsWith(':approach'));
  check('approach wording at half a mile', appr[0].text === 'In half a mile, Take exit 320');
  const exec = a.collect({ next: exit, following: null, distanceMi: 0.08 }, 60);
  check(
    'execute tier speaks the instruction alone',
    exec.length === 1 && exec[0].text === 'Take exit 320',
  );
  check(
    'all tiers exhausted → permanently silent',
    a.collect({ next: exit, following: null, distanceMi: 0.01 }, 60).length === 0,
  );

  // announcements are normal priority (maneuvers queue, never preempt)
  check('maneuver announcements are normal priority', prep[0].priority === 'normal');

  /*
   * Block 2 / priority C+D: HERE's instruction text ends with the length
   * of the road AFTER the turn ("Turn right onto Broad St. Go for 1.3
   * mi."). Spoken, that is a second distance in the same breath as the
   * announcement's own "In half a mile" — and "mi." is at the mercy of
   * whatever the TTS voice does with the abbreviation. It is stripped
   * before speaking; the announce-once KEY still uses the raw text, so
   * the change cannot alter what fires or how often.
   */
  {
    const verbose = {
      action: 'turn',
      instruction: 'Turn right onto Broad St. Go for 1.3 mi.',
      direction: 'right',
      mileMi: 50,
    };
    const v = createManeuverAnnouncer();
    const line = v.collect({ next: verbose, following: null, distanceMi: 0.45 }, 60);
    check(
      'spoken text drops the provider segment length',
      line.length === 1 && line[0].text === 'In half a mile, Turn right onto Broad St.',
    );
    check(
      'the announce-once key still keys on the RAW instruction',
      line[0].id === `maneuver:50@${verbose.instruction}:approach`,
    );

    const second = {
      action: 'turn',
      instruction: 'Turn left onto Dock St. Go for 300 ft.',
      direction: 'left',
      mileMi: 50.2,
    };
    const c = createManeuverAnnouncer();
    const chainedLine = c.collect({ next: verbose, following: second, distanceMi: 1.8 }, 60);
    check(
      'both halves of a chained line are normalized',
      chainedLine.length === 1 &&
        chainedLine[0].text ===
          'In 1.8 miles, Turn right onto Broad St., then Turn left onto Dock St.',
    );
  }

  /*
   * ANTI-CHATTER. This assertion previously required all three due tiers to
   * come out "together" from one collect(). That was the owner's road-test
   * complaint in test form: an announcer meeting a maneuver already inside a
   * closer threshold — every reroute, a trip started near a turn, GPS back
   * from a tunnel — read three near-identical sentences in a row.
   *
   * The property it was really protecting, announce-once per (maneuver,
   * tier), is preserved and asserted harder below: the far tiers are burned
   * silently, so they can never surface later either.
   */
  const b = createManeuverAnnouncer();
  const jump = b.collect({ next: exit, following: null, distanceMi: 0.05 }, 60);
  check(
    'meeting a maneuver up close speaks ONCE, at the nearest due tier',
    jump.length === 1 && jump[0].id.endsWith(':execute'),
    jump.map((r) => r.id),
  );
  check(
    'the tiers it skipped are burned, not merely deferred',
    b.collect({ next: exit, following: null, distanceMi: 0.04 }, 60).length === 0 &&
      b.collect({ next: exit, following: null, distanceMi: 1.5 }, 60).length === 0,
  );
  // Mid-ladder: due at approach but not yet execute → exactly one line, and
  // the still-distant execute tier remains available for later.
  const b2 = createManeuverAnnouncer();
  const mid = b2.collect({ next: exit, following: null, distanceMi: 0.3 }, 60);
  check(
    'entering at approach range speaks once, execute still to come',
    mid.length === 1 && mid[0].id.endsWith(':approach'),
    mid.map((r) => r.id),
  );
  const later = b2.collect({ next: exit, following: null, distanceMi: 0.05 }, 60);
  check(
    'execute still fires later, on its own',
    later.length === 1 && later[0].id.endsWith(':execute'),
  );
  check('maneuver lines carry the supersession group', later[0].group === 'maneuver');

  /*
   * GPS JITTER. Distance is not monotonic in the real world: a fix can
   * bounce back across a threshold it already crossed. Re-crossing must
   * stay silent.
   */
  const j = createManeuverAnnouncer();
  j.collect({ next: exit, following: null, distanceMi: 0.45 }, 60);
  let jitterLines = 0;
  for (const d of [0.52, 0.44, 0.51, 0.43, 0.55, 0.42]) {
    jitterLines += j.collect({ next: exit, following: null, distanceMi: d }, 60).length;
  }
  check('threshold jitter produces no further speech', jitterLines === 0, jitterLines);

  /*
   * A FULL APPROACH at highway speed is three lines total, not a stream —
   * one per stage, in order, however many GPS ticks arrive between them.
   */
  const full = createManeuverAnnouncer();
  const spoken: string[] = [];
  for (let d = 3.0; d >= 0.01; d -= 0.01) {
    for (const r of full.collect({ next: exit, following: null, distanceMi: d }, 60)) {
      spoken.push(r.id.split(':').pop()!);
    }
  }
  check(
    'a 3-mile approach yields exactly prepare, approach, execute — 3 lines from 300 ticks',
    spoken.length === 3 && spoken.join(',') === 'prepare,approach,execute',
    spoken,
  );

  /*
   * QUEUE SUPERSESSION. A maneuver line still WAITING while a newer one
   * comes due is obsolete — the driver must hear where they are now, not a
   * backlog of where they were. Eviction is queue-only: the sentence already
   * in the driver's ear is never cut mid-word to say something similar.
   */
  {
    let speaking: (() => void) | null = null;
    const spokenTexts: string[] = [];
    const port = {
      supported: true,
      speak(text: string, onDone: () => void) {
        spokenTexts.push(text);
        speaking = onDone;
      },
      cancel() {
        speaking = null;
      },
    };
    const v = createVoiceGuidance(port);
    v.request({
      id: 'm1',
      priority: 'normal',
      text: 'In half a mile, turn right',
      group: 'maneuver',
    });
    v.request({ id: 'm2', priority: 'normal', text: 'In 500 feet, turn right', group: 'maneuver' });
    check('first maneuver line is speaking, second waits', v.snapshot().queuedIds.join() === 'm2');
    v.request({ id: 'm3', priority: 'normal', text: 'Turn right', group: 'maneuver' });
    check(
      'a newer maneuver line evicts the stale queued one',
      v.snapshot().queuedIds.join() === 'm3',
      v.snapshot().queuedIds,
    );
    check('the utterance already speaking is never cut', v.snapshot().speakingId === 'm1');
    check('only one line was actually voiced so far', spokenTexts.length === 1);
    // Ungrouped traffic (HOS, status) is untouched by maneuver supersession.
    v.request({ id: 'hos1', priority: 'normal', text: 'Break required in 30 minutes' });
    v.request({ id: 'm4', priority: 'normal', text: 'Turn right now', group: 'maneuver' });
    check(
      'supersession never evicts other kinds of speech',
      v.snapshot().queuedIds.includes('hos1'),
      v.snapshot().queuedIds,
    );
    speaking!();
    check(
      'the driver next hears the queued HOS line',
      spokenTexts[1] === 'Break required in 30 minutes',
    );
  }

  /* Spoken distance buckets — no decimal readouts, no "In 1 miles". */
  {
    const d = createManeuverAnnouncer();
    const one = d.collect({ next: exit, following: null, distanceMi: 0.97 }, 60);
    check(
      '0.97 mi reads as "In 1 mile", singular',
      one[0].text.startsWith('In 1 mile,'),
      one[0].text,
    );
    const q = createManeuverAnnouncer();
    const quarter = q.collect({ next: exit, following: null, distanceMi: 0.25 }, 60);
    check(
      '0.25 mi reads as a quarter mile, not "In 1300 feet"',
      quarter[0].text.startsWith('In a quarter mile,'),
      quarter[0].text,
    );
  }

  // chained maneuvers: combined instruction, second prepare suppressed
  const c = createManeuverAnnouncer();
  const turn = {
    action: 'turn',
    instruction: 'Turn right on Elm',
    direction: 'right',
    mileMi: 50.3,
  };
  const chained = c.collect({ next: exit, following: turn, distanceMi: 1.9 }, 60);
  check(
    'chained: one combined instruction',
    chained.length === 1 &&
      chained[0].text === 'In 1.9 miles, Take exit 320, then Turn right on Elm',
  );
  const afterExit = c.collect({ next: turn, following: null, distanceMi: 0.1 }, 30);
  check(
    "chained: the second maneuver's own prepare stays suppressed",
    afterExit.every((r) => !r.id.endsWith(':prepare')),
  );
  check(
    'chained: second maneuver still gets approach/execute',
    afterExit.some((r) => r.id.endsWith(':approach')),
  );
}

// -------------------------------------------------------- HOS announcer
{
  const remaining = (untilBreakMin: number): RemainingClocks => ({
    drivingMin: 400,
    windowMin: 500,
    untilBreakMin,
    cycleMin: 3000,
    legalDrivingMin: 400,
    limitedBy: '11-hour',
  });
  check('speakable time: 45 → "45 minutes"', speakableMinutes(45) === '45 minutes');
  check('speakable time: 1 → singular', speakableMinutes(1) === '1 minute');
  check('speakable time: 60 → "1 hour"', speakableMinutes(60) === '1 hour');
  check('speakable time: 90 → "1 hour 30 minutes"', speakableMinutes(90) === '1 hour 30 minutes');
  check(
    'voice text never uses h:mm digits',
    hosVoiceText(
      { severity: 'warning', text: 'Break required in 0:28', clock: 'break' },
      remaining(28),
    ) === 'Break required in 28 minutes',
  );

  const h = createHosAnnouncer();
  check(
    'calm clocks are silent',
    h.collect({ severity: 'none', text: null, clock: null }, remaining(120)).length === 0,
  );
  const notice = h.collect(
    { severity: 'notice', text: 'Break required in 0:55', clock: 'break' },
    remaining(55),
  );
  check(
    'notice speaks at normal priority (never preempts a maneuver)',
    notice.length === 1 && notice[0].priority === 'normal' && notice[0].id === 'hos:break:notice',
  );
  const warning = h.collect(
    { severity: 'warning', text: 'Break required in 0:28', clock: 'break' },
    remaining(28),
  );
  check(
    'warning escalation is critical priority with a NEW id',
    warning.length === 1 &&
      warning[0].priority === 'critical' &&
      warning[0].id === 'hos:break:warning',
  );
  const again = h.collect(
    { severity: 'warning', text: 'Break required in 0:27', clock: 'break' },
    remaining(27),
  );
  check(
    'same severity re-offers the SAME id (guidance drops it as a repeat)',
    again.length === 1 && again[0].id === 'hos:break:warning',
  );
  const overdue = h.collect(
    { severity: 'critical', text: 'Break required now', clock: 'break' },
    remaining(0),
  );
  check('overdue wording spoken plainly', overdue[0].text === 'Break required now');

  // end-to-end: repeated ticks at one severity speak exactly once
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const ticking = createHosAnnouncer();
  for (let m = 28; m > 16; m--) {
    const reqs = ticking.collect(
      { severity: 'warning', text: `Break required in 0:${m}`, clock: 'break' },
      remaining(m),
    );
    for (const r of reqs) v.request(r);
  }
  f.finish();
  check(
    'twelve warning ticks → exactly one spoken warning',
    f.spoken.length === 1 && f.spoken[0] === 'Break required in 28 minutes',
  );
}

// ------------------------------------------------------ status announcer
{
  const s = createStatusAnnouncer();
  check('initial no-route state is not speakable', s.collect('no-route').length === 0);
  check('unchanged status is silent', s.collect('no-route').length === 0);
  const degraded = s.collect('position-degraded');
  check(
    'degradation announced in plain words',
    degraded.length === 1 && degraded[0].text === 'Position approximate. Guidance continues.',
  );
  check('staying degraded is silent', s.collect('position-degraded').length === 0);
  s.collect('navigating');
  const again = s.collect('position-degraded');
  check(
    'a LATER degradation is a new event with a new id (not a repeat)',
    again.length === 1 && again[0].id !== degraded[0].id,
  );
  const denied = s.collect('denied');
  check(
    'GPS denial announced in plain words',
    denied.length === 1 && denied[0].text === 'Location permission denied. Navigation cannot run.',
  );
  const unavailable = s.collect('position-unavailable');
  check(
    'GPS unavailable announced in plain words',
    unavailable.length === 1 && unavailable[0].text === 'Location unavailable from this device.',
  );
  const arrived = s.collect('arrived');
  check(
    "'arrived' is NOT a status announcement (lifecycle owns trip completion)",
    arrived.length === 0,
  );
}

// -------------------------------- trip-lifecycle requests (P1 rewire)
{
  const replaced = tripVoiceRequest({ kind: 'route-replaced', routeId: 'r2' });
  check(
    'route replacement speaks exactly "Route updated." once per route id',
    replaced !== null && replaced.text === 'Route updated.' && replaced.id === 'route:r2:updated',
  );
  const arrivedEnd = tripVoiceRequest({ kind: 'trip-ended', routeId: 'r2', endReason: 'arrived' });
  check('honest arrival sentence', arrivedEnd !== null && arrivedEnd.text === 'You have arrived.');
  const unverified = tripVoiceRequest({
    kind: 'trip-ended',
    routeId: 'r2',
    endReason: 'destination-unverified',
  });
  check(
    'destination-unverified arrival keeps the truth attached',
    unverified !== null &&
      unverified.text === 'You have arrived. Destination entrance is unverified.',
  );
  check(
    'cancellation is deliberately SILENT',
    tripVoiceRequest({ kind: 'trip-ended', routeId: 'r2', endReason: 'cancelled' }) === null,
  );
}

// ------------------------- start-muted + clearPending (P1 rewire rules)
{
  // No speech on page load: the screen creates voice with startMuted.
  const f = fakePort();
  const v = createVoiceGuidance(f.port, { startMuted: true });
  check('startMuted: snapshot reports muted', v.snapshot().muted);
  check(
    'startMuted: nothing speaks before the driver enables voice',
    v.request({ id: 'm1', priority: 'normal', text: 'x' }) === 'dropped-muted' &&
      f.spoken.length === 0,
  );
  v.unmute();
  check(
    'after enable, fresh announcements speak',
    v.request({ id: 'm2', priority: 'normal', text: 'y' }) === 'spoken' && f.spoken.length === 1,
  );

  // Announcer fired flags survive a muted period: what became stale while
  // muted is never replayed after enable.
  const ann = createManeuverAnnouncer();
  const view = {
    next: { action: 'exit', instruction: 'Take exit 320', direction: 'right', mileMi: 100 },
    following: null,
    distanceMi: 0.09,
  };
  const muted = createVoiceGuidance(fakePort().port, { startMuted: true });
  for (const r of ann.collect(view, 60)) muted.request(r); // dropped-muted, but FIRED
  muted.unmute();
  check(
    'unmute does not replay announcements that fired while muted',
    ann.collect(view, 60).length === 0,
  );

  // clearPending: current + queue die, mute preference and announce-once
  // ids survive — exactly what stop/arrival/route-replacement need.
  const g = fakePort();
  const w = createVoiceGuidance(g.port);
  w.request({ id: 'a', priority: 'normal', text: 'A' });
  w.request({ id: 'b', priority: 'normal', text: 'B' });
  w.request({ id: 'c', priority: 'normal', text: 'C' });
  check('fixture: one speaking, two queued', w.snapshot().queuedIds.length === 2);
  w.clearPending();
  check(
    'clearPending cancels current and clears the queue',
    w.snapshot().speakingId === null && w.snapshot().queuedIds.length === 0 && g.cancels() >= 1,
  );
  check('clearPending does NOT mute', !w.snapshot().muted);
  check(
    'clearPending keeps announce-once ids (no replay of the dead queue)',
    w.request({ id: 'b', priority: 'normal', text: 'B' }) === 'dropped-repeat',
  );
}

// ------------------------------------------------- component + wiring
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const html = renderToStaticMarkup(createElement(VoiceControls, { voice: v }));
  check(
    'mute control: 64px target, visible text, aria-pressed',
    html.includes('min-h-16') &&
      html.includes('Mute voice') &&
      html.includes('aria-pressed="false"'),
  );
  check(
    'mute control accessible name starts with its visible text',
    html.includes('aria-label="Mute voice guidance"'),
  );
  const unsupported = createVoiceGuidance({ supported: false, speak: () => {}, cancel: () => {} });
  const degraded = renderToStaticMarkup(createElement(VoiceControls, { voice: unsupported }));
  check(
    'unsupported: honest sentence instead of a dead button',
    degraded.includes('Voice guidance is unavailable on this device') &&
      !degraded.includes('<button'),
  );

  const screen = strip(readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8'));
  check('driving screen renders VoiceControls', /<VoiceControls/.test(screen));
  check(
    'mute goes through the shared permission gate, not a private check',
    /action="mute-voice"/.test(screen),
  );
  check(
    'runtime screen always passes voice (only static tests omit it)',
    /voice=\{voiceRef\.current\}/.test(screen),
  );
  const actions = readFileSync('src/lib/navigator/actions.ts', 'utf8');
  check(
    "'mute-voice' is allowed while moving (doc 06 matrix)",
    /'mute-voice':\s*true/.test(actions),
  );

  const hosStrip = strip(readFileSync('src/components/navigator/HosStrip.tsx', 'utf8'));
  check('HOS strip feeds threshold crossings to voice', /createHosAnnouncer/.test(hosStrip));

  // P1 lifecycle rewire pins — the screen speaks FROM the lifecycle, and
  // never on page load.
  check('voice is created MUTED (no speech on page load)', /startMuted:\s*true/.test(screen));
  check(
    'route replacement resets the maneuver announcer and clears stale speech',
    /maneuverAnnouncerRef\.current = createManeuverAnnouncer\(\)/.test(screen) &&
      /route-replaced/.test(screen),
  );
  check(
    'trip completion is announced from the lifecycle summary (honest end reason)',
    /trip-ended/.test(screen) && /snap\.summary/.test(screen),
  );
  check(
    'stop and unmount both kill pending speech',
    (screen.match(/clearPending\(\)/g) ?? []).length >= 3,
  );
  check(
    'exactly ONE voice instance (single speech owner)',
    (screen.match(/createVoiceGuidance\(/g) ?? []).length === 1,
  );

  // ---- co-existence with the pilot round-1/round-2 driving screen ----
  // N7 was authored against an earlier screen. Everything below exists
  // because the rebase onto the map-bearing screen is exactly where voice
  // could silently displace shipped driver-facing behavior — or where the
  // map work could silently displace voice. Each pin names the behavior
  // it protects so a future edit knows what it is breaking.
  check(
    'voice did not displace the live map: the screen still mounts NavigationMap',
    /<NavigationMap/.test(screen) && /mapSlot=\{/.test(screen),
  );
  check(
    'the map still renders ABOVE the fold of the guidance, via mapSlot',
    /\{mapSlot\}/.test(screen),
  );
  check(
    'round-2 trip-start handoff survives (driver is taken to the guidance)',
    /focusNavigationKey=\{focusNavigationKey\}/.test(screen) &&
      /lcState === 'navigating' && prev === 'route-ready'/.test(screen),
  );
  check(
    'the focus latch and the voice latch use SEPARATE refs (neither clobbers the other)',
    /prevStateRef/.test(screen) && /prevLcStateRef/.test(screen),
  );
  check(
    'US driver units survive: distance through formatDriverDistanceMi, speed in mph',
    /formatDriverDistanceMi\(view\.remainingMi\)/.test(screen) && /\bmph\b/.test(screen),
  );
  check(
    'reroute path is untouched by voice (no speech gate before requestReroute)',
    /lifecycle\.requestReroute\(/.test(screen) &&
      !/voice[\s\S]{0,80}requestReroute/.test(screen) &&
      !/await\s+voice/.test(screen),
  );
  check(
    'voice speaks a replacement route from the routeId, not from the reroute CALL',
    /spokenRouteIdRef/.test(screen),
  );
}

// -------------------- behavioral: voice + map on ONE rendered screen
// Regex pins above prove the wiring is written; this proves it actually
// renders. A driver must get the maneuver, the map and the voice control
// on the same surface — not one at the cost of another.
{
  const f = fakePort();
  const v = createVoiceGuidance(f.port);
  const view = {
    status: 'navigating' as const,
    maneuvers: {
      next: {
        action: 'turn',
        instruction: 'Turn right onto US-27 North',
        direction: 'right',
        mileMi: 4.6,
      },
      following: null,
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
          voice: v,
          mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
          focusNavigationKey: 'trip-start-1',
        }),
      ),
    ),
  );
  check('rendered screen shows the maneuver instruction', html.includes('US-27 North'));
  check('rendered screen shows the live map slot', html.includes('data-test-map="live"'));
  check('rendered screen shows the voice control', html.includes('Mute voice'));
  check('rendered screen shows US distance units, not meters', /12\.3\s*mi/.test(html));
  check('rendered screen shows speed in mph', /58\s*mph/.test(html));
  check(
    'the map is not pushed below the voice control',
    html.indexOf('data-test-map="live"') < html.indexOf('Mute voice'),
  );

  // ---- the SAME screen in map-first full-screen driving mode ----
  // This is the surface the driver actually sees at speed, and the one
  // the two milestones fought over. Voice must be present and reachable
  // ON it — not exiled below the fold with the pilot controls, because
  // mute is permitted while moving.
  const fs = renderToStaticMarkup(
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
          voice: v,
          fullScreen: true,
          roadName: 'US-27 North',
          etaText: '3:45 PM',
          mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
          overviewSlot: createElement('button', { type: 'button' }, 'Overview'),
          focusNavigationKey: 'trip-start-1',
        }),
      ),
    ),
  );
  check('full-screen: viewport-filling surface (100dvh)', /h-\[100dvh\]/.test(fs));
  check('full-screen: maneuver instruction present', fs.includes('US-27 North'));
  check('full-screen: live map present', fs.includes('data-test-map="live"'));
  check(
    'full-screen: map above the controls',
    fs.indexOf('data-test-map="live"') < fs.indexOf('Stop'),
  );
  check('full-screen: US units, not meters', /12\.3\s*mi/.test(fs));
  check('full-screen: speed in mph', /58\s*mph/.test(fs));
  check('full-screen: arrival estimate shown', fs.includes('3:45 PM'));
  // Voice is REACHABLE on the driving surface, in compact wording.
  check('full-screen: voice control present on the driving surface', /Voice on|>Mute</.test(fs));
  check(
    'full-screen: voice control keeps a 64 px target (words shorten, target does not)',
    /min-h-16[^>]*>(Voice on|Mute)</.test(fs) ||
      /aria-label="(Voice on — enable voice guidance|Mute voice guidance)"/.test(fs),
  );
  check(
    'full-screen: voice sits with Stop, not below the fold with the pilot controls',
    fs.indexOf('enable voice guidance') < fs.indexOf('Destination entry') ||
      fs.indexOf('Mute voice guidance') < fs.indexOf('Destination entry'),
  );
  check(
    'full-screen: accessible name still starts with the visible words (WCAG 2.5.3)',
    !/>Voice on</.test(fs) || /aria-label="Voice on — enable voice guidance"/.test(fs),
  );
}

// ------------------------------------- OUTPUT-ONLY boundary (hard bans)
{
  const files = [
    'src/lib/navigator/voice-guidance.ts',
    'src/components/navigator/VoiceControls.tsx',
    'src/components/navigator/speech-port.ts',
    'src/components/navigator/DrivingScreen.tsx',
    'src/components/navigator/HosStrip.tsx',
  ];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    check(
      `output-only ${f.split('/').pop()}: no microphone/recognition/recording API`,
      !/SpeechRecognition|webkitSpeechRecognition|getUserMedia|MediaRecorder|mediaDevices|AudioContext|microphone/i.test(
        src,
      ),
    );
  }
  const netlify = readFileSync('netlify.toml', 'utf8');
  check(
    'Permissions-Policy still disables the microphone site-wide',
    /microphone=\(\)/.test(netlify),
  );
  const port = strip(readFileSync('src/components/navigator/speech-port.ts', 'utf8'));
  check(
    'speech-port degrades silently when speechSynthesis is missing',
    /supported:\s*false/.test(port) && /'speechSynthesis' in window/.test(port),
  );
  const lib = strip(readFileSync('src/lib/navigator/voice-guidance.ts', 'utf8'));
  check(
    'pure module never touches speechSynthesis directly (port-injected)',
    !/speechSynthesis/.test(lib),
  );
}

console.log(`voice-guidance: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

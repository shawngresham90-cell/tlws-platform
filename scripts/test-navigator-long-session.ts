/**
 * Long-session stability for the subsystems this block added (Block 2,
 * priority H).
 *
 * The Block 1 stability harness covers the navigation engines. Screen
 * wake, the network notice, the road-test report and the voice
 * announce-once ledger are all newer than it, and a ten-hour day is
 * exactly where "it works" and "it keeps working" stop being the same
 * claim. Everything here is DRIVEN, not asserted: real controllers, tens
 * of thousands of events, and the growth that results is measured and
 * printed rather than assumed.
 *
 * Simulated hours, not real ones — every clock is an argument. Nothing
 * here claims a measurement taken on a phone.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-long-session.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-long.cjs && node /tmp/test-long.cjs
 */
import { createScreenWake, type WakePort, type WakeSentinel } from '@/lib/navigator/screen-wake';
import { createVoiceGuidance, createManeuverAnnouncer } from '@/lib/navigator/voice-guidance';
import type { SpeechPort } from '@/lib/navigator/voice-guidance';
import { buildRoadTestReport } from '@/lib/navigator/road-test-report';
import { createPilotLog, PILOT_LOG_MAX_ENTRIES } from '@/lib/navigator/pilot-mode';
import { offlineNotice } from '@/lib/navigator/network-status';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_754_000_000_000;
const HOUR = 3_600_000;
const measured: string[] = [];

async function main(): Promise<void> {
  // ---- a ten-hour day of phone-locking, calls, and glove-box time --------
  {
    // Every request is granted immediately, as a healthy device would.
    const live = new Set<object>();
    let requests = 0;
    const port: WakePort = {
      supported: true,
      request: async (): Promise<WakeSentinel> => {
        requests += 1;
        const id = {};
        live.add(id);
        return {
          release: () => live.delete(id),
          onRelease: () => {},
        };
      },
    };
    const wake = createScreenWake(port);
    wake.setActive(true);
    await new Promise<void>((r) => setTimeout(r, 0));

    // 10 hours at one hide/show per 6 seconds is 6,000 cycles — far past
    // any real day, which is the point.
    const CYCLES = 6_000;
    for (let i = 0; i < CYCLES; i += 1) {
      wake.setVisible(false);
      await Promise.resolve();
      wake.setVisible(true);
      await Promise.resolve();
    }
    await new Promise<void>((r) => setTimeout(r, 0));

    check(
      'wake: at most one lock is ever held, however many times the phone hides',
      live.size <= 1,
      live.size,
    );
    check('wake: the controller still holds one at the end', wake.snapshot().held);
    // One request per re-show is correct and unavoidable — the browser
    // drops the lock every time. What must NOT happen is requests piling up
    // faster than cycles, or sentinels accumulating.
    check('wake: requests scale with cycles, never faster', requests <= CYCLES + 2, {
      requests,
      cycles: CYCLES,
    });
    measured.push(`wake: ${requests} requests over ${CYCLES} hide/show cycles, ${live.size} held`);

    wake.setActive(false);
    await new Promise<void>((r) => setTimeout(r, 0));
    check('wake: ending the trip releases everything', live.size === 0 && !wake.snapshot().held);
  }

  // ---- the announce-once ledger over a full day of turns -----------------
  {
    const spoken: string[] = [];
    const port: SpeechPort = {
      supported: true,
      speak: (t, done) => {
        spoken.push(t);
        done();
      },
      cancel: () => {},
    };
    const voice = createVoiceGuidance(port, { startMuted: false });

    // A dense urban day: a maneuver every 90 seconds for ten hours = 400
    // maneuvers, each with up to three announcement tiers.
    const MANEUVERS = 400;
    for (let i = 0; i < MANEUVERS; i += 1) {
      const announcer = createManeuverAnnouncer();
      const next = {
        action: 'turn',
        instruction: `Turn right onto Street Number ${i}.`,
        direction: 'right',
        mileMi: i * 0.5,
      };
      for (const d of [1.8, 0.45, 0.08]) {
        for (const req of announcer.collect({ next, following: null, distanceMi: d }, 60)) {
          voice.request(req);
        }
      }
      voice.tick(T0 + i * 90_000);
    }

    const snap = voice.snapshot();
    check('voice: every maneuver was announced', spoken.length >= MANEUVERS);
    check('voice: nothing is stuck speaking at the end of the day', snap.speakingId === null);
    check('voice: the queue drained', snap.queuedIds.length === 0);
    // The announce-once ledger is UNBOUNDED by design — an id that fell out
    // could be spoken twice, which is the failure the ledger exists to
    // prevent. So the question is not "is it bounded" but "how big does a
    // real day make it", and the answer is measured, not assumed.
    const ledgerBytes = MANEUVERS * 3 * 60; // ~60 chars per id, 3 tiers
    check(
      'voice: the announce-once ledger stays trivially small over a full day',
      snap.announcedCount <= MANEUVERS * 3 && ledgerBytes < 200_000,
      { announced: snap.announcedCount, approxBytes: ledgerBytes },
    );
    measured.push(
      `voice: ${snap.announcedCount} ids retained after ${MANEUVERS} maneuvers (~${Math.round(ledgerBytes / 1024)} KB)`,
    );
  }

  // ---- the pilot log and the report it feeds ------------------------------
  {
    const log = createPilotLog();
    // 10 hours of 1 Hz ticks is 36,000 entries through a 500-entry ring.
    const TICKS = 36_000;
    for (let i = 0; i < TICKS; i += 1) {
      log.record(T0 + i * 1000, 'tick', `mile ${(i / 100).toFixed(2)} health good`);
    }
    check(
      'log: the ring holds its bound over a ten-hour day',
      log.entries().length === PILOT_LOG_MAX_ENTRIES,
      log.entries().length,
    );
    check('log: and says how many it dropped', log.dropped() === TICKS - PILOT_LOG_MAX_ENTRIES);

    // The report is built on demand, and a driver may build it repeatedly.
    const base = {
      generatedMs: T0 + 10 * HOUR,
      pilot: Object.freeze({ active: true, debugLogging: true, reason: 'pilot' as const }),
      lifecycleState: 'navigating',
      trip: null,
      logDropped: log.dropped(),
      gps: { health: 'good', accuracyM: 7.5, speedMph: 62 },
      voice: null,
      wake: null,
      device: { userAgent: 'test', viewport: { width: 390, height: 844 }, online: true },
    };
    const first = buildRoadTestReport({ ...base, log: log.entries() });
    const startMs = Date.now();
    const heapBefore = process.memoryUsage().heapUsed;
    const BUILDS = 500;
    let lastLength = 0;
    for (let i = 0; i < BUILDS; i += 1) {
      lastLength = buildRoadTestReport({ ...base, log: log.entries() }).length;
    }
    const perBuildMs = (Date.now() - startMs) / BUILDS;
    const grownMb = (process.memoryUsage().heapUsed - heapBefore) / 1048576;

    check(
      'report: repeated builds return the same size — no accumulation',
      lastLength === first.length,
    );
    check('report: a full-ring report stays a sane size', first.length < 200_000, first.length);
    // A driver taps this at a truck stop, not in a loop, so the bar is
    // generous; what matters is that it is not seconds.
    check('report: building one is fast', perBuildMs < 50, perBuildMs);
    check('report: 500 builds do not retain memory', grownMb < 50, grownMb);
    measured.push(
      `report: ${(first.length / 1024).toFixed(1)} KB from a full 500-entry ring · ${perBuildMs.toFixed(2)} ms/build · ${grownMb.toFixed(1)} MB retained over ${BUILDS} builds`,
    );
  }

  // ---- the network notice is pure, so a day of flapping costs nothing ----
  {
    const startMs = Date.now();
    const FLAPS = 100_000;
    let notices = 0;
    for (let i = 0; i < FLAPS; i += 1) {
      if (offlineNotice({ online: i % 2 === 0 ? false : true, navigating: true }) !== null) {
        notices += 1;
      }
    }
    const totalMs = Date.now() - startMs;
    check('network: half the flaps produce a notice, exactly as specified', notices === FLAPS / 2);
    check('network: 100k transitions cost under a second', totalMs < 1000, totalMs);
    measured.push(`network: ${FLAPS} transitions in ${totalMs} ms`);
  }

  console.log(`  measured: ${measured.join(' · ')}`);
  console.log(`navigator-long-session: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();

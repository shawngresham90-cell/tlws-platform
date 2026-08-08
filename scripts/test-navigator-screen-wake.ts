/**
 * Screen wake during navigation (Block 2, priority I — mobile browser
 * lifecycle). The policy core runs for real against a scripted platform
 * port: when a lock is requested, when it is released, what happens when
 * the platform drops it under the app, and what happens when the platform
 * refuses. The browser adapter and the DrivingScreen wiring are checked
 * structurally, because neither can run outside a browser.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-screen-wake.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-screen-wake.cjs && node /tmp/test-screen-wake.cjs
 */
import { readFileSync } from 'node:fs';
import {
  createScreenWake,
  MAX_REFUSALS,
  type WakePort,
  type WakeSentinel,
} from '@/lib/navigator/screen-wake';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/**
 * Scripted platform. Requests settle only when the test says so, which is
 * the whole point: navigation ending mid-request is a real ordering, not
 * a hypothetical one.
 */
function fakePort(supported = true) {
  const pending: Array<(s: WakeSentinel | null) => void> = [];
  const rejects: Array<(e: unknown) => void> = [];
  const live: Array<{ released: boolean; fire: () => void }> = [];
  let requests = 0;
  const port: WakePort = {
    supported,
    request: () =>
      new Promise<WakeSentinel | null>((resolve, reject) => {
        requests += 1;
        pending.push(resolve);
        rejects.push(reject);
      }),
  };
  function grant(): void {
    const resolve = pending.shift();
    rejects.shift();
    const rec = { released: false, fire: () => {} };
    live.push(rec);
    const sentinel: WakeSentinel = {
      release: () => {
        rec.released = true;
      },
      onRelease: (cb) => {
        rec.fire = cb;
      },
    };
    resolve?.(sentinel);
  }
  function refuse(): void {
    const resolve = pending.shift();
    rejects.shift();
    resolve?.(null);
  }
  function throwOut(): void {
    pending.shift();
    const reject = rejects.shift();
    reject?.(new Error('NotAllowedError'));
  }
  return { port, grant, refuse, throwOut, live, requests: () => requests };
}

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

async function run(): Promise<void> {
  // -------------------------------------------------- the ordinary trip
  {
    const f = fakePort();
    const w = createScreenWake(f.port);
    check('idle: nothing is requested before navigation starts', f.requests() === 0);
    w.setActive(true);
    check('start: one request, not yet held', f.requests() === 1 && !w.snapshot().held);
    f.grant();
    await settle();
    check('start: the lock is held once granted', w.snapshot().held);

    w.setActive(false);
    await settle();
    check('stop: the lock is released with the trip', !w.snapshot().held && f.live[0].released);
    check('stop: no second request was made', f.requests() === 1);
  }

  // ------------------------------------- hidden page: the call-taking case
  {
    const f = fakePort();
    const w = createScreenWake(f.port);
    w.setActive(true);
    f.grant();
    await settle();

    // The browser releases the lock itself when the page hides, and fires
    // the release event. Nothing should be re-requested while hidden.
    w.setVisible(false);
    f.live[0].fire();
    await settle();
    check('hidden: no lock is held', !w.snapshot().held);
    check('hidden: no request is made while the page is not being looked at', f.requests() === 1);

    // The defect this pins: returning to the page does NOT restore the
    // lock by itself, so without a re-request the driver loses the screen
    // for the rest of the trip after taking one call.
    w.setVisible(true);
    check('return: the lock is re-requested', f.requests() === 2);
    f.grant();
    await settle();
    check('return: and held again', w.snapshot().held);
  }

  // -------------------------- the platform drops it under a visible page
  {
    const f = fakePort();
    const w = createScreenWake(f.port);
    w.setActive(true);
    f.grant();
    await settle();
    f.live[0].fire(); // OS policy dropped it; page still visible, trip still live
    await settle();
    check('dropped: a new lock is requested at once', f.requests() === 2);
    f.grant();
    await settle();
    check('dropped: and held', w.snapshot().held);

    // A late callback from the OLD sentinel must not clear the NEW lock.
    f.live[0].fire();
    await settle();
    check('dropped: a stale release callback cannot cancel the live lock', w.snapshot().held);
  }

  // ------------------------------- navigation ends while a request is out
  {
    const f = fakePort();
    const w = createScreenWake(f.port);
    w.setActive(true);
    w.setActive(false);
    f.grant(); // arrives after the trip ended
    await settle();
    check(
      'race: a lock granted after the trip ended is released, never held',
      !w.snapshot().held && f.live[0].released,
    );
  }

  // ------------------------------------------------ refusal, and its cap
  {
    // A device with the API behind a permissions policy refuses every
    // single time. Asking once per visibility flip would be a battery
    // leak that fixes nothing, so the asking stops at the cap.
    const g = fakePort();
    const w2 = createScreenWake(g.port);
    w2.setActive(true);
    for (let i = 0; i < MAX_REFUSALS + 3; i += 1) {
      g.refuse();
      await settle();
      w2.setVisible(false);
      w2.setVisible(true);
    }
    check(
      'refusal: consecutive refusals stop the asking at the cap',
      g.requests() === MAX_REFUSALS,
      g.requests(),
    );
    check('refusal: the reason is reported, not swallowed', w2.snapshot().lastRefusal !== null);

    // A new trip deserves a fresh attempt.
    w2.setActive(false);
    w2.setActive(true);
    check('refusal: a new trip tries again', g.requests() === MAX_REFUSALS + 1);
  }

  // --------------------------------------------- a rejecting platform
  {
    const f = fakePort();
    const w = createScreenWake(f.port);
    w.setActive(true);
    f.throwOut();
    await settle();
    check('reject: a thrown request never reaches the driving screen', !w.snapshot().held);
    check('reject: the error NAME is kept for the pilot report', w.snapshot().lastRefusal !== null);
  }

  // -------------------------------------------- unsupported platform
  {
    const f = fakePort(false);
    const w = createScreenWake(f.port);
    w.setActive(true);
    await settle();
    check(
      'unsupported: no request, no held lock, no throw',
      f.requests() === 0 && !w.snapshot().held && !w.snapshot().supported,
    );
  }

  // ------------------------------------------------- structure & wiring
  {
    const port = readFileSync('src/components/navigator/wake-lock-port.ts', 'utf8');
    check(
      'adapter: asks only for a SCREEN lock, never a system one',
      port.includes("request('screen')") && !/system/i.test(port),
    );
    check(
      'adapter: absent API is an ordinary unsupported outcome',
      port.includes('supported: false') && port.includes("'wakeLock' in navigator"),
    );

    const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
    check(
      'wiring: the wake controller is driven by the LIFECYCLE, not by a timer',
      screen.includes('wake.setActive(ACTIVE_LIFECYCLE_STATES.includes(lcState))'),
    );
    check(
      'wiring: page visibility is observed and unsubscribed',
      screen.includes("document.addEventListener('visibilitychange', onVisibility)") &&
        screen.includes("document.removeEventListener('visibilitychange', onVisibility)"),
    );
    check(
      'wiring: leaving the screen releases the lock',
      /wakeRef\.current\?\.setActive\(false\)/.test(screen),
    );
    check(
      'wiring: one controller for the life of the screen (a ref, not a re-creation)',
      screen.includes('wakeRef.current = createScreenWake(createBrowserWakePort())'),
    );

    const core = readFileSync('src/lib/navigator/screen-wake.ts', 'utf8');
    check(
      'core: the policy module reads no clock and touches no browser global',
      !/Date\.now|new Date|navigator\.|document\./.test(core),
    );
  }

  console.log(`navigator-screen-wake: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void run();

/**
 * The startup bench: how many steps stand between a parked driver and
 * live guidance — and does the simplified flow keep every safety rail?
 *
 * Pilot round 3, item "simplify startup". The pilot driver reported the
 * old parked flow as too many steps: enter name, enable location, enable
 * voice, select destination, plan route, start navigation. The target
 * flow is: choose destination → tap Start → navigating, with location
 * permission requested just in time BY the Start tap, the route planned
 * only from a real GPS fix, and exactly one HERE transaction per
 * attempt.
 *
 * TWO FLOWS, ONE LEDGER:
 *
 *   --flow current     drives the multi-step flow this bench was written
 *                      against (main @ 1ae8995) and MEASURES it: every
 *                      required tap and every forced wait is ledgered.
 *                      Kept so the "before" is executable evidence, not
 *                      a memory. Expected against the simplified build:
 *                      FAIL (the separate Enable location / Plan route
 *                      steps no longer exist — which is the point).
 *
 *   --flow simplified  the required behavioral scenarios for the new
 *                      flow, each in a fresh browser context:
 *
 *     s1  fresh visitor, permission in PROMPT state: destination → Start
 *         → browser permission → valid fix → ONE route request → navigating
 *     s2  returning visitor, permission GRANTED: destination → Start →
 *         ONE route request → navigating (no extra prompt, no dwell wait);
 *         also run across widths 320/360/390/430/768/1280
 *     s3  permission DENIED: one clear recovery message, ZERO route
 *         requests, still parked
 *     s4  location unavailable/timed out: honest recovery, no guessed
 *         origin, ZERO route requests — then a retry that succeeds
 *     s5  rapid repeated Start taps: ONE location-start operation, ONE
 *         route request
 *     s6  blank name: navigation works, NO personalized greeting is
 *         fabricated
 *     s7  name provided + voice on: the existing personalized route-start
 *         greeting still says exactly one "Here's your route, <name>."
 *     s8  voice never enabled: navigation begins and stays muted
 *         (zero utterances)
 *     s9  voice enabled through a real tap: the in-gesture confirmation
 *         line still speaks (the mobile-Safari unlock contract)
 *     s10 route failure: honest refusal, still parked, safe retry
 *     s11 motion safety: destination editing locks while the vehicle is
 *         moving
 *     s12 reload mid-drive: PR #302 restore still works with ZERO
 *         additional provider spend (authority: navigator-trip-restore.mjs)
 *     s13 map rendering: PR #301 — driving-map tiles cover their
 *         container (no half-blank map)
 *
 * The geolocation, permissions and speechSynthesis APIs are scripted
 * fakes injected before any page code runs — Playwright's native
 * emulation cannot express the PROMPT state or a controlled denial, and
 * the fake records what the app asked for (watch calls, permission
 * queries, utterances) so "just in time" and "exactly once" are measured
 * rather than assumed. The app under test is a REAL production build;
 * the only mocked first-party endpoints are the route and search APIs,
 * both counted.
 *
 * Exit 0 when every selected scenario passes; exit 1 otherwise.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, not a CI gate, exactly like the other
 * scripts under scripts/bench. Install it ad hoc first:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3210 &
 *   node scripts/bench/navigator-startup.mjs --password <pw> \
 *     [--flow simplified|current] [--only s1,s2] [--port 3210] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3210');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const FLOW = arg('flow', 'simplified');
const ONLY = (arg('only', '') ?? '').split(',').filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;
const WIDTHS = [320, 360, 390, 430, 768, 1280];

/** The same synthetic validated route the other benches use. */
function syntheticRoute() {
  const geometry = [];
  for (let i = 0; i <= 300; i++) {
    geometry.push([ORIGIN.lat + (i * 0.02) / MI_PER_DEG_LAT, ORIGIN.lng]);
  }
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: 'startup-bench',
      distanceMiles: 6,
      seconds: 480,
      geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
        {
          action: 'turn',
          instruction: 'Turn right onto Old Mill Road toward the receiving gate.',
          direction: 'right',
          offset: 150,
        },
        {
          action: 'arrive',
          instruction: 'Arrive at the receiving gate.',
          direction: null,
          offset: 300,
        },
      ],
    },
  };
}

const SEARCH_PLACES = {
  ok: true,
  places: [
    {
      id: 'bench-place-1',
      title: 'Bench Distribution Center',
      address: '100 Depot Rd, Chattanooga, TN',
      position: { lat: ORIGIN.lat + 6 / MI_PER_DEG_LAT, lng: ORIGIN.lng },
      facility: 'distribution-center',
      distanceMi: 6.0,
    },
  ],
};

/**
 * Injected before any page script. Replaces geolocation, permissions and
 * speechSynthesis with controllable fakes that RECORD what the app asked
 * for. `mode` is the permission state the browser would be in:
 * 'granted' | 'prompt' | 'denied'.
 */
function initScript(mode) {
  return `(() => {
  const state = {
    mode: ${JSON.stringify(mode)},
    watchCalls: 0,
    permQueries: 0,
    nextId: 1,
    active: new Map(),
    pendingPrompt: [],
  };
  const deniedErr = { code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'denied' };
  window.__geoTest = {
    counts: () => ({ watchCalls: state.watchCalls, active: state.active.size, permQueries: state.permQueries, mode: state.mode }),
    grant() {
      state.mode = 'granted';
      for (const w of state.pendingPrompt.splice(0)) state.active.set(w.id, w);
    },
    deny() {
      state.mode = 'denied';
      for (const w of state.pendingPrompt.splice(0)) w.err(deniedErr);
    },
    emit(fix) {
      for (const w of state.active.values()) {
        w.ok({
          coords: {
            latitude: fix.lat, longitude: fix.lng,
            accuracy: fix.accuracy ?? 8,
            speed: fix.speed ?? 0, heading: fix.heading ?? null,
            altitude: null, altitudeAccuracy: null,
          },
          timestamp: Date.now(),
        });
      }
    },
    error(kind) {
      const code = kind === 'timeout' ? 3 : 2;
      for (const w of state.active.values()) {
        w.err({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: kind });
      }
    },
  };
  navigator.geolocation.watchPosition = (ok, err) => {
    state.watchCalls += 1;
    const id = state.nextId++;
    const w = { id, ok, err };
    if (state.mode === 'denied') setTimeout(() => err(deniedErr), 0);
    else if (state.mode === 'prompt') state.pendingPrompt.push(w);
    else state.active.set(id, w);
    return id;
  };
  navigator.geolocation.getCurrentPosition = (ok, err) => {
    const id = navigator.geolocation.watchPosition(ok, err);
    setTimeout(() => navigator.geolocation.clearWatch(id), 0);
  };
  navigator.geolocation.clearWatch = (id) => {
    state.active.delete(id);
    state.pendingPrompt = state.pendingPrompt.filter((w) => w.id !== id);
  };
  const realQuery = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = (desc) => {
    if (desc && desc.name === 'geolocation') {
      state.permQueries += 1;
      return Promise.resolve({ state: state.mode, onchange: null, addEventListener() {}, removeEventListener() {} });
    }
    return realQuery(desc);
  };
  const utterances = [];
  window.__speechTest = { utterances };
  // defineProperty, not assignment: window.speechSynthesis is a
  // getter-only accessor, so a plain assignment fails SILENTLY and the
  // app would talk to the real (mute, headless) engine while this
  // recorder saw nothing.
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: function (text) {
      this.text = text; this.lang = ''; this.onend = null; this.onerror = null;
    },
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      paused: false,
      speak(u) { utterances.push(u.text); setTimeout(() => { if (u.onend) u.onend(); }, 30); },
      cancel() {},
      resume() {},
      getVoices() { return []; },
    },
  });
})();`;
}

/* ------------------------------------------------------------------ */

let failures = 0;
function verdict(name, cond, detail = '') {
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures += 1;
}

// The pilot cookie from the FIRST login, reused by every later context:
// the access endpoint throttles repeated password submissions per IP
// (that is its job), and this bench runs a dozen scenarios.
let savedStorageState = null;

async function makeContext(browser, { mode = 'granted', width = 390, height = 844 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 700,
    hasTouch: width < 700,
    deviceScaleFactor: 2,
    storageState: savedStorageState ?? undefined,
  });
  const counters = { route: 0, search: 0, searchWithoutOrigin: 0, routeFailures: 0 };
  let routeFailNext = { n: 0 };
  await context.route('**/api/navigator/route', (r) => {
    counters.route += 1;
    if (routeFailNext.n > 0) {
      routeFailNext.n -= 1;
      counters.routeFailures += 1;
      return r.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          state: 'provider-failed',
          problems: [{ code: 'bench-injected' }],
        }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute()),
    });
  });
  await context.route('**/api/navigator/destination-search**', (r) => {
    counters.search += 1;
    const u = new URL(r.request().url());
    if (!u.searchParams.has('lat')) counters.searchWithoutOrigin += 1;
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SEARCH_PLACES),
    });
  });
  await context.addInitScript(initScript(mode));
  const page = await context.newPage();
  return { context, page, counters, failRoute: (n) => (routeFailNext.n = n) };
}

async function login(page) {
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/navigator/access')) {
      throw new Error('the pilot gate did not accept the password');
    }
    savedStorageState = await page.context().storageState();
  }
  await page.waitForTimeout(600); // hydration
}

const geo = {
  counts: (page) => page.evaluate(() => window.__geoTest.counts()),
  grant: (page) => page.evaluate(() => window.__geoTest.grant()),
  deny: (page) => page.evaluate(() => window.__geoTest.deny()),
  emit: (page, fix) => page.evaluate((f) => window.__geoTest.emit(f), fix),
  error: (page, kind) => page.evaluate((k) => window.__geoTest.error(k), kind),
  utterances: (page) => page.evaluate(() => window.__speechTest.utterances.slice()),
};

/** Feed parked fixes once a second for n seconds. */
async function feedParked(page, seconds, { speed = 0 } = {}) {
  for (let i = 0; i < seconds; i++) {
    await geo.emit(page, { lat: ORIGIN.lat, lng: ORIGIN.lng, speed });
    await page.waitForTimeout(1000);
  }
}

/** Feed moving fixes (northbound) once a second for n seconds. */
async function feedMoving(page, seconds, metersPerSecond, startLat = ORIGIN.lat) {
  const M_PER_DEG_LAT = 111320;
  for (let i = 0; i < seconds; i++) {
    await geo.emit(page, {
      lat: startLat + (metersPerSecond * (i + 1)) / M_PER_DEG_LAT,
      lng: ORIGIN.lng,
      speed: metersPerSecond,
      heading: 0,
    });
    await page.waitForTimeout(1000);
  }
  return startLat + (metersPerSecond * seconds) / M_PER_DEG_LAT;
}

async function bodyText(page) {
  return page.locator('body').innerText();
}

async function pickDestination(page) {
  await page.getByLabel(/Search for a destination/).fill('Bench Distribution');
  await page.getByRole('button', { name: /Bench Distribution Center/ }).click({ timeout: 10_000 });
}

async function isNavigating(page) {
  const text = await bodyText(page);
  // Distance formats as miles or, close to the maneuver, as feet.
  return /\bNavigating\b/.test(text) && /In [\d.,]+ (mi|ft)/.test(text);
}

/** Map coverage measure, same construction as the half-map bench. */
async function mapCoverage(page) {
  return page.evaluate(() => {
    const container = document.querySelector('.leaflet-container');
    if (!container) return null;
    const c = container.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return { width: c.width, height: c.height, coverage: 0 };
    const tiles = Array.from(container.querySelectorAll('img.leaflet-tile'));
    const cols = 24,
      rows = 24;
    let covered = 0;
    const rects = tiles.map((t) => t.getBoundingClientRect());
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = c.left + ((i + 0.5) * c.width) / cols;
        const y = c.top + ((j + 0.5) * c.height) / rows;
        if (rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered++;
      }
    }
    return { width: c.width, height: c.height, coverage: covered / (cols * rows) };
  });
}

/* ================================================================== */
/* --flow current: the measured BEFORE (main @ 1ae8995)               */
/* ================================================================== */

async function runCurrentFlow(browser) {
  console.log('\n=== flow: current (the multi-step startup this bench measures) ===');
  const { context, page, counters } = await makeContext(browser, { mode: 'granted' });
  const taps = [];
  const waits = [];
  try {
    await login(page);

    let text = await bodyText(page);
    verdict(
      'parked page: destination entry is LOCKED before location + stationary dwell',
      /Destination entry is locked/.test(text),
    );

    await page.getByRole('button', { name: /Enable location/i }).click();
    taps.push('Enable location');

    // The stationary dwell: destination entry unlocks only after 30 s of
    // sub-3-mph fixes. Measure how long the driver actually waits.
    const dwellStart = Date.now();
    let unlocked = false;
    for (let i = 0; i < 45; i++) {
      await geo.emit(page, { lat: ORIGIN.lat, lng: ORIGIN.lng, speed: 0 });
      await page.waitForTimeout(1000);
      if (
        await page
          .getByLabel(/Search for a destination/)
          .isVisible()
          .catch(() => false)
      ) {
        unlocked = true;
        break;
      }
    }
    const dwellSeconds = Math.round((Date.now() - dwellStart) / 1000);
    waits.push(`${dwellSeconds}s stationary dwell before destination entry unlocked`);
    verdict('destination entry unlocked after the dwell', unlocked, `${dwellSeconds}s`);

    await pickDestination(page);
    taps.push('type destination', 'pick destination');

    await page.getByRole('button', { name: /Plan validated truck route/i }).click();
    taps.push('Plan validated truck route');

    await page.getByRole('button', { name: /^Start navigation$/ }).click({ timeout: 15_000 });
    taps.push('Start navigation');

    await feedMoving(page, 4, 12);
    const navigating = await isNavigating(page);
    if (!navigating)
      console.log(`  [debug] page text: ${JSON.stringify((await bodyText(page)).slice(0, 900))}`);
    verdict('navigating after the full step sequence', navigating);
    verdict('exactly one route request', counters.route === 1, `saw ${counters.route}`);

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/current-flow-navigating.png` });
  } finally {
    console.log(`\n  measured steps (beyond password): ${taps.length}`);
    taps.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));
    waits.forEach((w) => console.log(`    + forced wait: ${w}`));
    await context.close();
  }
}

/* ================================================================== */
/* --flow simplified: the required scenarios                          */
/* ================================================================== */

const scenarios = {};

/** s1 — fresh visitor, permission in PROMPT state. */
scenarios.s1 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'prompt' });
  try {
    await login(page);
    let c = await geo.counts(page);
    verdict(
      's1: no geolocation watch before Start (prompt state)',
      c.watchCalls === 0,
      `watchCalls=${c.watchCalls}`,
    );

    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await page.waitForTimeout(400);

    c = await geo.counts(page);
    verdict(
      's1: the Start tap is the gesture that requests location',
      c.watchCalls === 1,
      `watchCalls=${c.watchCalls}`,
    );
    verdict(
      's1: honest progress while permission is pending',
      /Getting location/.test(await bodyText(page)),
    );
    verdict('s1: no route request before a fix exists', counters.route === 0);

    await geo.grant(page);
    await feedParked(page, 2);
    await page.waitForTimeout(800);
    await feedMoving(page, 3, 12);

    verdict('s1: navigating after grant + fix', await isNavigating(page));
    verdict('s1: exactly one route request', counters.route === 1, `saw ${counters.route}`);
    verdict(
      's1: destination search worked without a location (no origin sent)',
      counters.searchWithoutOrigin > 0,
      `unbiased searches=${counters.searchWithoutOrigin}`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s1-prompt-to-navigating.png` });
  } finally {
    await context.close();
  }
};

/** s2 — returning visitor, permission GRANTED; run at every width. */
scenarios.s2 = async (browser) => {
  for (const width of WIDTHS) {
    const { context, page, counters } = await makeContext(browser, {
      mode: 'granted',
      width,
      height: width >= 768 ? 900 : 844,
    });
    try {
      await login(page);
      // Fixes flow immediately: permission is already granted, so the
      // watch resumes without a tap and without a prompt.
      await feedParked(page, 2);

      const t0 = Date.now();
      await pickDestination(page);
      await page.getByRole('button', { name: /^Start$/ }).click();
      await feedParked(page, 2);
      await page.waitForTimeout(500);
      await feedMoving(page, 3, 12);
      const seconds = Math.round((Date.now() - t0) / 1000);

      const noHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      );
      verdict(
        `s2@${width}: destination → Start → navigating (${seconds}s, no dwell)`,
        await isNavigating(page),
      );
      verdict(
        `s2@${width}: exactly one route request`,
        counters.route === 1,
        `saw ${counters.route}`,
      );
      verdict(`s2@${width}: no horizontal scroll`, noHScroll);
      const c = await geo.counts(page);
      verdict(`s2@${width}: exactly one live watch`, c.active === 1, `active=${c.active}`);
      if (SHOTS && (width === 320 || width === 390 || width === 1280)) {
        await page.screenshot({ path: `${SHOTS}/s2-${width}-navigating.png` });
      }
    } finally {
      await context.close();
    }
  }
};

/** s3 — permission denied. */
scenarios.s3 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'denied' });
  try {
    await login(page);
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await page.waitForTimeout(1500);

    const text = await bodyText(page);
    verdict('s3: one clear recovery message', /Location permission is denied/.test(text));
    verdict('s3: zero route requests', counters.route === 0, `saw ${counters.route}`);
    verdict(
      's3: still parked (Start still offered)',
      await page.getByRole('button', { name: /^Start$/ }).isVisible(),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s3-denied.png` });
  } finally {
    await context.close();
  }
};

/** s4 — location unavailable / timed out, then a successful retry. */
scenarios.s4 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'prompt' });
  try {
    await login(page);
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await geo.grant(page);
    await page.waitForTimeout(300);
    // The platform answers with a timeout instead of a fix — the same
    // signal the browser's own 15 s watch bound produces.
    await geo.error(page, 'timeout');
    await page.waitForTimeout(1200);

    const text = await bodyText(page);
    verdict(
      's4: honest recovery on timeout',
      /couldn.t get a GPS fix|Location is unavailable/i.test(text),
    );
    verdict('s4: zero route requests without a fix', counters.route === 0, `saw ${counters.route}`);

    // Safe retry: tap Start again, fixes arrive this time.
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    await feedMoving(page, 3, 12);
    verdict('s4: retry reaches navigation', await isNavigating(page));
    verdict(
      's4: exactly one route request across the retry',
      counters.route === 1,
      `saw ${counters.route}`,
    );
  } finally {
    await context.close();
  }
};

/** s5 — rapid repeated Start taps. */
scenarios.s5 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'prompt' });
  try {
    await login(page);
    await pickDestination(page);
    const start = page.getByRole('button', { name: /^Start$/ });
    await start.click();
    // Four more taps as fast as the harness can deliver them, while the
    // permission prompt is still undecided.
    for (let i = 0; i < 4; i++) await start.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    let c = await geo.counts(page);
    verdict(
      's5: one location-start operation across 5 rapid taps',
      c.watchCalls === 1,
      `watchCalls=${c.watchCalls}`,
    );

    await geo.grant(page);
    await feedParked(page, 2);
    await page.waitForTimeout(700);
    await feedMoving(page, 3, 12);
    verdict('s5: exactly one route request', counters.route === 1, `saw ${counters.route}`);
    verdict('s5: navigating', await isNavigating(page));
  } finally {
    await context.close();
  }
};

/** s6 — blank name: no fabricated greeting. */
scenarios.s6 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    // Voice ON so anything the app wanted to say would actually be spoken.
    await page.getByRole('button', { name: /Enable voice/i }).click();
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    await feedMoving(page, 3, 12);

    const spoken = await geo.utterances(page);
    const personal = spoken.filter((u) =>
      /Good (morning|afternoon|evening)|Here.s your route/.test(u),
    );
    verdict('s6: navigating with a blank name', await isNavigating(page));
    verdict(
      's6: no personalized line was fabricated',
      personal.length === 0,
      JSON.stringify(personal),
    );
    verdict('s6: one route request', counters.route === 1);
  } finally {
    await context.close();
  }
};

/** s7 — name provided: the personalized route-start greeting survives. */
scenarios.s7 = async (browser) => {
  const { context, page } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    await page.getByLabel(/Your first name/i).fill('Shawn');
    await page.getByRole('button', { name: /Save name/i }).click();
    await page.getByRole('button', { name: /Enable voice/i }).click();
    await page.waitForTimeout(1500); // greeting window: passive line lands after the confirmation
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 3);
    await page.waitForTimeout(800);
    await feedMoving(page, 3, 12);

    const spoken = await geo.utterances(page);
    const routeStart = spoken.filter((u) => u === "Here's your route, Shawn. Now let's get it!");
    verdict(
      's7: the personalized route-start line spoke exactly once',
      routeStart.length === 1,
      JSON.stringify(spoken),
    );
    const greeting = spoken.filter((u) => /^Good (morning|afternoon|evening), Shawn\.$/.test(u));
    verdict(
      's7: the time-of-day greeting spoke exactly once',
      greeting.length === 1,
      JSON.stringify(greeting),
    );
    verdict('s7: navigating', await isNavigating(page));
  } finally {
    await context.close();
  }
};

/** s8 — voice never enabled: muted navigation, zero utterances. */
scenarios.s8 = async (browser) => {
  const { context, page } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    await feedMoving(page, 4, 12);

    const spoken = await geo.utterances(page);
    verdict(
      's8: navigation began muted — zero utterances',
      spoken.length === 0,
      JSON.stringify(spoken),
    );
    verdict('s8: navigating', await isNavigating(page));
  } finally {
    await context.close();
  }
};

/** s9 — voice enabled through a real tap: the unlock confirmation speaks. */
scenarios.s9 = async (browser) => {
  const { context, page } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 1);
    await page.getByRole('button', { name: /Enable voice/i }).click();
    await page.waitForTimeout(400);
    const spoken = await geo.utterances(page);
    verdict(
      's9: in-gesture confirmation spoke',
      spoken.includes('Voice guidance on.'),
      JSON.stringify(spoken),
    );
    // And mute works back off the same tap target.
    await page.getByRole('button', { name: /Mute voice/i }).click();
    verdict(
      's9: mute control returned',
      await page.getByRole('button', { name: /Enable voice/i }).isVisible(),
    );
  } finally {
    await context.close();
  }
};

/** s10 — route failure: honest refusal, still parked, safe retry. */
scenarios.s10 = async (browser) => {
  const { context, page, counters, failRoute } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    await pickDestination(page);
    failRoute(1);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(800);

    const text = await bodyText(page);
    verdict('s10: honest refusal shown', /Route refused:/.test(text));
    verdict(
      's10: still parked (Start available again)',
      await page.getByRole('button', { name: /^Start$/ }).isVisible(),
    );
    verdict(
      's10: one request spent on the failed attempt',
      counters.route === 1,
      `saw ${counters.route}`,
    );

    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    await feedMoving(page, 3, 12);
    verdict('s10: retry reaches navigation', await isNavigating(page));
    verdict(
      's10: one request per attempt (2 total)',
      counters.route === 2,
      `saw ${counters.route}`,
    );
  } finally {
    await context.close();
  }
};

/** s11 — motion safety: destination editing locks while moving. */
scenarios.s11 = async (browser) => {
  const { context, page } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    verdict(
      's11: destination entry available while parked (setup window)',
      await page.getByLabel(/Search for a destination/).isVisible(),
    );
    // Now the truck moves: 12 s above the 5 mph threshold trips MOVING.
    await feedMoving(page, 13, 12);
    const text = await bodyText(page);
    verdict('s11: destination entry LOCKED while moving', /Destination entry is locked/.test(text));
    verdict(
      's11: search input no longer reachable',
      !(await page
        .getByLabel(/Search for a destination/)
        .isVisible()
        .catch(() => false)),
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s11-moving-locked.png` });
  } finally {
    await context.close();
  }
};

/** s12 — reload mid-drive: restore with zero additional provider spend. */
scenarios.s12 = async (browser) => {
  const { context, page, counters } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    let lat = await feedMoving(page, 8, 27);
    verdict('s12: navigating before the reload', await isNavigating(page));
    const callsBefore = counters.route;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await feedMoving(page, 4, 27, lat);
    verdict('s12: navigating again after the reload, no questions asked', await isNavigating(page));
    verdict(
      's12: zero additional provider spend on restore',
      counters.route === callsBefore,
      `route calls ${callsBefore} → ${counters.route}`,
    );
  } finally {
    await context.close();
  }
};

/** s13 — PR #301: the driving map's tiles cover their container. */
scenarios.s13 = async (browser) => {
  const { context, page } = await makeContext(browser, { mode: 'granted' });
  try {
    await login(page);
    await feedParked(page, 2);
    await pickDestination(page);
    await page.getByRole('button', { name: /^Start$/ }).click();
    await feedParked(page, 2);
    await page.waitForTimeout(500);
    await feedMoving(page, 6, 12);

    const m = await mapCoverage(page);
    verdict(
      's13: driving-map tiles cover ≥95% of the container',
      m !== null && m.coverage >= 0.95 && m.height > 0,
      m === null ? 'no map' : `coverage=${(m.coverage * 100).toFixed(1)}% (${m.width}x${m.height})`,
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/s13-map-coverage.png` });
  } finally {
    await context.close();
  }
};

/* ================================================================== */

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  try {
    if (FLOW === 'current') {
      await runCurrentFlow(browser);
    } else {
      const names = Object.keys(scenarios).filter((n) => ONLY.length === 0 || ONLY.includes(n));
      for (const name of names) {
        console.log(`\n=== ${name} ===`);
        await scenarios[name](browser);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(failures === 0 ? '\nPASS: startup bench' : `\nFAIL: ${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

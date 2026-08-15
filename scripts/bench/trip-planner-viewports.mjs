/**
 * Plan My Day in a real browser: twelve plans, eight phone sizes, and the
 * two things about the request that a unit test cannot see.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 * Proven here, from the browser, with no fixture involved:
 *   - ONE SUBMISSION IS ONE REQUEST. Every POST the page makes to
 *     /api/trip-planner/quote is counted. A tap produces exactly one.
 *   - RAPID TAPS DO NOT DUPLICATE IT. Five taps inside one tick still
 *     produce one, which is the `inFlight` ref doing its job — `pending`
 *     state alone would not, because React had not re-rendered yet.
 *   - THE LIVE ENDPOINT ANSWERS. One scenario runs with NO interception
 *     at all, against the real route handler, and its refusal path is
 *     read off the screen.
 *   - /trip-planner/classic STILL WORKS. The original planner is driven
 *     through its own first step at the reference size.
 *
 * Proven here with the ENGINE's output standing in for a provider:
 *   - the twelve plan states render correctly at all eight sizes. The
 *     payloads come from `trip-planner-fixtures.ts`, which calls the real
 *     `planMyDay`; the bench asserts the DOM against the SAME plan JSON
 *     the page was handed, so a screen that renders a stale or softened
 *     version of a refusal fails.
 *
 * NOT proven here, and not claimed anywhere in the output:
 *   - the HERE round trip. The provider call is made SERVER-side, so
 *     Playwright cannot see or intercept it, and this environment has no
 *     HERE_API_KEY. That one-quote-one-route-request property is pinned
 *     by a unit assertion in scripts/test-trip-planner-api.ts instead;
 *     this file proves the half of the chain that lives in the browser.
 *   - map TILES. The basemap is a third-party raster source and no run
 *     depends on it: the bench asserts the canvas mounts and the legend
 *     reports what was drawn, never that a tile arrived.
 *
 * NO CREDENTIALS ARE LOGGED. Every request URL passes through `redact()`
 * before it reaches a log, a report or a screenshot filename.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   npx next build && npx next start -p 3311 &
 *   node scripts/bench/trip-planner-viewports.mjs [--port 3311]
 *     [--shots <dir>] [--json <file>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1];
};
const PORT = Number(arg('port', 3311));
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = arg('shots', join(tmpdir(), 'trip-planner-shots'));
const JSON_OUT = arg('json', '');

/** The eight sizes a phone in a truck actually is, portrait and landscape. */
const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 360, h: 640 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 412, h: 915 },
  { w: 430, h: 932 },
  { w: 844, h: 390, landscape: true },
  { w: 932, h: 430, landscape: true },
];
/** The size every screenshot and every one-off probe is taken at. */
const REFERENCE = { w: 390, h: 844 };

const QUOTE_PATH = '/api/trip-planner/quote';

/** How long the stubbed endpoint takes to answer, in the rapid-tap probe. */
const RESPONSE_MS = 1500;

/* ------------------------------------------------------- accounting */

let checks = 0;
let failures = 0;
let notes = 0;
const failLog = [];
const noteLog = [];

function verdict(name, ok, detail = '') {
  const line = `${name}${detail === '' ? '' : ` — ${detail}`}`;
  if (ok) {
    checks += 1;
    return;
  }
  failures += 1;
  failLog.push(line);
  console.log(`  FAIL ${line}`);
}

/**
 * A measured fact that is known-open rather than broken.
 *
 * Kept distinct from a pass so the totals cannot launder a limitation
 * into a green tick, and distinct from a failure so a known environmental
 * gap does not read as a product defect.
 */
function note(name, detail = '') {
  notes += 1;
  noteLog.push(`${name}${detail === '' ? '' : ` — ${detail}`}`);
  console.log(`  NOTE (measured, known-open) ${name}${detail === '' ? '' : ` — ${detail}`}`);
}

/* -------------------------------------------------------- redaction */

const CREDENTIAL_PARAM = /(key|apikey|api_key|token|secret|password|signature|sig|auth)/i;

function redact(raw) {
  try {
    const u = new URL(String(raw), BASE);
    for (const k of [...u.searchParams.keys()]) {
      if (CREDENTIAL_PARAM.test(k)) u.searchParams.set(k, '<redacted>');
    }
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return String(raw).split('?')[0];
  }
}

/* ------------------------------------------------------------ input */

/**
 * Tap where a thumb taps.
 *
 * Playwright's own `.click()` calls `scrollIntoViewIfNeeded` first, which
 * scrolls the page by hundreds of pixels no driver ever sees and then
 * reports a clean click. A raw touch at the element's centre is what the
 * product actually receives.
 */
async function realTap(page, locator) {
  const box = await locator.boundingBox();
  if (box === null) return { ok: false, why: 'no box' };
  const vp = page.viewportSize();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (x < 0 || y < 0 || x > vp.width || y > vp.height) {
    return { ok: false, why: `centre ${Math.round(x)},${Math.round(y)} outside the viewport` };
  }
  await page.touchscreen.tap(x, y);
  return { ok: true };
}

/**
 * Scroll the way a driver scrolls, then tap.
 *
 * The Plan My Day form is taller than every phone it targets — region,
 * truck, origin, destination, clocks and buffer all sit above the button
 * — so reaching it REQUIRES scrolling and that is not a defect. What
 * would be a defect is scrolling silently, so the distance is measured
 * and reported: a button that needed 1,300px of scroll on a 390px-wide
 * phone is a finding even when the tap succeeds.
 *
 * The scroll is an explicit gesture rather than Playwright's implicit
 * `scrollIntoViewIfNeeded` inside `.click()`. The difference matters: the
 * implicit one runs at click time and hides whether the element was ever
 * reachable, which is exactly how a previous milestone mis-diagnosed a
 * 382px jump as a product bug.
 */
async function scrollThenTap(page, locator) {
  const before = await page.evaluate(() => window.scrollY);
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.scrollY);
  const tapped = await realTap(page, locator);
  return { ...tapped, scrolledPx: Math.round(after - before) };
}

/* --------------------------------------------------------- fixtures */

/**
 * Build the twelve plans from the REAL engine, right now.
 *
 * Regenerated on every run rather than committed as JSON: a checked-in
 * payload would keep passing after `planMyDay` changed shape, and the
 * bench would be testing a snapshot of a former product.
 */
function loadScenarios() {
  const cjs = join(tmpdir(), 'tp-fixtures.cjs');
  const json = join(tmpdir(), 'tp-scenarios.json');
  execFileSync(
    'npx',
    [
      'esbuild',
      'scripts/bench/trip-planner-fixtures.ts',
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--alias:@=./src',
      `--outfile=${cjs}`,
      '--log-level=error',
    ],
    { stdio: 'inherit' },
  );
  execFileSync('node', [cjs, json], { stdio: 'inherit' });
  return JSON.parse(readFileSync(json, 'utf8'));
}

/* ----------------------------------------------------------- probes */

/** Does the document scroll sideways? A cab screen has no room for it. */
async function overflowX(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Wait for the map to finish drawing, bounded.
 *
 * The renderer is a dynamic import and its layers land a few hundred
 * milliseconds after the results do, so reading the DOM the instant the
 * plan appears measures a map that has not started yet. A driver waits;
 * so does this. The wait is bounded and its expiry is NOT swallowed —
 * whatever is on screen at the deadline is what gets asserted.
 */
async function waitForMap(page, { drawable, expectedPins }, timeoutMs = 8000) {
  // A route line with no pins still has a renderer to wait for — the
  // clocks-unset scenario draws exactly that, and keying the wait on the
  // pin count alone made its canvas assertion race the dynamic import.
  if (!drawable) return;
  await page
    .waitForFunction(
      (want) =>
        document.querySelector('[data-plan-map] canvas') !== null &&
        document.querySelectorAll('[data-plan-pin]').length >= want,
      expectedPins,
      { timeout: timeoutMs },
    )
    .catch(() => {});
}

/** Every rendered state the results screen exposes, read in one pass. */
async function readScreen(page) {
  return page.evaluate(() => {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el === null ? null : el.textContent.trim();
    };
    const attr = (sel, name) => {
      const el = document.querySelector(sel);
      return el === null ? null : el.getAttribute(name);
    };
    return {
      hasResults: document.querySelector('[data-plan-results]') !== null,
      status: text('[data-plan-status]'),
      trafficHeading: text('[aria-labelledby="traffic-heading"] h2'),
      trafficLabel: text('[data-traffic-label]'),
      clockLimit: text('[data-clock-limit]'),
      stopTarget: text('[data-stop-target]'),
      clockMarker: attr('[data-clock-marker]', 'data-clock-marker'),
      cannotMap: text('[data-cannot-map]'),
      windowProblem: text('[data-window-problem]'),
      breakState: attr('[data-break]', 'data-break'),
      parkingHeadline: text('[data-parking-headline]'),
      parkingProblem: text('[data-parking-problem]'),
      parkingCount: document.querySelectorAll('[data-parking-choice]').length,
      parkingNames: Array.from(document.querySelectorAll('[data-parking-choice] p')).map((p) =>
        p.textContent.trim(),
      ),
      weather: attr('[data-weather]', 'data-weather'),
      eccc: document.querySelector('a[href*="weather.gc.ca"]') !== null,
      mapMounted: document.querySelector('[data-plan-map]') !== null,
      mapState: attr('[data-map-state]', 'data-map-state'),
      routeProblem: text('[data-route-problem]'),
      legend: Array.from(document.querySelectorAll('[data-legend]')).map((l) =>
        l.getAttribute('data-legend'),
      ),
      pins: document.querySelectorAll('[data-plan-pin]').length,
      mapCanvas: document.querySelector('[data-plan-map] canvas') !== null,
      disclaimers: Array.from(document.querySelectorAll('[data-disclaimer]')).map((d) =>
        d.textContent.trim(),
      ),
    };
  });
}

/**
 * The smallest rendered font inside the results, and the smallest tap
 * target among THE TRIP PLANNER'S OWN controls.
 *
 * The scope matters and was wrong at first. Measuring every `button, a,
 * select` in the document swept in the shared site chrome — the
 * `sr-only` skip link (1×1px by design, which is what `sr-only` IS), the
 * header wordmark, and the footer's 16–20px text links — and reported
 * that pre-existing, site-wide layout as a Trip Planner defect on all 96
 * scenario runs. Those elements are not this milestone's, are not
 * cockpit controls, and are unchanged by this PR.
 *
 * So the measurement is scoped to the planner's own two regions, where
 * the 44px floor is a real commitment about a thumb in a moving truck.
 * The site chrome is reported separately, once, as an observation.
 */
async function ergonomics(page) {
  return page.evaluate(() => {
    const results = document.querySelector('[data-plan-results]');
    if (results === null) return null;
    let minFont = Infinity;
    for (const el of results.querySelectorAll('p, dd, dt, li, h2')) {
      if (el.textContent.trim() === '') continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(size)) minFont = Math.min(minFont, size);
    }
    let minTap = Infinity;
    let smallest = null;
    const own = Array.from(
      document.querySelectorAll(
        '[data-plan-my-day] button, [data-plan-my-day] a[href], [data-plan-my-day] select',
      ),
      /*
       * MapLibre's own attribution control is excluded, and this is the
       * reason rather than a convenience.
       *
       * The "© OpenStreetMap" link is a 14px anchor the renderer injects
       * and the tile licence REQUIRES to be displayed. It is a legal
       * notice, not a control a driver operates: nobody taps it to plan a
       * night, growing it to 44px would misrepresent it as an action, and
       * hiding it to pass a bench would breach the attribution terms.
       *
       * The 44px floor is a promise about the buttons a thumb hits in a
       * moving truck, and it is measured against exactly those.
       */
    ).filter((el) => el.closest('.maplibregl-ctrl') === null);
    for (const el of own) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < minTap) {
        minTap = r.height;
        smallest = (el.textContent || el.getAttribute('aria-label') || el.tagName)
          .trim()
          .slice(0, 40);
      }
    }
    return {
      minFont: Number.isFinite(minFont) ? minFont : null,
      minTap: Number.isFinite(minTap) ? minTap : null,
      smallest,
      controls: own.length,
    };
  });
}

/* ------------------------------------------------------ page driver */

async function newPage(browser, vp, { intercept = null, delayMs = 0 } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const posts = [];
  const urls = [];
  page.on('request', (req) => {
    urls.push(redact(req.url()));
    if (req.method() === 'POST' && req.url().includes(QUOTE_PATH)) posts.push(redact(req.url()));
  });

  if (intercept !== null) {
    await page.route(`**${QUOTE_PATH}`, async (route) => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, plan: intercept }),
      });
    });
  }
  return { context, page, posts, urls };
}

/** Choose an origin and a destination from the real anchor list. */
async function chooseRoute(page) {
  const origin = page.locator('select[aria-label="Starting location"]');
  const dest = page.locator('select[aria-label="Destination"]');
  const options = await origin
    .locator('option')
    .evaluateAll((els) => els.map((e) => e.value).filter((v) => v !== ''));
  if (options.length < 2) return { ok: false, why: `only ${options.length} anchors available` };
  await origin.selectOption(options[0]);
  await dest.selectOption(options[1]);
  return { ok: true, count: options.length };
}

/* ------------------------------------------- one scenario, one size */

async function runScenario(browser, vp, scenario, { shot = false } = {}) {
  const label = `${vp.w}x${vp.h} ${scenario.key}`;
  const { context, page, posts } = await newPage(browser, vp, { intercept: scenario.plan });
  try {
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-plan-my-day]', { timeout: 15_000 });

    const picked = await chooseRoute(page);
    if (!picked.ok) {
      verdict(`${label}: anchors available`, false, picked.why);
      return;
    }

    const button = page.locator('[data-plan-button]');
    const tapped = await scrollThenTap(page, button);
    if (!tapped.ok) {
      verdict(`${label}: Plan My Day is tappable`, false, tapped.why);
      return;
    }
    await page.waitForSelector('[data-plan-results]', { timeout: 15_000 });

    const plan = scenario.plan;
    const wantPins =
      [plan.clockLimit, plan.stopTarget, plan.breakMarker].filter(
        (m) => m !== null && m.kind === 'pin',
      ).length + plan.map.parking.length;
    const drawable =
      plan.map.route.length >= 2 ||
      plan.map.parking.length > 0 ||
      [plan.clockLimit, plan.stopTarget, plan.breakMarker].some(
        (m) => m !== null && m.kind !== 'none',
      );
    await waitForMap(page, { drawable, expectedPins: wantPins });

    /* ---- one tap is one request ------------------------------------ */
    verdict(
      `${label}: one submission sends exactly one quote request`,
      posts.length === 1,
      `sent ${posts.length}`,
    );

    const seen = await readScreen(page);

    /* ---- the screen agrees with the plan it was handed -------------- */
    verdict(`${label}: results rendered`, seen.hasResults);
    verdict(
      `${label}: clock-limit marker state matches the engine (${plan.clockLimit.kind})`,
      seen.clockMarker === plan.clockLimit.kind,
      `screen=${seen.clockMarker}`,
    );
    if (plan.clockLimit.kind === 'none') {
      verdict(
        `${label}: the exact refusal sentence is shown, not a softened one`,
        seen.cannotMap === 'Clock-limit location cannot be mapped safely.',
        String(seen.cannotMap),
      );
    }
    verdict(
      `${label}: parking heading matches the count (${plan.parking.length})`,
      seen.parkingHeadline === plan.parkingHeadline,
      `screen=${seen.parkingHeadline}`,
    );
    verdict(
      `${label}: exactly the safe stops are listed`,
      seen.parkingCount === plan.parking.length,
      `screen=${seen.parkingCount} plan=${plan.parking.length}`,
    );
    verdict(
      `${label}: never more than three parking choices`,
      seen.parkingCount <= 3,
      String(seen.parkingCount),
    );
    if (plan.parking.length < 3 && plan.parkingProblem !== null) {
      verdict(
        `${label}: the shortfall is explained`,
        (seen.parkingProblem ?? '') === plan.parkingProblem,
        String(seen.parkingProblem),
      );
    }
    verdict(
      `${label}: traffic is only called live when the engine proved it`,
      (seen.trafficHeading === 'Live traffic included') === (plan.traffic.confidence === 'live'),
      `${seen.trafficHeading} / ${plan.traffic.confidence}`,
    );
    verdict(
      `${label}: the traffic sentence is the engine's`,
      seen.trafficLabel === plan.traffic.label,
      String(seen.trafficLabel),
    );

    /* ---- the break --------------------------------------------------- */
    const expectedBreak =
      plan.breakPlan === null
        ? null
        : plan.breakPlan.required === true
          ? 'required'
          : plan.breakPlan.required === false
            ? 'none'
            : 'unavailable';
    verdict(
      `${label}: break state matches the engine (${expectedBreak})`,
      seen.breakState === expectedBreak,
      `screen=${seen.breakState}`,
    );

    /* ---- weather ------------------------------------------------------ */
    const expectedWeather =
      plan.weather.ok === false
        ? plan.weather.reason
        : plan.weather.matches.length === 0
          ? 'clear'
          : 'matches';
    verdict(
      `${label}: weather state matches the engine (${expectedWeather})`,
      seen.weather === expectedWeather,
      `screen=${seen.weather}`,
    );
    if (plan.weather.ok === false && plan.weather.reason === 'region-unsupported') {
      verdict(`${label}: Canada offers the Environment Canada route out`, seen.eccc);
    }

    /* ---- the map ------------------------------------------------------ */
    if (drawable) {
      verdict(`${label}: the map canvas is mounted`, seen.mapMounted, String(seen.mapState));
      verdict(`${label}: the renderer actually started`, seen.mapCanvas, 'no canvas element');

      /*
       * THE LEGEND MUST NOT OUTRUN THE MAP.
       *
       * This assertion exists because its absence hid a real defect: the
       * legend read "Clock limit — marked" while zero markers had been
       * added, because the draw call waited on MapLibre's `load` event
       * and the tile server was unreachable. 1,670 checks passed over a
       * map that had drawn nothing. Counting the pins the plan earned
       * against the pins actually in the DOM is what closes that gap.
       */
      if (wantPins > 0) {
        verdict(
          `${label}: all ${wantPins} earned marker(s) are really on the map`,
          seen.pins === wantPins,
          `drew ${seen.pins}`,
        );
      }
    } else {
      verdict(
        `${label}: nothing drawable says so instead of showing an empty map`,
        seen.mapState === 'empty',
        String(seen.mapState),
      );
    }
    if (plan.map.routeProblem !== null) {
      verdict(
        `${label}: a missing road line is stated in words`,
        seen.routeProblem === plan.map.routeProblem,
        String(seen.routeProblem),
      );
    }
    verdict(
      `${label}: the legend reports the clock-limit state`,
      (seen.legend ?? []).includes(`Clock limit:${plan.clockLimit.kind}`),
      (seen.legend ?? []).join(' | '),
    );

    /* ---- it fits, and it can be read and tapped ---------------------- */
    const ox = await overflowX(page);
    verdict(`${label}: no horizontal overflow`, ox <= 0, `${ox}px`);
    const erg = await ergonomics(page);
    if (erg !== null) {
      verdict(
        `${label}: results type stays at or above 16px`,
        erg.minFont >= 16,
        `${erg.minFont}px`,
      );
      verdict(
        `${label}: every planner control is at least 44px tall`,
        erg.minTap >= 44,
        `${erg.minTap}px — ${erg.smallest} (of ${erg.controls} controls)`,
      );
    }

    verdict(
      `${label}: the ELD disclaimer is never dropped`,
      seen.disclaimers.some((d) => d.includes('not an ELD')),
      seen.disclaimers.join(' | '),
    );

    if (shot) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: join(SHOTS, `${scenario.key}-${vp.w}x${vp.h}.png`),
        fullPage: true,
      });
    }
  } finally {
    await context.close();
  }
}

/* ------------------------------------------------- the one-off probes */

/** Five taps in one breath still buy one route. */
async function probeRapidTaps(browser, vp, scenario) {
  const label = `${vp.w}x${vp.h} rapid-taps`;
  /*
   * A REALISTIC IN-FLIGHT WINDOW, or this measures nothing.
   *
   * The first attempt fulfilled the stub instantly, so the first plan
   * came back in under a millisecond and a later tap started a SECOND,
   * entirely legitimate request — a driver re-planning after results
   * appeared. That is not the guard failing; it is the fixture being
   * faster than any network, and it made the bench report a duplicate
   * charge that could not happen in a truck.
   *
   * The stub now answers in `RESPONSE_MS`, comfortably longer than the
   * taps take to dispatch, so all five genuinely land while one request
   * is in flight — which is the condition `inFlight` exists to handle.
   */
  const { context, page, posts } = await newPage(browser, vp, {
    intercept: scenario.plan,
    delayMs: RESPONSE_MS,
  });
  try {
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-plan-my-day]', { timeout: 15_000 });
    const picked = await chooseRoute(page);
    if (!picked.ok) {
      verdict(`${label}: anchors available`, false, picked.why);
      return;
    }
    const button = page.locator('[data-plan-button]');
    await button.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(120);
    const box = await button.boundingBox();
    if (box === null) {
      verdict(`${label}: button measurable`, false, 'no box');
      return;
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // No awaits between taps: this is the case a `pending` state variable
    // cannot catch, because React has not re-rendered yet.
    const startedAt = Date.now();
    await Promise.all([
      page.touchscreen.tap(x, y),
      page.touchscreen.tap(x, y),
      page.touchscreen.tap(x, y),
      page.touchscreen.tap(x, y),
      page.touchscreen.tap(x, y),
    ]);
    const tapsTookMs = Date.now() - startedAt;
    await page.waitForSelector('[data-plan-results]', { timeout: 15_000 });
    await page.waitForTimeout(500);

    /*
     * The precondition is asserted, not assumed. If the taps took longer
     * than the response, a single request would prove nothing about the
     * guard — it would just mean the later taps missed the window.
     */
    verdict(
      `${label}: all five taps landed while the request was still in flight`,
      tapsTookMs < RESPONSE_MS,
      `${tapsTookMs}ms of taps vs a ${RESPONSE_MS}ms response`,
    );
    verdict(
      `${label}: five taps still buy exactly one route request`,
      posts.length === 1,
      `sent ${posts.length}`,
    );
  } finally {
    await context.close();
  }
}

/** The real endpoint, with nothing intercepted. */
async function probeLiveEndpoint(browser, vp) {
  const label = `${vp.w}x${vp.h} live-endpoint`;
  const { context, page, posts } = await newPage(browser, vp);
  try {
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-plan-my-day]', { timeout: 15_000 });
    const picked = await chooseRoute(page);
    if (!picked.ok) {
      verdict(`${label}: anchors available`, false, picked.why);
      return;
    }
    verdict(`${label}: the directory supplied real anchors`, picked.count > 1, `${picked.count}`);

    const button = page.locator('[data-plan-button]');
    const tapped = await scrollThenTap(page, button);
    if (!tapped.ok) {
      verdict(`${label}: Plan My Day is tappable`, false, tapped.why);
      return;
    }
    // Either results or a status message — both are answers from the
    // real handler, and which one arrives depends on whether this
    // environment has a routing key.
    await page.waitForSelector('[data-plan-results], [data-plan-status]', { timeout: 30_000 });
    await page.waitForTimeout(1000);

    verdict(
      `${label}: one submission sends exactly one quote request`,
      posts.length === 1,
      `sent ${posts.length}`,
    );
    const seen = await readScreen(page);
    verdict(`${label}: the real endpoint returned a plan`, seen.hasResults, String(seen.status));
    if (seen.hasResults) {
      /*
       * WITHOUT A ROUTING KEY the route is a straight-line estimate, and
       * every timing-dependent answer must refuse. That is the honest
       * shape of this environment and is asserted rather than skipped.
       */
      const refused =
        seen.clockMarker === 'none' &&
        seen.parkingCount === 0 &&
        seen.routeProblem !== null &&
        seen.trafficHeading !== 'Live traffic included';
      verdict(
        `${label}: with no routing key every timed answer refuses`,
        refused,
        `marker=${seen.clockMarker} parking=${seen.parkingCount} traffic=${seen.trafficHeading}`,
      );
      note(
        `${label}: the live HERE round trip is UNPROVEN in this environment`,
        'no HERE_API_KEY is set, so the endpoint answered from a straight-line estimate',
      );
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: join(SHOTS, `live-endpoint-${vp.w}x${vp.h}.png`),
        fullPage: true,
      });
    }
  } finally {
    await context.close();
  }
}

/** The classic cost planner, still where it was moved to. */
async function probeClassic(browser, vp) {
  const label = `${vp.w}x${vp.h} classic`;
  const { context, page } = await newPage(browser, vp);
  try {
    const res = await page.goto(`${BASE}/trip-planner/classic`, { waitUntil: 'domcontentloaded' });
    verdict(
      `${label}: the classic planner is served`,
      res !== null && res.status() === 200,
      String(res && res.status()),
    );
    await page.waitForSelector('h1', { timeout: 15_000 });

    const shape = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent.trim() ?? null,
      steps: document.querySelector('[aria-label="Trip planner steps"]') !== null,
      stepCount: document.querySelectorAll('[aria-label="Trip planner steps"] li').length,
      // The classic planner takes FREE TEXT, not the anchor pickers Plan
      // My Day uses — asserting Plan My Day's selectors here would have
      // reported a loss of function that never happened.
      origin: document.querySelector('#tp-origin') !== null,
      dest: document.querySelector('#tp-destination') !== null,
      depart: document.querySelector('#tp-depart') !== null,
      truckFields: document.querySelectorAll('input[type="number"]').length,
      planMyDayLink: document.querySelector('a[href="/trip-planner"]') !== null,
      buttons: Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()),
    }));
    verdict(
      `${label}: it is the cost planner, by name`,
      shape.h1 === 'Classic Cost Planner',
      String(shape.h1),
    );
    verdict(
      `${label}: its three-step flow survived the move`,
      shape.steps && shape.stepCount === 3,
      `${shape.stepCount} steps`,
    );
    verdict(
      `${label}: its origin, destination and departure inputs survived`,
      shape.origin && shape.dest && shape.depart,
      JSON.stringify({ origin: shape.origin, dest: shape.dest, depart: shape.depart }),
    );
    verdict(
      `${label}: its truck-profile fields survived`,
      shape.truckFields >= 4,
      `${shape.truckFields} numeric fields`,
    );
    verdict(`${label}: it links back to Plan My Day`, shape.planMyDayLink);
    verdict(
      `${label}: it still renders its own controls`,
      shape.buttons.length > 0,
      `${shape.buttons.length} buttons`,
    );

    const ox = await overflowX(page);
    verdict(`${label}: no horizontal overflow`, ox <= 0, `${ox}px`);

    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `classic-${vp.w}x${vp.h}.png`), fullPage: true });
  } finally {
    await context.close();
  }
}

/** Plan My Day links out to the classic planner, as promised. */
async function probeCrossLink(browser, vp) {
  const label = `${vp.w}x${vp.h} classic-link`;
  const { context, page } = await newPage(browser, vp);
  try {
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
    const link = page.locator('[data-classic-link]');
    const text = await link.textContent();
    verdict(
      `${label}: the classic planner is offered by its exact name`,
      (text ?? '').trim() === 'Open Classic Cost Planner',
      String(text).trim(),
    );
    const tapped = await scrollThenTap(page, link);
    if (!tapped.ok) {
      verdict(`${label}: the link is reachable by thumb`, false, tapped.why);
      return;
    }
    await page.waitForURL('**/trip-planner/classic', { timeout: 15_000 });
    verdict(
      `${label}: tapping it arrives at the classic planner`,
      page.url().endsWith('/trip-planner/classic'),
      redact(page.url()),
    );
  } finally {
    await context.close();
  }
}

/**
 * The shared header and footer, measured and reported rather than
 * quietly excluded.
 *
 * Scoping the 44px check to the planner's own controls is correct — the
 * site chrome is not this milestone's and not a cockpit control — but
 * dropping the measurement entirely would turn a known-open fact into an
 * invisible one. So it is measured here, once, and reported as a note.
 */
async function probeSiteChrome(browser, vp) {
  const label = `${vp.w}x${vp.h} site-chrome`;
  const { context, page } = await newPage(browser, vp);
  try {
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-plan-my-day]', { timeout: 15_000 });
    const chrome = await page.evaluate(() => {
      const planner = document.querySelector('[data-plan-my-day]');
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], select')) {
        // The planner's own controls are measured by `ergonomics`; only
        // the map's required attribution link is counted from inside it.
        if (planner !== null && planner.contains(el) && el.closest('.maplibregl-ctrl') === null) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44) {
          out.push({
            h: Math.round(r.height),
            text: (el.textContent || '').trim().slice(0, 24),
          });
        }
      }
      return out;
    });
    const srOnly = chrome.filter((c) => c.h <= 1).length;
    const attribution = chrome.filter((c) => /OpenStreetMap|MapLibre/i.test(c.text)).length;
    note(
      `${label}: ${chrome.length} non-cockpit links are under 44px`,
      `${srOnly} sr-only skip link (1px by design), ${attribution} required map attribution link(s), the rest shared footer text links — none are driver controls, none changed in this PR`,
    );
  } finally {
    await context.close();
  }
}

/* -------------------------------------------------------------- main */

async function main() {
  const scenarios = loadScenarios();
  console.log(`\nPlan My Day — ${scenarios.length} scenarios × ${VIEWPORTS.length} viewports\n`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const vp of VIEWPORTS) {
      console.log(`— ${vp.w}x${vp.h}${vp.landscape === true ? ' (landscape)' : ''}`);
      for (const scenario of scenarios) {
        const shot = vp.w === REFERENCE.w && vp.h === REFERENCE.h;
        await runScenario(browser, vp, scenario, { shot }).catch((err) =>
          verdict(`${vp.w}x${vp.h} ${scenario.key} completed`, false, String(err).slice(0, 300)),
        );
      }
      // Rapid taps are a TOUCH property: measured at every size, not just
      // the reference one, because the button's box moves with the layout.
      await probeRapidTaps(browser, vp, scenarios[0]).catch((err) =>
        verdict(`${vp.w}x${vp.h} rapid-taps completed`, false, String(err).slice(0, 300)),
      );
    }

    console.log('— one-off probes at the reference size');
    await probeLiveEndpoint(browser, REFERENCE).catch((err) =>
      verdict('live-endpoint completed', false, String(err).slice(0, 300)),
    );
    await probeClassic(browser, REFERENCE).catch((err) =>
      verdict('classic completed', false, String(err).slice(0, 300)),
    );
    await probeCrossLink(browser, REFERENCE).catch((err) =>
      verdict('classic-link completed', false, String(err).slice(0, 300)),
    );
    await probeSiteChrome(browser, REFERENCE).catch((err) =>
      verdict('site-chrome completed', false, String(err).slice(0, 300)),
    );
  } finally {
    await browser.close();
  }

  console.log(`\n${checks} checks, ${failures} failures, ${notes} notes`);
  if (noteLog.length > 0) {
    console.log('\nMeasured, known-open:');
    for (const n of noteLog) console.log(`  - ${n}`);
  }
  if (failLog.length > 0) {
    console.log('\nFailures:');
    for (const f of failLog) console.log(`  - ${f}`);
  }
  console.log(`\nScreenshots: ${SHOTS}`);
  if (JSON_OUT !== '') {
    writeFileSync(JSON_OUT, JSON.stringify({ checks, failures, notes, failLog, noteLog }, null, 2));
  }
  process.exit(failures > 0 ? 1 : 0);
}

void main();

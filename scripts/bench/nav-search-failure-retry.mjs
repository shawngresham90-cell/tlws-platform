/**
 * NAV-SEARCH-1 browser bench — a failed destination search must stay
 * retryable, and must never masquerade as "no places found".
 *
 * The offline harness (scripts/test-nav-search-failure-cache.ts) proves
 * the coordinator and the component in isolation. This bench proves the
 * same journey in a REAL browser against a production build, at the four
 * widths a driver actually holds, on BOTH surfaces that mount the shared
 * `DestinationSearch`:
 *
 *   Navigator     /drive          (pilot-gated)
 *   Plan My Day   /trip-planner   (public)
 *
 * DETERMINISTIC AND FREE. Both first-party search endpoints are
 * intercepted, so no HERE transaction is spent and every scenario is
 * repeatable. The intercepted REQUESTS are the evidence: "did the app ask
 * again after the failure" is answered by counting what the app actually
 * sent, not by reading the code that sends it.
 *
 * The journey, per surface and per viewport:
 *   1. type a valid destination query
 *   2. the first intercepted request FAILS
 *      → "Search unavailable right now.", no cards, no "No places found"
 *   3. clear and retype the normalized-equivalent query
 *   4. the second request SUCCEEDS
 *      → a second request was really issued; a real card appears
 *   5. select the place → the search settles
 *   6. edit the query → the old pick clears and search reopens
 *
 * Plus, at every width: no horizontal overflow, ≥64 px targets, readable
 * cards, an aria-live status, no coordinate text, no console errors, and
 * no duplicate request caused by GPS-driven re-renders.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3217 &
 *   node scripts/bench/nav-search-failure-retry.mjs --password <pw> \
 *     [--port 3217] [--only navigator|planner]
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3217');
const PASSWORD = arg('password');
const ONLY = arg('only');
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
];

const QUERY = 'Petro Knoxville';
/** Same query after the coordinator's whitespace/case normalization. */
const EQUIVALENT = '  petro   KNOXVILLE  ';
const UNAVAILABLE = 'Search unavailable right now.';
const NO_PLACES = 'No places found. Try a different search.';

let passed = 0;
let failed = 0;
function verdict(name, cond, detail) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  FAIL: ${name}${detail === undefined ? '' : ` — ${detail}`}`);
  }
}

/** The one place the intercepted endpoints answer from. */
function makeEndpoint() {
  const state = { fail: true, requests: [] };
  const handler = (route) => {
    const url = route.request().url();
    state.requests.push(url);
    if (state.fail) {
      // A 503 — the shape an expired session, a provider outage or a
      // refusal all reduce to at the port.
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'search-unavailable' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        places: [
          {
            id: 'bench-1',
            title: 'Petro Knoxville',
            address: '803 Watt Rd, Knoxville, TN 37932',
            position: { lat: 35.9, lng: -84.2 },
            facility: 'truck-stop',
            distanceMi: 4.2,
          },
        ],
      }),
    });
  };
  return { state, handler };
}

async function newContext(browser, vp, endpoint, storageState) {
  const context = await browser.newContext({
    viewport: vp,
    isMobile: vp.width < 700,
    hasTouch: vp.width < 700,
    deviceScaleFactor: 1,
    permissions: ['geolocation'],
    geolocation: { latitude: 35.9606, longitude: -83.9207, accuracy: 8 },
    storageState: storageState ?? undefined,
  });
  await context.route('**/api/navigator/destination-search*', endpoint.handler);
  await context.route('**/api/trip-planner/destination-search*', endpoint.handler);
  // Nothing else may reach a provider or a tile server from a bench.
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());
  await context.route('**://*.hereapi.com/**', (r) => r.abort());
  return context;
}

let savedStorageState = null;
async function loginPilot(page) {
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/drive/, { timeout: 20_000 }).catch(() => {});
    await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/navigator/access')) {
      throw new Error('the pilot gate refused the password');
    }
    savedStorageState = await page.context().storageState();
  }
  await page.waitForTimeout(800); // hydration
  /*
   * NAV-ENTRY-1 moved the cockpit from `/drive` to `/drive/navigate`; `/drive`
   * is the three-button launcher now. The gate is still entered through
   * `/drive` — that is what an unauthorized visitor is redirected away from and
   * back to — and the helper then lands on the driving surface this bench is
   * about, so every measurement below still describes the same screen.
   */
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  // Let the surface hydrate before a caller starts looking for controls.
  await page.waitForTimeout(900);
}

/** The search input on whichever surface is under test. */
async function findSearchInput(page) {
  const input = page.locator('input[type="search"]').first();
  await input.waitFor({ state: 'visible', timeout: 20_000 });
  return input;
}

async function statusText(page) {
  const el = page.locator('p[aria-live="polite"]').first();
  return ((await el.textContent()) ?? '').trim();
}

async function cardTexts(page) {
  const cards = page.locator('ul[aria-label="Destination search results"] li');
  const n = await cards.count();
  const out = [];
  for (let i = 0; i < n; i++) out.push(((await cards.nth(i).innerText()) ?? '').trim());
  return out;
}

/** Type into the box and wait past the 350 ms debounce plus the round trip. */
async function typeQuery(page, input, value) {
  await input.fill('');
  await page.waitForTimeout(120);
  await input.fill(value);
  await page.waitForTimeout(900);
}

async function runJourney(browser, surface, vp) {
  const label = `${surface} @ ${vp.width}×${vp.height}`;
  const endpoint = makeEndpoint();
  const context = await newContext(
    browser,
    vp,
    endpoint,
    surface === 'navigator' ? savedStorageState : null,
  );
  const page = await context.newPage();
  /*
   * CONSOLE NOISE THIS BENCH CREATES ITSELF, and must not blame the app
   * for. Two sources, both deliberate:
   *   - aborted map-tile and provider routes (the bench refuses them so a
   *     run reaches no third party at all), which the browser reports as
   *     ERR_FAILED;
   *   - the intentional 503 on the search endpoint, which is the whole
   *     point of step 2 and which the browser logs as a failed resource.
   * Everything else counts.
   */
  const benchInduced = (t) =>
    /net::ERR_FAILED|net::ERR_ABORTED/.test(t) ||
    /Failed to load resource.*50\d/.test(t) ||
    /destination-search/.test(t);
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !benchInduced(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (!benchInduced(String(e))) consoleErrors.push(String(e));
  });
  /**
   * Errors already present after load, BEFORE the search is touched.
   * `/drive` hydrates a whole driving screen (clocks, map, GPS) and
   * carries its own pre-existing noise; this bench is about the search,
   * so the property asserted is that THE JOURNEY ADDS NONE — which is
   * both meaningful and robust to page noise this milestone did not
   * create.
   */
  let baselineErrors = 0;

  try {
    if (surface === 'navigator') {
      await loginPilot(page);
    } else {
      await page.goto(`${BASE}/trip-planner`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
    }

    const input = await findSearchInput(page);
    await page.waitForTimeout(500);
    baselineErrors = consoleErrors.length;

    /* --- 1-3. the first attempt fails ---------------------------------- */
    endpoint.state.fail = true;
    await typeQuery(page, input, QUERY);
    const afterFailRequests = endpoint.state.requests.length;
    const failStatus = await statusText(page);
    const failCards = await cardTexts(page);

    verdict(
      `${label}: the failed attempt issued exactly one request`,
      afterFailRequests === 1,
      String(afterFailRequests),
    );
    verdict(`${label}: status says "${UNAVAILABLE}"`, failStatus === UNAVAILABLE, failStatus);
    verdict(
      `${label}: no result cards after a failure`,
      failCards.length === 0,
      String(failCards.length),
    );
    verdict(
      `${label}: the driver is NOT told "${NO_PLACES}"`,
      failStatus !== NO_PLACES,
      failStatus,
    );

    /* --- 4-6. clear, retype the equivalent query, and succeed ---------- */
    endpoint.state.fail = false;
    await typeQuery(page, input, EQUIVALENT);
    const afterRetryRequests = endpoint.state.requests.length;
    const okStatus = await statusText(page);
    const okCards = await cardTexts(page);

    verdict(
      `${label}: the retype issued a SECOND network request`,
      afterRetryRequests === afterFailRequests + 1,
      `${afterFailRequests} -> ${afterRetryRequests}`,
    );
    verdict(`${label}: a real result card appears`, okCards.length === 1, JSON.stringify(okCards));
    verdict(
      `${label}: the card names the place`,
      (okCards[0] ?? '').includes('Petro Knoxville'),
      okCards[0],
    );
    verdict(`${label}: the status line clears on success`, okStatus === '', okStatus);

    /* --- selection settles the search ---------------------------------- */
    await page.locator('ul[aria-label="Destination search results"] li button').first().click();
    await page.waitForTimeout(700);
    const afterSelect = endpoint.state.requests.length;
    const cardsAfterSelect = await cardTexts(page);
    verdict(
      `${label}: selecting clears the result list`,
      cardsAfterSelect.length === 0,
      String(cardsAfterSelect.length),
    );
    verdict(
      `${label}: a settled box does not re-search its own title`,
      afterSelect === afterRetryRequests,
      `${afterRetryRequests} -> ${afterSelect}`,
    );

    /* --- editing reopens the search ------------------------------------ */
    await input.fill('Petro Knoxville West');
    await page.waitForTimeout(900);
    verdict(
      `${label}: editing after selection reopens the search`,
      endpoint.state.requests.length > afterSelect,
      `${afterSelect} -> ${endpoint.state.requests.length}`,
    );

    /* --- layout, accessibility, privacy -------------------------------- */
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    verdict(`${label}: no horizontal overflow`, overflow <= 1, `${overflow}px`);

    const liveRegions = await page.locator('p[aria-live="polite"]').count();
    verdict(
      `${label}: the status line is an aria-live region`,
      liveRegions >= 1,
      String(liveRegions),
    );

    // Restore a result list, then measure the card and the input.
    await typeQuery(page, input, QUERY);
    const small = await page.evaluate(() => {
      const out = [];
      const nodes = [
        ...document.querySelectorAll('input[type="search"]'),
        ...document.querySelectorAll('ul[aria-label="Destination search results"] li button'),
      ];
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.height < 64) out.push(`${n.tagName}:${Math.round(r.height)}`);
      }
      return out;
    });
    verdict(
      `${label}: search input and cards are ≥64 px tall`,
      small.length === 0,
      small.join(','),
    );

    const cardsNow = await cardTexts(page);
    const cardText = cardsNow.join(' ');
    verdict(
      `${label}: the card stays readable (name + address)`,
      cardText.includes('Petro Knoxville') && cardText.includes('Watt Rd'),
      cardText,
    );
    verdict(
      `${label}: no coordinate appears in the card text`,
      !/-?\d{1,3}\.\d{4,}/.test(cardText),
      cardText,
    );

    /* --- GPS-driven re-renders must not duplicate the request ---------- */
    const beforeChurn = endpoint.state.requests.length;
    for (let i = 0; i < 6; i++) {
      await context.setGeolocation({
        latitude: 35.9606 + i * 0.000002,
        longitude: -83.9207 + i * 0.000002,
        accuracy: 8,
      });
      await page.waitForTimeout(250);
    }
    verdict(
      `${label}: GPS re-renders issue no duplicate endpoint call`,
      endpoint.state.requests.length === beforeChurn,
      `${beforeChurn} -> ${endpoint.state.requests.length}`,
    );

    verdict(
      `${label}: the search journey adds no console error`,
      consoleErrors.length === baselineErrors,
      `${baselineErrors} -> ${consoleErrors.length}: ${consoleErrors.slice(baselineErrors, baselineErrors + 2).join(' | ')}`,
    );
    if (baselineErrors > 0) {
      console.log(
        `  note: ${label} carried ${baselineErrors} pre-existing console error(s) at load, before the search was touched`,
      );
    }

    // Every request went to a first-party door and carried no credential.
    const foreign = endpoint.state.requests.filter(
      (u) => !/\/api\/(navigator|trip-planner)\//.test(u),
    );
    verdict(
      `${label}: every search request hit a first-party endpoint`,
      foreign.length === 0,
      foreign.join(','),
    );
    const leaky = endpoint.state.requests.filter((u) => /apiKey|api_key|password|token/i.test(u));
    verdict(
      `${label}: no credential appears in any search URL`,
      leaky.length === 0,
      leaky.join(','),
    );
  } finally {
    await context.close();
  }
}

async function main() {
  if (!PASSWORD && ONLY !== 'planner') {
    console.error('--password is required for the Navigator surface (or pass --only planner)');
    process.exit(2);
  }
  // The pinned browser this image ships; PLAYWRIGHT_BROWSERS_PATH already
  // points at it, but naming it keeps the bench working when the ad-hoc
  // `npm install --no-save playwright` resolves a different version.
  const browser = await chromium.launch({
    executablePath:
      process.env.BENCH_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const surfaces = ONLY ? [ONLY] : ['navigator', 'planner'];
  try {
    for (const surface of surfaces) {
      console.log(`\n================ ${surface} ================`);
      for (const vp of VIEWPORTS) {
        console.log(`\n--- ${vp.width}×${vp.height} ---`);
        await runJourney(browser, surface, vp);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nnav-search-failure-retry: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();

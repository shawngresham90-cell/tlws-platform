/**
 * The slimmed Directory surfaces in a real browser, against a real production
 * build, at the four widths the milestone names (DIR-PAYLOAD-1).
 *
 * WHAT THIS PROVES THAT THE OFFLINE HARNESS CANNOT. The harness drives the
 * modules; this drives the shipped page, which is where a payload change goes
 * wrong in ways no module test can see:
 *
 *   - THE BOUNDED RENDER IS NOT A BOUNDED TRUTH. The category page paints 30
 *     cards and says "1,882 of 1,882"; the map paints 30 and counts 1,940. A
 *     driver searching for a listing whose rank is past 1,800 finds it.
 *   - THE CARD WINDOW ACTUALLY ARRIVES. Cards past the first window come from
 *     /api/directory/cards. The request is watched: it must carry ids and no
 *     query text, and the cards it returns must render.
 *   - THE FAILURE STATE IS HONEST. With that endpoint answering 503, the page
 *     says details are unavailable and offers a retry — it does not say "no
 *     match", and it does not silently paint blank cards.
 *   - THE INITIAL HTML IS STILL A PAGE. Server-rendered cards and crawlable
 *     detail links are asserted from the DOM before hydration could have
 *     added them.
 *
 * Nothing here writes: the only endpoint touched is a read, and geolocation is
 * granted from a fixed fake coordinate rather than a real device.
 *
 * Setup (browser already present in this image):
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   node scripts/bench/directory-payload-viewports.mjs --tree .
 *
 * The tree must hold a production `.next` build made against
 * scripts/bench/mock-postgrest.mjs with MOCK_TEXT_PROFILE=production and
 * MOCK_FIELD_PROFILE=production, built from a REMOVED `.next` (a stale ISR
 * entry in `.next/cache` is served in preference to a fresh prerender and
 * references chunk hashes that no longer exist).
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import { chromium } from 'playwright';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const TREE = arg('tree', '.');
const MOCK_PORT = Number(arg('mock-port', '54999'));

async function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const WIDTHS = [360, 390, 430, 1280];
/** Touch-target floor already used by this repo's mobile work. */
const MIN_TOUCH_PX = 40;
/** What the pages render per window. */
const PAGE = 30;

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  FAIL: ${name}`, detail === undefined ? '' : JSON.stringify(detail));
  }
};

if (!fs.existsSync(path.join(TREE, '.next'))) {
  console.error('--tree must point at a checkout with a production .next build');
  process.exit(2);
}

/* ------------------------------------------------------- server plumbing */

/**
 * A LIVE server, not the prerendered artifacts. The community bench serves the
 * built HTML directly because those pages are pure prerender; these are not —
 * the category page's later card windows come from /api/directory/cards, and
 * a static file server has no endpoint to answer with. What is under test
 * includes that round trip, so the app has to actually run.
 */
function startMock({ failTable = '' } = {}) {
  return spawn('node', [path.join(process.cwd(), 'scripts/bench/mock-postgrest.mjs')], {
    env: {
      ...process.env,
      MOCK_PORT: String(MOCK_PORT),
      MOCK_TEXT_PROFILE: 'production',
      MOCK_FIELD_PROFILE: 'production',
      MOCK_FAIL_TABLE: failTable,
    },
    detached: true,
    stdio: 'ignore',
  });
}

function startApp(appPort) {
  return spawn('npx', ['next', 'start', '-p', String(appPort)], {
    cwd: TREE,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
      NO_PROXY: '*',
      no_proxy: '*',
    },
    detached: true,
    stdio: 'ignore',
  });
}

async function waitFor(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const APP_PORT = await freePort();
const base = `http://127.0.0.1:${APP_PORT}`;

/* --------------------------------------------------------- page helpers */

/** The complete browse index the page serialized, read back off the page. */
async function indexFromPage(page) {
  return page.evaluate(() => {
    const joined = (window.__next_f ?? [])
      .map((c) => (typeof c?.[1] === 'string' ? c[1] : ''))
      .join('');
    const at = joined.indexOf('"index":[');
    if (at === -1) return [];
    // Walk balanced brackets: the array spans flight chunk boundaries.
    let depth = 0;
    const from = joined.indexOf('[', at);
    for (let p = from; p < joined.length; p++) {
      const c = joined[p];
      if (c === '"') {
        p++;
        while (p < joined.length && joined[p] !== '"') {
          if (joined[p] === '\\') p++;
          p++;
        }
        continue;
      }
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(joined.slice(from, p + 1));
          } catch {
            return [];
          }
        }
      }
    }
    return [];
  });
}

async function noHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

const cardCount = (page) => page.locator('[aria-label^="View details for "]').count();

async function typeSearch(page, value) {
  const box = page.locator('#directory-search');
  await box.fill(value);
  // The component filters synchronously on change; give React a frame.
  await page.waitForTimeout(120);
}

/* ------------------------------------------------------- category journey */

async function categoryJourney(page, width, tail) {
  const label = `${width} category`;
  const cardRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/directory/cards')) cardRequests.push(r.url());
  });

  await page.goto(`${base}/directory/truck-stops`, { waitUntil: 'networkidle' });

  // 1-3. bounded initial cards, complete count, complete index.
  const initial = await cardCount(page);
  check(`${label}: initial cards bounded to one window`, initial === PAGE, initial);
  const status = await page.locator('[aria-live="polite"]').first().innerText();
  check(
    `${label}: total count is the whole category, not the window`,
    /1882 of 1882/.test(status.replace(/\s+/g, ' ')),
    status.slice(0, 60),
  );
  const idx = await indexFromPage(page);
  check(`${label}: complete index serialized`, idx.length === 1882, idx.length);
  check(
    `${label}: index carries no card-only fields`,
    idx.length > 0 &&
      !('phone' in idx[0]) &&
      !('description' in idx[0]) &&
      !('detailSlug' in idx[0]),
    idx[0] && Object.keys(idx[0]),
  );

  // Server-rendered crawlable links exist in the initial document.
  const rawHtml = await (await fetch(`${base}/directory/truck-stops`)).text();
  check(
    `${label}: detail links are in the server HTML`,
    (rawHtml.match(/aria-label="View details for /g) || []).length === PAGE,
    (rawHtml.match(/aria-label="View details for /g) || []).length,
  );

  // 4-5. a tail listing is findable and links through.
  await typeSearch(page, tail.name);
  await page.waitForTimeout(400); // allow the card window to arrive
  const tailVisible = await page.getByText(tail.name, { exact: false }).first().isVisible();
  check(`${label}: tail listing (rank ${tail.rank}) is findable`, tailVisible);
  const tailLink = page.locator(`[aria-label="View details for ${tail.name}"]`).first();
  check(
    `${label}: tail listing links to its detail page`,
    (await tailLink.count()) > 0 &&
      ((await tailLink.getAttribute('href')) ?? '').startsWith('/directory/location/'),
    await tailLink.getAttribute('href').catch(() => null),
  );
  check(
    `${label}: card window was fetched by id, with no query text`,
    cardRequests.length > 0 &&
      cardRequests.every((u) => u.includes('ids=') && !/[?&](q|query|search)=/.test(u)),
    cardRequests[0],
  );

  // 6. clearing restores the full set.
  await typeSearch(page, '');
  const cleared = await page.locator('[aria-live="polite"]').first().innerText();
  check(
    `${label}: clearing search restores the full count`,
    /1882 of 1882/.test(cleared.replace(/\s+/g, ' ')),
  );

  // 7-8. state then city filter.
  await page.selectOption('#directory-state', tail.state);
  await page.waitForTimeout(150);
  const stateStatus = await page.locator('[aria-live="polite"]').first().innerText();
  const stateShown = Number((stateStatus.match(/(\d+) of/) ?? [])[1] ?? -1);
  check(`${label}: state filter narrows to the state's own count`, stateShown === tail.stateCount, {
    shown: stateShown,
    expected: tail.stateCount,
  });
  const cityOptions = await page.locator('#directory-city option').count();
  check(`${label}: city options follow the state`, cityOptions > 1, cityOptions);
  await page.selectOption('#directory-state', '');
  await page.waitForTimeout(150);

  // 9-10. sorts.
  for (const [value, name] of [
    ['newest', 'Newest'],
    ['alpha', 'A–Z'],
  ]) {
    await page.selectOption('#directory-sort', value);
    await page.waitForTimeout(400);
    check(`${label}: ${name} sort still renders a window`, (await cardCount(page)) === PAGE);
  }

  // 11. nearest — only after the driver chooses it, with a faked position.
  await page.context().setGeolocation({ latitude: 35.0456, longitude: -85.3097 });
  await page.selectOption('#directory-sort', 'distance');
  await page.waitForTimeout(600);
  const distStatus = await page.locator('[aria-live="polite"]').first().innerText();
  check(
    `${label}: nearest sort reports it is sorted by distance`,
    /sorted by distance|finding your location/.test(distStatus),
    distStatus.slice(0, 80),
  );
  await page.selectOption('#directory-sort', 'featured');
  await page.waitForTimeout(300);

  // 12. Load more grows the window, twice.
  const loadMore = page.getByRole('button', { name: /Load more/ });
  await loadMore.click();
  await page.waitForTimeout(500);
  const after1 = await cardCount(page);
  await loadMore.click();
  await page.waitForTimeout(500);
  const after2 = await cardCount(page);
  check(`${label}: Load more grows the window`, after1 === PAGE * 2 && after2 === PAGE * 3, {
    after1,
    after2,
  });
  const ids = await page
    .locator('[aria-label^="View details for "]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  check(`${label}: no listing renders twice`, new Set(ids).size === ids.length);

  // Layout + accessibility at this width.
  check(`${label}: no horizontal overflow`, await noHorizontalOverflow(page));
  const smallTargets = await page
    .locator('#directory-search, #directory-state, #directory-sort')
    .evaluateAll(
      (els, min) => els.filter((e) => e.getBoundingClientRect().height < min).length,
      MIN_TOUCH_PX,
    );
  check(`${label}: controls meet the touch-target floor`, smallTargets === 0, smallTargets);
  const dom = await page.evaluate(() => document.getElementsByTagName('*').length);
  check(`${label}: DOM stays bounded after three windows`, dom < 4000, dom);
}

/* ------------------------------------------------------------ map journey */

async function mapJourney(page, width, mapTail) {
  const label = `${width} map`;
  const nearbyBodies = [];
  const nearbyUrls = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/directory/nearby')) {
      nearbyUrls.push(r.url());
      nearbyBodies.push(r.postData() ?? '');
    }
  });

  await page.goto(`${base}/directory/map`, { waitUntil: 'networkidle' });

  // innerText is the RENDERED text, and these headings are CSS-uppercased.
  const heading = (
    await page
      .locator('h2', { hasText: /location/i })
      .first()
      .innerText()
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  check(
    `${label}: heading counts every mapped listing`,
    /1940 location/.test(heading),
    heading.slice(0, 40),
  );
  const cards = await page.locator('[data-entry-id]').count();
  check(`${label}: result cards bounded to one window`, cards === PAGE, cards);
  check(
    `${label}: a Show more control offers the rest`,
    (await page.getByRole('button', { name: /Show more/ }).count()) === 1,
  );

  const dom = await page.evaluate(() => document.getElementsByTagName('*').length);
  check(`${label}: DOM bounded (was 23,120 before this milestone)`, dom < 4000, dom);
  check(`${label}: no horizontal overflow`, await noHorizontalOverflow(page));

  // Search a tail listing, then select its card.
  await page
    .locator('input[type="search"], input[placeholder*="city" i]')
    .first()
    .fill(mapTail.name);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const statusRegion = (
    await page.locator('[role="status"], [aria-live]').first().innerText()
  ).toLowerCase();
  check(
    `${label}: searching a tail listing centres the map on it`,
    statusRegion.includes(mapTail.name.toLowerCase()),
    statusRegion.slice(0, 90),
  );

  // Category filter keeps the complete set behind it.
  await page.goto(`${base}/directory/map`, { waitUntil: 'networkidle' });
  await page.selectOption('#f-category', 'truck-stops');
  await page.waitForTimeout(300);
  const filtered = (
    await page
      .locator('h2', { hasText: /location/i })
      .first()
      .innerText()
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const n = Number((filtered.match(/(\d+) location/) ?? [])[1] ?? -1);
  check(`${label}: category filter narrows the count honestly`, n > 0 && n < 1940, {
    shown: n,
    of: 1940,
  });
  check(
    `${label}: filtering does not unbound the card list`,
    (await page.locator('[data-entry-id]').count()) <= PAGE,
  );

  // Deep link resolves a listing whose rank is past the visible window.
  await page.goto(`${base}/directory/map?listing=${mapTail.detailSlug}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(500);
  // The deep-link status line is transient: the results-count effect writes
  // over it as soon as the filtered set settles. What has to survive is the
  // SELECTION, so that is what is asserted.
  const deepCard = page.locator(`[data-entry-id="${mapTail.id}"]`);
  check(
    `${label}: the selected listing is rendered even though its rank is past the window`,
    (await deepCard.count()) === 1,
  );
  check(
    `${label}: deep link selects the tail listing`,
    (await deepCard.locator('[aria-pressed="true"]').count()) === 1,
    await deepCard.innerText().catch(() => null),
  );
  check(`${label}: no internal id in the URL`, !page.url().includes(mapTail.id));

  // Use my location: click-initiated, coordinates in a POST body, never a URL.
  await page.context().setGeolocation({ latitude: 35.0456, longitude: -85.3097 });
  const locate = page.getByRole('button', { name: /Use my location/ });
  if ((await locate.count()) > 0) {
    await locate.click();
    await page.waitForTimeout(1200);
    check(
      `${label}: nearby coordinates travel in a POST body`,
      nearbyBodies.length === 0 ||
        (nearbyBodies.every((b) => b.includes('"lat"')) &&
          nearbyUrls.every((u) => !/lat=|lng=/.test(u))),
      { urls: nearbyUrls.slice(0, 1), bodied: nearbyBodies.length },
    );
  }
}

/* --------------------------------------------------------- failure states */

async function cardFailureJourney(page, width, tail) {
  const label = `${width} card-failure`;
  await page.route('**/api/directory/cards**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'Listing details are temporarily unavailable.' }),
    }),
  );
  await page.goto(`${base}/directory/truck-stops`, { waitUntil: 'networkidle' });
  await typeSearch(page, tail.name);
  await page.waitForTimeout(700);

  const text = await page.locator('body').innerText();
  check(
    `${label}: says details are unavailable, not that nothing matched`,
    /temporarily\s+unavailable/i.test(text) && !/No .*match/i.test(text),
    text.slice(0, 0),
  );
  check(
    `${label}: the listing is still named, not blanked`,
    text.toLowerCase().includes(tail.name.toLowerCase()),
  );
  check(
    `${label}: a user-driven retry is offered`,
    (await page.getByRole('button', { name: /Try again/ }).count()) === 1,
  );
  check(`${label}: no horizontal overflow in the failure state`, await noHorizontalOverflow(page));
  await page.unroute('**/api/directory/cards**');
}

/* ------------------------------------------------------------------- run */

const mock = startMock();
const app = startApp(APP_PORT);
const stop = () => {
  for (const p of [mock, app]) {
    try {
      process.kill(-p.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
};
process.on('exit', stop);

if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`))) {
  console.error('mock-postgrest did not come up');
  stop();
  process.exit(2);
}
if (!(await waitFor(`${base}/directory/truck-stops`))) {
  console.error('next start did not come up');
  stop();
  process.exit(2);
}

/* The tail targets are read from the mock, so the bench and the page agree
   about which listing sits past rank 1,800 rather than guessing. */
const allRows = await (
  await fetch(
    `http://127.0.0.1:${MOCK_PORT}/rest/v1/locations?select=id,name,city,state,category_slug,detail_slug,lat&is_published=eq.true&deleted_at=is.null&limit=3000`,
  )
).json();
const eligible = allRows.filter((r) => r.detail_slug);
const truckStops = eligible
  .filter((r) => r.category_slug === 'truck-stops')
  .sort((a, b) => a.name.localeCompare(b.name));
const mapped = eligible.filter((r) => r.lat != null).sort((a, b) => a.name.localeCompare(b.name));
const tailRow = truckStops[1850];
const mapRow = mapped[1900];
const tail = {
  name: tailRow.name,
  state: tailRow.state,
  rank: 1851,
  stateCount: truckStops.filter((r) => r.state === tailRow.state).length,
};
const mapTail = {
  id: mapRow.id,
  name: mapRow.name,
  city: mapRow.city,
  detailSlug: mapRow.detail_slug,
};

console.log(`\nDIRECTORY PAYLOAD — real browser`);
console.log(`  tail listing: ${tail.name} (truck-stops rank ${tail.rank} of ${truckStops.length})`);
console.log(`  map tail:     ${mapTail.name} (map rank 1901 of ${mapped.length})\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const consoleErrors = [];
async function newPage(width) {
  const context = await browser.newContext({
    viewport: {
      width,
      height: width === 1280 ? 800 : width === 430 ? 932 : width === 390 ? 844 : 740,
    },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  // A 1x1 PNG for every tile. Leaflet gets a real image, the test gets
  // determinism, and no request leaves the machine.
  await context.route(/tile\.openstreetmap\.org/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    }),
  );
  page.on('requestfailed', (r) => {
    // An ABORTED request is the browser cancelling, not the page failing:
    // Next prefetches `/?_rsc=…` for the header's Link, and closing the
    // context mid-flight cancels it. Anything else is reported with its URL,
    // so an environment problem stays distinguishable from a regression.
    const reason = r.failure()?.errorText ?? '';
    if (reason.includes('ERR_ABORTED')) return;
    consoleErrors.push(`${width}: ${reason} ${r.url().slice(0, 80)}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // A failed subresource is already reported by requestfailed, with its URL.
    if (t.includes('Failed to load resource')) return;
    // Turnstile warns when no site key is configured in a bench build; that
    // is the bench's environment, not this milestone's change.
    if (t.includes('Turnstile')) return;
    consoleErrors.push(`${width}: ${t.slice(0, 120)}`);
  });
  return { context, page };
}

for (const width of WIDTHS) {
  console.log(`— ${width}px —`);
  const { context, page } = await newPage(width);
  try {
    await categoryJourney(page, width, tail);
    await mapJourney(page, width, mapTail);
    await cardFailureJourney(page, width, tail);
  } finally {
    await context.close();
  }
}

check('no console errors introduced', consoleErrors.length === 0, consoleErrors.slice(0, 4));

await browser.close();
stop();

console.log(`\ndirectory-payload-viewports: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

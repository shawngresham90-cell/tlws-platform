/**
 * The community listing pickers in a real browser, against a real production
 * build, at the four widths the milestone names (DIR-COMPLETE-2).
 *
 * WHAT THIS PROVES THAT A UNIT TEST CANNOT. The offline harness proves the
 * complete pool reaches the component. This proves a driver can USE it:
 *
 *   - THE TAIL LISTING IS REACHABLE. A listing that sat past the old
 *     `.limit(2000)` — in production, anything in TX, UT, VA, WA, WI, WV, WY
 *     or the back half of TN — is searched for by name in the rendered page,
 *     selected, and read back off the DOM. Against the pre-fix build the same
 *     search renders "No published listing matches".
 *   - THE COMPLETE POOL DOES NOT BREAK THE PAGE. No horizontal overflow at
 *     360/390/430, result rows still meet the touch-target floor, at most 12
 *     rows render however broad the query, and filtering stays responsive
 *     with the whole pool in memory.
 *   - THE DEEP LINK STILL LANDS. ?listing=<detail-slug> selects the listing
 *     and switches the report kind, with no internal id anywhere in the URL.
 *   - THE FAILURE STATE IS HONEST. With the listing read answering 500, the
 *     page says the lookup is unavailable rather than that no listing
 *     matches, and new-location reporting still works.
 *
 * Nothing here submits: the review POST is intercepted and aborted, and its
 * body is asserted instead — that is how the selected id is verified without
 * writing a review.
 *
 * Setup (browser already present in this image):
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   node scripts/bench/community-picker-viewports.mjs --tree .
 *
 * The tree must hold a production `.next` build made against
 * scripts/bench/mock-postgrest.mjs with MOCK_TEXT_PROFILE=production, and
 * that build must start from a REMOVED `.next`.
 *
 * `next build` does not clear `.next/cache`, and the ISR cache in there wins
 * over a freshly written prerender. A stale entry from an earlier run is
 * therefore served in preference to the new page — referencing chunk hashes
 * that no longer exist, so the JS 404s, React never hydrates, and every
 * assertion below fails while the build itself was perfectly fine. Delete
 * `.next` before building for a bench run.
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as net from 'node:net';
import { chromium } from 'playwright';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = path.resolve(arg('tree', '.'));
/**
 * The APP port is claimed at startup rather than fixed: a bench that leaves a
 * `next start` behind — or runs beside another one — otherwise dies on
 * EADDRINUSE before asserting anything.
 */
async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * The MOCK port must match the port the tree was BUILT against.
 * `NEXT_PUBLIC_SUPABASE_URL` is inlined at build time, so a mock on a
 * different port is simply not the database this build knows about — and the
 * symptom is silent: the read fails on the failure pass's live render and
 * every page quietly claims to be unavailable. Bench and build both default
 * to the mock's own default port for that reason.
 */
const PORT = Number(arg('port', '54999'));
let APP_PORT = Number(arg('appPort', '0')) || 0;
const SHOT_DIR = process.env.SHOT_DIR ?? fs.mkdtempSync('/tmp/picker-shots-');
const WIDTHS = [360, 390, 430, 1280];
const ROUTES = ['/directory/submit', '/directory/reviews'];

/** Touch-target floor already used by this repo's mobile work. */
const MIN_TOUCH_PX = 40;
/** The picker's own render cap. */
const MAX_RESULTS = 12;

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
 * THE HEALTHY PASS IS SERVED FROM THE BUILD ARTIFACTS, NOT FROM `next start`.
 *
 * These two routes are ISR pages with `revalidate = 300`, and the build
 * generates 4,483 pages — so `/directory/submit` is already older than its own
 * revalidate window by the time the build finishes. Every `next start` therefore
 * answers the first request with `x-nextjs-cache: STALE` and regenerates in the
 * background, overwriting the prerender on disk. What the bench measured was
 * whatever that regeneration produced, not what the build produced, and each run
 * degraded the tree a little further.
 *
 * Regeneration is not what this milestone is about. A visitor inside the
 * revalidate window gets the prerendered bytes from the CDN, so those bytes are
 * what the picker has to work with — and they are sitting in .next/server/app.
 * Serve exactly them, plus the real client chunks, and the browser hydrates the
 * page as shipped. Nothing is fabricated: every byte came out of `next build`.
 *
 * The read-FAILURE pass still needs a live render (a failed read cannot be
 * prerendered), so that one keeps `next start` against a mock that answers 500.
 */
function startStaticServer() {
  const types = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = null;
    if (url.pathname.startsWith('/_next/static/')) {
      file = path.join(TREE, '.next/static', url.pathname.slice('/_next/static/'.length));
    } else if (ROUTES.includes(url.pathname)) {
      file = path.join(TREE, '.next/server/app', `${url.pathname.slice(1)}.html`);
    } else {
      const pub = path.join(TREE, 'public', url.pathname);
      if (fs.existsSync(pub) && fs.statSync(pub).isFile()) file = pub;
    }
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

function startMock({ failTable = '' } = {}) {
  return spawn('node', [path.join(process.cwd(), 'scripts/bench/mock-postgrest.mjs')], {
    env: {
      ...process.env,
      MOCK_PORT: String(PORT),
      MOCK_TEXT_PROFILE: 'production',
      MOCK_FAIL_TABLE: failTable,
    },
    // Detached with no inherited stdio: `next start` forks a worker, and an
    // inherited stderr keeps this script's own stdout pipe open long after the
    // run ends. Own the process group instead, and kill all of it.
    detached: true,
    stdio: 'ignore',
  });
}

function startApp() {
  return spawn('npx', ['next', 'start', '-p', String(APP_PORT)], {
    cwd: TREE,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
      NO_PROXY: '*',
      no_proxy: '*',
    },
    // Detached with no inherited stdio: `next start` forks a worker, and an
    // inherited stderr keeps this script's own stdout pipe open long after the
    // run ends. Own the process group instead, and kill all of it.
    detached: true,
    stdio: 'ignore',
  });
}

async function waitFor(url, tries = 90) {
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

/* The build inlines NEXT_PUBLIC_SUPABASE_URL, so the MOCK port must match the
   one the tree was built against; the APP port is ours to choose. */
if (!APP_PORT) APP_PORT = await freePort();
const base = `http://127.0.0.1:${APP_PORT}`;

/* --------------------------------------------------------- page helpers */

/**
 * Every listing ref the page serialized, read back out of the live page.
 *
 * The chunks are JOINED first. Next streams the flight payload as a series of
 * `self.__next_f.push([1, "…"])` calls, and a 440 kB listing array does not
 * land inside one of them — matching chunk by chunk silently finds nothing.
 */
async function poolFromPage(page) {
  return page.evaluate(() => {
    const joined = (window.__next_f ?? [])
      .map((c) => (typeof c?.[1] === 'string' ? c[1] : ''))
      .join('');
    const found = [];
    const re =
      /"id":"([0-9a-f-]{36})","name":"(.*?)","city":"(.*?)","state":"([A-Z]{2})","detailSlug":"(.*?)"/g;
    let m;
    while ((m = re.exec(joined)) !== null) {
      found.push({ id: m[1], name: m[2], city: m[3], state: m[4], detailSlug: m[5] });
    }
    return found;
  });
}

/**
 * Select the "correction" report kind and wait for the picker it reveals.
 *
 * A click that lands before React hydrates is simply lost, and the page then
 * looks exactly like one where the kind was never offered — which is how an
 * earlier version of this bench passed while testing nothing. Retry until the
 * kind actually takes, and fail loudly if it never does.
 */
async function chooseCorrection(page, revealsPicker = true) {
  const radio = page.locator('input[type="radio"][value="correction"]');
  await radio.waitFor({ state: 'attached' });
  for (let attempt = 0; attempt < 6; attempt++) {
    await radio.check({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
    if (await radio.isChecked()) {
      if (!revealsPicker) return true;
      // The picker's search box (healthy) or its status notice (read failed).
      const ready = await Promise.race([
        page
          .locator('#submission_location')
          .waitFor({ timeout: 1500 })
          .then(() => true),
        page
          .locator('#submission_location-unavailable')
          .waitFor({ timeout: 1500 })
          .then(() => true),
      ]).catch(() => false);
      if (ready) return true;
    }
  }
  return false;
}

async function noHorizontalOverflow(page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 &&
      document.body.scrollWidth <= window.innerWidth + 1,
  );
}

/** Type into a picker and wait for the listbox to settle. */
async function typeQuery(page, inputId, query) {
  const input = page.locator(`#${inputId}`);
  await input.fill(query);
  await page.waitForTimeout(60);
  return page.locator('[role="option"]');
}

/* ------------------------------------------------------------- journeys */

async function submitJourney(page, width, tail) {
  const label = `submit @${width}`;
  await page.goto(`${base}/directory/submit`, { waitUntil: 'networkidle' });
  check(`${label}: no horizontal overflow`, await noHorizontalOverflow(page));

  // 1. Choose Correction — the picker only exists for report kinds that need one.
  check(
    `${label}: the correction kind selects and reveals the picker`,
    await chooseCorrection(page),
  );
  const input = page.locator('#submission_location');
  check(`${label}: picker appears for a correction`, await input.isVisible());
  const fontPx = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(`${label}: search input is readable (>=16px avoids iOS zoom)`, fontPx >= 16, fontPx);

  // 2–3. The tail listing — invisible before this milestone — is searchable.
  let options = await typeQuery(page, 'submission_location', tail.name);
  const count = await options.count();
  const first = count ? (await options.first().innerText()).trim() : '';
  check(`${label}: tail listing found by name`, count === 1 && first.includes(tail.name), {
    count,
    first,
  });
  check(
    `${label}: no "no match" claim for a listing that exists`,
    (await page.locator('text=No published listing matches').count()) === 0,
  );

  // Touch targets on the result rows.
  if (count) {
    const box = await options.first().boundingBox();
    check(
      `${label}: result row meets the touch-target floor`,
      (box?.height ?? 0) >= MIN_TOUCH_PX,
      box?.height,
    );
  }

  // 4–5. Select it; the selected label carries the right name, city and state.
  await options.first().click();
  await page.waitForTimeout(50);
  const selectedText = await page
    .locator(`text=${tail.name}`)
    .first()
    .innerText()
    .catch(() => '');
  check(
    `${label}: selection shows the right name/city/state`,
    selectedText.includes(tail.name) &&
      selectedText.includes(tail.city) &&
      selectedText.includes(tail.state),
    selectedText,
  );
  check(
    `${label}: no coordinates rendered`,
    !/-?\d{2,3}\.\d{4,}/.test(await page.locator('form').innerText()),
  );

  // 6–7. Change, then search again.
  await page.locator('button:has-text("Change")').click();
  await page.waitForTimeout(50);
  check(
    `${label}: Change restores the search box`,
    await page.locator('#submission_location').isVisible(),
  );

  const broad = await typeQuery(page, 'submission_location', 'a');
  const broadCount = await broad.count();
  check(
    `${label}: at most ${MAX_RESULTS} rows render for a broad query`,
    broadCount <= MAX_RESULTS,
    broadCount,
  );
  check(
    `${label}: still no horizontal overflow with results open`,
    await noHorizontalOverflow(page),
  );

  // Keyboard reachability + listbox semantics.
  await page.locator('#submission_location').focus();
  const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
  check(
    `${label}: search input takes keyboard focus`,
    focusedId === 'submission_location',
    focusedId,
  );
  const roles = await page.evaluate(() => ({
    listbox: document.querySelectorAll('[role="listbox"]').length,
    options: document.querySelectorAll('[role="listbox"] [role="option"]').length,
  }));
  check(`${label}: listbox semantics intact`, roles.listbox === 1 && roles.options > 0, roles);

  await page.screenshot({ path: path.join(SHOT_DIR, `submit-${width}.png`), fullPage: false });

  // 8. Deep link by detail slug — no internal id in the URL.
  await page.goto(`${base}/directory/submit?listing=${tail.detailSlug}&kind=correction`, {
    waitUntil: 'networkidle',
  });
  // The deep link is applied in a mount effect, so nothing about it is true
  // until React has hydrated. Wait for the effect's own output.
  const deepLinkLanded = await page
    .locator('button:has-text("Change")')
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(`${label}: deep link resolved after hydration`, deepLinkLanded);
  const deepText = await page.locator('form').innerText();
  check(
    `${label}: deep link preselects the tail listing`,
    deepText.includes(tail.name),
    deepText.slice(0, 90),
  );
  check(
    `${label}: deep link switched the report kind to correction`,
    await page.locator('input[type="radio"][value="correction"]').isChecked(),
  );
  check(
    `${label}: selection survives hydration`,
    await page.locator('button:has-text("Change")').isVisible(),
  );
  check(`${label}: no internal id in the URL`, !page.url().includes(tail.id));
  check(`${label}: no internal id rendered on the page`, !deepText.includes(tail.id));
}

async function reviewsJourney(page, width, tail) {
  const label = `reviews @${width}`;
  await page.goto(`${base}/directory/reviews`, { waitUntil: 'networkidle' });
  check(`${label}: no horizontal overflow`, await noHorizontalOverflow(page));

  const options = await typeQuery(page, 'review_location', tail.name);
  const count = await options.count();
  check(`${label}: tail listing found by name`, count === 1, count);
  await options.first().click();
  await page.waitForTimeout(50);

  // The id the form would send, verified WITHOUT writing a review: the POST
  // is intercepted and aborted, and its body is read off the request.
  let postedBody = null;
  await page.route('**/api/directory/review', async (route) => {
    postedBody = route.request().postDataJSON();
    await route.abort();
  });
  await page
    .locator('[aria-label="5 stars"], button[aria-label*="5"]')
    .first()
    .click()
    .catch(() => {});
  await page.locator('#review_title').fill('Bench check — not submitted');
  await page.locator('#review_body').fill('This request is intercepted and aborted by the bench.');
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(400);
  check(
    `${label}: the form carries the selected listing's id`,
    postedBody?.location_id === tail.id,
    { got: postedBody?.location_id, want: tail.id },
  );
  check(`${label}: nothing was written — the request was aborted`, postedBody !== null);
  await page.unroute('**/api/directory/review');

  await page.screenshot({ path: path.join(SHOT_DIR, `reviews-${width}.png`), fullPage: false });
}

async function failureJourney(page, width) {
  const label = `failure @${width}`;
  await page.goto(`${base}/directory/submit`, { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();

  // New-location reporting is the default kind and must be untouched.
  check(
    `${label}: new-location reporting still available`,
    body.includes('Business name'),
    body.slice(0, 80),
  );

  check(
    `${label}: the correction kind selects and reveals the picker`,
    await chooseCorrection(page),
  );
  /* Assert OUR copy, not the phrase alone: the Turnstile widget also says
     "temporarily unavailable" when no site key is configured, which is true
     of every bench build — an earlier version of this check passed on that
     message while the picker was not even rendered. */
  const notice = page.locator('#submission_location-unavailable');
  const noticeText = (await notice.innerText().catch(() => '')) ?? '';
  check(
    `${label}: the PICKER says the lookup is unavailable`,
    noticeText.includes('Listing search is temporarily unavailable'),
    noticeText.slice(0, 100),
  );
  const formText = await page.locator('form').innerText();
  check(
    `${label}: does NOT claim the listing does not exist`,
    !formText.includes('No published listing matches'),
  );
  check(`${label}: no partial listing pool rendered`, (await poolFromPage(page)).length === 0);
  check(
    `${label}: unavailable notice is announced`,
    (await notice.getAttribute('role')) === 'status',
    await notice.getAttribute('role'),
  );
  check(`${label}: no horizontal overflow`, await noHorizontalOverflow(page));

  await page.goto(`${base}/directory/reviews`, { waitUntil: 'networkidle' });
  const reviewNotice = await page
    .locator('#review_location-unavailable')
    .innerText()
    .catch(() => '');
  const reviewText = await page.locator('form').innerText();
  check(
    `${label}: reviews page says unavailable too`,
    reviewNotice.includes('Listing search is temporarily unavailable'),
    reviewNotice.slice(0, 100),
  );
  check(
    `${label}: reviews page makes no no-match claim`,
    !reviewText.includes('No published listing matches'),
  );
  await page.screenshot({ path: path.join(SHOT_DIR, `failure-${width}.png`) });
}

/* ------------------------------------------------------------------ run */

async function withServers({ failTable = '' }, fn) {
  const mock = startMock({ failTable });
  const app = startApp();
  try {
    if (!(await waitFor(`${base}/directory/submit`))) throw new Error('app did not start');
    await fn();
  } finally {
    for (const child of [app, mock]) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const consoleErrors = [];
const failedResponses = [];
async function newPage(width) {
  const context = await browser.newContext({
    viewport: { width, height: 860 },
    deviceScaleFactor: width < 1000 ? 2 : 1,
    isMobile: width < 1000,
    hasTouch: width < 1000,
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${width}: ${m.text()}`);
  });
  // "Failed to load resource" says nothing on its own; record what failed.
  page.on('response', (r) => {
    if (r.status() >= 400) failedResponses.push(`${width}: ${r.status()} ${r.url()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${width}: ${e.message}`));
  return page;
}

let tail = null;

async function withStaticServer(fn) {
  const server = await startStaticServer();
  try {
    await fn();
  } finally {
    await new Promise((r) => server.close(r));
  }
}

await withStaticServer(async () => {
  // Pick the tail target off the LIVE page: the listing whose presentation
  // rank is past 2,000 is the one the old cap dropped.
  const probe = await newPage(1280);
  await probe.goto(`${base}/directory/submit`, { waitUntil: 'networkidle' });
  const pool = await poolFromPage(probe);
  console.log(
    `\npool serialized into /directory/submit: ${pool.length.toLocaleString()} listing refs`,
  );
  check('pool is complete (past the old 2,000 cap)', pool.length > 2000, pool.length);
  if (pool.length === 0) {
    console.log(
      '  ↳ the served page contains NO listing refs. That is almost always a stale or\n' +
        '    polluted .next: rebuild the tree against the mock before benching —\n' +
        '    MOCK_TEXT_PROFILE=production, NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<mock>.',
    );
  }
  if (pool.length > 2000) {
    // The pool arrives in presentation order, so index 2400 IS a listing the
    // old `.limit(2000)` dropped.
    tail = pool[2400] ?? pool[pool.length - 1];
    console.log(
      `tail target (rank ${pool.indexOf(tail) + 1}): ${tail.name} — ${tail.city}, ${tail.state}\n  slug: ${tail.detailSlug}`,
    );
  }
  await probe.context().close();

  if (!tail?.detailSlug) {
    check('tail target resolvable', false, 'could not locate a listing past rank 2,000');
  } else {
    for (const width of WIDTHS) {
      const before = { passed, failed };
      const page = await newPage(width);
      await submitJourney(page, width, tail);
      await reviewsJourney(page, width, tail);
      await page.context().close();
      console.log(
        `— ${width}px: ${passed - before.passed} passed, ${failed - before.failed} failed`,
      );
    }
  }
});

/* The failure pass needs an ON-DEMAND render: the prerendered artifacts hold
   a healthy page, so they are removed and Next regenerates against a mock
   whose locations reads answer 500.
   
   THE WHOLE `.next` IS SNAPSHOTTED FIRST, not just those files. Rendering on
   demand also writes Next's ISR and fetch caches, so a failed render leaves a
   zero-listing page cached where the healthy one was. Restoring six files
   left that behind, and every later run of this bench then measured an empty
   pool and reported it as a broken build — the bench breaking the thing it
   measures, and blaming the code. Snapshot and swap the directory instead. */
console.log('\n— read-failure state —');
const nextDir = path.join(TREE, '.next');
const snapshot = path.join(TREE, '.next.bench-snapshot');
fs.rmSync(snapshot, { recursive: true, force: true });
fs.cpSync(nextDir, snapshot, { recursive: true });
try {
  for (const route of ['directory/submit', 'directory/reviews']) {
    for (const ext of ['html', 'rsc', 'meta']) {
      fs.rmSync(path.join(nextDir, 'server/app', `${route}.${ext}`), { force: true });
    }
  }
  /* Removing the prerender is not enough to reach the database again. Next
     caches the underlying fetches too, and within the revalidate window an
     on-demand render is answered from that cache — so the page rebuilds itself
     from the BUILD's successful reads and looks perfectly healthy while the
     database is returning 500. (That same cache is why one build serves both
     pages from a single five-request scan.) Clear it, or this pass silently
     tests nothing. */
  fs.rmSync(path.join(nextDir, 'cache/fetch-cache'), { recursive: true, force: true });
  await withServers({ failTable: 'locations' }, async () => {
    for (const width of [360, 1280]) {
      const page = await newPage(width);
      await failureJourney(page, width);
      await page.context().close();
    }
  });
} finally {
  fs.rmSync(nextDir, { recursive: true, force: true });
  fs.renameSync(snapshot, nextDir);
  console.log('  (build tree restored from snapshot)');
}

await browser.close();

/* The bench builds without NEXT_PUBLIC_TURNSTILE_SITE_KEY, and the widget
   logs one console.error saying so on every page that renders it. That is a
   property of an unconfigured build, not of this change — it is present
   identically on both sides of the comparison. Exactly that message is
   ignored; anything else counts. */
const IGNORED_CONSOLE =
  /\[Turnstile\] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set|Failed to load resource/;
const unexpectedErrors = consoleErrors.filter((e) => !IGNORED_CONSOLE.test(e));
check('no console errors introduced', unexpectedErrors.length === 0, unexpectedErrors.slice(0, 5));

/**
 * IN SCOPE: the two routes under test and the assets they load. Next prefetches
 * the RSC payload of every nav link on the page (`/academy?_rsc=…`,
 * `/road-ahead?_rsc=…`, the generated `/icon`), and the healthy pass is served
 * by a static server that hosts only these two routes plus `.next/static` — so
 * those 404s are this harness declining to serve the rest of the site, not the
 * page failing. They are counted and reported rather than swallowed; a 404 on a
 * real chunk, or on either route under test, still fails.
 */
const inScope = (entry) => {
  const url = entry.slice(entry.indexOf(' ') + 1);
  const p = new URL(url.slice(url.indexOf('http'))).pathname;
  return ROUTES.includes(p) || p.startsWith('/_next/static/');
};
const scopedFailures = [...new Set(failedResponses)].filter(inScope);
const outOfScope = [...new Set(failedResponses)].filter((e) => !inScope(e));
check(
  'no failing requests for the routes under test or their assets',
  scopedFailures.length === 0,
  scopedFailures.slice(0, 5),
);
if (outOfScope.length) {
  console.log(
    `  (${outOfScope.length} out-of-scope 404s — nav prefetches for pages the static\n` +
      `   server does not host; e.g. ${outOfScope[0].split(' ').pop()})`,
  );
}
check(
  'the only ignored console errors are the unconfigured-Turnstile notice and those same 404s',
  consoleErrors.every((e) => IGNORED_CONSOLE.test(e)) || unexpectedErrors.length > 0,
);

console.log(`\nscreenshots: ${SHOT_DIR}`);
console.log(`community-picker-viewports: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

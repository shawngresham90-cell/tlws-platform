/**
 * The Fast Start bench: how long is the parked screen, really?
 *
 * The pilot's complaint was a measurement, not a mood — "there is too
 * much setup before starting... it takes too long to get moving" — so it
 * is answered with measurements. The audit recorded the baseline on a
 * 390x844 phone with a driver who had already entered everything:
 *
 *     parked-screen height          8,826 px
 *     top → Start Route             5,758 px  (~6.8 phone screens)
 *     occurrences of 13'6"          2
 *     occurrences of 80,000 lb      2
 *     the word "passenger", parked  present
 *
 * This bench re-measures all of it against the running build, across
 * eight viewports, for BOTH drivers that matter: the first-timer who has
 * to set the truck up, and the returning driver who already did.
 *
 * WHAT IT REFUSES TO DO. It never asserts "shorter than before" against
 * a number typed into this file — the baseline is printed beside the new
 * value and the delta is computed, so a regression is visible rather
 * than hidden behind a threshold someone relaxed. The pass/fail checks
 * are about FACTS a driver can verify: Start is reachable, the truck's
 * numbers appear once, a parked driver is never called a passenger, the
 * saved preference reaches the wire, and one Start tap spends one route
 * request.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3214 &
 *   node scripts/bench/navigator-fast-start.mjs --password <pw> \
 *     [--port 3214] [--shots <dir>]
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3214');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

/**
 * The audit's numbers, quoted so the report can print the delta. They are
 * REFERENCE VALUES, never assertions: nothing here passes or fails by
 * comparing to them.
 */
const BASELINE = { heightPx: 8826, startPx: 5758, reference: '390x844, returning driver' };

/**
 * Eight viewports: the phone the defect was found on, the small phone
 * that is worst-case for a long screen, two large phones, a phablet, a
 * tablet portrait and landscape, and a desktop width — because the
 * parked screen is also what a fleet manager sees on a laptop.
 */
const VIEWPORTS = [
  { name: 'iphone-se', width: 320, height: 568, mobile: true },
  { name: 'iphone-8', width: 375, height: 667, mobile: true },
  { name: 'iphone-13', width: 390, height: 844, mobile: true },
  { name: 'pixel-7', width: 412, height: 915, mobile: true },
  { name: 'iphone-max', width: 430, height: 932, mobile: true },
  { name: 'tablet-portrait', width: 768, height: 1024, mobile: true },
  { name: 'tablet-landscape', width: 1024, height: 768, mobile: false },
  { name: 'desktop', width: 1280, height: 800, mobile: false },
];

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;
const DEST_US = { lat: ORIGIN.lat + 6 / MI_PER_DEG_LAT, lng: ORIGIN.lng };
/** Windsor-ish, for the cross-border case: a real second country. */
const ORIGIN_CA = { lat: 42.317, lng: -83.036 };
const DEST_CA = { lat: 43.65, lng: -79.38 };

let failures = 0;
let checks = 0;
const notes = [];
function verdict(name, cond, detail = '') {
  checks += 1;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}
function note(text) {
  notes.push(text);
  console.log(`  note ${text}`);
}

function syntheticRoute() {
  const geometry = [];
  for (let i = 0; i <= 200; i++)
    geometry.push([ORIGIN.lat + (i * 0.03) / MI_PER_DEG_LAT, ORIGIN.lng]);
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: 'fast-start-bench',
      distanceMiles: 6,
      seconds: 480,
      geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
        { action: 'arrive', instruction: 'Arrive at the gate.', direction: null, offset: 200 },
      ],
    },
  };
}

let savedStorageState = null;
async function login(page) {
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/drive/, { timeout: 20_000 }).catch(() => {});
    await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/navigator/access'))
      throw new Error('the pilot gate refused the password');
    savedStorageState = await page.context().storageState();
  }
  await page.waitForTimeout(800);
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

/**
 * A context. `geo` null means NO LOCATION PERMISSION — the audit's own
 * condition, and the pilot's actual one: a parked driver who has not
 * shared their location yet.
 */
async function newContext(
  browser,
  { viewport, keepStorage = null, geo = ORIGIN, dest = DEST_US } = {},
) {
  const context = await browser.newContext({
    permissions: geo === null ? [] : ['geolocation'],
    ...(geo === null
      ? {}
      : { geolocation: { latitude: geo.lat, longitude: geo.lng, accuracy: 8 } }),
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    deviceScaleFactor: 1,
    storageState: keepStorage ?? savedStorageState ?? undefined,
  });
  const counts = { route: 0, search: 0 };
  /** Every avoid list the app actually put on the wire, in order. */
  const sentAvoid = [];
  await context.route('**/api/navigator/route', async (r) => {
    counts.route += 1;
    // THE WIRE, read rather than assumed. A preference that never
    // arrives here did nothing, however the screen described it.
    let body = null;
    try {
      body = JSON.parse(r.request().postData() ?? 'null');
    } catch {
      body = null;
    }
    sentAvoid.push(body?.request?.avoid ?? body?.avoid ?? null);
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute()),
    });
  });
  await context.route('**/api/navigator/destination-search*', (r) => {
    counts.search += 1;
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        places: [
          {
            id: 'bench:gate',
            title: 'Bench Receiving Gate',
            address: '100 Depot Rd',
            position: dest,
            facility: 'warehouse',
            distanceMi: null,
          },
        ],
      }),
    });
  });
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());
  return { context, counts, sentAvoid };
}

/** Full document height — what the driver actually has to scroll. */
const pageHeight = (page) =>
  page.evaluate(() =>
    Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
  );

/** Absolute document Y of an element's top edge, or null if absent. */
async function documentTop(locator) {
  const handle = await locator
    .first()
    .elementHandle()
    .catch(() => null);
  if (handle === null) return null;
  return handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return Math.round(r.top + window.scrollY);
  });
}

/**
 * The destination search box. Matched on its aria-label rather than a
 * placeholder: the placeholder is prose that changes with the region,
 * and a bench that misses the box would silently measure nothing.
 */
const searchBox = (page) => page.getByLabel(/Search for a destination/i).first();

const countText = async (page, text) => {
  const body = await page.evaluate(() => document.body.innerText);
  return body.split(text).length - 1;
};

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/**
 * Make sure a setup control is on screen, expanding the collapsed setup
 * the way a driver would if it is not.
 *
 * Accepts a locator or a name pattern. It does NOT assume the setup is
 * collapsed — on a first run it is already open, and clicking a
 * non-existent "Change setup" would be a bench failure rather than a
 * product one.
 */
/**
 * Make a setup control reachable.
 *
 * It used to expand a collapsed stack on the driving screen. NAV-ENTRY-1
 * moved that stack to /drive/settings, so "open the setup" now means "be on
 * the setup surface" — and the helper navigates there if the control the
 * caller wants is not already in front of them.
 */
async function openSetup(page, target) {
  const locator =
    typeof target === 'object' && 'count' in target
      ? target
      : page.getByRole('button', { name: target });
  if ((await locator.count()) > 0) return;
  if (!page.url().includes('/drive/settings')) {
    await page.goto(`${BASE}/drive/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    return;
  }
  const open = page.locator('[data-open-setup]');
  if ((await open.count()) > 0) {
    await open.first().click();
    await page.waitForTimeout(250);
  }
}

/** Confirm the truck and set a name — what a first-time driver does once. */
async function completeSetup(page) {
  const confirm = page.getByRole('button', { name: 'This is my truck' });
  if ((await confirm.count()) > 0) await confirm.first().click();
  await page.waitForTimeout(200);
}

/* ===================================================================== */
/* 1. THE MEASUREMENT — eight viewports, first-time vs returning          */
/* ===================================================================== */
async function scenarioLength(browser) {
  console.log('\n=== parked-screen length: first-time vs returning, 8 viewports ===');
  const rows = [];
  for (const viewport of VIEWPORTS) {
    /* --- first run: nothing saved, no location permission ----------- */
    const first = await newContext(browser, { viewport, geo: null });
    const p1 = await first.context.newPage();
    await login(p1);
    await p1.waitForTimeout(600);
    const firstHeight = await pageHeight(p1);
    const firstStart = await documentTop(p1.getByRole('button', { name: 'Start Route' }));
    await shot(p1, `fast-start-${viewport.name}-first`);

    // Complete setup, then RELOAD — the returning driver, restored from
    // this device's own storage rather than a fixture.
    await completeSetup(p1);
    const returningStorage = await first.context.storageState();
    await first.context.close();

    /* --- returning: same device, next morning ----------------------- */
    const back = await newContext(browser, { viewport, keepStorage: returningStorage, geo: null });
    const p2 = await back.context.newPage();
    /*
     * NAV-ENTRY-1: `/drive` is the launcher; the parked screen this bench
     * measures is `/drive/navigate`. Measuring the launcher instead would
     * have reported a spectacular improvement that describes a different
     * page — the honest comparison is cockpit against cockpit.
     */
    await p2.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(900);
    const returnHeight = await pageHeight(p2);
    const returnStart = await documentTop(p2.getByRole('button', { name: 'Start Route' }));
    const returnDest = await documentTop(searchBox(p2));
    const heights = { firstHeight, firstStart, returnHeight, returnStart, returnDest };
    await shot(p2, `fast-start-${viewport.name}-returning`);

    // --- the duplication the audit counted -------------------------
    const dupHeight = await countText(p2, '13′6″');
    const dupWeight = await countText(p2, '80,000 lb');
    // --- and the word that must not be on a parked screen ----------
    const passenger = await countText(p2, 'passenger');

    rows.push({ viewport: viewport.name, ...heights, dupHeight, dupWeight, passenger });

    verdict(
      `${viewport.name}: Start Route is on the returning screen`,
      returnStart !== null,
      returnStart === null ? 'absent' : `y=${returnStart}`,
    );
    verdict(
      `${viewport.name}: the returning screen is SHORTER than the first run`,
      returnHeight <= firstHeight,
      `${returnHeight}px vs ${firstHeight}px`,
    );
    /*
     * THE COMPARISON INVERTED INTO AN EQUALITY, and that is the better
     * result (NAV-ENTRY-1).
     *
     * Fast Start's win was that a RETURNING driver got a shorter screen than
     * a first-time one, because their setup collapsed. There is no setup on
     * this screen at all now — it moved to /drive/settings — so the two
     * drivers get the SAME short screen, and "sooner than the first run" can
     * never be true again. Asserting `<=` says what is actually promised: a
     * returning driver is never made to scroll further than a new one, and
     * neither of them scrolls past a setup stack to reach Start.
     */
    verdict(
      `${viewport.name}: Start Route is no further away than on the first run`,
      returnStart !== null && firstStart !== null && returnStart <= firstStart,
      `${returnStart}px vs ${firstStart}px`,
    );
    verdict(
      `${viewport.name}: the truck's height appears ONCE, not twice`,
      dupHeight <= 1,
      `${dupHeight}x 13′6″`,
    );
    verdict(
      `${viewport.name}: the gross weight appears ONCE, not twice`,
      dupWeight <= 1,
      `${dupWeight}x 80,000 lb`,
    );
    verdict(
      `${viewport.name}: a parked driver is never called a passenger`,
      passenger === 0,
      `${passenger} occurrences`,
    );
    await back.context.close();
  }

  /* --- the report the milestone was asked for ---------------------- */
  console.log('\n  --- parked-screen measurements ---');
  console.log('  viewport          first-run h   first Start   returning h   returning Start');
  for (const r of rows) {
    console.log(
      `  ${r.viewport.padEnd(17)} ${String(r.firstHeight).padStart(9)}px ${String(
        r.firstStart ?? '-',
      ).padStart(11)}px ${String(r.returnHeight).padStart(11)}px ${String(
        r.returnStart ?? '-',
      ).padStart(15)}px`,
    );
  }
  const ref = rows.find((r) => r.viewport === 'iphone-13');
  if (ref) {
    const dh = BASELINE.heightPx - ref.returnHeight;
    const ds = BASELINE.startPx - (ref.returnStart ?? BASELINE.startPx);
    console.log(
      `\n  vs AUDIT BASELINE (${BASELINE.reference}):` +
        `\n    height:  ${BASELINE.heightPx}px -> ${ref.returnHeight}px  (${dh >= 0 ? '-' : '+'}${Math.abs(
          dh,
        )}px, ${((dh / BASELINE.heightPx) * 100).toFixed(1)}% shorter)` +
        `\n    Start:   ${BASELINE.startPx}px -> ${ref.returnStart}px  (${ds >= 0 ? '-' : '+'}${Math.abs(
          ds,
        )}px, ${((ds / BASELINE.startPx) * 100).toFixed(1)}% sooner)` +
        `\n    screens of scrolling to Start: ${(BASELINE.startPx / 844).toFixed(1)} -> ${(
          (ref.returnStart ?? 0) / 844
        ).toFixed(1)}`,
    );
  }
  return rows;
}

/* ===================================================================== */
/* 2. PREFERENCES: saved, restored, and ON THE WIRE                       */
/* ===================================================================== */
async function scenarioPreferences(browser) {
  console.log('\n=== saved preferences reach the HERE request ===');
  const viewport = VIEWPORTS[2];
  const { context, counts, sentAvoid } = await newContext(browser, { viewport });
  const page = await context.newPage();
  try {
    await login(page);
    await completeSetup(page);

    /*
     * NAV-ENTRY-1 moved the preference editor to /drive/settings with the
     * rest of the setup. What this scenario is really about is unchanged and
     * is asserted below: a saved preference reaches the provider on the wire.
     */
    await page.goto(`${BASE}/drive/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-edit-prefs]').first().waitFor({ timeout: 20_000 });
    await page.locator('[data-edit-prefs]').first().click();
    await page.waitForTimeout(150);
    const toll = page.locator('[data-pref-toggle="tollRoad"]');
    verdict('prefs: a toll toggle is offered', (await toll.count()) === 1);
    await toll.first().click();
    await page.waitForTimeout(150);
    verdict(
      'prefs: the toggle reports itself pressed',
      (await toll.first().getAttribute('aria-pressed')) === 'true',
    );

    // Survive a reload — the whole point of "saved settings".
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    /*
     * READ WHERE THE DRIVER READS IT. The saved preference has to be legible
     * on the COMPACT summary, not only inside the editor a driver would have
     * to open — otherwise they have no way to see what their route is being
     * planned around without opening the thing they just closed.
     *
     * NAV-ENTRY-1 moved that summary to the preferences section of
     * /drive/settings, which is where the reload lands, so the same sentence
     * is read from `[data-prefs-summary]`.
     */
    const collapsed = await page
      .locator('[data-prefs-summary]')
      .first()
      .innerText()
      .catch(() => '');
    verdict(
      'prefs: the choice survived a reload',
      collapsed.includes('Avoid tolls'),
      collapsed.replace(/\n/g, ' | '),
    );
    verdict(
      'prefs: the OTHER state is named too, never left blank',
      collapsed.includes('Ferries allowed'),
      collapsed.replace(/\n/g, ' | '),
    );

    /*
     * Now start a trip and read the wire. Back to the driving surface: the
     * preference was set where preferences are set, and it has to reach a
     * provider request made where trips are started.
     */
    await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const search = searchBox(page);
    await search.fill('Bench');
    await page.waitForTimeout(1200);
    const result = page.getByText('Bench Receiving Gate').first();
    if ((await result.count()) > 0) await result.click();
    await page.waitForTimeout(300);
    const start = page.getByRole('button', { name: 'Start Route' });
    // FIVE RAPID TAPS: one route request is the contract.
    for (let i = 0; i < 5; i++) await start.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);

    verdict(
      'prefs: five rapid Start taps spent ONE route request',
      counts.route === 1,
      `${counts.route} requests`,
    );
    const avoid = sentAvoid[0];
    verdict(
      'prefs: the request actually carried avoid[features]=tollRoad',
      Array.isArray(avoid) && avoid.includes('tollRoad'),
      JSON.stringify(avoid),
    );
    verdict(
      'prefs: ...and did NOT carry a preference the driver left off',
      !Array.isArray(avoid) || !avoid.includes('ferry'),
      JSON.stringify(avoid),
    );
    await shot(page, 'fast-start-preferences');
  } finally {
    await context.close();
  }
}

/* ===================================================================== */
/* 3. UNITS: the same truck, both ways of reading it                      */
/* ===================================================================== */
async function scenarioUnits(browser) {
  console.log('\n=== imperial and metric read the same stored truck ===');
  const viewport = VIEWPORTS[2];
  const { context } = await newContext(browser, { viewport });
  const page = await context.newPage();
  try {
    await login(page);
    await completeSetup(page);
    /*
     * Read the truck where its dimensions are rendered in full — the truck
     * section of /drive/settings (NAV-ENTRY-1). The driving surface carries a
     * one-line summary in plain words ("13 ft 6 in") which avoids the same
     * decimal-feet trap, but the prime-mark rendering this scenario is about
     * lives with the editor and the unit switch it is comparing against.
     */
    await page.goto(`${BASE}/drive/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const imperial = await page.evaluate(() => document.body.innerText);
    verdict(
      'units: imperial reads 13′6″, never 13.6',
      imperial.includes('13′6″') && !imperial.includes('13.6'),
    );

    await openSetup(page, /^Kilometres \/ kg$/);
    await page
      .getByRole('button', { name: /^Kilometres \/ kg$/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    const metric = await page.evaluate(() => document.body.innerText);
    verdict(
      'units: metric reads the same truck as 4.11 m',
      metric.includes('4.11'),
      'expected 4.11 m',
    );
    verdict('units: and no longer shows the imperial reading', !metric.includes('13′6″'));
    await shot(page, 'fast-start-metric');
  } finally {
    await context.close();
  }
}

/* ===================================================================== */
/* 4. CANADA + CROSS-BORDER: HOS honesty survives the collapse            */
/* ===================================================================== */
async function scenarioRegions(browser) {
  console.log('\n=== Canada and cross-border, with setup collapsed ===');
  const viewport = VIEWPORTS[2];
  const { context } = await newContext(browser, { viewport, geo: ORIGIN_CA, dest: DEST_CA });
  const page = await context.newPage();
  try {
    await login(page);
    await completeSetup(page);
    await openSetup(page, /^Canada$/);
    await page
      .getByRole('button', { name: /^Canada$/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => document.body.innerText);
    verdict(
      'canada: the HOS calculation is still declared unavailable',
      /not calculated/i.test(text),
      'expected a "not calculated" statement',
    );
    verdict('canada: no fresh eleven-hour clock is implied', !text.includes('11:00'));
    await shot(page, 'fast-start-canada');
  } finally {
    await context.close();
  }
}

/* ===================================================================== */
/* 5. STATIONARY GPS LOSS vs CONFIRMED MOTION — the safety half           */
/* ===================================================================== */
async function scenarioMotion(browser) {
  console.log('\n=== parked signal loss, and real movement ===');
  const viewport = VIEWPORTS[2];
  const { context } = await newContext(browser, { viewport });
  const page = await context.newPage();
  try {
    await login(page);
    await completeSetup(page);
    await page.waitForTimeout(400);

    // A parked driver, with location granted and the truck standing
    // still: nothing on this screen may ask them to claim to be a
    // passenger, and nothing may claim the truck is moving.
    const parked = await page.evaluate(() => document.body.innerText);
    verdict('parked: the word "passenger" is absent', !/passenger/i.test(parked));
    verdict(
      'parked: the screen never claims the vehicle is moving',
      !/while the vehicle is moving/i.test(parked),
    );
    await shot(page, 'fast-start-parked');

    // Now take the signal away entirely, the way a canopy does.
    await context.setGeolocation(undefined).catch(() => {});
    await context.clearPermissions();
    await page.waitForTimeout(1500);
    const lost = await page.evaluate(() => document.body.innerText);
    // Either the setup is still usable (inside the parked grace) or it is
    // paused for a NAMED reason. What it must never be is a passenger
    // declaration — the driver has not moved.
    verdict('signal lost: still no passenger declaration', !/passenger/i.test(lost));
    const paused = await page.locator('[data-lock-reason="location-unknown"]').count();
    if (paused > 0)
      note('signal lost: setup paused with reason "location-unknown" (grace expired)');
    else note('signal lost: setup still available (inside the 60s parked grace)');
    await shot(page, 'fast-start-signal-lost');
  } finally {
    await context.close();
  }
}

/* ===================================================================== */
/* 6. TAP TARGETS + CONTRAST on the collapsed screen                      */
/* ===================================================================== */
async function scenarioTouch(browser) {
  console.log('\n=== tap targets and contrast, collapsed screen ===');
  const viewport = VIEWPORTS[0]; // the smallest phone: worst case
  const { context } = await newContext(browser, { viewport, geo: null });
  const page = await context.newPage();
  try {
    await login(page);
    await completeSetup(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const small = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button, [role="button"], a, input, select')) {
        // MapLibre's own attribution chrome is not ours to size.
        if (el.closest('.maplibregl-ctrl, .maplibregl-control-container')) continue;
        if (el.closest('header, nav, footer')) continue;
        // The skip link is sr-only by design: 1x1 until it takes focus,
        // at which point it becomes a full-size control. Measuring it
        // unfocused measures the wrong thing.
        if (el.classList.contains('sr-only')) continue;

        /*
         * MEASURE WHAT THE THUMB HITS. A radio or checkbox inside a
         * <label> is a 24px dot painted inside a much larger row, and
         * tapping anywhere on that row activates it — so the label is
         * the tap target and the dot is decoration. Measuring the input
         * would report a failure a driver cannot experience; measuring
         * the label reports the one they can.
         */
        const label =
          el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.closest('label') : null;
        const target = label ?? el;
        const r = target.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44 || r.width < 44) {
          bad.push(
            `${target.tagName.toLowerCase()}:${(target.textContent ?? '').trim().slice(0, 24)} ${Math.round(
              r.width,
            )}x${Math.round(r.height)}`,
          );
        }
      }
      return bad;
    });
    verdict(
      'touch: every planner control is at least 44x44 at 320px',
      small.length === 0,
      small.slice(0, 4).join(' | '),
    );

    // The Start button's own contrast — the one control that must never
    // be black on black. Measured, not eyeballed.
    const contrast = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent ?? '').trim() === 'Start Route',
      );
      if (!btn) return null;
      const lum = (c) => {
        const [r, g, b] = c
          .match(/\d+(\.\d+)?/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const cs = getComputedStyle(btn);
      let bg = cs.backgroundColor;
      let el = btn;
      while (bg === 'rgba(0, 0, 0, 0)' && el.parentElement) {
        el = el.parentElement;
        bg = getComputedStyle(el).backgroundColor;
      }
      const a = lum(cs.color);
      const b = lum(bg);
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    });
    verdict(
      'contrast: Start Route meets WCAG AA for large text (>= 3:1)',
      contrast !== null && contrast >= 3,
      contrast === null ? 'button not found' : `${contrast}:1`,
    );
    await shot(page, 'fast-start-320-collapsed');
  } finally {
    await context.close();
  }
}

/* ===================================================================== */
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  try {
    await scenarioLength(browser);
    await scenarioPreferences(browser);
    await scenarioUnits(browser);
    await scenarioRegions(browser);
    await scenarioMotion(browser);
    await scenarioTouch(browser);
  } finally {
    await browser.close();
  }
  console.log(
    `\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`,
  );
  if (notes.length > 0) console.log(`${notes.length} note(s) recorded above.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * The resume-on-return bench: does a reload mid-drive put the trip back?
 *
 * Pilot round 3, item 4: the driver leaves for a phone call or Facebook,
 * the OS discards the tab, and the browser reloads the page mid-drive.
 * Before trip restore that reload landed on the idle screen and asked a
 * rolling driver to re-plan a route. This drives a REAL production
 * build to active navigation, hard-reloads the page, and requires:
 *
 *   1. the driving surface back with the SAME route — no destination
 *      entry, no questions, no provider call (the route endpoint is
 *      mocked and counted; a restore that re-spends fails the bench),
 *   2. guidance genuinely LIVE again — the GPS watch resumed under the
 *      already-granted permission and the maneuver distance keeps
 *      counting down as the truck keeps moving.
 *
 * What a browser honestly cannot do remains out of scope, and the docs
 * say so: no background GPS while another app is foregrounded, and
 * voice returns muted because mobile Safari requires a user gesture for
 * the first utterance of a session.
 *
 * Exit 0 when the reload restores live guidance; exit 1 otherwise.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, not a CI gate, exactly like the other
 * scripts under scripts/bench. Install it ad hoc first:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3210 &
 *   node scripts/bench/navigator-trip-restore.mjs --password <pw> \
 *     [--port 3210] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;

/*
 * The idle control was renamed 'Start' -> 'Start Route' in the pre-trip
 * setup milestone. Anchored, and accepting either name: 'Start
 * navigation' and 'Start with full clocks' are different buttons.
 */
const START_BUTTON = /^Start(?: Route)?$/;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3210');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;

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
      routeId: 'trip-restore-bench',
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

/**
 * Confirm the truck, once, before a route may be requested.
 *
 * The truck-route confidence milestone gates Start on a driver having
 * verified the profile: an unconfirmed truck spends nothing, which is
 * the point. Every flow that reaches Start therefore passes through
 * here first — the same tap a driver makes.
 */
async function confirmTruck(page) {
  /*
   * A CONFIRMED truck no longer shows a confirm button at all. Since the
   * pre-trip setup milestone the profile persists in localStorage and
   * collapses to a compact summary with 'Edit truck', so a scenario that
   * inherits a saved storage state arrives with nothing left to confirm.
   * Waiting for the old button in that case is waiting for something
   * that is correctly absent.
   */
  const summary = page.getByRole('button', { name: 'Edit truck' });
  if ((await summary.count()) > 0) return;
  const btn = page.getByRole('button', { name: /This is my truck|Truck confirmed/ });
  if ((await btn.count()) === 0) return;
  await btn.scrollIntoViewIfNeeded();
  if (!(await btn.isDisabled())) await btn.click();
  await page.waitForTimeout(200);
}

async function readState(page, label) {
  const s = await page.evaluate(() => {
    const text = document.body.innerText;
    const maneuver = document.querySelector('[aria-label="Next maneuver"]');
    const distance = /In ([\d.]+) mi/.exec(maneuver ? maneuver.textContent : '');
    return {
      navigating: /\bNavigating\b/.test(text),
      maneuverShown:
        maneuver !== null && /Old Mill Road|receiving gate|Depot Road/.test(maneuver.textContent),
      distanceMi: distance ? Number(distance[1]) : null,
      askedForDestination: /Search for a destination|Destination latitude/.test(text),
      speedShown: /\d+ mph/.test(text),
    };
  });
  console.log(`  [${label}] ${JSON.stringify(s)}`);
  return s;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  // The route endpoint is mocked AND counted: a restore that plans over
  // the network again is a failure this bench must catch.
  let routeCalls = 0;
  await context.route('**/api/navigator/route', (r) => {
    routeCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute()),
    });
  });
  const page = await context.newPage();

  let cursorLat = ORIGIN.lat;
  async function feed(seconds, metersPerSecond) {
    const M_PER_DEG_LAT = 111_320;
    for (let i = 0; i < seconds; i++) {
      await context.setGeolocation({
        latitude: cursorLat + (metersPerSecond * (i + 1)) / M_PER_DEG_LAT,
        longitude: ORIGIN.lng,
        accuracy: 8,
      });
      await page.waitForTimeout(1000);
    }
    cursorLat += (metersPerSecond * seconds) / M_PER_DEG_LAT;
  }

  await page.goto(`${BASE}/navigator/access?next=/drive`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  /*
   * NAV-ENTRY-1 moved the cockpit from `/drive` to `/drive/navigate`; `/drive`
   * is the launcher now. The gate is still entered through `/drive`.
   */
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    throw new Error('the pilot gate did not accept the password');
  }

  // Simplified startup (pilot round 3): destination entry is available at
  // a cold start (the setup window), the granted watch auto-resumes on
  // load, and ONE Start tap plans and begins the trip. Everything this
  // bench asserts about the RESTORE is unchanged.
  await feed(3, 0.3); // the auto-resumed watch publishes parked fixes
  try {
    await page.getByText('Developer: enter coordinates instead').click({ timeout: 20_000 });
  } catch (err) {
    console.error('\n--- page text when the destination form was expected ---');
    console.error((await page.locator('body').innerText()).slice(0, 1600));
    throw err;
  }
  await page.getByLabel('Destination latitude').fill(String(ORIGIN.lat + 6 / MI_PER_DEG_LAT));
  await page.getByLabel('Destination longitude').fill(String(ORIGIN.lng));
  await confirmTruck(page);
  await page.getByRole('button', { name: START_BUTTON }).click();
  console.log('one Start tap: fix → one validated plan → navigation…');
  await feed(3, 0.3);

  console.log('driving (14 s to satisfy the moving dwell)…');
  await feed(14, 27);

  const before = await readState(page, 'driving, before the reload');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/restore-1-before-reload.png` });
  const callsBeforeReload = routeCalls;

  // The event under test: the OS discarded the tab during a call and the
  // browser reloads the page. A hard reload rebuilds everything — React
  // tree, lifecycle, engines — from nothing but the snapshot.
  console.log('reloading the page mid-drive…');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500); // restore + permission query + first fix

  const after = await readState(page, 'immediately after the reload');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/restore-2-after-reload.png` });

  // Keep driving: the restored guidance must be LIVE, not a still image.
  await feed(6, 27);
  const later = await readState(page, 'six more seconds of driving');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/restore-3-still-live.png` });

  await browser.close();

  console.log('\n--- verdict ---');
  const restored = after.navigating && after.maneuverShown && !after.askedForDestination;
  const live =
    later.navigating &&
    later.distanceMi !== null &&
    after.distanceMi !== null &&
    later.distanceMi < after.distanceMi;
  const noRespend = routeCalls === callsBeforeReload;
  console.log(`restored without questions: ${restored ? 'yes' : 'NO'}`);
  console.log(
    `guidance live again (distance ${after.distanceMi} → ${later.distanceMi} mi): ${live ? 'yes' : 'NO'}`,
  );
  console.log(
    `no provider re-spend on restore (route calls ${callsBeforeReload} → ${routeCalls}): ${noRespend ? 'yes' : 'NO'}`,
  );
  const pass = restored && live && noRespend;
  console.log(
    pass
      ? 'PASS: a reload mid-drive restores the active trip'
      : 'FAIL: resume-on-return regression',
  );
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

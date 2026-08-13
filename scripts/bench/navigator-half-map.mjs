/**
 * The half-map bench: does the driving map's canvas follow its container?
 *
 * Pilot round 3 reported "half the map showing, half blank" mid-drive.
 * Reproduced here on 2026-08-11 against a production build: Leaflet
 * measures its container once at creation and re-measures on its own only
 * for a WINDOW resize — but starting a trip resizes the CONTAINER with no
 * window event (parked page box → viewport-filling cockpit, with the map
 * deliberately kept mounted across the switch). The stale canvas rendered
 * tiles over 43% of the driving map and gave the route line's SVG a 0px
 * height; one synthetic window resize healed both, isolating the cause to
 * the missed re-measure. The fix is a ResizeObserver in NavigationMap
 * plus a real parked-page box in DrivingScreen; this bench is the
 * end-to-end proof either way.
 *
 * What it does — the pilot's real path (the round-3 simplified startup),
 * with the viewport FIXED the whole run so Leaflet's own window-resize
 * handling can never mask the bug: pilot gate → destination (available at
 * a cold start under the setup window; the granted watch auto-resumes on
 * load) → measure the parked map → ONE Start tap (plan + auto-start) →
 * 14 s moving dwell → measure tile coverage of the driving map WITHOUT
 * any window resize. Coverage is computed from DOM rects, so tile-image network
 * failures cannot fake a result. If coverage fails, one synthetic window
 * resize is fired and measured again: healing implicates a stale canvas
 * size; not healing means a different bug.
 *
 * Exit 0 when the driving map's tiles cover ≥95% of its container with no
 * window resize since Start; exit 1 otherwise.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, not a CI gate, exactly like the other
 * scripts under scripts/bench. Install it ad hoc first:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3210 &
 *   node scripts/bench/navigator-half-map.mjs --password <pw> \
 *     [--port 3210] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from '/home/user/tlws-platform/node_modules/playwright/index.js';
const { chromium } = pkg;

/*
 * The idle control was renamed 'Start' -> 'Start Route' in the pre-trip
 * setup milestone (it is the last step of a named sequence now, not a
 * bare verb). The pattern below accepts either name and stays ANCHORED:
 * 'Start navigation' on the route briefing and 'Start with full clocks'
 * in the clock editor are different buttons, and a bench that meant one
 * must never silently tap another.
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

/** A short synthetic route the mocked endpoint hands back. */
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
      routeId: 'half-map-bench',
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
 * Container rect, tile coverage, and the overlay SVG's size — all from
 * DOM rects. The coverage grid marks every cell any tile overlaps, so
 * overlapping zoom generations are not double counted, and a "half map"
 * shows as coverage stopping at a horizontal line above the container's
 * bottom edge.
 */
async function measure(page, label) {
  const m = await page.evaluate(() => {
    const container = document.querySelector('[aria-label^="Navigation map"]');
    if (!container) return { present: false };
    const c = container.getBoundingClientRect();

    // The renderer is MapLibre now: one canvas, not a grid of tile
    // images. The half-map defect is measured the same way — how far
    // down the container the drawn picture actually reaches — by
    // treating the canvas as the single "tile".
    const tiles = Array.from(document.querySelectorAll('.nav-map .maplibregl-canvas'));
    const cols = 40;
    const rowsN = 60;
    const covered = new Uint8Array(cols * rowsN);
    for (const t of tiles) {
      const r = t.getBoundingClientRect();
      const x0 = Math.max(r.left, c.left);
      const x1 = Math.min(r.right, c.right);
      const y0 = Math.max(r.top, c.top);
      const y1 = Math.min(r.bottom, c.bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      const gx0 = Math.floor(((x0 - c.left) / Math.max(c.width, 1)) * cols);
      const gx1 = Math.ceil(((x1 - c.left) / Math.max(c.width, 1)) * cols);
      const gy0 = Math.floor(((y0 - c.top) / Math.max(c.height, 1)) * rowsN);
      const gy1 = Math.ceil(((y1 - c.top) / Math.max(c.height, 1)) * rowsN);
      for (let gy = gy0; gy < Math.min(gy1, rowsN); gy++)
        for (let gx = gx0; gx < Math.min(gx1, cols); gx++) covered[gy * cols + gx] = 1;
    }
    let on = 0;
    for (const v of covered) on += v;
    let lastCoveredRow = -1;
    for (let gy = 0; gy < rowsN; gy++) {
      let any = 0;
      for (let gx = 0; gx < cols; gx++) any |= covered[gy * cols + gx];
      if (any) lastCoveredRow = gy;
    }

    // The route line is drawn INTO that canvas by WebGL, so the old
    // overlay-SVG measurement becomes the canvas's own drawing-buffer
    // size: a stale-size renderer shows up as a buffer that no longer
    // matches its container.
    const svg = document.querySelector('.nav-map .maplibregl-canvas');
    const svgRect = svg ? svg.getBoundingClientRect() : null;

    return {
      present: true,
      container: { w: Math.round(c.width), h: Math.round(c.height) },
      tiles: tiles.length,
      coveragePct: Math.round((on / (cols * rowsN)) * 100),
      coveredToPx: Math.round(((lastCoveredRow + 1) / rowsN) * c.height),
      overlaySvg: svgRect ? { w: Math.round(svgRect.width), h: Math.round(svgRect.height) } : null,
    };
  });
  console.log(`  [${label}] ${JSON.stringify(m)}`);
  return m;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    // FIXED for the whole run: a viewport change fires a real window
    // resize, which Leaflet handles by itself — and hides this bug.
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  // The route endpoint is mocked: this measures LAYOUT, and a real
  // provider call would spend money and make the run non-deterministic.
  await context.route('**/api/navigator/route', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute()),
    }),
  );
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
  if (page.url().includes('/navigator/access')) {
    throw new Error('the pilot gate did not accept the password');
  }

  // Simplified startup (pilot round 3): destination entry is available at
  // a cold start (the setup window), permission is already granted so the
  // watch auto-resumes on load, and ONE Start tap plans and begins the
  // trip. The bench's measured transition is unchanged — the parked page
  // box becomes the viewport-filling cockpit with no window resize.
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
  await page.waitForTimeout(500);

  const parked = await measure(page, 'parked page, before Start');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/half-map-1-parked.png` });

  // The transition under test: the container resizes, the window does not.
  await page.getByRole('button', { name: START_BUTTON }).click();
  console.log('driving (14 s to satisfy the moving dwell)…');
  await feed(14, 27);
  await page.waitForTimeout(1500);

  const driving = await measure(page, 'navigating, NO window resize since Start');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/half-map-2-navigating.png` });

  const pass =
    driving.present &&
    driving.coveragePct >= 95 &&
    driving.overlaySvg !== null &&
    driving.overlaySvg.h > 0;

  if (!pass) {
    // Diagnose: one synthetic window resize and nothing else. Healing
    // implicates a stale canvas size; not healing means a different bug.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(1200);
    const healed = await measure(page, 'after ONE synthetic window resize');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/half-map-3-after-resize.png` });
    console.log(
      healed.coveragePct >= 95
        ? '\ndiagnosis: a re-measure healed it — Leaflet held a stale canvas size'
        : '\ndiagnosis: a re-measure did NOT heal it — this is not (only) a stale canvas size',
    );
  }

  await browser.close();

  console.log('\n--- verdict ---');
  console.log(
    `parked map box: ${parked.present ? `${parked.container.w}x${parked.container.h}` : 'absent'}` +
      (parked.present && parked.container.h === 0
        ? ' — 0px tall: the canvas is born degenerate'
        : ''),
  );
  if (driving.present) {
    console.log(
      `driving map ${driving.container.w}x${driving.container.h}: tiles cover ` +
        `${driving.coveragePct}% (to ${driving.coveredToPx}px), route SVG ` +
        `${driving.overlaySvg ? `${driving.overlaySvg.w}x${driving.overlaySvg.h}` : 'absent'}`,
    );
  } else {
    console.log('driving map: NOT PRESENT');
  }
  console.log(pass ? 'PASS: the canvas follows its container' : 'FAIL: half-map regression');
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

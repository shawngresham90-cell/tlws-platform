/**
 * The declutter bench: how much map does the driver actually get?
 *
 * Road-test feedback said the live screen is too busy — the HOS strip
 * takes permanent space, the maneuver card is too tall, and the map is
 * what drivers want more of. This measures whether that changed, in a
 * real browser against a production build, at the phone sizes drivers
 * hold.
 *
 * THE MEASUREMENT THAT MATTERS IS NOT THE MAP CONTAINER. The map has
 * been `absolute inset-0` since #304 — it is already 100% of the
 * viewport and reporting that number would say "100%" before and after
 * while changing nothing a driver sees. What a driver gets is the part
 * of the map NOT covered by an overlay, so that is what this samples: a
 * grid of points across the viewport, each asked `elementFromPoint`, and
 * counted as map only when the hit resolves inside the map element.
 * Overlapping overlays, gaps between them and rounded corners all fall
 * out of that correctly and none of them can be argued with.
 *
 * Per viewport it records:
 *   - the maneuver card's height;
 *   - the HOS area's height, expanded and collapsed;
 *   - unobstructed map percentage, expanded and collapsed;
 *   - every persistent overlay rectangle;
 *   - the truck marker's clearance and what covers it when it is not clear;
 *   - route-ahead visibility above the truck;
 *   - tap-target sizes for Overview, Voice, Stop and the clocks control;
 *   - document overflow and scrolling during live guidance;
 *   - route and search request counts.
 *
 * It runs unchanged against a build WITHOUT the collapse control, which
 * is the point: the same script produces the BEFORE and the AFTER, and a
 * missing control is recorded as absent rather than faked.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3250 &
 *   node scripts/bench/navigator-declutter.mjs --password <pw> \
 *     [--port 3250] [--shots <dir>] [--json <file>] [--label before]
 */
import pkg from 'playwright';
import { writeFileSync } from 'node:fs';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3250');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const JSON_OUT = arg('json');
const LABEL = arg('label', 'run');
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

/*
 * The sizes the milestone names, plus the two landscape shapes the
 * Navigator benches already use. 320x568 is the floor the design has
 * always been held to; 844x390 is the one that has caught every
 * bottom-band overflow so far.
 */
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

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;
const DEST = { lat: ORIGIN.lat + 6 / MI_PER_DEG_LAT, lng: ORIGIN.lng };

/** A driver five hours in, so the strip has real numbers to lay out. */
const MID_SHIFT_CLOCKS = {
  v: 1,
  entered: {
    drivingMin: 305,
    windowMin: 470,
    untilBreakMin: 185,
    cycleMin: 1325,
    cycleRule: '70/8',
  },
  enteredAtMs: 1754000000000,
  fromFreshShift: false,
};

/**
 * A driver eight minutes from a required break: every clock cell reads
 * URGENT or OVER. Used for the "urgent while hidden" scenario, where the
 * collapsed strip must not be allowed to swallow the warning.
 */
const URGENT_CLOCKS = {
  v: 1,
  entered: {
    drivingMin: 40,
    windowMin: 60,
    untilBreakMin: 8,
    cycleMin: 300,
    cycleRule: '70/8',
  },
  enteredAtMs: 1754000000000,
  fromFreshShift: false,
};

let failures = 0;
let checks = 0;
const report = { label: LABEL, viewports: {} };

function verdict(name, cond, detail = '') {
  checks += 1;
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}

/*
 * A MEASURED, KNOWN-OPEN condition — recorded, never counted as a pass.
 *
 * The alternative is worse in both directions: asserting it turns a
 * pre-existing defect into this milestone's failure, and deleting it
 * hides a real problem behind a green run. Notes are printed loudly,
 * tallied separately, and repeated in the summary so nobody reads this
 * bench as saying the screen is perfect.
 */
let notes = 0;
const noteLog = [];
function note(name, ok, detail = '') {
  if (ok) {
    checks += 1;
    console.log(`  ok  ${name}${detail === '' ? '' : ` — ${detail}`}`);
    return;
  }
  notes += 1;
  noteLog.push(`${name}${detail === '' ? '' : ` — ${detail}`}`);
  console.log(`  NOTE (known, pre-existing) ${name}${detail === '' ? '' : ` — ${detail}`}`);
}

function syntheticRoute({ longNames = false } = {}) {
  const geometry = [];
  for (let i = 0; i <= 200; i++) {
    geometry.push([ORIGIN.lat + (i * 0.03) / MI_PER_DEG_LAT, ORIGIN.lng]);
  }
  const turn = longNames
    ? 'Turn right onto Interstate 24 West toward Chattanooga / Nashville Exit 178B Commercial Vehicle Route'
    : 'Turn right onto Old Mill Road.';
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: 'declutter-bench',
      distanceMiles: 6,
      seconds: 480,
      geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
        { action: 'turn', instruction: turn, direction: 'right', offset: 100 },
        {
          action: 'arrive',
          instruction: 'Arrive at the receiving gate.',
          direction: null,
          offset: 200,
        },
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
  await page.waitForTimeout(700);
}

async function makeContext(browser, { w, h }, { clocks = MID_SHIFT_CLOCKS, longNames = false }) {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: w, height: h },
    isMobile: w < 700 || h < 700,
    hasTouch: w < 700 || h < 700,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });
  await context.addInitScript((record) => {
    try {
      window.localStorage.setItem('tlws-navigator-clocks-v1', JSON.stringify(record));
    } catch {
      /* a context that cannot seed still runs; the HOS checks will say so */
    }
  }, clocks);
  const counts = { route: 0, search: 0 };
  await context.route('**/api/navigator/route', (r) => {
    counts.route += 1;
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute({ longNames })),
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
            address: '100 Depot Rd, Ringgold, GA 30736',
            position: DEST,
            facility: 'warehouse',
            distanceMi: null,
          },
        ],
      }),
    });
  });
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());
  return { context, counts };
}

/**
 * Everything the milestone asks to be measured, taken in one pass so the
 * numbers all describe the same frame.
 */
async function measure(page) {
  /*
   * Pin the viewport to the guidance surface first.
   *
   * The driving screen is a 100dvh surface at the top of a document that
   * deliberately continues below it — the motion-lock explainer, the trip
   * controls, the pilot onboarding. A driver never scrolls during
   * guidance, but a scripted run can leave the page scrolled after a tap,
   * and then `elementFromPoint` samples below-fold prose instead of the
   * map. The first draft of this bench did exactly that and reported the
   * COLLAPSED state as having LESS map than the expanded one, which is
   * the opposite of what the change does.
   */
  await page.evaluate(() => {
    /*
     * Reset EVERY scroller, not just the window.
     *
     * The drive-mode shell is a `fixed inset-0 overflow-y-auto` element,
     * so it scrolls independently of the document — `window.scrollY`
     * stays 0 while the guidance surface is 382 px above the viewport.
     * Focusing any control scrolls it: tapping Voice does it, which is
     * how this was traced, so it predates this milestone and is recorded
     * as a pre-existing finding rather than attributed to the collapse.
     *
     * A driver never scrolls during guidance, so measuring a scrolled
     * shell measures a screen no driver has. Reset first, then sample.
     */
    window.scrollTo(0, 0);
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mapEl = document.querySelector('.maplibregl-map');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };

    /*
     * UNOBSTRUCTED MAP, sampled rather than computed.
     *
     * A rectangle union would have to know which elements are overlays,
     * and would be wrong about rounded corners, transparent gaps and
     * anything that overlaps. Asking the document what is actually on
     * top at a point cannot be wrong about any of that. The grid is
     * coarse enough to be fast and fine enough that a 40px band cannot
     * hide between samples.
     */
    const COLS = 40;
    const ROWS = 70;
    let mapPoints = 0;
    let total = 0;
    const coveredBy = new Map();
    for (let r = 0; r < ROWS; r++) {
      const y = ((r + 0.5) * vh) / ROWS;
      for (let c = 0; c < COLS; c++) {
        const x = ((c + 0.5) * vw) / COLS;
        total += 1;
        const hit = document.elementFromPoint(x, y);
        if (hit && mapEl && mapEl.contains(hit)) {
          mapPoints += 1;
        } else if (hit) {
          // Name the covering surface, so a regression says WHAT grew.
          const named = hit.closest('[aria-label]');
          const key = named ? named.getAttribute('aria-label') : hit.tagName.toLowerCase();
          coveredBy.set(key, (coveredBy.get(key) ?? 0) + 1);
        }
      }
    }

    /*
     * THE BOTTOM BAND, as one measured box.
     *
     * Since the cleanup milestone the trip strip, the HOS region and the
     * control row live inside one wrapper, so "how much of the bottom is
     * cockpit" is a single rect rather than a guess assembled from three.
     * The same wrapper is what the camera measures, so the bench and the
     * product are reading the same number.
     */
    const band = document.querySelector('[data-bottom-band]');
    const bandRect = band ? band.getBoundingClientRect() : null;

    const maneuver = document.querySelector('[aria-label="Next maneuver"]');
    const hosCompact = document.querySelector('[aria-label^="Hours of service — compact"]');
    const hosUnset = document.querySelector('[aria-label^="Hours of service — not"]');
    const hosRegion = document.querySelector('[data-hos-region]');

    // Every persistent overlay rectangle, named.
    const overlays = [];
    for (const sel of [
      '[aria-label="Next maneuver"]',
      '[data-hos-region]',
      '[aria-label^="Hours of service"]',
      '[aria-label="Trip progress"]',
    ]) {
      const el = document.querySelector(sel);
      if (el) overlays.push({ sel, rect: box(el) });
    }

    // The truck, and whether anything sits on it.
    const marker = document.querySelector('[aria-label="Your truck"]');
    let truck = null;
    if (marker && mapEl) {
      const mr = marker.getBoundingClientRect();
      const cx = mr.left + mr.width / 2;
      const cy = mr.top + mr.height / 2;
      if (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh) {
        const hit = document.elementFromPoint(cx, cy);
        const clear = hit !== null && mapEl.contains(hit);
        truck = {
          x: Math.round(cx),
          y: Math.round(cy),
          clear,
          coveredBy:
            clear || hit === null
              ? null
              : (hit.closest('[aria-label]')?.getAttribute('aria-label') ??
                hit.tagName.toLowerCase()),
        };
        /*
         * ROUTE AHEAD. Heading-up puts the road the driver is about to
         * drive ABOVE the marker, so the clearance that matters is the
         * gap between the truck and the lowest edge of whatever overlay
         * hangs over it. Sampled straight up from the marker.
         */
        let clearAbove = 0;
        for (let y = cy - 4; y >= 0; y -= 4) {
          const h2 = document.elementFromPoint(cx, y);
          if (!(h2 && mapEl.contains(h2))) break;
          clearAbove = Math.round(cy - y);
        }
        truck.clearAbovePx = clearAbove;
        /*
         * CLEARANCE: the gap between the marker's LOWER EDGE and the
         * band's top. Negative means the marker is inside the cockpit
         * band — which is the defect this milestone exists to close, and
         * which measured -27 px to -114 px on main.
         */
        truck.bottom = Math.round(mr.bottom);
        truck.clearancePx = bandRect === null ? null : Math.round(bandRect.top - mr.bottom);
        truck.fraction = Number((cy / vh).toFixed(3));
      }
    }

    // Tap targets. 48 is the milestone's floor; the project's own is 64.
    const targets = {};
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const label = `${btn.getAttribute('aria-label') ?? ''} ${btn.textContent ?? ''}`.trim();
      const key = /Hide clocks|Show clocks/i.test(label)
        ? 'clocks'
        : /^Stop/.test(label)
          ? 'stop'
          : /Voice|Mute/i.test(label)
            ? 'voice'
            : /overview/i.test(label)
              ? 'overview'
              : /Zoom in/i.test(label)
                ? 'zoomIn'
                : /Zoom out/i.test(label)
                  ? 'zoomOut'
                  : null;
      if (key === null || targets[key]) continue;
      const r = btn.getBoundingClientRect();
      targets[key] = {
        w: Math.round(r.width),
        h: Math.round(r.height),
        inViewport: r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1,
        short: Math.round(Math.min(r.width, r.height)),
      };
    }

    /*
     * SCROLLING, asked of the guidance surface rather than the document.
     *
     * The driving screen deliberately continues below the fold — the
     * motion-lock explainer, the trip controls and the pilot onboarding
     * all live past it, and they are supposed to. `document.scrollHeight
     * > innerHeight` is therefore true by design and says nothing. What
     * the milestone actually forbids is a driver having to scroll to
     * reach guidance, so the question is whether the 100dvh surface
     * overflows ITSELF.
     */
    const surface = document.querySelector('[data-driving-surface]');
    const surfaceOverflow = surface
      ? Math.max(0, Math.round(surface.scrollHeight - surface.clientHeight))
      : null;

    const body = document.body;
    return {
      vw,
      vh,
      surfaceOverflow,
      mapPct: Number(((100 * mapPoints) / total).toFixed(1)),
      coveredBy: Object.fromEntries(
        [...coveredBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      ),
      maneuverH: maneuver ? Math.round(maneuver.getBoundingClientRect().height) : null,
      hosH: hosRegion
        ? Math.round(hosRegion.getBoundingClientRect().height)
        : hosCompact
          ? Math.round(hosCompact.getBoundingClientRect().height)
          : hosUnset
            ? Math.round(hosUnset.getBoundingClientRect().height)
            : null,
      hosPresent: hosCompact !== null,
      overlays,
      truck,
      targets,
      band: bandRect
        ? {
            top: Math.round(bandRect.top),
            h: Math.round(bandRect.height),
          }
        : null,
      hscroll: body.scrollWidth > vw + 1,
      vscroll: body.scrollHeight > vh + 1,
      urgentVisible: /URGENT|OVER|Break required|limit reached|window ended/.test(
        document.body.innerText,
      ),
      eldVisible: /ELD is authoritative/.test(document.body.innerText),
      text: document.body.innerText.slice(0, 400),
    };
  });
}

/** Tap the clocks control if this build has one. Returns what it found. */
async function toggleClocks(page, want) {
  const btn = page.getByRole('button', { name: want === 'hide' ? /Hide clocks/i : /Show clocks/i });
  if ((await btn.count()) === 0) return 'absent';
  await btn
    .first()
    .click({ timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(350);
  return 'tapped';
}

async function driveTo(page, feed) {
  await page.getByText('Developer: enter coordinates instead').click({ timeout: 20_000 });
  await page.getByLabel('Destination latitude').fill(String(DEST.lat));
  await page.getByLabel('Destination longitude').fill(String(DEST.lng));
  await page.waitForTimeout(300);
  const confirm = page.getByRole('button', { name: /This is my truck/ });
  if ((await confirm.count()) > 0) {
    await confirm.scrollIntoViewIfNeeded();
    if (!(await confirm.isDisabled())) await confirm.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /^Start(?: Route)?$/ }).click({ timeout: 10_000 });
  await feed(14, 27);
  await page.waitForTimeout(1200);
}

async function runViewport(browser, vp, { clocks, longNames, key }) {
  const name = `${vp.w}x${vp.h}${vp.landscape ? ' landscape' : ''}`;
  console.log(`\n=== ${name}${key === 'normal' ? '' : ` · ${key}`} ===`);
  const { context, counts } = await makeContext(browser, vp, { clocks, longNames });
  const page = await context.newPage();
  try {
    await login(page);

    /* A scripted drive: real fixes at real speed, so guidance is live. */
    let t = 0;
    let mile = 0;
    const feed = async (seconds, mph) => {
      for (let i = 0; i < seconds; i++) {
        t += 1;
        mile += mph / 3600;
        await page.evaluate(
          ([lat, lng, spd]) => {
            const g = navigator.geolocation;
            if (g && g.__benchPush) g.__benchPush(lat, lng, spd);
          },
          [ORIGIN.lat + mile / MI_PER_DEG_LAT, ORIGIN.lng, mph / 2.236936],
        );
        await page.waitForTimeout(60);
      }
    };
    // The real geolocation is already granted and moving is simulated by
    // Playwright's own setGeolocation, which the app's watch observes.
    const step = async (seconds, mph) => {
      for (let i = 0; i < seconds; i++) {
        t += 1;
        mile += mph / 3600;
        await context.setGeolocation({
          latitude: ORIGIN.lat + mile / MI_PER_DEG_LAT,
          longitude: ORIGIN.lng,
          accuracy: 8,
        });
        await page.waitForTimeout(120);
      }
    };
    void feed;

    await driveTo(page, step);

    // ---- EXPANDED ------------------------------------------------------
    const expanded = await measure(page);
    if (SHOTS)
      await page.screenshot({ path: `${SHOTS}/${LABEL}-${vp.w}x${vp.h}-${key}-expanded.png` });

    // ---- COLLAPSED -----------------------------------------------------
    const toggled = await toggleClocks(page, 'hide');
    const collapsed = toggled === 'absent' ? null : await measure(page);
    if (SHOTS && collapsed)
      await page.screenshot({ path: `${SHOTS}/${LABEL}-${vp.w}x${vp.h}-${key}-collapsed.png` });

    const row = {
      viewport: name,
      scenario: key,
      maneuverH: expanded.maneuverH,
      hosExpandedH: expanded.hosH,
      hosCollapsedH: collapsed ? collapsed.hosH : null,
      mapPctExpanded: expanded.mapPct,
      mapPctCollapsed: collapsed ? collapsed.mapPct : null,
      truck: expanded.truck,
      targets: expanded.targets,
      overlays: expanded.overlays,
      coveredBy: expanded.coveredBy,
      hscroll: expanded.hscroll,
      surfaceOverflow: expanded.surfaceOverflow,
      truckCollapsed: collapsed ? collapsed.truck : null,
      collapseControl: toggled,
      requests: { ...counts },
    };
    report.viewports[`${name}|${key}`] = row;

    console.log(
      `  maneuver=${row.maneuverH}px  hos=${row.hosExpandedH}px` +
        (row.hosCollapsedH === null ? '' : `→${row.hosCollapsedH}px`) +
        `  map=${row.mapPctExpanded}%` +
        (row.mapPctCollapsed === null ? '' : `→${row.mapPctCollapsed}%`) +
        `  requests route=${counts.route}`,
    );
    if (Object.keys(expanded.coveredBy).length > 0) {
      console.log(`  covered by: ${JSON.stringify(expanded.coveredBy)}`);
    }

    // ---- the invariants that hold in every build -----------------------
    verdict(`${name}: no horizontal overflow during guidance`, !expanded.hscroll);
    verdict(
      `${name}: the guidance surface does not overflow itself`,
      expanded.surfaceOverflow === null || expanded.surfaceOverflow <= 1,
      `${expanded.surfaceOverflow}px`,
    );
    /*
     * TRUCK CLEARANCE — a hard assertion since the cleanup milestone.
     *
     * It was a note while the camera could not see the band: the reserve
     * came from a ResizeObserver on the trip strip alone, which fires on
     * SIZE and not on position, so a band that grew UNDERNEATH the strip
     * never re-reported. Measured on main the marker sat 27 to 114 px
     * inside the cockpit band. The band is one observed box now, so the
     * number is knowable and the check can be a check.
     */
    verdict(
      `${name}: the truck marker is not covered by an overlay`,
      expanded.truck === null || expanded.truck.clear,
      expanded.truck?.coveredBy ?? '',
    );
    verdict(
      `${name}: and clears the cockpit band by a measurable margin`,
      expanded.truck === null ||
        expanded.truck.clearancePx === null ||
        expanded.truck.clearancePx > 0,
      `${expanded.truck?.clearancePx}px (band top ${expanded.band?.top}, marker bottom ${expanded.truck?.bottom})`,
    );
    /*
     * AND IN THE LOWER HALF — WHERE THE GEOMETRY ALLOWS IT.
     *
     * The two goals are not always compatible. The marker is 36 px tall
     * and the camera parks its lower edge 26 px above the band
     * (FOLLOW_MARKER_HALF_PX + FOLLOW_MARKER_GAP_PX in
     * src/lib/navigator/heading.ts), so the LOWEST the marker's centre
     * can sit is 62 px above the band's top edge. Where that point is
     * still above mid-screen, "below the middle" and "clear of the band"
     * cannot both be true — measured: 320x568 (band at 316, so the
     * lowest centre is 254 against a middle of 284), 844x390 (119
     * against 195) and 932x430 (159 against 215).
     *
     * Clearance is the one that matters: a marker inside the cockpit
     * band shows the driver no road at all. So the condition is asserted
     * exactly where it is achievable — judged from the measured band and
     * the camera's own constants, not from a list of viewports that
     * happen to fail — and recorded with its number where it is not.
     */
    const MARKER_H = 36;
    const MARKER_GAP = 26;
    const lowerHalfPossible =
      expanded.band !== null && expanded.band.top - MARKER_GAP - MARKER_H > expanded.vh / 2;
    (lowerHalfPossible ? verdict : note)(
      `${name}: while staying in the lower half, so the road ahead keeps the screen`,
      expanded.truck === null || expanded.truck.fraction > 0.5,
      `${expanded.truck?.fraction}` +
        (lowerHalfPossible
          ? ''
          : ` — impossible here: the band starts at ${expanded.band?.top} of ${expanded.vh}`),
    );
    for (const [ctl, min] of [
      ['stop', 48],
      ['voice', 48],
      ['overview', 48],
    ]) {
      const t2 = expanded.targets[ctl];
      verdict(
        `${name}: ${ctl} is present, in-viewport and >= ${min}px`,
        t2 !== undefined && t2.inViewport && t2.short >= min,
        t2 ? JSON.stringify(t2) : 'absent',
      );
    }
    verdict(
      `${name}: exactly one route request for the whole drive`,
      counts.route === 1,
      String(counts.route),
    );
    if (key === 'urgent') {
      verdict(
        `${name}: the urgent HOS condition is visible while expanded`,
        expanded.urgentVisible,
        expanded.text.slice(0, 120),
      );
      if (collapsed) {
        verdict(
          `${name}: and it is STILL visible with the clocks hidden`,
          collapsed.urgentVisible,
          collapsed.text.slice(0, 160),
        );
        verdict(
          `${name}: ELD authority travels with the hidden-state warning`,
          collapsed.eldVisible,
        );
      }
    }
    if (collapsed) {
      verdict(
        `${name}: collapsing the clocks gave space back to the map`,
        collapsed.mapPct > expanded.mapPct,
        `${expanded.mapPct}% → ${collapsed.mapPct}%`,
      );
      verdict(
        `${name}: the clocks control stays glove-sized while collapsed`,
        collapsed.targets.clocks !== undefined && collapsed.targets.clocks.short >= 48,
        JSON.stringify(collapsed.targets.clocks ?? null),
      );
      verdict(
        `${name}: still no overflow while collapsed`,
        !collapsed.hscroll &&
          (collapsed.surfaceOverflow === null || collapsed.surfaceOverflow <= 1),
        `h=${collapsed.hscroll} surface=${collapsed.surfaceOverflow}px`,
      );
      verdict(
        `${name}: the truck marker is clear once the clocks are hidden`,
        collapsed.truck === null || collapsed.truck.clear,
        collapsed.truck?.coveredBy ?? '',
      );
      verdict(
        `${name}: with clearance recomputed for the shorter band`,
        collapsed.truck === null ||
          collapsed.truck.clearancePx === null ||
          collapsed.truck.clearancePx > 0,
        `${collapsed.truck?.clearancePx}px`,
      );
      /* What this milestone DOES promise: hiding never makes it worse. */
      verdict(
        `${name}: hiding the clocks never worsens truck clearance`,
        expanded.truck === null ||
          collapsed.truck === null ||
          collapsed.truck.clear ||
          !expanded.truck.clear,
        `${expanded.truck?.coveredBy ?? 'clear'} → ${collapsed.truck?.coveredBy ?? 'clear'}`,
      );
    }
    return row;
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const vp of VIEWPORTS) {
      await runViewport(browser, vp, {
        clocks: MID_SHIFT_CLOCKS,
        longNames: false,
        key: 'normal',
      }).catch((err) =>
        verdict(`${vp.w}x${vp.h} normal completed`, false, String(err).slice(0, 200)),
      );
    }
    // The two shapes that break layouts, on the reference phone only —
    // a long exit name and a driver out of hours.
    const ref = { w: 390, h: 844 };
    await runViewport(browser, ref, {
      clocks: MID_SHIFT_CLOCKS,
      longNames: true,
      key: 'long-name',
    }).catch((err) => verdict('390x844 long-name completed', false, String(err).slice(0, 200)));
    await runViewport(browser, ref, {
      clocks: URGENT_CLOCKS,
      longNames: false,
      key: 'urgent',
    }).catch((err) => verdict('390x844 urgent completed', false, String(err).slice(0, 200)));
  } finally {
    await browser.close();
  }

  console.log('\n--- summary -------------------------------------------------');
  for (const [k, r] of Object.entries(report.viewports)) {
    console.log(
      `${k.padEnd(28)} maneuver=${String(r.maneuverH).padStart(4)}px  ` +
        `hos=${String(r.hosExpandedH).padStart(4)}${r.hosCollapsedH === null ? '' : `→${r.hosCollapsedH}`}px  ` +
        `map=${String(r.mapPctExpanded).padStart(5)}%${r.mapPctCollapsed === null ? '' : `→${r.mapPctCollapsed}%`}`,
    );
  }
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`\nmeasurements written to ${JSON_OUT}`);
  }
  if (noteLog.length > 0) {
    console.log(`\n${notes} KNOWN, PRE-EXISTING condition(s) measured and NOT counted as passes:`);
    for (const n of noteLog) console.log(`  · ${n}`);
  }
  console.log(
    failures === 0
      ? `\nPASS: declutter bench — ${checks} checks, ${notes} known-open notes`
      : `\nFAIL: ${failures} of ${checks} checks failed (plus ${notes} known-open notes)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

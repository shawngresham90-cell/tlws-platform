/**
 * The full-map bench: how much of the driving viewport does the MAP own
 * while guidance is live — and is everything the driver needs still
 * readable, reachable, and un-clipped above it?
 *
 * Pilot round 3, item "full-screen navigation map". The acceptance
 * standard is a real navigation app's feel: during live guidance the map
 * owns the screen, guidance stays readable as overlays, controls stay
 * safe. This drives a REAL production build to active navigation with
 * the round-3 one-tap startup, then MEASURES at every required width in
 * portrait and landscape:
 *
 *   1. map coverage: the renderer container's viewport-clipped area as a
 *      percentage of the viewport (the before/after headline number);
 *   2. no horizontal overflow;
 *   3. the essential controls (Stop, voice, Overview) and the maneuver
 *      distance are visible, inside the viewport, and glove-sized
 *      (≥44 px on their short axis — the app's own floor is 64 px);
 *   4. the truck's viewport position is NOT covered by an overlay — the
 *      element under the vehicle marker's center resolves to the map;
 *   5. the always-on status line is present (honesty pin);
 *   6. the maneuver distance keeps counting down (guidance is live, not
 *      a still image).
 *
 * Final pilot milestone additions, measured at every width BEFORE the
 * trip starts (the flow now drives the REAL parked map-top search, not
 * the developer coordinate boxes):
 *   7. the parked search sits at the top of the map, does not autofocus,
 *      and never causes horizontal overflow;
 *   8. typed results render inside the viewport, stay reachable with the
 *      phone keyboard up (visual viewport shrunk ~45%), and selecting
 *      one updates the chosen destination beside Start;
 *   9. the truck-profile chip is GONE from the live map — the profile is
 *      verified once, parked, on the panel.
 *
 * With --expect full it FAILS unless coverage is ≥ the edge-to-edge
 * floor (95% portrait and landscape); with --expect baseline it only
 * records the numbers, PASSing so the "before" is capturable evidence.
 *
 * Exit 0 when every selected case passes; exit 1 otherwise.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, not a CI gate, exactly like the other
 * scripts under scripts/bench. Install it ad hoc first:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3210 &
 *   node scripts/bench/navigator-fullmap.mjs --password <pw> \
 *     [--expect full|baseline] [--only 390x844] [--port 3210] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
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
const EXPECT = arg('expect', 'full');
const ONLY = (arg('only', '') ?? '').split(',').filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;

/** Every required width in portrait, plus landscape phone cases. */
const CASES = [
  { w: 320, h: 568 },
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
  // Landscape phones: the hard case the road test flagged.
  { w: 844, h: 390 },
  { w: 932, h: 430 },
];

/** Edge-to-edge floor for --expect full: measured, not aspirational. */
const FULL_COVERAGE_PCT = 95;

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
      routeId: 'fullmap-bench',
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

let failures = 0;
function verdict(name, cond, detail = '') {
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures += 1;
}

/** Synthetic search results — no provider spend, deterministic titles.
 *  Six places so small screens genuinely have a list to reach into. */
function syntheticPlaces() {
  const dest = { lat: ORIGIN.lat + 6 / MI_PER_DEG_LAT, lng: ORIGIN.lng };
  const places = [
    {
      id: 'bench:gate',
      title: 'TLWS Receiving Gate',
      address: '100 Depot Rd, Ringgold, GA 30736',
      position: dest,
      facility: 'warehouse',
      distanceMi: null,
    },
  ];
  for (let i = 2; i <= 6; i++) {
    places.push({
      id: `bench:filler-${i}`,
      title: `Bench Distribution Center ${i}`,
      address: `${i}00 Industrial Blvd, Ringgold, GA 30736`,
      position: { lat: dest.lat + i * 0.01, lng: dest.lng },
      facility: 'distribution-center',
      distanceMi: null,
    });
  }
  return { ok: true, places };
}

// The pilot cookie from the FIRST login, reused afterwards — the access
// endpoint throttles repeated password submissions per IP.
let savedStorageState = null;

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
   * collapses to a compact summary with 'Edit truck', so a case that
   * inherits a saved storage state arrives with nothing left to confirm.
   */
  if ((await page.getByRole('button', { name: 'Edit truck' }).count()) > 0) return;
  const btn = page.getByRole('button', { name: /This is my truck|Truck confirmed/ });
  if ((await btn.count()) === 0) return;
  await btn.scrollIntoViewIfNeeded();
  if (!(await btn.isDisabled())) await btn.click();
  await page.waitForTimeout(200);
}

/*
 * A driver five hours into a shift, seeded straight into the store.
 *
 * This bench is about the DRIVING SCREEN'S LAYOUT — how much map the
 * driver gets, whether the controls are glove-sized, where the compact
 * HOS strip sits. It used to get clocks for free, because the strip
 * seeded itself with a fresh eleven hours for everybody. The pre-trip
 * setup milestone removed that: with nothing entered the strip correctly
 * shows 'Clocks not set' and has no numbers to lay out.
 *
 * So the clocks are supplied rather than assumed. Seeding the record is
 * deliberate over driving the editor UI — this file measures geometry,
 * and it should not fail because a button in someone else's panel moved.
 * The unset presentation has its own coverage in
 * `test-navigator-warning-rail` and `scripts/bench/navigator-pretrip-setup.mjs`.
 */
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

async function seedClocks(context) {
  await context.addInitScript((record) => {
    try {
      window.localStorage.setItem('tlws-navigator-clocks-v1', JSON.stringify(record));
    } catch {
      /* a bench that cannot seed still runs; the HOS checks will say so */
    }
  }, MID_SHIFT_CLOCKS);
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

/** Everything measured about the live driving surface, in one evaluate. */
async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = {
      vw,
      vh,
      hscroll: doc.scrollWidth > doc.clientWidth + 1,
      coveragePct: 0,
      mapRect: null,
      truckClear: null,
      truckCoveredBy: null,
      truckPoint: null,
      controls: [],
      distanceText: null,
      hos: null,
      truck: null,
      searchInput: document.querySelector('input[type="search"]') !== null,
      statusPresent: /\bNavigating\b|Position approximate/.test(document.body.innerText),
    };
    // MapLibre replaced Leaflet as the Navigator's renderer: the element
    // that fills the box is `.maplibregl-map`, and the picture inside it
    // is one WebGL canvas rather than a grid of tile images.
    const mapEl = document.querySelector('.maplibregl-map');
    if (mapEl) {
      const r = mapEl.getBoundingClientRect();
      const left = Math.max(r.left, 0);
      const top = Math.max(r.top, 0);
      const right = Math.min(r.right, vw);
      const bottom = Math.min(r.bottom, vh);
      const visible = Math.max(0, right - left) * Math.max(0, bottom - top);
      out.coveragePct = Number(((100 * visible) / (vw * vh)).toFixed(1));
      out.mapRect = {
        left: Math.round(r.left),
        top: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }
    // The truck marker. Its center must resolve to something inside the
    // map — an overlay sitting on the truck fails.
    const marker = document.querySelector('[aria-label="Your truck"]');
    if (marker && mapEl) {
      const mr = marker.getBoundingClientRect();
      const cx = mr.left + mr.width / 2;
      const cy = mr.top + mr.height / 2;
      if (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh) {
        const hit = document.elementFromPoint(cx, cy);
        out.truckClear = hit !== null && mapEl.contains(hit);
        // Name what is on top when it fails — a bare boolean sends the
        // reader hunting through a screenshot.
        out.truckCoveredBy =
          out.truckClear || hit === null
            ? null
            : `${hit.tagName.toLowerCase()}${hit.getAttribute('aria-label') ? `[${hit.getAttribute('aria-label')}]` : ''}.${String(hit.className ?? '').slice(0, 60)}`;
        out.truckPoint = { x: Math.round(cx), y: Math.round(cy), vh };
      }
    }
    // Essential controls: visible, inside the viewport, glove-sized.
    // Matched against aria-label AND visible text (the Overview button's
    // accessible name describes the action, not the word on it). Recenter
    // is deliberately NOT required: it exists only when the camera is
    // detached (road-tested follow behavior) — the zoom pair is the map
    // control that is always present.
    const wanted = [/^Stop/, /Voice|Mute/, /overview/i, /Zoom in/, /Zoom out/];
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const label = `${btn.getAttribute('aria-label') ?? ''} ${btn.textContent ?? ''}`.trim();
      if (!wanted.some((w) => w.test(label))) continue;
      const r = btn.getBoundingClientRect();
      out.controls.push({
        label: label.slice(0, 40),
        inViewport: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
        shortAxisPx: Math.round(Math.min(r.width, r.height)),
        visible: r.width > 0 && r.height > 0,
      });
    }
    const card = document.querySelector('[aria-label="Next maneuver"]');
    const dist = card ? /In ([\d.,]+ (?:mi|ft))/.exec(card.textContent ?? '') : null;
    out.distanceText = dist ? dist[1] : null;

    // ---- compact HOS strip (pilot round 3) --------------------------------
    const hos = document.querySelector('[aria-label^="Hours of service — compact"]');
    if (hos) {
      const r = hos.getBoundingClientRect();
      const text = hos.textContent ?? '';
      out.hos = {
        heightPx: Math.round(r.height),
        inViewport: r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1,
        labels: ['DRIVE', 'WINDOW', 'CYCLE', 'BREAK'].filter((l) => text.includes(l)),
        // Clock values, e.g. "11:00" — four of them when all are known.
        values: (text.match(/\d+:[0-5]\d/g) ?? []).slice(0, 4),
        limitingMarked: hos.querySelector('[title="Limiting clock"]') !== null,
        disclaimer: /not an ELD/i.test(text),
        tappable: hos.tagName === 'BUTTON',
        shortAxisPx: Math.round(Math.min(r.width, r.height)),
      };
    }
    // ---- compact truck summary -------------------------------------------
    const chip = document.querySelector('[aria-label="Truck profile used for this route"]');
    if (chip) {
      const r = chip.getBoundingClientRect();
      const text = chip.textContent ?? '';
      out.truck = {
        inViewport: r.top >= -1 && r.bottom <= vh + 1,
        heightPx: Math.round(r.height),
        text: text.replace(/\s+/g, ' ').trim().slice(0, 90),
        hasHeight: /13′6″|13'6/.test(text),
        hasWeight: /80,000/.test(text),
        hasAxles: /axles/.test(text),
        hasHazmat: /hazmat/i.test(text),
        hasTrailers: /trailers/i.test(text),
      };
    }
    return out;
  });
}

/**
 * The parked map-top search, proven in the real browser at this exact
 * viewport (final pilot milestone): placement over the map, no
 * autofocus, results reachable — including with the phone keyboard up
 * (emulated by shrinking the visual viewport ~45%) — and the pick
 * landing on the Start surface. Ends with the destination CHOSEN.
 */
async function parkedSearchProof(page, w, h) {
  const input = page.getByLabel(
    'Search for a destination by address, business, truck stop, or city',
  );
  await input.waitFor({ timeout: 20_000 });
  const overlay = await page.evaluate(() => {
    const inp = document.querySelector('input[type="search"]');
    const mapEl = document.querySelector('.maplibregl-map');
    if (!inp) return null;
    const r = inp.getBoundingClientRect();
    const m = mapEl ? mapEl.getBoundingClientRect() : null;
    return {
      rect: { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width) },
      overMap: m !== null && r.top >= m.top - 1 && r.top <= m.top + m.height / 2,
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      focused: document.activeElement === inp,
    };
  });
  verdict('parked: search input present', overlay !== null);
  if (overlay) {
    verdict(
      'parked: search sits at the top of the map',
      overlay.overMap,
      JSON.stringify(overlay.rect),
    );
    verdict(
      'parked: no autofocus — the keyboard stays down until the driver taps',
      !overlay.focused,
    );
    verdict('parked: no horizontal overflow with the search mounted', !overlay.hscroll);
  }
  await input.click();
  await input.fill('receiving gate ringgold');
  const firstCard = page.getByRole('button').filter({ hasText: 'TLWS Receiving Gate' }).first();
  await firstCard.waitFor({ timeout: 10_000 });
  const res = await page.evaluate(() => {
    const list = document.querySelector('[aria-label="Destination search results"]');
    const doc = document.documentElement;
    if (!list) return null;
    const cards = Array.from(list.querySelectorAll('button')).map((b) => b.getBoundingClientRect());
    return {
      count: cards.length,
      hscroll: doc.scrollWidth > doc.clientWidth + 1,
      withinX: cards.every((r) => r.left >= -1 && r.right <= window.innerWidth + 1),
      noFakeDistance: !(list.textContent ?? '').includes('mi away'),
    };
  });
  verdict(
    'parked: results render',
    res !== null && res.count >= 1,
    res ? `${res.count} cards` : 'no list',
  );
  if (res) {
    verdict(
      'parked: result cards fit horizontally (no clipping/overflow)',
      res.withinX && !res.hscroll,
    );
    verdict('parked: no distance line when the wire carried none', res.noFakeDistance);
  }
  // The phone keyboard eats roughly the bottom half of the visual
  // viewport. The pick must stay REACHABLE in what remains: Playwright's
  // click auto-scrolls, so a covered or clipped card fails here.
  await page.setViewportSize({ width: w, height: Math.max(220, Math.round(h * 0.55)) });
  await page.waitForTimeout(400);
  const kb = await page.evaluate(() => ({
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  verdict('parked: keyboard-open — no horizontal overflow', !kb.hscroll);
  let picked = true;
  try {
    await firstCard.click({ timeout: 8000 });
  } catch {
    picked = false;
  }
  verdict('parked: keyboard-open — the result is reachable and takes the tap', picked);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  if (picked) {
    const confirmed = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    verdict(
      'parked: selecting updated the chosen destination beside Start',
      /Destination:\s*TLWS Receiving Gate/.test(confirmed),
    );
  }
}

async function driveToNavigating(context, page, { w, h }) {
  let cursorLat = ORIGIN.lat;
  async function feed(seconds, metersPerSecond) {
    const M_PER_DEG_LAT = 111320;
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

  await login(page);
  await feed(2, 0.3); // auto-resumed watch publishes parked fixes
  // The REAL driver flow (final milestone): search on the map, pick,
  // one Start tap. The developer coordinate boxes are no longer the path
  // this bench exercises.
  await parkedSearchProof(page, w, h);
  await confirmTruck(page);
  await page.getByRole('button', { name: START_BUTTON }).click();
  await feed(3, 0.3);
  await feed(6, 12);
  return { feed };
}

async function runCase(browser, { w, h }) {
  const name = `${w}x${h}${w > h ? ' landscape' : ''}`;
  console.log(`\n=== ${name} ===`);
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: w, height: h },
    isMobile: w < 700 || h < 700,
    hasTouch: w < 700 || h < 700,
    deviceScaleFactor: 2,
    storageState: savedStorageState ?? undefined,
  });
  await seedClocks(context);
  await context.route('**/api/navigator/route', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute()),
    }),
  );
  // The search endpoint too: deterministic results, zero provider spend.
  await context.route('**/api/navigator/destination-search*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticPlaces()),
    }),
  );
  const page = await context.newPage();
  try {
    const { feed } = await driveToNavigating(context, page, { w, h });
    // Let the camera SETTLE before measuring. The heading-up camera eases
    // over ~450 ms per fix, and sampling mid-ease reads a picture that is
    // still moving — which showed up as an obstruction check that passed
    // or failed depending on the frame it happened to catch.
    await page.waitForTimeout(1200);

    const m1 = await measure(page);
    await feed(5, 12);
    await page.waitForTimeout(1200);
    const m2 = await measure(page);

    console.log(
      `  map ${m2.mapRect ? `${m2.mapRect.w}x${m2.mapRect.h} @ (${m2.mapRect.left},${m2.mapRect.top})` : 'ABSENT'}` +
        ` — coverage ${m2.coveragePct}% of ${m2.vw}x${m2.vh}`,
    );
    if (EXPECT === 'full') {
      verdict(
        `map owns the viewport (≥${FULL_COVERAGE_PCT}%)`,
        m2.coveragePct >= FULL_COVERAGE_PCT,
        `${m2.coveragePct}%`,
      );
    } else {
      verdict('baseline coverage recorded', m2.mapRect !== null, `${m2.coveragePct}%`);
    }
    verdict('no horizontal overflow', !m2.hscroll);
    verdict('always-on status line present', m2.statusPresent);
    verdict('maneuver distance visible', m2.distanceText !== null, m2.distanceText ?? 'missing');
    verdict(
      'guidance is live (distance advanced between measures)',
      m1.distanceText !== null && m2.distanceText !== null && m1.distanceText !== m2.distanceText,
      `${m1.distanceText} → ${m2.distanceText}`,
    );
    const missing = ['Stop', 'Voice|Mute', '[Oo]verview', 'Zoom in', 'Zoom out'].filter(
      (want) => !m2.controls.some((c) => new RegExp(want).test(c.label) && c.visible),
    );
    verdict('essential controls all present', missing.length === 0, missing.join(','));
    const bad = m2.controls.filter((c) => c.visible && (!c.inViewport || c.shortAxisPx < 44));
    verdict(
      'controls inside the viewport and glove-sized (≥44px)',
      bad.length === 0,
      JSON.stringify(bad),
    );
    // ---- compact HOS strip ------------------------------------------------
    const hos = m2.hos;
    verdict('HOS: the compact strip is visible during guidance', hos !== null);
    if (hos) {
      console.log(
        `  hos strip ${hos.heightPx}px — ${hos.labels.join('/')} ${JSON.stringify(hos.values)}`,
      );
      verdict('HOS: all four clocks are labelled', hos.labels.length === 4, hos.labels.join(','));
      verdict(
        'HOS: four clock values are shown',
        hos.values.length === 4,
        JSON.stringify(hos.values),
      );
      verdict('HOS: the limiting clock is marked', hos.limitingMarked);
      verdict('HOS: the planning-aid/not-an-ELD line rides with it', hos.disclaimer);
      verdict('HOS: inside the viewport, nothing clipped', hos.inViewport);
      verdict('HOS: glove-sized tap target (≥44px)', hos.shortAxisPx >= 44, `${hos.shortAxisPx}px`);
      // The whole point: compact. It must stay a strip, not a card.
      verdict('HOS: stays compact (≤96px tall)', hos.heightPx <= 96, `${hos.heightPx}px`);
    }
    // ---- truck profile: must NOT ride the live map (final milestone) ------
    // The docked chip repeated numbers the driver verified parked; its
    // pixels belong to the map now. Presence here is a regression.
    verdict(
      'truck: no profile chip over the live map',
      m2.truck === null,
      m2.truck ? m2.truck.text : '',
    );
    // The search is a PARKED control: while guidance is live no text
    // field exists, so no keyboard can open over the map and no result
    // list can cover the live controls.
    verdict('search: no text field during live guidance', m2.searchInput === false);

    if (m2.truckClear !== null) {
      verdict(
        'truck position not covered by an overlay',
        m2.truckClear === true,
        m2.truckClear === true
          ? ''
          : `covered by ${m2.truckCoveredBy ?? 'unknown'} at ${JSON.stringify(m2.truckPoint)}`,
      );
    } else {
      console.log('  (truck marker off-viewport this frame — obstruction check skipped)');
    }

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/fullmap-${EXPECT}-${w}x${h}.png` });

    // Stop must still work — the safety-critical exit, on every layout.
    // A click that cannot land (covered control, off-viewport) is a
    // FINDING, not a crash: record it and keep measuring the other cases.
    try {
      await page.getByRole('button', { name: /^Stop/ }).click({ timeout: 8000 });
      await page.waitForTimeout(600);
      verdict(
        'Stop navigation works',
        !/\bNavigating\b/.test(await page.locator('body').innerText()),
      );
    } catch {
      verdict('Stop navigation works', false, 'the Stop control could not be tapped');
    }
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const cases = CASES.filter((c) => ONLY.length === 0 || ONLY.includes(`${c.w}x${c.h}`));
    for (const c of cases) {
      try {
        await runCase(browser, c);
      } catch (err) {
        verdict(`case ${c.w}x${c.h} completed`, false, String(err).slice(0, 200));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(failures === 0 ? '\nPASS: full-map bench' : `\nFAIL: ${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

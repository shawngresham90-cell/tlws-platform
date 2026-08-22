/**
 * NAV-ENTRY-2 in a real browser: after START DRIVING, can the driver
 * actually enter a destination without scrolling?
 *
 * WHY A BENCH. The deterministic harness can prove the search renders
 * before the map in the tree and that the visibility RULE rejects the
 * numbers the shipped build produced. It cannot produce those numbers.
 * "The destination input's visible height is 0 px" is a fact about a
 * painted page — an ancestor's overflow box clipping a descendant — and no
 * amount of reading the source finds it. That defect shipped precisely
 * because everything about it looked right in the source.
 *
 * WHAT IT MEASURES, at each of the six required viewports, on the parked
 * `/drive/navigate` a driver reaches by tapping START DRIVING:
 *
 *   1. the destination input's top and bottom, in viewport coordinates,
 *      with no scrolling of any kind;
 *   2. how much of it is actually PAINTED — every ancestor's clip box
 *      intersected with the viewport — which is the measurement that
 *      catches the shipped defect and the one a naive top < height check
 *      misses at three of the six viewports;
 *   3. whether anything is on top of it, by hit-testing its centre;
 *   4. its touch-target height against the 44 px floor;
 *   5. the map's visible area as a share of the viewport;
 *   6. horizontal overflow of the document;
 *   7. route requests and search requests counted separately, at every
 *      stage of the journey — load, focus, type, pick, Settings, Start;
 *   8. that a moving truck still gets the field (NAV-ENTRY-1's decision);
 *   9. that no Passenger Access control exists anywhere on the surface;
 *  10. the layout at 200% text zoom.
 *
 * WHAT IT REFUSES TO DO. It never asserts "better than before" against a
 * number typed into this file. The measured before-values are printed
 * beside the new ones and the delta computed, so a regression is visible
 * rather than hidden behind a threshold someone relaxed.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3424 &
 *   node scripts/bench/navigator-destination-first.mjs --password <pw> \
 *     [--port 3424] [--only 390x844] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3424');
const PASSWORD = arg('password', 'local-smoke-only');
const SHOTS = arg('shots');
const ONLY = (arg('only', '') ?? '').split(',').filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

/*
 * These four constants are a COPY of `src/lib/navigator/destination-first.ts`
 * — this is a plain .mjs script run by hand and cannot import a TypeScript
 * module. The copy is not trusted: NED60 in the deterministic harness reads
 * this file and fails if any of it drifts from the authority, which is the
 * only thing standing between "the bench passed" and "the bench measured
 * what the contract actually asks for".
 */
const REQUIRED_VIEWPORTS = [
  { name: '360x740', width: 360, height: 740, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '430x932', width: 430, height: 932, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '932x430', width: 932, height: 430, mobile: true },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
];
const MIN_DESTINATION_TARGET_PX = 44;
const NAVIGATOR_TOUCH_FLOOR_PX = 64;
const DOMINANCE_FRACTION = 0.5;

/**
 * The measured before-state: production build of main at b247256, same
 * settings, same journey. Reference values printed for the delta — never
 * assertions, so a regression shows as a number rather than as silence.
 */
const BEFORE = {
  '360x740': { top: 813, bottom: 877, visibleHeight: 0 },
  '390x844': { top: 753, bottom: 817, visibleHeight: 0 },
  '430x932': { top: 731, bottom: 795, visibleHeight: 0 },
  '844x390': { top: 649, bottom: 713, visibleHeight: 0 },
  '932x430': { top: 649, bottom: 713, visibleHeight: 0 },
  '1280x800': { top: 649, bottom: 713, visibleHeight: 0 },
};

const ORIGIN = { lat: 34.7698, lng: -84.9702 };
const DEST = { lat: 34.85, lng: -84.95 };

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}

/**
 * A route response the app will actually accept. Route plausibility and
 * maneuver-offset validation are real and will refuse a lazy fixture, so
 * the geometry is interpolated origin -> destination and the arrive
 * maneuver points at the last point of the line it belongs to.
 */
function syntheticRoute() {
  const geometry = [];
  const steps = 200;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    geometry.push([
      ORIGIN.lat + (DEST.lat - ORIGIN.lat) * t,
      ORIGIN.lng + (DEST.lng - ORIGIN.lng) * t,
    ]);
  }
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: 'destination-first-bench',
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

async function newContext(browser, viewport, { geo = ORIGIN } = {}) {
  const context = await browser.newContext({
    permissions: geo === null ? [] : ['geolocation'],
    ...(geo === null
      ? {}
      : { geolocation: { latitude: geo.lat, longitude: geo.lng, accuracy: 8 } }),
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });
  /*
   * Route and search are counted SEPARATELY and never conflated. The whole
   * route-spend contract turns on the difference: a search is cheap and
   * expected while typing, a route is the thing exactly one deliberate
   * Start tap is allowed to buy.
   */
  const counts = { route: 0, search: 0 };
  await context.route('**/api/navigator/route', (r) => {
    counts.route += 1;
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
            address: '100 Depot Rd, Dalton, GA',
            position: DEST,
            facility: 'warehouse',
            distanceMi: 6,
          },
        ],
      }),
    });
  });
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());
  const page = await context.newPage();
  return { context, page, counts };
}

async function login(page) {
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
}

/**
 * The measurement. Intersects the destination input's box with every
 * clipping ancestor and the viewport, hit-tests its centre, and reports
 * the map's visible share — all in one evaluate so nothing can shift
 * between two reads.
 */
const MEASURE = () => {
  const out = {
    viewport: { w: innerWidth, h: innerHeight },
    scrollHeight: document.scrollingElement.scrollHeight,
    scrollY: window.scrollY,
    overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  };
  const input = document.querySelector('input[type="search"]');
  if (!input) return { ...out, input: null, map: null };
  const r = input.getBoundingClientRect();
  let clip = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
  for (let el = input.parentElement; el; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') {
      continue;
    }
    const b = el.getBoundingClientRect();
    clip = {
      top: Math.max(clip.top, b.top),
      left: Math.max(clip.left, b.left),
      right: Math.min(clip.right, b.right),
      bottom: Math.min(clip.bottom, b.bottom),
    };
  }
  const visH = Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top));
  const visW = Math.max(0, Math.min(r.right, clip.right) - Math.max(r.left, clip.left));
  /*
   * The site's fixed mobile tool bar owns the bottom band under the `sm`
   * breakpoint. A control painted underneath it is not a control a driver
   * can tap, so its top edge is the real fold on those viewports.
   */
  let obstructionTop = innerHeight;
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect();
    if (b.height <= 0 || b.bottom < innerHeight - 2 || b.top <= 0) continue;
    obstructionTop = Math.min(obstructionTop, b.top);
  }
  const hit = document.elementFromPoint(
    Math.round(r.left + r.width / 2),
    Math.round(r.top + r.height / 2),
  );
  out.input = {
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    height: Math.round(r.height),
    visibleHeight: Math.round(visH),
    visibleWidth: Math.round(visW),
    viewportHeight: innerHeight,
    obstructionTop: Math.round(obstructionTop),
    coveredBy: hit === input || input.contains(hit) ? null : (hit?.tagName.toLowerCase() ?? 'none'),
    accessibleName: input.getAttribute('aria-label') ?? '',
    autofocused: document.activeElement === input,
  };
  const map = document.querySelector('.nav-map');
  if (map) {
    const m = map.getBoundingClientRect();
    const vh = Math.max(0, Math.min(m.bottom, innerHeight) - Math.max(m.top, 0));
    const vw = Math.max(0, Math.min(m.right, innerWidth) - Math.max(m.left, 0));
    out.map = {
      height: Math.round(m.height),
      visibleArea: Math.round(vh * vw),
      pctOfViewport: +(((vh * vw) / (innerWidth * innerHeight)) * 100).toFixed(1),
    };
  } else {
    out.map = null;
  }
  return out;
};

/** The shipped rule, applied to a measurement (mirrors destination-first.ts). */
function usable(m) {
  const reasons = [];
  if (m.height < MIN_DESTINATION_TARGET_PX) reasons.push(`target ${m.height}px under floor`);
  if (m.top < 0) reasons.push(`top ${m.top}px above viewport`);
  if (m.bottom > m.viewportHeight) reasons.push(`bottom ${m.bottom}px below fold`);
  if (m.visibleHeight < m.height - 1) reasons.push(`only ${m.visibleHeight}px painted — clipped`);
  if (m.bottom > m.obstructionTop + 1) reasons.push(`covered from ${m.obstructionTop}px`);
  return { ok: reasons.length === 0, reasons };
}

async function startDriving(page) {
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-launcher-action="start-driving"]').click();
  await page.waitForURL(/\/drive\/navigate/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
}

/* ============================ per-viewport journey ====================== */

async function runViewport(browser, vp) {
  console.log(`\n── ${vp.name} ─────────────────────────────────────────────`);
  const { context, page, counts } = await newContext(browser, vp);
  await login(page);
  const afterLauncher = counts.route;
  check(`${vp.name} D1: opening /drive spends no route request`, afterLauncher === 0, counts);

  await startDriving(page);
  check(
    `${vp.name} D2: START DRIVING opens /drive/navigate and spends no route request`,
    page.url().includes('/drive/navigate') && counts.route === 0,
    { url: page.url(), ...counts },
  );
  check(
    `${vp.name} D3: opening the parked map issues no destination-search request either`,
    counts.search === 0,
    counts,
  );

  const m = await page.evaluate(MEASURE);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.name}-parked.png` });

  const before = BEFORE[vp.name];
  const delta = before ? m.input.top - before.top : null;
  console.log(
    `     destination input: top ${m.input.top}px  bottom ${m.input.bottom}px  ` +
      `height ${m.input.height}px  painted ${m.input.visibleHeight}px` +
      (before
        ? `   (before: top ${before.top}px, painted ${before.visibleHeight}px, delta ${delta > 0 ? '+' : ''}${delta}px)`
        : ''),
  );
  console.log(
    `     map: ${m.map ? `${m.map.height}px tall, ${m.map.pctOfViewport}% of viewport visible` : 'not mounted'}` +
      `   page height ${m.scrollHeight}px`,
  );

  const verdict = usable(m.input);
  check(
    `${vp.name} D4: the destination entry is fully visible without scrolling`,
    verdict.ok,
    verdict.reasons,
  );
  check(
    `${vp.name} D5: nothing is painted on top of the destination input`,
    m.input.coveredBy === null,
    m.input.coveredBy,
  );
  check(
    `${vp.name} D6: the touch target clears the ${MIN_DESTINATION_TARGET_PX}px floor`,
    m.input.height >= MIN_DESTINATION_TARGET_PX,
    m.input.height,
  );
  check(
    `${vp.name} D7: …and keeps the Navigator's preferred ${NAVIGATOR_TOUCH_FLOOR_PX}px target`,
    m.input.height >= NAVIGATOR_TOUCH_FLOOR_PX,
    m.input.height,
  );
  check(
    `${vp.name} D8: the destination entry is DOMINANT — in the top half of the screen`,
    m.input.top <= m.viewport.h * DOMINANCE_FRACTION,
    { top: m.input.top, half: Math.round(m.viewport.h * DOMINANCE_FRACTION) },
  );
  check(`${vp.name} D9: no horizontal overflow`, m.overflowX === 0, m.overflowX);
  check(
    `${vp.name} D10: the page opens unscrolled — the driver is not put mid-page`,
    m.scrollY === 0,
    m.scrollY,
  );
  check(
    `${vp.name} D11: the map is mounted and visibly substantial`,
    m.map !== null && m.map.height >= 140,
    m.map,
  );
  check(
    `${vp.name} D12: the input has a real accessible name`,
    /destination/i.test(m.input.accessibleName),
    m.input.accessibleName,
  );
  check(
    `${vp.name} D13: the input does not autofocus — no keyboard opens on arrival`,
    m.input.autofocused === false,
  );

  /* ---- route-spend: focus, then type, then pick ---- */
  const search = page.locator('input[type="search"]').first();
  await search.focus();
  await page.waitForTimeout(600);
  check(
    `${vp.name} D14: focusing the destination field spends no route request`,
    counts.route === 0,
    counts,
  );
  check(`${vp.name} D15: focusing spends no search request either`, counts.search === 0, counts);

  await search.fill('bench gate');
  await page.waitForTimeout(1200);
  const searchesAfterTyping = counts.search;
  check(
    `${vp.name} D16: typing spends search requests but never a route request`,
    counts.route === 0 && searchesAfterTyping >= 1,
    { ...counts },
  );

  let picked = false;
  try {
    await page
      .locator('ul[aria-label="Destination search results"] button')
      .first()
      .waitFor({ timeout: 10_000 });
    await page.locator('ul[aria-label="Destination search results"] button').first().click();
    picked = true;
  } catch {
    picked = false;
  }
  check(`${vp.name} D17: a result could be selected`, picked);
  await page.waitForTimeout(500);
  check(
    `${vp.name} D18: SELECTING a destination spends no route request`,
    counts.route === 0,
    counts,
  );

  const afterPick = await page.evaluate(MEASURE);
  check(
    `${vp.name} D19: choosing a destination does not push the field off screen`,
    afterPick.input !== null && usable(afterPick.input).ok,
    afterPick.input ? usable(afterPick.input).reasons : 'input gone',
  );
  check(
    `${vp.name} D20: no horizontal overflow after results rendered`,
    afterPick.overflowX === 0,
    afterPick.overflowX,
  );

  /* ---- Settings and back: no accidental purchase ---- */
  const settings = page.locator('[data-open-settings]').first();
  if ((await settings.count()) > 0) {
    await settings.click();
    await page.waitForURL(/\/drive\/settings/, { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(800);
    check(`${vp.name} D21: opening Settings spends no route request`, counts.route === 0, counts);
    await page.goBack();
    await page.waitForTimeout(1500);
    check(
      `${vp.name} D22: returning from Settings spends no route request`,
      counts.route === 0,
      counts,
    );
  } else {
    check(`${vp.name} D21: the Settings link is present on the parked map`, false);
  }

  await context.close();
  return { name: vp.name, measured: m, counts: { ...counts } };
}

/* ============================ one-off journeys ========================= */

/** One deliberate Start on a valid destination buys exactly one route. */
async function startSpendsExactlyOne(browser) {
  console.log(`\n── route-spend: one deliberate Start ──────────────────────`);
  const vp = REQUIRED_VIEWPORTS[1];
  const { context, page, counts } = await newContext(browser, vp);
  await login(page);
  await startDriving(page);
  const search = page.locator('input[type="search"]').first();
  await search.fill('bench gate');
  await page
    .locator('ul[aria-label="Destination search results"] button')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  await page.locator('ul[aria-label="Destination search results"] button').first().click();
  await page.waitForTimeout(500);
  check('R1: before Start, zero route requests', counts.route === 0, counts);

  const start = page.getByRole('button', { name: /^Start(?: Route)?$/ }).first();
  if ((await start.count()) === 0) {
    check('R2: the Start control is present after choosing a destination', false);
    await context.close();
    return;
  }
  await start.click();
  await page.waitForTimeout(6000);
  check('R2: one deliberate Start spends exactly one route request', counts.route === 1, counts);

  /*
   * Settings DURING an active trip. The contract is that the trip survives
   * and comes back without a replacement purchase — the restore runs the
   * lifecycle's own plan() with the payload pre-armed, so the provider is
   * never asked twice for the same trip.
   */
  const spentBefore = counts.route;
  await page.goto(`${BASE}/drive/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  check(
    'R3: returning from Settings during an active trip buys no replacement route',
    counts.route === spentBefore,
    { spentBefore, now: counts.route },
  );
  const restored = await page.evaluate(() => ({
    surface: document.querySelector('[data-driving-surface]') !== null,
    band: document.querySelector('[data-bottom-band]') !== null,
  }));
  check('R4: the active trip is still on screen after the round trip', restored.surface, restored);

  /* Plan My Trip, from the launcher, must not purchase either. */
  const before = counts.route;
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  const plan = page.locator('[data-launcher-action="plan-my-trip"]').first();
  if ((await plan.count()) > 0) {
    await plan.click();
    await page.waitForTimeout(2500);
    check('R5: opening Plan My Trip buys no route', counts.route === before, {
      before,
      now: counts.route,
    });
  } else {
    check('R5: the Plan My Trip launcher action exists', false);
  }
  await context.close();
}

/** A moving truck keeps the destination field, and no passenger path exists. */
async function motionKeepsTheField(browser) {
  console.log(`\n── motion: editing is never disabled ─────────────────────`);
  const vp = REQUIRED_VIEWPORTS[1];
  const { context, page, counts } = await newContext(browser, vp);
  await login(page);
  await startDriving(page);
  /*
   * REAL SIMULATED MOTION, not a flag this bench sets.
   *
   * The app derives speed from the delta between accepted fixes when the
   * platform reports none, and Playwright's `setGeolocation` reports none.
   * So the truck is walked north at a genuine highway pace — 0.00027 deg
   * of latitude per second is about 65 mph — and it is walked for LONGER
   * THAN THE DWELL. That matters: MOVING latches only after
   * MOVING_DWELL_MS (10 s) above 5 mph, so a shorter loop leaves the lock
   * in UNKNOWN and would have this check passing without ever having
   * reached the state it claims to test. An earlier draft of this bench
   * did exactly that, and reported "Location checks begin when you start".
   */
  const STEP_DEG = 0.00027;
  let motion = null;
  for (let i = 1; i <= 16; i += 1) {
    await context.setGeolocation({
      latitude: ORIGIN.lat + i * STEP_DEG,
      longitude: ORIGIN.lng,
      accuracy: 6,
    });
    await page.waitForTimeout(1000);
    motion = await page.evaluate(
      () => document.querySelector('[data-motion-status]')?.textContent?.trim() ?? null,
    );
    if (motion === 'Moving') break;
  }
  const state = await page.evaluate(() => ({
    motion: document.querySelector('[data-motion-status]')?.textContent?.trim() ?? null,
    field: document.querySelector('input[type="search"]') !== null,
    fieldDisabled: document.querySelector('input[type="search"]')?.disabled ?? null,
    passenger: Array.from(document.querySelectorAll('button, a')).some((el) =>
      /passenger/i.test(`${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`),
    ),
    bodyMentionsPassenger: /passenger/i.test(document.body.innerText),
  }));
  console.log(`     motion status reads: ${JSON.stringify(state.motion)}`);
  /*
   * The state is ASSERTED, not merely printed. A motion regression check
   * that never reached MOVING proves nothing, so reaching it is itself the
   * first assertion — otherwise a future change could disable the field
   * while moving and this bench would still be green.
   */
  check(
    'M0: the simulated drive actually reaches the MOVING state',
    state.motion === 'Moving',
    state,
  );
  check('M1: the destination field survives established motion', state.field, state);
  check('M1b: …and is not disabled while moving', state.fieldDisabled === false, state);
  check('M2: no Passenger Access control exists on the surface', !state.passenger, state);
  check('M3: the word "passenger" appears nowhere on the page', !state.bodyMentionsPassenger);
  check('M4: motion alone spends no route request', counts.route === 0, counts);
  await context.close();
}

/** 200% text zoom: the destination entry must survive it. */
async function textZoom(browser) {
  console.log(`\n── 200% text zoom ────────────────────────────────────────`);
  const vp = REQUIRED_VIEWPORTS[1];
  const { context, page } = await newContext(browser, vp);
  await login(page);
  await startDriving(page);
  const baseline = await page.evaluate(() => ({
    overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  }));
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(1200);
  const zoomed = await page.evaluate(MEASURE);
  console.log(
    `     at 200%: input top ${zoomed.input?.top}px height ${zoomed.input?.height}px, ` +
      `overflowX ${zoomed.overflowX}px (baseline ${baseline.overflowX}px)`,
  );
  check('Z1: the destination input still exists at 200% text zoom', zoomed.input !== null);
  check(
    'Z2: it is still painted, not clipped, at 200% text zoom',
    zoomed.input !== null && zoomed.input.visibleHeight >= zoomed.input.height - 1,
    zoomed.input,
  );
  check(
    'Z3: it still clears the 44px floor at 200% text zoom',
    zoomed.input !== null && zoomed.input.height >= MIN_DESTINATION_TARGET_PX,
    zoomed.input?.height,
  );
  /*
   * NAV-ENTRY-1 recorded a PRE-EXISTING mobile-nav overflow in the shared
   * site header at 200% zoom. It is reported here as a number against the
   * baseline rather than asserted, because this milestone neither caused
   * it nor claims to have fixed it — and a bench that failed on it would
   * be blaming NAV-ENTRY-2 for someone else's defect.
   */
  console.log(
    `     NOTE: shared site-header overflow at 200% zoom is pre-existing (NAV-ENTRY-1); ` +
      `measured ${zoomed.overflowX}px here, not asserted.`,
  );
  await context.close();
}

/* ============================ main ==================================== */

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
const cases = REQUIRED_VIEWPORTS.filter((v) => ONLY.length === 0 || ONLY.includes(v.name));
const rows = [];
try {
  for (const vp of cases) rows.push(await runViewport(browser, vp));
  if (ONLY.length === 0) {
    await startSpendsExactlyOne(browser);
    await motionKeepsTheField(browser);
    await textZoom(browser);
  }
} finally {
  await browser.close();
}

console.log('\n── destination position, before and after ────────────────');
console.log('viewport    before-top  after-top   delta   before-painted  after-painted');
for (const r of rows) {
  const b = BEFORE[r.name];
  const a = r.measured.input;
  console.log(
    `${r.name.padEnd(11)} ${String(b?.top ?? '—').padStart(9)}  ${String(a.top).padStart(9)}  ` +
      `${String(a.top - (b?.top ?? a.top)).padStart(6)}  ${String(b?.visibleHeight ?? '—').padStart(14)}  ` +
      `${String(a.visibleHeight).padStart(13)}`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('failed:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail > 0 ? 1 : 0);

/**
 * NAV-ENTRY-3 in a real browser: after the driver picks a destination, is
 * the next step obvious — and does finding it cost anything?
 *
 * WHY A BENCH. The deterministic harness can prove the route-start cluster
 * is ordered between the search and the map, and that the shipped ledger
 * rejects a journey that buys a route in the wrong place. It cannot produce
 * the numbers. "The Start control's painted height is 0 px" is a fact about
 * a rendered page — the element exists, its coordinates look plausible, and
 * it is simply not on the screen — and that is exactly the state this
 * milestone found on main.
 *
 * WHAT IT MEASURES, at each of the six required viewports, on the parked
 * `/drive/navigate` a driver reaches by tapping START DRIVING:
 *
 *   1. the selected-destination confirmation and the primary CTA, before
 *      and after a real search result is chosen: viewport position, PAINTED
 *      height after intersecting every clipping ancestor, whether anything
 *      is hit-testing on top, and whether an ancestor scroller hides them;
 *   2. touch-target height against the shipped 44 px floor;
 *   3. horizontal overflow of the document;
 *   4. the map's position and visible share — it must still be substantial,
 *      and it must not be remounted to achieve any of the above;
 *   5. how many times a map renderer element is ADDED to the document,
 *      counted by a MutationObserver installed before the app runs;
 *   6. route requests and destination-search requests, counted SEPARATELY,
 *      at every step of the journey, then priced by the shipped ledger
 *      rather than by a copy of the rules kept in this file;
 *   7. the Settings and Plan My Trip round trips, including during an
 *      ACTIVE trip, where a replacement route purchase would be the
 *      expensive regression;
 *   8. that one deliberate Start buys exactly one route — not zero, not two;
 *   9. that the destination remains changeable after being chosen;
 *  10. the layout at 200% text zoom, with the shared site-header overflow
 *      baselined separately rather than blamed on this milestone.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3434 &
 *   node scripts/bench/navigator-route-start.mjs --password <pw> \
 *     [--port 3434] [--only 390x844] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3434');
const PASSWORD = arg('password', 'local-smoke-only');
const SHOTS = arg('shots');
const ONLY = (arg('only', '') ?? '').split(',').filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

/*
 * A COPY of `src/lib/navigator/route-start-contract.ts`, because this is a
 * plain .mjs script run by hand and cannot import a TypeScript module. The
 * copy is not trusted: NER60e and NER60f in the deterministic harness read
 * this file and fail if the viewport list or the ledger's vocabulary drifts
 * from the authority.
 */
const REQUIRED_VIEWPORTS = [
  { name: '360x740', width: 360, height: 740, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '430x932', width: 430, height: 932, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '932x430', width: 932, height: 430, mobile: true },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
];
const MIN_CTA_TARGET_PX = 44;
const DELIBERATE_START_ACTION = 'deliberate Start on a valid destination';
const DELIBERATE_START_ROUTE_COST = 1;
const ZERO_ROUTE_ACTIONS = [
  'open /drive',
  'tap START DRIVING',
  'open /drive/navigate',
  'focus destination field',
  'type a destination query',
  'select a destination result',
  'open Settings',
  'return from Settings',
  'open Plan My Trip',
  'return from Plan My Trip',
];

function routeSpendViolations(steps) {
  const violations = [];
  for (const s of steps) {
    if (ZERO_ROUTE_ACTIONS.includes(s.action)) {
      if (s.routeRequests !== 0) {
        violations.push(`${s.action} spent ${s.routeRequests} route request(s), must spend 0`);
      }
    } else if (s.action === DELIBERATE_START_ACTION) {
      if (s.routeRequests !== DELIBERATE_START_ROUTE_COST) {
        violations.push(
          `${s.action} spent ${s.routeRequests}, must spend exactly ${DELIBERATE_START_ROUTE_COST}`,
        );
      }
    } else {
      violations.push(`${s.action} is not a step this contract knows the price of`);
    }
  }
  const covered = new Set(steps.map((s) => s.action));
  for (const req of ZERO_ROUTE_ACTIONS) {
    if (!covered.has(req)) violations.push(`${req} was never measured`);
  }
  if (!covered.has(DELIBERATE_START_ACTION)) {
    violations.push(`${DELIBERATE_START_ACTION} was never measured`);
  }
  return { ok: violations.length === 0, violations };
}

/**
 * The measured BEFORE state: production build of main at 86b417e, same
 * journey, same settings. Reference values printed for the delta — never
 * assertions, so a regression shows as a number rather than as silence.
 */
const BEFORE = {
  '360x740': { ctaTop: 1182, ctaPainted: 0, scrollNeeded: 514 },
  '390x844': { ctaTop: 1142, ctaPainted: 0, scrollNeeded: 370 },
  '430x932': { ctaTop: 1175, ctaPainted: 0, scrollNeeded: 315 },
  '844x390': { ctaTop: 859, ctaPainted: 0, scrollNeeded: 541 },
  '932x430': { ctaTop: 872, ctaPainted: 0, scrollNeeded: 514 },
  '1280x800': { ctaTop: 1045, ctaPainted: 0, scrollNeeded: 317 },
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

function syntheticRoute() {
  const geometry = [];
  for (let i = 0; i <= 200; i += 1) {
    const t = i / 200;
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
      routeId: 'route-start-bench',
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

/* Counts every time a map renderer element is ADDED to the document. */
const MOUNT_COUNTER = `
  window.__mapMounts = 0;
  window.__seenMaps = [];
  const scan = (root) => {
    if (!root || root.nodeType !== 1) return;
    const els = [];
    if (root.matches && root.matches('.maplibregl-map, .nav-map')) els.push(root);
    if (root.querySelectorAll) els.push.apply(els, root.querySelectorAll('.maplibregl-map, .nav-map'));
    for (const el of els) {
      if (window.__seenMaps.indexOf(el) === -1) { window.__seenMaps.push(el); window.__mapMounts += 1; }
    }
  };
  const start = () => {
    scan(document.body || document.documentElement);
    new MutationObserver((m) => { for (const r of m) for (const n of r.addedNodes) scan(n); })
      .observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', function once() {
    if (document.documentElement) { document.removeEventListener('readystatechange', once); start(); }
  });
`;

/**
 * Painted geometry of one element: its box intersected with every clipping
 * ancestor and the viewport, what is hit-testing on top of it, and whether
 * an ancestor is an inner scroller it could be hidden inside.
 */
const MEASURE = `(el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  /*
   * TWO DIFFERENT QUESTIONS, measured separately.
   *
   * \`clip\` intersects the ancestors AND the viewport: that answers "is all
   * of this on screen right now", which is what the no-scrolling contract
   * needs at default zoom.
   *
   * \`aclip\` intersects the ANCESTORS ONLY: that answers "is any of this cut
   * off by an overflow box" — a different defect, and the one that still
   * matters at 200% text zoom, where the page legitimately doubles in height
   * and scrolling is expected. Conflating them made the zoom checks demand
   * that a 144 px control fit a viewport now holding half as much, which no
   * honest layout could satisfy.
   */
  let clip = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
  let aclip = { top: -1e7, left: -1e7, right: 1e7, bottom: 1e7 };
  let trap = null;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if ((/auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflowX)) &&
        p.scrollHeight > p.clientHeight + 1) {
      trap = { cls: String(p.className).slice(0, 40), scrollH: p.scrollHeight, clientH: p.clientHeight };
    }
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const b = p.getBoundingClientRect();
    clip = { top: Math.max(clip.top, b.top), left: Math.max(clip.left, b.left),
             right: Math.min(clip.right, b.right), bottom: Math.min(clip.bottom, b.bottom) };
    aclip = { top: Math.max(aclip.top, b.top), left: Math.max(aclip.left, b.left),
              right: Math.min(aclip.right, b.right), bottom: Math.min(aclip.bottom, b.bottom) };
  }
  const visH = Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top));
  const visW = Math.max(0, Math.min(r.right, clip.right) - Math.max(r.left, clip.left));
  const aH = Math.max(0, Math.min(r.bottom, aclip.bottom) - Math.max(r.top, aclip.top));
  const aW = Math.max(0, Math.min(r.right, aclip.right) - Math.max(r.left, aclip.left));
  const cx = Math.round(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1));
  const cy = Math.round(Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
  const hit = document.elementFromPoint(cx, cy);
  return {
    vpTop: Math.round(r.top), vpBottom: Math.round(r.bottom), height: Math.round(r.height),
    paintedH: Math.round(visH),
    fullyPainted: visH >= r.height - 1 && visW >= r.width - 1,
    ancestorClipped: !(aH >= r.height - 1 && aW >= r.width - 1),
    inViewport: r.top >= -1 && r.bottom <= innerHeight + 1,
    covered: hit && !(hit === el || el.contains(hit) || hit.contains(el))
      ? hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 30) : null,
    trap,
  };
}`;

const findCta = `(() => { const b = Array.from(document.querySelectorAll('button'))
  .find(x => /^Start(\\s+Route)?$/.test((x.textContent||'').trim()));
  return b ? (${MEASURE})(b) : null; })()`;
const findConfirmation = `(() => { const p = Array.from(document.querySelectorAll('p'))
  .find(x => /^Destination:/.test((x.textContent||'').trim()));
  return p ? (${MEASURE})(p) : null; })()`;
const pageInfo = `(() => ({
  vh: innerHeight,
  scrollH: document.scrollingElement.scrollHeight,
  scrollY: window.scrollY,
  overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  mapMounts: window.__mapMounts ?? -1,
}))()`;
const mapBox = `(() => { const m = document.querySelector('.nav-map'); if (!m) return null;
  const r = m.getBoundingClientRect();
  const vh = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  const vw = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  return { top: Math.round(r.top), height: Math.round(r.height),
           pctOfViewport: +((vh * vw) / (innerWidth * innerHeight) * 100).toFixed(1) }; })()`;

let savedStorageState = null;

async function newContext(browser, vp) {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });
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
  await context.addInitScript(MOUNT_COUNTER);
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
    if (page.url().includes('/navigator/access'))
      throw new Error('the pilot gate refused the password');
    savedStorageState = await page.context().storageState();
  }
}

/* =================== the journey, one viewport at a time =============== */

async function runViewport(browser, vp) {
  console.log(`\n── ${vp.name} ─────────────────────────────────────────────`);
  const { context, page, counts } = await newContext(browser, vp);
  /** Route/search spent since the last call, as one priced ledger step. */
  let seen = { route: 0, search: 0 };
  const ledger = [];
  const step = (action) => {
    ledger.push({
      action,
      routeRequests: counts.route - seen.route,
      searchRequests: counts.search - seen.search,
    });
    seen = { ...counts };
  };

  await login(page);
  step('open /drive');

  await page.locator('[data-launcher-action="start-driving"]').click();
  await page.waitForURL(/\/drive\/navigate/, { timeout: 20_000 });
  step('tap START DRIVING');
  await page.waitForTimeout(3000);
  step('open /drive/navigate');

  const before = {
    cta: await page.evaluate(findCta),
    map: await page.evaluate(mapBox),
    info: await page.evaluate(pageInfo),
  };

  const search = page.locator('input[type="search"]').first();
  await search.focus();
  await page.waitForTimeout(600);
  step('focus destination field');

  await search.fill('bench gate');
  await page.waitForTimeout(1400);
  step('type a destination query');

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
  await page.waitForTimeout(1000);
  step('select a destination result');

  const after = {
    cta: await page.evaluate(findCta),
    confirmation: await page.evaluate(findConfirmation),
    map: await page.evaluate(mapBox),
    info: await page.evaluate(pageInfo),
  };
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.name}-picked.png` });

  const b = BEFORE[vp.name];
  const scrollNeeded = after.cta ? Math.max(0, after.cta.vpBottom - after.info.vh) : null;
  console.log(
    `     CTA after picking: top ${after.cta?.vpTop}px  painted ${after.cta?.paintedH}/${after.cta?.height}px  ` +
      `scrollNeeded ${scrollNeeded}px` +
      (b
        ? `   (before: top ${b.ctaTop}px, painted ${b.ctaPainted}px, scroll ${b.scrollNeeded}px)`
        : ''),
  );
  console.log(
    `     confirmation: top ${after.confirmation?.vpTop}px painted ${after.confirmation?.paintedH}/${after.confirmation?.height}px` +
      `   map: ${after.map ? `${after.map.height}px tall, ${after.map.pctOfViewport}% visible` : 'not mounted'}` +
      `   mapMounts: ${after.info.mapMounts}`,
  );

  check(`${vp.name} S1: a destination result could be selected`, picked);
  check(`${vp.name} S2: the chosen destination is named on screen`, after.confirmation !== null);
  check(
    `${vp.name} S3: the confirmation is fully painted, not clipped`,
    after.confirmation !== null && after.confirmation.fullyPainted,
    after.confirmation,
  );
  check(
    `${vp.name} S4: the confirmation is inside the initial viewport`,
    after.confirmation !== null && after.confirmation.inViewport,
    after.confirmation,
  );
  check(`${vp.name} S5: the primary CTA exists after picking`, after.cta !== null);
  check(
    `${vp.name} S6: the CTA is inside the initial viewport — no scrolling to find it`,
    after.cta !== null && after.cta.inViewport,
    { cta: after.cta, scrollNeeded },
  );
  check(
    `${vp.name} S7: the CTA is fully painted, not clipped by an ancestor`,
    after.cta !== null && after.cta.fullyPainted,
    after.cta,
  );
  check(
    `${vp.name} S8: nothing is painted on top of the CTA`,
    after.cta !== null && after.cta.covered === null,
    after.cta?.covered,
  );
  check(
    `${vp.name} S9: the CTA is not inside an inner scroller`,
    after.cta !== null && after.cta.trap === null,
    after.cta?.trap,
  );
  check(
    `${vp.name} S10: the CTA clears the ${MIN_CTA_TARGET_PX}px touch floor`,
    after.cta !== null && after.cta.height >= MIN_CTA_TARGET_PX,
    after.cta?.height,
  );
  check(
    `${vp.name} S11: the CTA is ordered ahead of the map`,
    after.cta !== null && after.map !== null && after.cta.vpTop < after.map.top,
    { cta: after.cta?.vpTop, map: after.map?.top },
  );
  check(
    `${vp.name} S12: the map is still mounted and substantial`,
    after.map !== null && after.map.height >= 140,
    after.map,
  );
  check(
    `${vp.name} S13: the map was mounted exactly once — no remount to reorder UI`,
    after.info.mapMounts === 1,
    after.info.mapMounts,
  );
  check(`${vp.name} S14: no horizontal overflow`, after.info.overflowX === 0, after.info.overflowX);
  check(`${vp.name} S15: the page opens unscrolled`, after.info.scrollY === 0, after.info.scrollY);
  check(
    `${vp.name} S16: before picking, the CTA was already present (state, not appearance)`,
    before.cta !== null,
  );

  /* ---- the destination stays changeable ---- */
  await search.fill('bench gate 2');
  await page.waitForTimeout(900);
  const editable = await page.evaluate(
    `(() => { const i = document.querySelector('input[type="search"]'); return i ? { value: i.value, disabled: i.disabled } : null; })()`,
  );
  check(
    `${vp.name} S17: the destination can still be changed after being chosen`,
    editable !== null && editable.disabled === false && editable.value.length > 0,
    editable,
  );

  /* ---- Settings and Plan My Trip round trips ---- */
  const settings = page.locator('[data-open-settings]').first();
  if ((await settings.count()) > 0) {
    await settings.click();
    await page.waitForURL(/\/drive\/settings/, { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(800);
    step('open Settings');
    await page.goBack();
    await page.waitForTimeout(1500);
    step('return from Settings');
  } else {
    check(`${vp.name} S18: the Settings link is present`, false);
  }

  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  const plan = page.locator('[data-launcher-action="plan-my-trip"]').first();
  if ((await plan.count()) > 0) {
    await plan.click();
    await page.waitForTimeout(2500);
    step('open Plan My Trip');
    await page.goBack();
    await page.waitForTimeout(1200);
    step('return from Plan My Trip');
  } else {
    check(`${vp.name} S19: the Plan My Trip action is present`, false);
  }

  /* ---- one deliberate Start ---- */
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const s2 = page.locator('input[type="search"]').first();
  await s2.fill('bench gate');
  try {
    await page
      .locator('ul[aria-label="Destination search results"] button')
      .first()
      .waitFor({ timeout: 10_000 });
    await page.locator('ul[aria-label="Destination search results"] button').first().click();
  } catch {
    /* reported by the ledger below */
  }
  await page.waitForTimeout(800);
  seen = { ...counts };
  const startBtn = page.getByRole('button', { name: /^Start(?: Route)?$/ }).first();
  if ((await startBtn.count()) > 0) {
    await startBtn.click();
    await page.waitForTimeout(6000);
  }
  step(DELIBERATE_START_ACTION);

  const verdict = routeSpendViolations(ledger);
  check(
    `${vp.name} S20: the whole journey is priced correctly by the shipped ledger`,
    verdict.ok,
    verdict.violations,
  );
  console.log(
    `     ledger: ${ledger.map((l) => `${l.action}=${l.routeRequests}r/${l.searchRequests}s`).join(', ')}`,
  );

  await context.close();
  return { vp: vp.name, before, after, scrollNeeded, ledger };
}

/* =========================== one-off journeys ========================== */

/** Settings during an ACTIVE trip must not buy a replacement route. */
async function activeTripSurvivesSettings(browser) {
  console.log(`\n── active trip: Settings and Plan My Trip round trips ─────`);
  const { context, page, counts } = await newContext(browser, REQUIRED_VIEWPORTS[1]);
  await login(page);
  await page.locator('[data-launcher-action="start-driving"]').click();
  await page.waitForURL(/\/drive\/navigate/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  const search = page.locator('input[type="search"]').first();
  await search.fill('bench gate');
  await page
    .locator('ul[aria-label="Destination search results"] button')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  await page
    .locator('ul[aria-label="Destination search results"] button')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(600);
  await page
    .getByRole('button', { name: /^Start(?: Route)?$/ })
    .first()
    .click();
  await page.waitForTimeout(6000);
  check('A1: one deliberate Start bought exactly one route', counts.route === 1, counts);

  const spent = counts.route;
  await page.goto(`${BASE}/drive/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  check(
    'A2: returning from Settings mid-trip bought no replacement route',
    counts.route === spent,
    {
      spent,
      now: counts.route,
    },
  );
  const restored = await page.evaluate(
    `(() => ({ surface: document.querySelector('[data-driving-surface]') !== null }))()`,
  );
  check('A3: the active trip is still on screen after the round trip', restored.surface, restored);
  const mounts = await page.evaluate(`(() => window.__mapMounts ?? -1)()`);
  check('A4: the map mounted once on the restored surface', mounts === 1, mounts);

  const spent2 = counts.route;
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-launcher-action="plan-my-trip"]').first().click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  check('A5: the Plan My Trip round trip bought no route either', counts.route === spent2, {
    spent2,
    now: counts.route,
  });
  await context.close();
}

/** Motion must not disable the destination field, and no passenger path. */
async function motionKeepsEditing(browser) {
  console.log(`\n── motion: editing is never disabled ─────────────────────`);
  const { context, page, counts } = await newContext(browser, REQUIRED_VIEWPORTS[1]);
  await login(page);
  await page.locator('[data-launcher-action="start-driving"]').click();
  await page.waitForURL(/\/drive\/navigate/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  /*
   * Real simulated motion: MOVING latches only after 10 s above 5 mph, so
   * the truck is walked north at ~65 mph for LONGER than the dwell.
   * Reaching the state is itself asserted — a loop that never leaves
   * UNKNOWN would let this check pass without testing anything.
   */
  let motion = null;
  for (let i = 1; i <= 16; i += 1) {
    await context.setGeolocation({
      latitude: ORIGIN.lat + i * 0.00027,
      longitude: ORIGIN.lng,
      accuracy: 6,
    });
    await page.waitForTimeout(1000);
    motion = await page.evaluate(
      `(() => document.querySelector('[data-motion-status]')?.textContent?.trim() ?? null)()`,
    );
    if (motion === 'Moving') break;
  }
  const state = await page.evaluate(`(() => {
    const i = document.querySelector('input[type="search"]');
    const cta = Array.from(document.querySelectorAll('button'))
      .find(x => /^Start(\\s+Route)?$/.test((x.textContent||'').trim()));
    return {
      motion: document.querySelector('[data-motion-status]')?.textContent?.trim() ?? null,
      field: i !== null, fieldDisabled: i ? i.disabled : null,
      ctaPresent: cta !== undefined,
      passenger: Array.from(document.querySelectorAll('button, a')).some(el =>
        /passenger/i.test((el.getAttribute('aria-label')||'') + ' ' + (el.textContent||''))),
      bodyPassenger: /passenger/i.test(document.body.innerText),
    };
  })()`);
  console.log(`     motion status reads: ${JSON.stringify(state.motion)}`);
  check(
    'M0: the simulated drive actually reaches the MOVING state',
    state.motion === 'Moving',
    state,
  );
  check('M1: the destination field survives established motion', state.field, state);
  check('M2: …and is not disabled while moving', state.fieldDisabled === false, state);
  check('M3: the route-start CTA survives motion too', state.ctaPresent, state);
  check('M4: no Passenger Access control exists', !state.passenger, state);
  check('M5: the word "passenger" appears nowhere on the page', !state.bodyPassenger);
  check('M6: motion alone bought no route', counts.route === 0, counts);
  await context.close();
}

/** 200% text zoom on this milestone's own surface. */
async function textZoom(browser) {
  console.log(`\n── 200% text zoom ────────────────────────────────────────`);
  const { context, page } = await newContext(browser, REQUIRED_VIEWPORTS[1]);
  await login(page);
  await page.locator('[data-launcher-action="start-driving"]').click();
  await page.waitForURL(/\/drive\/navigate/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  const search = page.locator('input[type="search"]').first();
  await search.fill('bench gate');
  await page
    .locator('ul[aria-label="Destination search results"] button')
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  await page
    .locator('ul[aria-label="Destination search results"] button')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(1200);
  const cta = await page.evaluate(findCta);
  const conf = await page.evaluate(findConfirmation);
  const info = await page.evaluate(pageInfo);
  console.log(
    `     at 200%: CTA top ${cta?.vpTop}px h ${cta?.height}px painted ${cta?.paintedH}px, overflowX ${info.overflowX}px`,
  );
  check('Z1: the CTA still exists at 200% text zoom', cta !== null);
  /*
   * At 200% text zoom the page is twice as tall and about half of it fits
   * the viewport, so REACHING the CTA legitimately costs a scroll. What must
   * still hold is that nothing CUTS IT OFF: no ancestor overflow box clips
   * it, nothing is painted over it, no inner scroller swallows it, and the
   * target stays glove-sized. Those are the defects zoom actually produces.
   */
  check(
    'Z2: no ancestor clips the CTA at 200% text zoom',
    cta !== null && cta.ancestorClipped === false,
    cta,
  );
  check(
    'Z3: it still clears the touch floor at 200% text zoom',
    cta !== null && cta.height >= MIN_CTA_TARGET_PX,
    cta?.height,
  );
  check(
    'Z4: no ancestor clips the confirmation at 200% text zoom',
    conf !== null && conf.ancestorClipped === false,
    conf,
  );
  /*
   * NAV-ENTRY-1 recorded a PRE-EXISTING overflow in the shared site
   * header at 200% zoom, and NAV-ENTRY-2 baselined it at 46 px on main and
   * 46 px on the branch. It is printed here, never asserted: a bench that
   * failed on it would be blaming this milestone for someone else's defect.
   */
  console.log(
    `     NOTE: shared site-header overflow at 200% zoom is pre-existing (NAV-ENTRY-1/2); ` +
      `measured ${info.overflowX}px here, not asserted.`,
  );
  await context.close();
}

/* ================================ main ================================ */

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
const cases = REQUIRED_VIEWPORTS.filter((v) => ONLY.length === 0 || ONLY.includes(v.name));
const rows = [];
try {
  for (const vp of cases) rows.push(await runViewport(browser, vp));
  if (ONLY.length === 0) {
    await activeTripSurvivesSettings(browser);
    await motionKeepsEditing(browser);
    await textZoom(browser);
  }
} finally {
  await browser.close();
}

console.log('\n── primary CTA after choosing a destination, before and after ──');
console.log(
  'viewport     before-top  after-top   before-painted  after-painted  before-scroll  after-scroll',
);
for (const r of rows) {
  const b = BEFORE[r.vp];
  const a = r.after.cta;
  console.log(
    `${r.vp.padEnd(12)} ${String(b?.ctaTop ?? '—').padStart(10)}  ${String(a?.vpTop ?? '—').padStart(9)}  ` +
      `${String(b?.ctaPainted ?? '—').padStart(14)}  ${String(a?.paintedH ?? '—').padStart(13)}  ` +
      `${String(b?.scrollNeeded ?? '—').padStart(13)}  ${String(r.scrollNeeded).padStart(12)}`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('failed:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail > 0 ? 1 : 0);

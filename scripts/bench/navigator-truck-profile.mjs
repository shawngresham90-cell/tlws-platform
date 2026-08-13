/**
 * The truck-profile bench: what did the driver confirm, what did the
 * provider actually receive, and what was the driver told?
 *
 * This is the fleet-demonstration question, measured in a real browser
 * against a production build. It drives the parked surface the way a
 * driver does — set the truck, confirm it, search a destination, tap
 * Start — and RECORDS the request the app made, with the key redacted,
 * beside the route-request count and the driver-facing explanation.
 *
 * The route endpoint is intercepted, so a full run spends nothing and
 * every scenario is deterministic. The intercepted request body is the
 * evidence: it is the same body the server would have turned into a HERE
 * URL, so "which restrictions were sent" is answered by observation
 * rather than by reading the code.
 *
 * Per scenario it records and checks:
 *   - the confirmed profile (as the driver set it);
 *   - the truck fields on the request, redacted;
 *   - the route-request COUNT (an invalid or unconfirmed truck must be 0,
 *     a valid confirmed one exactly 1, five rapid taps still 1);
 *   - the outcome — accepted, warned, or refused — and the line the
 *     driver was shown;
 *   - that no car-route fallback and no credential ever appear.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3212 &
 *   node scripts/bench/navigator-truck-profile.mjs --password <pw> \
 *     [--port 3212] [--only taller] [--shots <dir>]
 */
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3212');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const ONLY = (arg('only', '') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

const ORIGIN = { lat: 35.0, lng: -85.0 };
const MI_PER_DEG_LAT = 69.0937;
const DEST = { lat: ORIGIN.lat + 6 / MI_PER_DEG_LAT, lng: ORIGIN.lng };

let failures = 0;
let checks = 0;
function verdict(name, cond, detail = '') {
  checks += 1;
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}

function syntheticRoute({ warnings = [] } = {}) {
  const geometry = [];
  for (let i = 0; i <= 200; i++) {
    geometry.push([ORIGIN.lat + (i * 0.03) / MI_PER_DEG_LAT, ORIGIN.lng]);
  }
  return {
    ok: true,
    state: warnings.length > 0 ? 'valid-with-warning' : 'valid',
    warnings,
    route: {
      routeId: 'truck-bench',
      distanceMiles: 6,
      seconds: 480,
      geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head north on Depot Road.', direction: null, offset: 0 },
        {
          action: 'turn',
          instruction: 'Turn right onto Old Mill Road.',
          direction: 'right',
          offset: 100,
        },
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
  await page.waitForTimeout(700); // hydration
}

/** Set one editable field by typing into its labelled input. */
async function setField(page, label, unit, value) {
  const input = page.getByLabel(`${label} in ${unit}`);
  await input.scrollIntoViewIfNeeded();
  await input.fill(String(value));
  await page.waitForTimeout(120);
}

/** Toggle an avoidance by its driver-facing label. */
async function toggleAvoidance(page, label) {
  const btn = page.getByRole('button', { name: label, exact: true });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(120);
}

const SCENARIOS = [
  {
    key: 'standard',
    label: 'standard 13′6″ / 80,000 lb / 5 axles',
    edits: [],
    expect: { height: 411, weight: 36287, axles: 5 },
    outcome: 'accepted',
  },
  {
    key: 'taller',
    label: 'taller 14 ft',
    edits: [['Height', 'ft', 14]],
    expect: { height: 427 },
    outcome: 'accepted',
  },
  {
    key: 'heavier',
    label: 'heavier 120,000 lb on 9 axles',
    edits: [
      ['Axles', 'axles', 9],
      ['Gross weight', 'lb', 120000],
    ],
    expect: { weight: 54431, axles: 9 },
    outcome: 'accepted',
  },
  {
    key: 'dimensions',
    label: 'narrower and shorter',
    edits: [
      ['Width', 'ft', 8],
      ['Length', 'ft', 48],
    ],
    expect: { width: 244, length: 1463 },
    outcome: 'accepted',
  },
  {
    key: 'hazmat',
    label: 'hazmat class 3',
    hazmat: '3',
    expect: { hazmat: 'flammable' },
    outcome: 'accepted',
  },
  {
    key: 'tolls',
    label: 'avoid toll roads',
    avoid: ['Avoid toll roads'],
    expect: { avoid: 'tollRoad' },
    outcome: 'accepted',
  },
  {
    key: 'ferries',
    label: 'avoid ferries and tolls',
    avoid: ['Avoid ferries', 'Avoid toll roads'],
    expect: { avoidHas: ['ferry', 'tollRoad'] },
    outcome: 'accepted',
  },
  {
    key: 'impossible',
    label: 'impossible height (99 ft)',
    edits: [['Height', 'ft', 99]],
    outcome: 'refused-before-network',
  },
  {
    key: 'unconfirmed',
    label: 'never confirmed',
    skipConfirm: true,
    outcome: 'refused-before-network',
  },
  {
    key: 'warned',
    label: 'a warned route',
    warnings: ['Route includes a restricted segment for this truck.'],
    outcome: 'warned',
  },
  { key: 'refused', label: 'a provider refusal', providerStatus: 500, outcome: 'refused' },
  { key: 'rapid', label: 'five rapid Start taps', rapid: true, outcome: 'accepted' },
  {
    key: 'profile-change',
    label: 'profile changed after a route was planned',
    // A WARNED route pauses at the briefing, which is where a driver can
    // still see the plan and change their mind about the truck — the
    // exact moment the "do not reuse the old route" rule has to hold.
    warnings: ['Route includes a restricted segment for this truck.'],
    changeAfter: true,
    outcome: 'warned',
  },
];

async function runScenario(browser, sc) {
  console.log(`\n=== ${sc.key}: ${sc.label} ===`);
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });
  const routeBodies = [];
  await context.route('**/api/navigator/route', async (r) => {
    let body = null;
    try {
      body = JSON.parse(r.request().postData() ?? '{}');
    } catch {
      /* recorded as null */
    }
    routeBodies.push(body);
    if (sc.providerStatus === 500) {
      return r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'provider-error' }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute({ warnings: sc.warnings ?? [] })),
    });
  });
  await context.route('**/api/navigator/destination-search*', (r) =>
    r.fulfill({
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
    }),
  );
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());

  const page = await context.newPage();
  try {
    await login(page);

    // --- the driver sets their truck ---------------------------------
    for (const [label, unit, value] of sc.edits ?? []) await setField(page, label, unit, value);
    if (sc.hazmat) {
      await page.getByLabel('Hazmat placard class').selectOption(sc.hazmat);
      await page.waitForTimeout(120);
    }
    for (const a of sc.avoid ?? []) await toggleAvoidance(page, a);

    const confirmBtn = page.getByRole('button', { name: /This is my truck|Truck confirmed/ });
    await confirmBtn.scrollIntoViewIfNeeded();
    const confirmDisabled = await confirmBtn.isDisabled();
    if (sc.key === 'impossible') {
      verdict('an impossible value shows a correction and blocks confirmation', confirmDisabled);
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      verdict(
        'and the correction is a sentence the driver can act on',
        /Fix before planning a route/.test(text),
      );
    }
    if (!sc.skipConfirm && !confirmDisabled) await confirmBtn.click();
    await page.waitForTimeout(200);

    // --- destination, then Start --------------------------------------
    const search = page.getByLabel(
      'Search for a destination by address, business, truck stop, or city',
    );
    await search.scrollIntoViewIfNeeded();
    await search.fill('bench receiving gate');
    await page
      .getByRole('button')
      .filter({ hasText: 'Bench Receiving Gate' })
      .first()
      .click({ timeout: 15_000 });
    const start = page.getByRole('button', { name: /^Start$/ });
    await start.scrollIntoViewIfNeeded();
    if (sc.rapid) {
      for (let i = 0; i < 5; i++) {
        try {
          await start.click({ timeout: 1500 });
        } catch {
          /* the control legitimately goes away after the first tap */
        }
      }
    } else {
      await start.click();
    }
    await page.waitForTimeout(2500);

    // --- what actually happened ---------------------------------------
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const expectedCalls = sc.outcome === 'refused-before-network' ? 0 : 1;
    verdict(
      `route requests = ${expectedCalls}`,
      routeBodies.length === expectedCalls,
      `${routeBodies.length}`,
    );

    if (routeBodies.length > 0) {
      const t = routeBodies[0].truck ?? {};
      const redacted = {
        heightCm: Math.round(t.heightFt * 30.48),
        widthCm: Math.round(t.widthFt * 30.48),
        lengthCm: Math.round(t.lengthFt * 30.48),
        grossWeightKg: Math.round(t.grossWeightLbs * 0.45359237),
        axleCount: t.axles,
        hazmat: t.hazmatClass,
        avoid: routeBodies[0].avoid ?? null,
      };
      console.log(`  request (redacted): ${JSON.stringify(redacted)}`);
      const e = sc.expect ?? {};
      if (e.height !== undefined)
        verdict(
          `height on the wire = ${e.height} cm`,
          redacted.heightCm === e.height,
          `${redacted.heightCm}`,
        );
      if (e.width !== undefined)
        verdict(
          `width on the wire = ${e.width} cm`,
          redacted.widthCm === e.width,
          `${redacted.widthCm}`,
        );
      if (e.length !== undefined)
        verdict(
          `length on the wire = ${e.length} cm`,
          redacted.lengthCm === e.length,
          `${redacted.lengthCm}`,
        );
      if (e.weight !== undefined)
        verdict(
          `weight on the wire = ${e.weight} kg`,
          redacted.grossWeightKg === e.weight,
          `${redacted.grossWeightKg}`,
        );
      if (e.axles !== undefined)
        verdict(
          `axles on the wire = ${e.axles}`,
          redacted.axleCount === e.axles,
          `${redacted.axleCount}`,
        );
      if (e.hazmat !== undefined)
        verdict('the hazmat class travels', redacted.hazmat === '3', `${redacted.hazmat}`);
      if (e.avoid !== undefined)
        verdict(
          `avoidance ${e.avoid} travels`,
          (redacted.avoid ?? []).includes(e.avoid),
          JSON.stringify(redacted.avoid),
        );
      if (e.avoidHas !== undefined) {
        verdict(
          'both avoidances travel',
          e.avoidHas.every((a) => (redacted.avoid ?? []).includes(a)),
          JSON.stringify(redacted.avoid),
        );
      }
      verdict(
        'no credential anywhere in the request body',
        !/apiKey|HERE_API_KEY/i.test(JSON.stringify(routeBodies[0])),
      );
      verdict(
        'no car-route fallback — the app never asks for one',
        !/car|pedestrian/i.test(JSON.stringify(routeBodies[0])),
      );
    }

    // Outcome + the driver-facing explanation.
    if (sc.outcome === 'accepted') {
      // The LIFECYCLE's own state line, not the status wording: the
      // status text varies with GPS health (a parked bench fix can read
      // "position approximate"), while the lifecycle state is the fact
      // this scenario is about.
      verdict(
        'the trip is navigating',
        /Pilot trip state: navigating/.test(bodyText),
        /Pilot trip state: [a-z -]+/.exec(bodyText)?.[0] ?? 'no state line',
      );
    } else if (sc.outcome === 'warned') {
      verdict(
        'a warned route PAUSES at the briefing',
        /Route briefing|Start navigation/.test(bodyText),
      );
      verdict(
        'and the warning is shown in plain language, not collapsed',
        /restricted segment/i.test(bodyText),
      );
      verdict(
        '"Route planned for" lists what was sent',
        /Route planned for/.test(bodyText) && /13′6″|80,000 lb/.test(bodyText),
      );
    } else if (sc.outcome === 'refused') {
      verdict(
        'a provider refusal keeps the driver parked',
        !/Pilot trip state: navigating/.test(bodyText),
      );
      verdict('with one honest reason', /Route refused/.test(bodyText));
      verdict(
        'and no automatic retry loop',
        routeBodies.length === 1,
        `${routeBodies.length} requests`,
      );
    } else if (sc.outcome === 'refused-before-network') {
      verdict('the driver stays parked', !/Pilot trip state: navigating/.test(bodyText));
      verdict(
        'and is told what to do',
        /Confirm your truck above|Fix the truck details above/.test(bodyText),
        bodyText.slice(0, 0) || undefined,
      );
    }
    verdict('no credential is ever on screen', !/HERE_API_KEY|apiKey/.test(bodyText));
    verdict(
      'no internal provider parameter is on screen',
      !/truck\[|shippedHazardousGoods|transportMode/.test(bodyText),
    );

    /*
     * A profile change after planning must not reuse the old route. The
     * driver is at the briefing (the route is planned, not started); they
     * change the truck; the route that belonged to the OLD truck must be
     * gone, the confirmation must be re-asked, and none of it may cost a
     * provider request.
     */
    if (sc.changeAfter) {
      verdict(
        'the planned route is waiting at the briefing',
        /Pilot trip state: route ready/.test(bodyText),
        /Pilot trip state: [a-z -]+/.exec(bodyText)?.[0] ?? 'no state line',
      );
      // The truck editor is PARKED-AND-IDLE only, so changing the truck
      // means discarding the plan first — which is the honest order: the
      // route belonged to the old truck, and it goes before the new one
      // exists. Discard costs nothing.
      // The briefing's own Discard, not the cockpit's "stop and discard
      // position" control — two different buttons, two different jobs.
      await page
        .getByRole('button', { name: /^Discard route$|^Discard$/ })
        .first()
        .click({ timeout: 8000 });
      await page.waitForTimeout(400);
      verdict(
        'discarding the plan costs no provider request',
        routeBodies.length === 1,
        `${routeBodies.length} requests`,
      );
      await setField(page, 'Height', 'ft', 14);
      await page.waitForTimeout(400);
      const text2 = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      verdict(
        'the route planned for the old truck is gone',
        !/Pilot trip state: route ready/.test(text2),
        /Pilot trip state: [a-z -]+/.exec(text2)?.[0] ?? 'idle (no trip)',
      );
      verdict('and re-asks for confirmation', /This is my truck/.test(text2));
      verdict(
        'the change itself cost no provider request',
        routeBodies.length === 1,
        `${routeBodies.length} requests`,
      );
      const startAgain = page.getByRole('button', { name: /^Start$/ });
      await startAgain.scrollIntoViewIfNeeded().catch(() => {});
      await startAgain.click().catch(() => {});
      await page.waitForTimeout(1000);
      verdict(
        'and Start refuses until the new truck is confirmed',
        routeBodies.length === 1,
        `${routeBodies.length} requests`,
      );
    }

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/truck-${sc.key}.png`, fullPage: false });
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
    for (const sc of SCENARIOS.filter((s) => ONLY.length === 0 || ONLY.includes(s.key))) {
      try {
        await runScenario(browser, sc);
      } catch (err) {
        verdict(`scenario ${sc.key} completed`, false, String(err).slice(0, 200));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(
    failures === 0
      ? `\nPASS: truck-profile bench — ${checks} checks`
      : `\nFAIL: ${failures} of ${checks} checks failed`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

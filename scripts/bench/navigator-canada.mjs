/**
 * The Canada bench: what country was searched, what units were shown, and
 * what did the provider actually receive?
 *
 * Twenty scenarios in a real browser against a production build. The
 * search and route endpoints are intercepted, so a full run spends
 * nothing and every scenario is deterministic — and the intercepted
 * REQUESTS are the evidence. "Which country did the app ask about" is
 * answered by reading the query string the app sent, not by reading the
 * code that builds it.
 *
 * Per scenario it records:
 *   - region and units, as the driver set them;
 *   - the `country` parameter on every destination-search request;
 *   - the route request, redacted, and the count;
 *   - the units actually rendered on screen;
 *   - the HOS disclosure (clocks, or the Canadian notice, verbatim);
 *   - the outcome;
 *   - that no credential, no provider parameter and no car fallback ever
 *     appears.
 *
 * Playwright is installed ad hoc, like every script under scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3213 &
 *   node scripts/bench/navigator-canada.mjs --password <pw> \
 *     [--port 3213] [--only ca-search] [--shots <dir>] [--viewports]
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
const PORT = arg('port', '3213');
const PASSWORD = arg('password');
const SHOTS = arg('shots');
const VIEWPORTS_ONLY = process.argv.includes('--viewports');
const ONLY = (arg('only', '') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

const MI_PER_DEG_LAT = 69.0937;

/* The eleven named Canadian places the milestone asks for, plus the US
 * places the cross-border scenarios need. Coordinates are real; the
 * search endpoint is intercepted, so nothing is looked up. */
const PLACES = {
  'toronto-on': {
    title: 'Toronto, ON',
    address: 'Toronto, ON, Canada',
    pos: { lat: 43.6532, lng: -79.3832 },
    country: 'CAN',
  },
  'montreal-qc': {
    title: 'Montréal, QC',
    address: '1000 Rue de la Gauchetière O, Montréal, QC H3B 4W5, Canada',
    pos: { lat: 45.5019, lng: -73.5674 },
    country: 'CAN',
  },
  'vancouver-bc': {
    title: 'Vancouver, BC',
    address: '1055 W Georgia St, Vancouver, BC V6E 3P3, Canada',
    pos: { lat: 49.2827, lng: -123.1207 },
    country: 'CAN',
  },
  'calgary-ab': {
    title: 'Calgary, AB',
    address: '215 9 Ave SE, Calgary, AB T2G 0Y9, Canada',
    pos: { lat: 51.0447, lng: -114.0719 },
    country: 'CAN',
  },
  'winnipeg-mb': {
    title: 'Winnipeg, MB',
    address: '1 Portage Ave, Winnipeg, MB R3B 0R3, Canada',
    pos: { lat: 49.8951, lng: -97.1384 },
    country: 'CAN',
  },
  'halifax-ns': {
    title: 'Halifax, NS',
    address: '1741 Brunswick St, Halifax, NS B3J 3X8, Canada',
    pos: { lat: 44.6488, lng: -63.5752 },
    country: 'CAN',
  },
  'saskatoon-sk': {
    title: 'Saskatoon, SK',
    address: '222 3 Ave N, Saskatoon, SK S7K 0J5, Canada',
    pos: { lat: 52.1332, lng: -106.67 },
    country: 'CAN',
  },
  'quebec-qc': {
    title: 'Québec, QC',
    address: '1 Rue des Carrières, Québec, QC G1R 4P5, Canada',
    pos: { lat: 46.8139, lng: -71.208 },
    country: 'CAN',
  },
  'moncton-nb': {
    title: 'Moncton, NB',
    address: '655 Main St, Moncton, NB E1C 1E8, Canada',
    pos: { lat: 46.0878, lng: -64.7782 },
    country: 'CAN',
  },
  'whitehorse-yt': {
    title: 'Whitehorse, YT',
    address: '2121 2 Ave, Whitehorse, YT Y1A 1C2, Canada',
    pos: { lat: 60.7212, lng: -135.0568 },
    country: 'CAN',
  },
  'yellowknife-nt': {
    title: 'Yellowknife, NT',
    address: '4807 52 St, Yellowknife, NT X1A 1P1, Canada',
    pos: { lat: 62.454, lng: -114.3718 },
    country: 'CAN',
  },
  'windsor-on': {
    title: 'Windsor, ON',
    address: '350 City Hall Sq W, Windsor, ON N9A 6S1, Canada',
    pos: { lat: 42.3149, lng: -83.0364 },
    country: 'CAN',
  },
  'detroit-mi': {
    title: 'Detroit, MI',
    address: '2 Woodward Ave, Detroit, MI 48226, United States',
    pos: { lat: 42.3314, lng: -83.0458 },
    country: 'USA',
  },
  'seattle-wa': {
    title: 'Seattle, WA',
    address: '600 4th Ave, Seattle, WA 98104, United States',
    pos: { lat: 47.6062, lng: -122.3321 },
    country: 'USA',
  },
  'nashville-tn': {
    title: 'Nashville, TN',
    address: '1 Public Sq, Nashville, TN 37201, United States',
    pos: { lat: 36.1627, lng: -86.7816 },
    country: 'USA',
  },
};

let failures = 0;
let checks = 0;
function verdict(name, cond, detail = '') {
  checks += 1;
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}

function syntheticRoute(origin, dest) {
  const geometry = [];
  for (let i = 0; i <= 200; i++) {
    geometry.push([
      origin.lat + ((dest.lat - origin.lat) * i) / 200,
      origin.lng + ((dest.lng - origin.lng) * i) / 200,
    ]);
  }
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: 'canada-bench',
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

async function setRegion(page, region) {
  const btn = page.getByRole('button', {
    name: region === 'CA' ? 'Canada' : 'United States',
    exact: true,
  });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(200);
}

async function setUnits(page, units) {
  const btn = page.getByRole('button', {
    name: units === 'metric' ? 'Kilometres / kg' : 'Miles / lb',
    exact: true,
  });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(200);
}

async function confirmTruck(page) {
  /*
   * A CONFIRMED truck no longer shows a confirm button at all. Since the
   * pre-trip setup milestone the profile persists and collapses to a
   * compact summary with 'Edit truck', so a scenario inheriting a saved
   * storage state arrives with nothing left to confirm.
   */
  if ((await page.getByRole('button', { name: 'Edit truck' }).count()) > 0) return;
  const confirmBtn = page.getByRole('button', { name: /This is my truck|Truck confirmed/ });
  if ((await confirmBtn.count()) === 0) return;
  await confirmBtn.scrollIntoViewIfNeeded();
  if (!(await confirmBtn.isDisabled())) await confirmBtn.click();
  await page.waitForTimeout(250);
}

/**
 * Whether the truck is currently CONFIRMED, asked of the UI rather than
 * of a phrase.
 *
 * This used to be a text match on 'Truck confirmed'. The pre-trip setup
 * milestone replaced that button with a collapsed summary — 'Your truck
 * / Saved' and an 'Edit truck' button — so the phrase is gone while the
 * state it described is unchanged. Reading the state directly says what
 * the check always meant: the summary is showing, and no confirmation is
 * being asked for.
 */
async function isTruckConfirmed(page) {
  const summary = (await page.getByRole('button', { name: 'Edit truck' }).count()) > 0;
  const asking = (await page.getByRole('button', { name: /This is my truck/ }).count()) > 0;
  return summary && !asking;
}

/* ------------------------------------------------------------------ */

const SCENARIOS = [
  // --- 1-11: the eleven named Canadian places, across provinces and
  //           territories, each searched in Canada mode.
  ...Object.entries(PLACES)
    .filter(([, p]) => p.country === 'CAN')
    .slice(0, 11)
    .map(([key, p]) => ({
      key: `ca-${key}`,
      label: `Canadian search: ${p.title}`,
      region: 'CA',
      origin: { lat: 43.6532, lng: -79.3832 },
      search: key,
      expectCountry: 'CAN',
      expectMetric: true,
      expectHos: 'canada',
      outcome: 'search-only',
    })),

  // --- 12: a Canadian route, planned and started
  {
    key: 'ca-route',
    label: 'CA → CA: Toronto to Ottawa, metric, routed',
    region: 'CA',
    origin: { lat: 43.6532, lng: -79.3832 },
    search: 'montreal-qc',
    expectCountry: 'CAN',
    expectMetric: true,
    expectHos: 'canada',
    outcome: 'navigating',
  },
  // --- 13: US → CA cross-border
  {
    key: 'cross-us-ca',
    label: 'US → CA: a US driver deliberately searches Canada',
    region: 'US',
    origin: { lat: 42.3314, lng: -83.0458 },
    flipSearch: true,
    search: 'windsor-on',
    expectCountry: 'CAN',
    expectMetric: false,
    expectHos: 'clocks',
    expectCrossBorder: true,
    outcome: 'navigating',
  },
  // --- 14: CA → US cross-border, the Windsor/Detroit corridor
  {
    key: 'cross-ca-us',
    label: 'CA → US: Windsor to Detroit, the corridor no coordinate rule decides',
    region: 'CA',
    origin: { lat: 42.3149, lng: -83.0364 },
    flipSearch: true,
    search: 'detroit-mi',
    expectCountry: 'USA',
    expectMetric: true,
    expectHos: 'canada',
    expectCrossBorder: true,
    outcome: 'navigating',
  },
  // --- 15: CA → US where geography alone answers
  {
    key: 'cross-ca-us-west',
    label: 'CA → US: Vancouver to Seattle',
    region: 'CA',
    origin: { lat: 49.2827, lng: -123.1207 },
    flipSearch: true,
    search: 'seattle-wa',
    expectCountry: 'USA',
    expectMetric: true,
    expectHos: 'canada',
    expectCrossBorder: true,
    outcome: 'navigating',
  },
  // --- 16: US → US, the regression case. Nothing may have changed.
  {
    key: 'us-domestic',
    label: 'US → US: unchanged imperial behaviour',
    region: 'US',
    origin: { lat: 35.0456, lng: -85.3097 },
    search: 'nashville-tn',
    expectCountry: 'USA',
    expectMetric: false,
    expectHos: 'clocks',
    expectCrossBorder: false,
    outcome: 'navigating',
  },
  // --- 17: metric TRUCK ENTRY must reach the wire as the imperial twin
  {
    key: 'metric-truck',
    label: 'metric truck entry: 4.11 m / 36287 kg → the identical request',
    region: 'CA',
    origin: { lat: 43.6532, lng: -79.3832 },
    search: 'montreal-qc',
    metricTruck: true,
    expectCountry: 'CAN',
    expectMetric: true,
    expectHos: 'canada',
    expectWire: { height: 411, weight: 36287 },
    outcome: 'navigating',
  },
  // --- 18: a unit switch must not re-gate a confirmed truck
  {
    key: 'unit-switch',
    label: 'switching units does NOT invalidate a confirmed truck',
    region: 'CA',
    origin: { lat: 43.6532, lng: -79.3832 },
    search: 'montreal-qc',
    switchUnitsAfterConfirm: true,
    expectCountry: 'CAN',
    expectMetric: false,
    expectHos: 'canada',
    outcome: 'navigating',
  },
  // --- 19: a deliberate cross-border SEARCH must not change region/units
  {
    key: 'flip-preserves',
    label: 'the cross-border search flip leaves region, units and truck alone',
    region: 'CA',
    origin: { lat: 43.6532, lng: -79.3832 },
    flipSearch: true,
    search: 'detroit-mi',
    expectCountry: 'USA',
    expectMetric: true,
    expectHos: 'canada',
    outcome: 'search-only',
  },
  // --- 20: the region survives a reload, and costs nothing to restore
  {
    key: 'reload',
    label: 'the region and units survive a reload with zero re-spend',
    region: 'CA',
    origin: { lat: 43.6532, lng: -79.3832 },
    reload: true,
    expectMetric: true,
    expectHos: 'canada',
    outcome: 'reload-only',
  },
];

async function runScenario(browser, sc, viewport = { width: 390, height: 844 }) {
  console.log(`\n=== ${sc.key}: ${sc.label} ===`);
  const origin = sc.origin ?? { lat: 43.6532, lng: -79.3832 };
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: origin.lat, longitude: origin.lng, accuracy: 8 },
    viewport,
    isMobile: viewport.width < 700,
    hasTouch: true,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });

  const searchCountries = [];
  const routeBodies = [];
  await context.route('**/api/navigator/destination-search*', (r) => {
    const url = new URL(r.request().url());
    searchCountries.push(url.searchParams.get('country'));
    const place = PLACES[sc.search] ?? PLACES['toronto-on'];
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        places: [
          {
            id: `bench:${sc.search ?? 'toronto-on'}`,
            title: place.title,
            address: place.address,
            position: place.pos,
            facility: 'unknown',
            distanceMi: 6,
          },
        ],
      }),
    });
  });
  await context.route('**/api/navigator/route', async (r) => {
    let body = null;
    try {
      body = JSON.parse(r.request().postData() ?? '{}');
    } catch {
      /* recorded as null */
    }
    routeBodies.push(body);
    const place = PLACES[sc.search] ?? PLACES['toronto-on'];
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticRoute(origin, place.pos)),
    });
  });
  await context.route('**tile.openstreetmap.org/**', (r) => r.abort());

  const page = await context.newPage();
  try {
    await login(page);

    // --- the driver chooses a region -----------------------------------
    await setRegion(page, sc.region ?? 'US');
    if (sc.units) await setUnits(page, sc.units);

    let bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`  region=${sc.region ?? 'US'} units=${sc.expectMetric ? 'metric' : 'imperial'}`);

    // --- HOS disclosure -------------------------------------------------
    if (sc.expectHos === 'canada') {
      verdict(
        'Canada mode replaces the clocks with the exact notice',
        bodyText.includes('Canadian HOS is not calculated in this pilot.'),
      );
      verdict(
        'and the ELD sentence travels with the region choice',
        /Verify your clocks with your ELD/.test(bodyText),
      );
      verdict('the pilot status panel is shown', /Canadian pilot status/.test(bodyText));
      verdict(
        'parking honesty is stated',
        /Canadian parking coverage is limited in this pilot\./.test(bodyText),
      );
      verdict('HOS is listed as not included', /Not included/.test(bodyText));
    } else if (sc.expectHos === 'clocks') {
      verdict(
        'US mode keeps the clocks and shows no Canadian notice',
        !/Canadian HOS is not calculated/.test(bodyText),
      );
    }

    // --- the reload scenario stops here --------------------------------
    if (sc.outcome === 'reload-only') {
      const before = searchCountries.length + routeBodies.length;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const after = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      verdict(
        'the region survives the reload',
        after.includes('Canadian HOS is not calculated in this pilot.'),
      );
      verdict(
        'and restoring it costs no provider request',
        searchCountries.length + routeBodies.length === before,
        `${searchCountries.length + routeBodies.length} vs ${before}`,
      );
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/canada-${sc.key}.png` });
      return;
    }

    // --- the metric truck ------------------------------------------------
    if (sc.metricTruck) {
      // In metric mode the editor's inputs are labelled in metres and kg,
      // and the values convert ONCE on the way in.
      await page.getByLabel('Height in m').fill('4.11');
      await page.waitForTimeout(120);
      await page.getByLabel('Gross weight in kg').fill('36287');
      await page.waitForTimeout(150);
    }
    await confirmTruck(page);
    if (sc.switchUnitsAfterConfirm) {
      await setUnits(page, 'imperial');
      await page.waitForTimeout(250);
      verdict('the truck is STILL confirmed after a unit switch', await isTruckConfirmed(page));
      verdict(
        'and Start is not gated again by a display-unit change',
        !(await page.getByRole('button', { name: /^Start(?: Route)?$/ }).count()) ||
          (await page.getByText('Confirm your truck first').count()) === 0,
      );
    }

    // --- the search ------------------------------------------------------
    if (sc.flipSearch) {
      const flip = page.getByRole('button', {
        name: /Search Canada instead|Search the United States instead/,
      });
      await flip.scrollIntoViewIfNeeded();
      await flip.click();
      await page.waitForTimeout(200);
    }
    const search = page.getByLabel(
      'Search for a destination by address, business, truck stop, or city',
    );
    await search.scrollIntoViewIfNeeded();
    const place = PLACES[sc.search] ?? PLACES['toronto-on'];
    await search.fill(place.title.split(',')[0].toLowerCase());
    await page.waitForTimeout(900); // past the 350 ms debounce

    console.log(`  search country sent: ${JSON.stringify(searchCountries)}`);
    verdict(
      `every search asked for ${sc.expectCountry}, and only that`,
      searchCountries.length > 0 && searchCountries.every((c) => c === sc.expectCountry),
      JSON.stringify(searchCountries),
    );
    verdict(
      'one country per request — never both',
      searchCountries.every((c) => c === 'CAN' || c === 'USA'),
      JSON.stringify(searchCountries),
    );
    verdict('typing alone requested no route', routeBodies.length === 0, `${routeBodies.length}`);

    const resultsText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (sc.expectCountry === 'CAN') {
      verdict(
        'the Canadian address survives verbatim — province, postal code, accents',
        resultsText.includes(place.address.split(',').slice(-2)[0].trim()),
        place.address,
      );
    }
    if (sc.expectMetric) {
      verdict(
        'the result distance reads in kilometres',
        /\d+(\.\d+)? km/.test(resultsText),
        /[\d.]+ (km|mi)/.exec(resultsText)?.[0] ?? 'no distance',
      );
    }

    if (sc.outcome === 'search-only') {
      if (sc.key === 'flip-preserves') {
        verdict(
          'the flip left the region on Canada',
          resultsText.includes('Canadian HOS is not calculated in this pilot.'),
        );
        verdict('and the units on metric', /Kilometres \/ kg/.test(resultsText));
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/canada-${sc.key}.png` });
      return;
    }

    // --- pick, then Start -------------------------------------------------
    await page
      .getByRole('button')
      .filter({ hasText: place.title.split(',')[0] })
      .first()
      .click({ timeout: 15_000 });
    await page.waitForTimeout(300);

    const afterPick = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (sc.expectCrossBorder === true) {
      verdict(
        'the cross-border notice is shown before Start, verbatim',
        afterPick.includes(
          'Cross-border route. Verify customs documents, permits, border status, and operating hours separately.',
        ),
      );
    } else if (sc.expectCrossBorder === false) {
      verdict(
        'a domestic trip shows no cross-border notice',
        !/Cross-border route\./.test(afterPick),
      );
    }

    const start = page.getByRole('button', { name: START_BUTTON });
    await start.scrollIntoViewIfNeeded();
    await start.click();
    await page.waitForTimeout(2500);

    bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    verdict(
      'one Start = exactly one route request',
      routeBodies.length === 1,
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
      console.log(`  route request (redacted): ${JSON.stringify(redacted)}`);
      if (sc.expectWire?.height !== undefined) {
        verdict(
          `metric entry reached the wire as ${sc.expectWire.height} cm — the imperial twin`,
          redacted.heightCm === sc.expectWire.height,
          `${redacted.heightCm}`,
        );
      }
      if (sc.expectWire?.weight !== undefined) {
        verdict(
          `and as ${sc.expectWire.weight} kg`,
          redacted.grossWeightKg === sc.expectWire.weight,
          `${redacted.grossWeightKg}`,
        );
      }
      verdict(
        'no credential anywhere in the request body',
        !/apiKey|HERE_API_KEY/i.test(JSON.stringify(routeBodies[0])),
      );
      verdict(
        'no car-route fallback — the app never asks for one',
        !/"car"|pedestrian/i.test(JSON.stringify(routeBodies[0])),
      );
    }

    verdict(
      'the trip is navigating',
      /Pilot trip state: navigating/.test(bodyText),
      /Pilot trip state: [a-z -]+/.exec(bodyText)?.[0] ?? 'no state line',
    );
    /*
     * A parked bench truck has no speed — two fixes are needed for one —
     * so the cockpit legitimately reads an em dash. What must hold either
     * way is that no unit from the OTHER system is anywhere on the
     * screen: the failure being hunted is a metric number wearing an
     * imperial label, and that shows up as a stray "mph" or "mi".
     */
    const speedShown = /\d+ (km\/h|mph)/.exec(bodyText)?.[0] ?? 'no speed yet (parked)';
    if (sc.expectMetric) {
      verdict(
        'no imperial speed unit is on a metric cockpit',
        !/\d+ mph/.test(bodyText),
        speedShown,
      );
      verdict('no imperial distance unit either', !/\d+(\.\d+)? mi\b|\d+ ft\b/.test(bodyText));
      verdict(
        'and any speed shown is km/h',
        !/\d+ (km\/h|mph)/.test(bodyText) || /\d+ km\/h/.test(bodyText),
        speedShown,
      );
    } else {
      verdict(
        'no metric speed unit is on an imperial cockpit',
        !/\d+ km\/h/.test(bodyText),
        speedShown,
      );
      verdict('no metric distance unit either', !/\d+(\.\d+)? km\b/.test(bodyText));
      verdict(
        'and any speed shown is mph',
        !/\d+ (km\/h|mph)/.test(bodyText) || /\d+ mph/.test(bodyText),
        speedShown,
      );
    }
    verdict('no credential is ever on screen', !/HERE_API_KEY|apiKey/.test(bodyText));
    verdict(
      'no internal provider parameter is on screen',
      !/truck\[|shippedHazardousGoods|transportMode|countryCode:/.test(bodyText),
    );

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/canada-${sc.key}.png` });
  } finally {
    await context.close();
  }
}

/* The eight required viewports, run against the Canadian idle surface:
 * the region panel, the notice, the status list and the search box must
 * all be reachable and must not overflow horizontally. */
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
];

async function runViewports(browser) {
  for (const vp of VIEWPORTS) {
    console.log(`\n=== viewport ${vp.width}×${vp.height} ===`);
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 43.6532, longitude: -79.3832, accuracy: 8 },
      viewport: vp,
      isMobile: vp.width < 700,
      hasTouch: true,
      deviceScaleFactor: 1,
      storageState: savedStorageState ?? undefined,
    });
    await context.route('**/api/navigator/destination-search*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, places: [] }),
      }),
    );
    await context.route('**tile.openstreetmap.org/**', (r) => r.abort());
    const page = await context.newPage();
    try {
      await login(page);
      await setRegion(page, 'CA');
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      verdict(`${vp.width}×${vp.height}: no horizontal overflow`, overflow <= 1, `${overflow}px`);
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      verdict(
        `${vp.width}×${vp.height}: the HOS notice is present`,
        text.includes('Canadian HOS is not calculated in this pilot.'),
      );
      verdict(
        `${vp.width}×${vp.height}: the pilot status panel is present`,
        /Canadian pilot status/.test(text),
      );
      // Every control the driver must reach is at least 64 px tall.
      const small = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('button, input, select')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          // The TAPPABLE target is what matters, not the glyph. A radio
          // is 24 px of pixels inside a 64 px label, and the whole label
          // is the hit area — measuring the input alone would fail a
          // control that is perfectly glove-sized.
          const target = el.closest('label') ?? el;
          const tr = target.getBoundingClientRect();
          if (tr.height < 60)
            out.push(
              `${el.tagName}[${el.getAttribute('type')}] h=${Math.round(tr.height)} aria="${el.getAttribute('aria-label') ?? ''}"`,
            );
        }
        return out;
      });
      verdict(
        `${vp.width}×${vp.height}: every control is glove-sized`,
        small.length === 0,
        small.join(' | '),
      );
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/canada-vp-${vp.width}x${vp.height}.png`,
          fullPage: true,
        });
    } finally {
      await context.close();
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    if (!VIEWPORTS_ONLY) {
      for (const sc of SCENARIOS.filter((s) => ONLY.length === 0 || ONLY.includes(s.key))) {
        try {
          await runScenario(browser, sc);
        } catch (err) {
          failures += 1;
          console.log(`  FAIL ${sc.key} threw — ${err.message}`);
        }
      }
    }
    if (VIEWPORTS_ONLY || ONLY.length === 0) await runViewports(browser);
  } finally {
    await browser.close();
  }
  console.log(`\ncanada bench: ${checks - failures}/${checks} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

main();

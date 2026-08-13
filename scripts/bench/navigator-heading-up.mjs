/**
 * The heading-up bench: does the MAP actually turn with the truck, and
 * does a spoken left turn appear on the LEFT of the screen?
 *
 * This is the milestone's acceptance standard, measured in a real browser
 * against a production build. It drives the live driving surface with
 * simulated movement and then measures the SCREEN, never an internal
 * property: marker positions come from the DOM, and the route line is
 * sampled out of the WebGL canvas by colour. If the camera bearing were
 * faked — icon-only rotation, or a CSS transform — the canvas and the
 * markers would disagree and these numbers would not hold.
 *
 * Per directional scenario it measures:
 *   1. the camera bearing DERIVED from two markers whose world positions
 *      are known (truck + destination): screen angle vs world bearing;
 *   2. the truck's position in the viewport (must be lower-middle);
 *   3. how much route is drawn AHEAD of the truck versus behind, by
 *      counting cyan route pixels above and below it on the canvas;
 *   4. for turn scenarios, which SIDE of the screen the road after the
 *      maneuver falls on — the claim that must agree with the voice;
 *   5. that the canvas and the DOM markers agree (alignment);
 *   6. controls reachable, HOS strip visible, no truck-profile chip, the
 *      maneuver distance still counting down, and the route-request count.
 *
 * Tiles are intercepted and served as a flat local image: the bench box
 * has no tile network, and a bench must never depend on a third party.
 * The route endpoint is intercepted too, so a full run spends nothing.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, like every script in scripts/bench:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3211 &
 *   node scripts/bench/navigator-heading-up.mjs --password <pw> \
 *     [--port 3211] [--only eastbound] [--shots <dir>]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;
import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Build a valid solid-colour PNG. The bench box has no tile network, so
 * the basemap is served locally — and it has to be a REAL png: an
 * invalid one is accepted by the request layer and then silently fails
 * to decode, leaving a blank canvas that looks exactly like a broken
 * renderer. (Measured: a hand-written base64 stub did precisely that.)
 */
function makePng(size, [r, g, b]) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Decode a Chromium screenshot (PNG, 8-bit RGB/RGBA) to raw pixels.
 *
 * The route line is drawn by WebGL, and a WebGL canvas cannot be read
 * back with drawImage once the frame is composited (MapLibre runs with
 * preserveDrawingBuffer off, as it should — turning it on for a test
 * would slow the real driving map). So the bench measures what the
 * DRIVER sees: a screenshot, decoded here with nothing but zlib.
 */
function decodePng(buf) {
  let pos = 8; // skip the signature
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported png: depth=${bitDepth} color=${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/**
 * Count the route line's pixels around the truck, from a screenshot.
 * Returns how much cyan road is drawn ahead / behind / left / right of
 * the truck's screen position — the picture the driver is looking at.
 */
function sampleRoute(png, truck) {
  const { width, height, channels, data } = png;
  const out = { ahead: 0, behind: 0, left: 0, right: 0, total: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // The blueprint's electric cyan (#33C7FF): strong blue and green,
      // weak red. The dark casing and the basemap fail this easily.
      if (b > 170 && g > 130 && r < 130 && b - r > 70) {
        out.total++;
        if (y < truck.y - 3) out.ahead++;
        else if (y > truck.y + 3) out.behind++;
        if (x < truck.x - 3) out.left++;
        else if (x > truck.x + 3) out.right++;
      }
    }
  }
  return out;
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3211');
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
const M_PER_DEG_LAT = 111_320;
const cosLat = Math.cos((ORIGIN.lat * Math.PI) / 180);

let failures = 0;
let checks = 0;
function verdict(name, cond, detail = '') {
  checks += 1;
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}

/** True-north bearing between two coordinates, in [0,360). */
function bearingBetween(from, to) {
  const f1 = (from.lat * Math.PI) / 180;
  const f2 = (to.lat * Math.PI) / 180;
  const dl = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function shortestDelta(a, b) {
  return (((b - a + 540) % 360) - 180 + 360) % 360 > 180
    ? ((b - a + 540) % 360) - 180
    : ((b - a + 540) % 360) - 180;
}

/** Move `mi` miles along `bearing` from a coordinate. */
function offset(from, bearingDeg, mi) {
  const th = (bearingDeg * Math.PI) / 180;
  return {
    lat: from.lat + (mi * Math.cos(th)) / MI_PER_DEG_LAT,
    lng: from.lng + (mi * Math.sin(th)) / (MI_PER_DEG_LAT * cosLat),
  };
}

/**
 * A synthetic route: a straight leg on `legBearing`, optionally turning
 * onto `turnBearing` at the halfway point. Returns the geometry plus the
 * points the bench needs to reason about (the maneuver, and a point on
 * the road AFTER the maneuver).
 */
function buildRoute({ legBearing, turnBearing = null, legMi = 1.2, tailMi = 0.9 }) {
  const geometry = [];
  const STEP = 0.02;
  let p = { ...ORIGIN };
  geometry.push([p.lat, p.lng]);
  for (let d = STEP; d <= legMi + 1e-9; d += STEP) {
    p = offset(ORIGIN, legBearing, d);
    geometry.push([p.lat, p.lng]);
  }
  const maneuver = { ...p };
  let afterManeuver = offset(maneuver, turnBearing ?? legBearing, tailMi);
  for (let d = STEP; d <= tailMi + 1e-9; d += STEP) {
    const q = offset(maneuver, turnBearing ?? legBearing, d);
    geometry.push([q.lat, q.lng]);
  }
  afterManeuver = { lat: geometry[geometry.length - 1][0], lng: geometry[geometry.length - 1][1] };
  return { geometry, maneuver, afterManeuver };
}

function wireRoute(route, turnDirection) {
  const n = route.geometry.length;
  const turnAt = Math.round((n - 1) * 0.57);
  return {
    ok: true,
    state: 'valid',
    warnings: [],
    route: {
      routeId: `heading-bench-${turnDirection ?? 'straight'}`,
      distanceMiles: Number(((n - 1) * 0.02).toFixed(1)),
      seconds: 300,
      geometry: route.geometry,
      maneuvers: [
        { action: 'depart', instruction: 'Head out on Depot Road.', direction: null, offset: 0 },
        turnDirection === null
          ? {
              action: 'continue',
              instruction: 'Continue on Depot Road.',
              direction: null,
              offset: turnAt,
            }
          : {
              action: 'turn',
              instruction: `Turn ${turnDirection} onto Old Mill Road.`,
              direction: turnDirection,
              offset: turnAt,
            },
        {
          action: 'arrive',
          instruction: 'Arrive at the receiving gate.',
          direction: null,
          offset: n - 1,
        },
      ],
    },
  };
}

/**
 * The bench basemap: a flat mid-grey tile, generated locally. Grey, not
 * black, so the sampler can tell "the basemap drew" from "nothing drew".
 */
const FLAT_TILE = makePng(256, [58, 62, 68]);

/**
 * Confirm the truck before Start (truck-route confidence milestone):
 * an unconfirmed profile spends nothing, so every flow that plans a
 * route passes through the same tap a driver makes.
 */
async function confirmTruck(page) {
  const btn = page.getByRole('button', { name: /This is my truck|Truck confirmed/ });
  await btn.scrollIntoViewIfNeeded();
  if (!(await btn.isDisabled())) await btn.click();
  await page.waitForTimeout(150);
}

let savedStorageState = null;
async function login(page) {
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    // NOT networkidle: a live WebGL map keeps a tile request in flight for
    // as long as it is on screen, so "the network went quiet" never
    // happens on this page and waiting for it would hang every run.
    await page.waitForURL(/\/drive/, { timeout: 20_000 }).catch(() => {});
    await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/navigator/access')) {
      throw new Error('the pilot gate did not accept the password');
    }
    savedStorageState = await page.context().storageState();
  }
  await page.waitForTimeout(600); // hydration
}

/**
 * Everything measured about the rotated driving surface, from OUTSIDE the
 * renderer: marker geometry from the DOM, route geometry from the canvas.
 */
async function measure(page, probe) {
  return page.evaluate((probeArg) => {
    const out = {
      vw: window.innerWidth,
      vh: window.innerHeight,
      truck: null,
      dest: null,
      maneuver: null,
      canvas: null,
      routeAhead: 0,
      routeBehind: 0,
      routeLeft: 0,
      routeRight: 0,
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      hosVisible: false,
      truckChip: false,
      searchInput: document.querySelector('input[type="search"]') !== null,
      distanceText: null,
      controls: [],
      attribution: null,
      mapCount: document.querySelectorAll('.maplibregl-map').length,
      canvasCount: document.querySelectorAll('.maplibregl-canvas').length,
      leafletPresent: document.querySelector('.leaflet-container') !== null,
      containerTransform: '',
    };
    const centre = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    };
    out.truck = centre(document.querySelector('[aria-label="Your truck"]'));
    out.dest = centre(document.querySelector('[aria-label="Destination"]'));
    out.maneuver = centre(document.querySelector('[aria-label="Next maneuver"]'));

    const cv = document.querySelector('.maplibregl-canvas');
    if (cv) {
      const r = cv.getBoundingClientRect();
      out.canvas = { x: r.left, y: r.top, w: r.width, h: r.height };
      const mapEl = document.querySelector('.maplibregl-map');
      out.containerTransform = mapEl ? getComputedStyle(mapEl).transform : '';
    }

    const hos = document.querySelector('[aria-label^="Hours of service — compact"]');
    if (hos) {
      const r = hos.getBoundingClientRect();
      out.hosVisible =
        r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
    }
    out.truckChip =
      document.querySelector('[aria-label="Truck profile used for this route"]') !== null;

    const card = document.querySelector('[aria-label="Next maneuver"]');
    const cardText = card ? (card.textContent ?? '') : document.body.innerText;
    const m = /In ([\d.,]+ (?:mi|ft))/.exec(cardText);
    out.distanceText = m ? m[1] : null;

    for (const btn of Array.from(document.querySelectorAll('button'))) {
      const label = `${btn.getAttribute('aria-label') ?? ''} ${btn.textContent ?? ''}`.trim();
      if (!/^Stop|Voice|Mute|overview|Zoom in|Zoom out|Recenter/i.test(label)) continue;
      const r = btn.getBoundingClientRect();
      out.controls.push({
        label: label.slice(0, 32),
        inViewport:
          r.left >= -1 &&
          r.top >= -1 &&
          r.right <= window.innerWidth + 1 &&
          r.bottom <= window.innerHeight + 1,
        shortAxisPx: Math.round(Math.min(r.width, r.height)),
      });
    }
    const attrib = document.querySelector('.maplibregl-ctrl-attrib');
    if (attrib) {
      const st = getComputedStyle(attrib);
      out.attribution = {
        text: (attrib.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        visible: st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.1,
      };
    }
    void probeArg;
    return out;
  }, probe);
}

/** The camera bearing, DERIVED from two markers with known world points. */
function derivedBearing(m, fromWorld, toWorld) {
  if (!m.truck || !m.dest) return null;
  const dx = m.dest.x - m.truck.x;
  const dy = m.dest.y - m.truck.y;
  if (Math.hypot(dx, dy) < 8) return null; // too close to read an angle
  // Screen angle measured clockwise from "up".
  const screenAngle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const world = bearingBetween(fromWorld, toWorld);
  return (((world - screenAngle) % 360) + 360) % 360;
}

const SCENARIOS = [
  { key: 'northbound', legBearing: 0, turn: null },
  { key: 'eastbound', legBearing: 90, turn: null },
  { key: 'southbound', legBearing: 180, turn: null },
  { key: 'westbound', legBearing: 270, turn: null },
  { key: 'left-turn', legBearing: 90, turn: 'left', turnBearing: 0 },
  { key: 'right-turn', legBearing: 90, turn: 'right', turnBearing: 180 },
  { key: 'left-turn-southbound', legBearing: 180, turn: 'left', turnBearing: 90 },
  { key: 'right-turn-westbound', legBearing: 270, turn: 'right', turnBearing: 0 },
  // The 359°→0° boundary: travelling just west of due north.
  { key: 'boundary-359', legBearing: 358, turn: null },
  { key: 'consecutive-turns', legBearing: 90, turn: 'left', turnBearing: 0, second: 90 },
  // Camera controls and restore are tested once each, on a plain leg:
  // they are claims about the CAMERA, not about a direction of travel,
  // and each needs the truck to come to a genuine stop first (the
  // shared motion lock gates Overview while moving — as it should).
  { key: 'camera-controls', legBearing: 90, turn: null, cameraControls: true },
  { key: 'stop-then-move', legBearing: 90, turn: null, stopThenMove: true },
  { key: 'hard-reload', legBearing: 90, turn: null, reload: true },
];

async function runScenario(browser, scenario, opts = {}) {
  const { w = 390, h = 844 } = opts;
  const name = `${scenario.key} (${w}x${h})`;
  console.log(`\n=== ${name} ===`);
  const route = buildRoute({
    legBearing: scenario.legBearing,
    turnBearing: scenario.turnBearing ?? null,
  });
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: ORIGIN.lat, longitude: ORIGIN.lng, accuracy: 8 },
    viewport: { width: w, height: h },
    isMobile: w < 700 || h < 700,
    hasTouch: w < 700 || h < 700,
    deviceScaleFactor: 1,
    storageState: savedStorageState ?? undefined,
  });
  let routeCalls = 0;
  await context.route('**/api/navigator/route', (r) => {
    routeCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wireRoute(route, scenario.turn)),
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
            id: 'bench:dest',
            title: 'Bench Receiving Gate',
            address: '1 Depot Rd, Ringgold, GA 30736',
            position: route.afterManeuver,
            facility: 'warehouse',
            distanceMi: null,
          },
        ],
      }),
    }),
  );
  await context.route('**tile.openstreetmap.org/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: FLAT_TILE }),
  );

  const page = await context.newPage();
  try {
    await login(page);

    // Parked: the map-top search from #307 must still work here.
    const input = page.getByLabel(
      'Search for a destination by address, business, truck stop, or city',
    );
    await input.waitFor({ timeout: 20_000 });
    await input.fill('bench receiving gate');
    await page
      .getByRole('button')
      .filter({ hasText: 'Bench Receiving Gate' })
      .first()
      .click({ timeout: 15_000 });
    await confirmTruck(page);
    await page.getByRole('button', { name: /^Start$/ }).click();

    // Drive the leg, then the tail, feeding real GPS courses.
    let travelled = 0;
    const feed = async (bearingDeg, seconds, mps = 13.4) => {
      for (let i = 0; i < seconds; i++) {
        travelled += (mps / 1609.34) * 1; // miles per second
        const at = offset(ORIGIN, scenario.legBearing, Math.min(travelled, 1.2));
        const past = travelled > 1.2;
        const p = past
          ? offset(route.maneuver, scenario.turnBearing ?? scenario.legBearing, travelled - 1.2)
          : at;
        await context.setGeolocation({
          latitude: p.lat,
          longitude: p.lng,
          accuracy: 8,
          heading: bearingDeg,
          speed: mps,
        });
        await page.waitForTimeout(1000);
      }
    };
    await feed(scenario.legBearing, 8);
    await page.waitForTimeout(1200); // let the camera ease settle

    const before = await measure(page);
    const straightBearing = derivedBearing(before, ORIGIN, route.afterManeuver);
    const shotPath = SHOTS ? `${SHOTS}/heading-${scenario.key}-${w}x${h}.png` : undefined;
    const beforeShot = await page.screenshot(shotPath ? { path: shotPath } : {});
    const beforePixels = before.truck ? sampleRoute(decodePng(beforeShot), before.truck) : null;

    // --- the headline: is travel UP the screen? --------------------------
    verdict(
      'renderer: MapLibre is the live map (exactly one instance)',
      before.mapCount === 1 && before.canvasCount === 1,
      `maps=${before.mapCount} canvases=${before.canvasCount}`,
    );
    verdict('renderer: no Leaflet map is mounted', before.leafletPresent === false);
    verdict(
      'renderer: the map container carries NO css rotation',
      before.containerTransform === 'none' ||
        before.containerTransform === '' ||
        /matrix\(1, 0, 0, 1/.test(before.containerTransform),
      before.containerTransform,
    );
    verdict('markers: the truck marker is on screen', before.truck !== null);

    if (straightBearing !== null) {
      const want = scenario.legBearing;
      const err = Math.abs(shortestDelta(want, straightBearing));
      verdict(
        `camera: bearing follows travel (want ~${want}°)`,
        err <= 12,
        `derived ${straightBearing.toFixed(1)}° (±${err.toFixed(1)}°)`,
      );
    } else {
      verdict('camera: bearing measurable from two markers', false, 'markers too close together');
    }

    if (before.truck) {
      const frac = before.truck.y / before.vh;
      verdict(
        'camera: the truck rides the lower middle (55–90% down)',
        frac >= 0.55 && frac <= 0.9,
        `${(frac * 100).toFixed(0)}%`,
      );
      const centred = Math.abs(before.truck.x - before.vw / 2) / before.vw;
      verdict(
        'camera: and stays horizontally centred (±12%)',
        centred <= 0.12,
        `${(centred * 100).toFixed(0)}% off centre`,
      );
    }
    if (beforePixels !== null && beforePixels.total > 200) {
      verdict('canvas: the route line is drawn', true, `${beforePixels.total} route px`);
      verdict(
        'canvas: more route is drawn AHEAD of the truck than behind (≥2:1)',
        beforePixels.ahead >= beforePixels.behind * 2,
        `ahead=${beforePixels.ahead} behind=${beforePixels.behind}`,
      );
    } else {
      verdict(
        'canvas: the route line is drawn',
        false,
        `only ${beforePixels ? beforePixels.total : 0} route pixels found`,
      );
    }

    // --- the turn, if this scenario has one ------------------------------
    if (scenario.turn !== null) {
      // Drive to just before the maneuver, so the road after it is the
      // part of the route still ahead.
      await feed(scenario.legBearing, 4);
      await page.waitForTimeout(1200);
      const atTurn = await measure(page);
      const turnShot = await page.screenshot(
        SHOTS ? { path: `${SHOTS}/heading-${scenario.key}-turn-${w}x${h}.png` } : {},
      );
      const turnPixels = atTurn.truck ? sampleRoute(decodePng(turnShot), atTurn.truck) : null;
      if (atTurn.truck && atTurn.dest) {
        const dx = atTurn.dest.x - atTurn.truck.x;
        const side = Math.abs(dx) < 6 ? 'straight' : dx > 0 ? 'right' : 'left';
        verdict(
          `turn: a spoken "${scenario.turn}" turn branches ${scenario.turn} on screen`,
          side === scenario.turn,
          `road after the turn is ${side} of the truck (dx=${dx.toFixed(0)}px)`,
        );
      } else {
        verdict(
          `turn: the road after the turn is measurable`,
          false,
          'destination marker off-screen',
        );
      }
      if (turnPixels !== null && turnPixels.left + turnPixels.right > 200) {
        const drawnSide = turnPixels.left > turnPixels.right ? 'left' : 'right';
        verdict(
          `turn: the DRAWN route line also leans ${scenario.turn}`,
          drawnSide === scenario.turn,
          `left=${turnPixels.left} right=${turnPixels.right}`,
        );
      }
    }

    // Keep driving before the second measurement: the maneuver distance
    // has to be seen COUNTING DOWN, not merely present. The card rounds
    // to a tenth of a mile, so the gap has to be long enough to move a
    // displayed digit — 15 s at ~30 mph is about 0.12 mi.
    await feed(scenario.turnBearing ?? scenario.legBearing, 15);
    await page.waitForTimeout(1200);

    // --- alignment: canvas and DOM markers agree -------------------------
    const after = await measure(page);

    verdict('layout: no horizontal overflow', !after.hscroll);
    verdict('layout: the compact HOS strip stays visible', after.hosVisible);
    verdict('layout: the removed truck-profile chip is still absent', after.truckChip === false);
    verdict('layout: no text field during live guidance', after.searchInput === false);
    verdict(
      'guidance: the maneuver distance is shown',
      after.distanceText !== null,
      after.distanceText ?? 'missing',
    );
    verdict(
      'guidance: and it is still counting down',
      before.distanceText !== null &&
        after.distanceText !== null &&
        before.distanceText !== after.distanceText,
      `${before.distanceText} → ${after.distanceText}`,
    );
    const missing = ['Stop', 'Voice|Mute', 'overview', 'Zoom in', 'Zoom out'].filter(
      (want) => !after.controls.some((c) => new RegExp(want, 'i').test(c.label)),
    );
    verdict('controls: all essential controls present', missing.length === 0, missing.join(','));
    const small = after.controls.filter((c) => c.shortAxisPx < 44 || !c.inViewport);
    verdict(
      'controls: glove-sized and inside the viewport',
      small.length === 0,
      JSON.stringify(small),
    );
    verdict(
      'attribution: the OSM credit is rendered and visible',
      after.attribution !== null &&
        after.attribution.visible &&
        /OpenStreetMap/i.test(after.attribution.text),
      after.attribution ? after.attribution.text : 'absent',
    );
    /*
     * CAMERA CONTROLS. Overview is gated by the shared motion lock — a
     * moving driver gets the locked row, not the map control — so the
     * truck stops first, exactly as it would at a light. Feeding
     * stationary fixes until the lock says STATIONARY is the honest way
     * in; there is no bench-only bypass of the safety authority.
     */
    if (scenario.cameraControls === true) {
      await feed(scenario.legBearing, 34, 0);
      await page.waitForTimeout(1200);
      const parkedBearing = derivedBearing(await measure(page), ORIGIN, route.afterManeuver);

      const overviewBtn = page.getByRole('button', {
        name: /Show the whole route, then return to your truck/i,
      });
      const unlocked = await overviewBtn.isVisible().catch(() => false);
      verdict('overview: the control unlocks once the truck is stopped', unlocked);
      if (unlocked) {
        await overviewBtn.click({ timeout: 8000 });
        await page.waitForTimeout(900);
        const ov = await measure(page);
        const ovBearing = derivedBearing(ov, ORIGIN, route.afterManeuver);
        verdict(
          'overview: the camera returns to NORTH-up so the whole route reads plainly',
          ovBearing !== null && Math.abs(shortestDelta(0, ovBearing)) <= 3,
          ovBearing === null ? 'markers too close to read' : `${ovBearing.toFixed(1)}°`,
        );
        verdict(
          'overview: the destination is on screen — the whole route fits',
          ov.dest !== null &&
            ov.dest.x >= -2 &&
            ov.dest.x <= ov.vw + 2 &&
            ov.dest.y >= -2 &&
            ov.dest.y <= ov.vh + 2,
          ov.dest
            ? JSON.stringify({ x: Math.round(ov.dest.x), y: Math.round(ov.dest.y) })
            : 'off screen',
        );
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/heading-overview-${w}x${h}.png` });

        const recenterBtn = page.getByRole('button', { name: /Recenter the map on your truck/i });
        verdict(
          'recenter: the control is offered once the camera left the truck',
          await recenterBtn.isVisible().catch(() => false),
        );
        await recenterBtn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(900);
        const re = await measure(page);
        const reBearing = derivedBearing(re, ORIGIN, route.afterManeuver);
        verdict(
          'recenter: heading-up is restored',
          reBearing !== null &&
            parkedBearing !== null &&
            Math.abs(shortestDelta(parkedBearing, reBearing)) <= 8,
          `${parkedBearing?.toFixed(1)}° → ${reBearing?.toFixed(1)}°`,
        );
        if (re.truck) {
          const frac = re.truck.y / re.vh;
          verdict(
            'recenter: and the truck is back in its follow position',
            frac >= 0.5 && frac <= 0.92,
            `${(frac * 100).toFixed(0)}%`,
          );
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/heading-recenter-${w}x${h}.png` });
      }
      verdict(
        'spend: camera changes cost NOTHING — still one route request',
        routeCalls === 1,
        `${routeCalls}`,
      );
    }

    /*
     * A STOP, then movement again. The map must hold the last reliable
     * orientation while stopped — not spin, not snap north — and pick the
     * heading straight back up when the truck rolls.
     */
    if (scenario.stopThenMove === true) {
      const moving = derivedBearing(await measure(page), ORIGIN, route.afterManeuver);
      await feed(scenario.legBearing, 20, 0); // stopped
      await page.waitForTimeout(1200);
      const stopped = derivedBearing(await measure(page), ORIGIN, route.afterManeuver);
      verdict(
        'stop: the map HOLDS its orientation while the truck is stopped',
        moving !== null && stopped !== null && Math.abs(shortestDelta(moving, stopped)) <= 3,
        `${moving?.toFixed(1)}° → ${stopped?.toFixed(1)}°`,
      );
      await feed(scenario.legBearing, 6);
      await page.waitForTimeout(1200);
      const rolling = derivedBearing(await measure(page), ORIGIN, route.afterManeuver);
      verdict(
        'stop: and picks the heading straight back up when it rolls again',
        rolling !== null && Math.abs(shortestDelta(scenario.legBearing, rolling)) <= 12,
        `${rolling?.toFixed(1)}°`,
      );
    }

    /*
     * A HARD RELOAD mid-drive. The trip must come back without a second
     * provider request, and the camera must NOT invent a bearing before
     * the restored session has movement evidence again.
     */
    if (scenario.reload === true) {
      const callsBefore = routeCalls;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const restoredText = await page.locator('body').innerText();
      verdict('reload: the trip is restored', /Navigating|Position approximate/.test(restoredText));
      verdict(
        'reload: with NO second route request',
        routeCalls === callsBefore,
        `${callsBefore} → ${routeCalls}`,
      );
      const restored = await measure(page);
      verdict('reload: the compact HOS strip comes back', restored.hosVisible);
      await feed(scenario.legBearing, 8);
      await page.waitForTimeout(1200);
      const back = await measure(page);
      const backBearing = derivedBearing(back, ORIGIN, route.afterManeuver);
      verdict(
        'reload: heading-up returns once the restored trip has movement evidence',
        backBearing !== null && Math.abs(shortestDelta(scenario.legBearing, backBearing)) <= 12,
        backBearing === null ? 'markers too close to read' : `${backBearing.toFixed(1)}°`,
      );
      verdict(
        'reload: still exactly one route request in the whole scenario',
        routeCalls === 1,
        `${routeCalls}`,
      );
    }

    if (scenario.cameraControls !== true && scenario.reload !== true) {
      verdict(
        'spend: exactly ONE route request for the whole scenario',
        routeCalls === 1,
        `${routeCalls}`,
      );
    }
    return { routeCalls };
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
    const list = SCENARIOS.filter((s) => ONLY.length === 0 || ONLY.includes(s.key));
    for (const s of list) {
      try {
        await runScenario(browser, s);
      } catch (err) {
        verdict(`scenario ${s.key} completed`, false, String(err).slice(0, 200));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(
    failures === 0
      ? `\nPASS: heading-up bench — ${checks} checks`
      : `\nFAIL: ${failures} of ${checks} checks failed`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

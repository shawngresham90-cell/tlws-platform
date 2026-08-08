/**
 * Mobile road-use measurement for the Navigator driving screen (P8).
 *
 * Everything else in this repo tests the driving screen structurally —
 * "no fixed pixel widths", "single-column primitives". That is as far as
 * a Node harness can honestly go. This drives a REAL browser against a
 * REAL production build, gets the screen into ACTIVE NAVIGATION, and
 * measures what a driver would see at the sizes a phone in a truck
 * actually is, in both orientations.
 *
 * What it measures per viewport:
 *   - horizontal overflow of the document (a driving screen must never
 *     scroll sideways),
 *   - whether the next-maneuver instruction is inside the viewport
 *     WITHOUT scrolling — the one thing that must always be readable,
 *   - the smallest tap target among the always-available driving
 *     controls, against the 48 px floor the safety doc sets,
 *   - the map's visible height, and how much of the screen it gets,
 *   - any element wider than the viewport, named.
 *
 * Playwright is deliberately NOT a committed dependency — this is a
 * measurement tool run by hand, not a CI gate, exactly like the other
 * scripts under scripts/bench.
 *
 * Usage:
 *   NEXT_PUBLIC_NAVIGATOR_ENABLED=true NAVIGATOR_PREVIEW_PASSWORD=<pw> \
 *     npx next build && npx next start -p 3210 &
 *   node scripts/bench/navigator-viewports.mjs --password <pw> [--port 3210]
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from '/home/user/tlws-platform/node_modules/playwright/index.js';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = arg('port', '3210');
const PASSWORD = arg('password');
const BASE = `http://127.0.0.1:${PORT}`;
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}

/** Portrait sizes first, then the same devices on their side. */
const VIEWPORTS = [
  { label: '320x568 portrait', width: 320, height: 568 },
  { label: '360x800 portrait', width: 360, height: 800 },
  { label: '375x812 portrait', width: 375, height: 812 },
  { label: '390x844 portrait', width: 390, height: 844 },
  { label: '428x926 portrait', width: 428, height: 926 },
  { label: '768x1024 portrait', width: 768, height: 1024 },
  { label: '568x320 landscape', width: 568, height: 320 },
  { label: '800x360 landscape', width: 800, height: 360 },
  { label: '844x390 landscape', width: 844, height: 390 },
  { label: '926x428 landscape', width: 926, height: 428 },
];

/** A short synthetic route the mocked endpoint hands back. */
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
      routeId: 'viewport-bench',
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

const MIN_TAP_PX = 48;

async function main() {
  // The container ships a Chromium build that predates the Playwright
  // version installed here, so point at it rather than downloading one.
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

  /**
   * Push 1 Hz position updates. The safety lock will not call the truck
   * STATIONARY without 30 s of sustained sub-3-mph motion, and it cannot
   * derive a speed at all from a single fix — so a static geolocation
   * leaves the screen in UNKNOWN, which is treated as MOVING and locks
   * destination entry. That is the lock working, not a bug, so this walks
   * the real path instead of trying to shortcut it.
   */
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
  let cursorLat = ORIGIN.lat;

  // Through the pilot gate. The password is the one the local server was
  // started with — never a production value.
  await page.goto(`${BASE}/navigator/access?next=/drive`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/navigator/access')) {
    throw new Error('the pilot gate did not accept the password');
  }

  await page.getByRole('button', { name: /Enable location/i }).click();

  // 0.3 m/s is ~0.7 mph: under the 3 mph stationary bar, and moving
  // enough that a speed can be derived at all. 34 s clears the 30 s dwell.
  process.stdout.write('  parking the truck (34 s to satisfy the stationary dwell)…\n');
  await feed(34, 0.3);

  try {
    await page.getByText('Developer: enter coordinates instead').click({ timeout: 20_000 });
  } catch (err) {
    console.error('\n--- page text when the destination form was expected ---');
    console.error((await page.locator('body').innerText()).slice(0, 1600));
    throw err;
  }
  await page.getByLabel('Destination latitude').fill(String(ORIGIN.lat + 6 / MI_PER_DEG_LAT));
  await page.getByLabel('Destination longitude').fill(String(ORIGIN.lng));
  await page.getByRole('button', { name: /Plan validated truck route/i }).click();
  await page.getByRole('button', { name: /^Start navigation$/ }).click({ timeout: 15_000 });

  // Now drive. 27 m/s is ~60 mph; 14 s clears the 10 s moving dwell, so
  // the screen is measured in the state a driver is actually in.
  process.stdout.write('  driving (14 s to satisfy the moving dwell)…\n');
  await feed(14, 27);

  const motion = await page
    .locator('text=/Motion (unknown|—)/i')
    .count()
    .catch(() => 0);
  if (motion > 0) process.stdout.write('  note: screen still reports motion unknown\n');

  const rows = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(900); // let Leaflet re-measure and settle

    const m = await page.evaluate(
      ({ minTap }) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        /**
         * Only what a driver can actually touch counts. The driving screen
         * puts a full-screen map surface over the ordinary page, so the
         * site header and footer are still in the DOM, still have boxes,
         * and are still measurable — and are completely unreachable. A
         * control counts only when the topmost element at its own centre
         * is the control itself.
         */
        const reallyOnTop = (el) => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx < 0 || cy < 0 || cx > vw || cy > vh) return false;
          const hit = document.elementFromPoint(cx, cy);
          return hit !== null && (hit === el || el.contains(hit) || hit.contains(el));
        };

        const visibleRect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            w: Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)),
            h: Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)),
            full: r,
          };
        };

        // Anything genuinely wider than the viewport, named for a report.
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width > vw + 1 && r.height > 0) {
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}=${Math.round(r.width)}px`,
            );
            if (offenders.length >= 3) break;
          }
        }

        const maneuver = document.querySelector('[aria-label="Next maneuver"]');
        // Hierarchy and clipping. The card is capped at 28dvh with
        // overflow-hidden, so on a short screen its lower lines — the road
        // name and the "then …" preview — can vanish with no indication
        // that anything was cut. Measure it rather than assume.
        let card = null;
        if (maneuver) {
          const cr = maneuver.getBoundingClientRect();
          const lines = Array.from(maneuver.querySelectorAll('p')).map((p) => {
            const pr = p.getBoundingClientRect();
            return {
              text: p.textContent.trim().replace(/\s+/g, ' ').slice(0, 34),
              px: Math.round(parseFloat(getComputedStyle(p).fontSize)),
              bottom: Math.round(pr.bottom - cr.top),
              clipped: pr.bottom > cr.bottom + 1,
            };
          });
          card = {
            h: Math.round(cr.height),
            contentH: maneuver.scrollHeight,
            clipped: maneuver.scrollHeight > Math.round(cr.height) + 1,
            lines,
          };
        }
        const maneuverVisible =
          maneuver !== null && visibleRect(maneuver).h > 8 && reallyOnTop(maneuver);

        const map = document.querySelector('[aria-label^="Navigation map"]');
        const mapVis = map ? visibleRect(map) : null;

        // Tap targets: reachable controls only.
        const targets = [];
        for (const el of document.querySelectorAll('button:not([disabled]), a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          if (!reallyOnTop(el)) continue;
          const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 44);
          targets.push({ label, w: Math.round(r.width), h: Math.round(r.height) });
        }
        // Map attribution is a licence requirement and is small by
        // convention everywhere; it is not a driving control and holding
        // it to a 48 px floor would just make the report cry wolf. It is
        // still counted and named, just not treated as a failure.
        const isAttribution = (t) =>
          /leaflet|openstreetmap|opentopomap|mapbox|carto|© /i.test(t.label);
        const undersized = targets.filter((t) => t.h < minTap || t.w < minTap);
        const tooSmall = undersized.filter((t) => !isAttribution(t));
        const smallAttribution = undersized.filter(isAttribution).length;

        // Is the map-first layout actually engaged? If the site footer is
        // reachable, the driver is looking at an ordinary page, not the
        // driving surface — which would make every other number here a
        // measurement of the wrong screen.
        const footerLink = Array.from(document.querySelectorAll('footer a[href]')).find(
          reallyOnTop,
        );

        return {
          docWidth: document.documentElement.scrollWidth,
          vw,
          vh,
          horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
          verticalOverflow: document.documentElement.scrollHeight > vh + 1,
          offenders,
          maneuverPresent: maneuver !== null,
          maneuverVisibleWithoutScrolling: maneuverVisible,
          card,
          maneuverText: maneuver
            ? maneuver.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)
            : null,
          mapHeightOnScreen: mapVis ? Math.round(mapVis.h) : 0,
          mapHeightLaidOut: mapVis ? Math.round(mapVis.full.height) : 0,
          mapShareOfScreen: mapVis ? Math.round((mapVis.h / vh) * 100) : 0,
          mapClippedBy: mapVis ? Math.round(mapVis.full.height - mapVis.h) : 0,
          controlCount: targets.length,
          tooSmall: tooSmall.slice(0, 5),
          smallAttribution,
          footerReachable: footerLink !== undefined,
        };
      },
      { minTap: MIN_TAP_PX },
    );
    rows.push({ vp, m });
  }

  await browser.close();

  console.log(`\nNavigator driving screen — measured in Chromium during ACTIVE navigation\n`);
  console.log(
    '  viewport            h-ovf  v-ovf  maneuver  map-on-screen  map%  clipped  taps  <48px  chrome',
  );
  let failures = 0;
  for (const { vp, m } of rows) {
    const bad =
      m.horizontalOverflow ||
      !m.maneuverVisibleWithoutScrolling ||
      m.tooSmall.length > 0 ||
      m.mapClippedBy > 8 ||
      (m.card && m.card.clipped) ||
      m.footerReachable;
    if (bad) failures += 1;
    console.log(
      `  ${vp.label.padEnd(18)} ${(m.horizontalOverflow ? 'YES' : 'no').padEnd(6)} ` +
        `${(m.verticalOverflow ? 'yes' : 'no').padEnd(6)} ` +
        `${(m.maneuverVisibleWithoutScrolling ? 'yes' : 'NO').padEnd(9)} ` +
        `${String(m.mapHeightOnScreen).padStart(13)} ${String(m.mapShareOfScreen).padStart(4)}% ` +
        `${String(m.mapClippedBy).padStart(8)} ${String(m.controlCount).padStart(5)} ` +
        `${String(m.tooSmall.length).padStart(6)} ${(m.footerReachable ? ' YES' : '  no').padStart(7)}`,
    );
  }

  console.log('\ndetail for anything that failed:');
  let printed = 0;
  for (const { vp, m } of rows) {
    const bad =
      m.horizontalOverflow ||
      !m.maneuverVisibleWithoutScrolling ||
      m.tooSmall.length > 0 ||
      m.mapClippedBy > 8 ||
      (m.card && m.card.clipped) ||
      m.footerReachable;
    if (!bad) continue;
    printed += 1;
    console.log(`  ${vp.label}:`);
    if (m.horizontalOverflow) {
      console.log(
        `    document ${m.docWidth}px in a ${m.vw}px viewport; widest: ${m.offenders.join(', ') || '(none identified)'}`,
      );
    }
    if (!m.maneuverVisibleWithoutScrolling) {
      console.log(
        `    next-maneuver card ${m.maneuverPresent ? 'is present but not visible' : 'is NOT RENDERED'}` +
          (m.maneuverText ? ` — "${m.maneuverText}"` : ''),
      );
    }
    if (m.mapClippedBy > 8) {
      console.log(
        `    map is laid out ${m.mapHeightLaidOut}px tall in a ${m.vh}px viewport — ${m.mapClippedBy}px off-screen`,
      );
    }
    if (m.card && m.card.clipped) {
      console.log(
        `    maneuver card clipped: ${m.card.contentH}px of content in a ${m.card.h}px box`,
      );
      for (const l of m.card.lines) {
        console.log(`      ${l.px}px ${l.clipped ? 'CUT ' : '    '}"${l.text}"`);
      }
    }
    if (m.footerReachable) {
      console.log(
        '    the site footer is reachable: this is the ordinary page, not the driving surface',
      );
    }
    for (const t of m.tooSmall) {
      console.log(`    tap target ${t.w}x${t.h}px (floor ${MIN_TAP_PX}): "${t.label}"`);
    }
  }
  if (printed === 0) console.log('  (nothing failed)');

  console.log(`\n${rows.length - failures}/${rows.length} viewports clean`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

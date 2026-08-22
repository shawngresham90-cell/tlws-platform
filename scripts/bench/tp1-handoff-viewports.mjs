/**
 * TP-1 — the clock-to-parking handoff, measured on a phone.
 *
 * WHY THIS EXISTS BESIDE `trip-planner-viewports.mjs`. That bench walks the
 * whole Plan My Day journey and needs live directory anchors to reach the
 * results screen; without a database it stops at "0 anchors available" and
 * never renders a parking card. This one measures the two surfaces TP-1 adds
 * to the PARKED NAVIGATOR SCREEN, which need no directory data at all — the
 * planned-stop record is seeded directly into storage, exactly as Plan My Day
 * would have written it.
 *
 * So the two are complementary rather than redundant: that one proves the
 * plan can be produced, this one proves the result can be acted on.
 *
 * WHAT IT ASSERTS, at 360 / 390 / 430 px:
 *   - a fresh planned stop renders, and names the stop the driver chose
 *   - both its controls clear the touch floor and sit inside the viewport
 *   - the parked screen never scrolls sideways
 *   - with no plan stored, "Trip plan first?" is offered instead
 *   - PLANNING IS NEVER FORCED: Just Drive dismisses it, it stays dismissed
 *     across a reload, and the destination search underneath is untouched
 *
 *   node scripts/bench/tp1-handoff-viewports.mjs --port 3311 --password <pw>
 *
 * The password is the pilot passcode the server was started with. It is read
 * from an argument and never printed.
 */
import pkg from 'playwright';
const { chromium } = pkg;
function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3311');
const PASSWORD = arg('password');
if (!PASSWORD) {
  console.error('--password is required (the pilot password the server was started with)');
  process.exit(1);
}
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [360, 390, 430];
const HEIGHTS = { 360: 640, 390: 844, 430: 932 };
const TOUCH_FLOOR = 44; // WCAG 2.5.5 AAA is 44px; the repo aims at 48.

const PLANNED = {
  v: 1,
  id: 'stop-1',
  name: 'Sample Truck Plaza',
  position: { lat: 35.05, lng: -85.31 },
  arriveAtMs: Date.now() + 3 * 3600 * 1000,
  clockLeftMin: 65,
  detourMiles: 0.4,
  detourMinutes: 2,
  source: 'TLWS directory',
  plannedAtMs: Date.now(),
  /*
   * The fingerprint of the clocks and truck this stop was planned against.
   * The seeded record must carry the SAME string the Navigator computes live,
   * or it is correctly refused as inputs-changed. That the record must match
   * at all is the point; this is not a convenience.
   *
   * IT CHANGED WITH NAV-ENTRY-1, and the change is the product being right.
   * A fresh profile used to have no truck, so the live fingerprint was
   * `truck:none`. A fresh profile now gets the shipped standard truck, so the
   * live fingerprint names it — and a stop planned for "no truck known" is a
   * stop planned against different inputs. The bench follows the app rather
   * than the app being loosened to accept a stale record.
   *
   * Built from DEFAULT_TRUCK_PROFILE the way `plannedStopInputsFingerprint`
   * builds it: height, width, length to one decimal, then weight, axles,
   * hazmat, and the sorted avoid list (empty here).
   */
  inputsFingerprint: 'clocks:none|truck:13.5,8.5,70.0,80000,5,none,',
};

let pass = 0,
  fail = 0;
const problems = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else {
    fail++;
    problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

for (const w of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: HEIGHTS[w] },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();

  // Unlock the pilot gate exactly as the navigator bench does.
  // NAV-ENTRY-1: the gate is entered at `/drive`; the cockpit is a child of it.
  await page.goto(`${BASE}/drive`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (page.url().includes('/navigator/access')) {
    await page.waitForSelector('input[type="password"]', { timeout: 30_000 });
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/drive/, { timeout: 20_000 }).catch(() => {});
    await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  }
  /*
   * ALWAYS land on the cockpit, not only after an authentication round.
   * `/drive` is the launcher since NAV-ENTRY-1, and a context that reuses a
   * saved session skips the branch above entirely — which left this bench
   * seeding a planned stop and then looking for its card on a page that does
   * not render one.
   */
  await page.goto(`${BASE}/drive/navigate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate((rec) => {
    localStorage.setItem('tlws-navigator-planned-stop-v1', JSON.stringify(rec));
    localStorage.removeItem('tlws-navigator-trip-plan-asked-v2');
  }, PLANNED);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const card = page.locator('[data-planned-stop]');
  const seen = await card.count();
  check(`${w}px: the planned stop card renders`, seen > 0, `count=${seen}`);

  if (seen > 0) {
    const name = await page
      .locator('[data-planned-stop-name]')
      .first()
      .innerText()
      .catch(() => '');
    check(`${w}px: it names the stop the driver chose`, name.includes('Sample Truck Plaza'), name);

    for (const [label, sel] of [
      ['Use this stop', '[data-use-planned-stop]'],
      ['Not this one', '[data-discard-planned-stop]'],
    ]) {
      const el = page.locator(sel).first();
      if ((await el.count()) === 0) {
        check(`${w}px: ${label} exists`, false);
        continue;
      }
      const box = await el.boundingBox();
      check(
        `${w}px: "${label}" meets the touch floor`,
        box && box.height >= TOUCH_FLOOR,
        box ? `h=${Math.round(box.height)}` : 'no box',
      );
      check(
        `${w}px: "${label}" is inside the viewport`,
        box && box.x >= 0 && box.x + box.width <= w + 1,
        box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : 'no box',
      );
    }
  }

  // No horizontal overflow anywhere on the parked screen.
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${w}px: the page does not scroll sideways`, scrollW <= w + 1, `scrollWidth=${scrollW}`);

  // Now the other branch: no planned stop -> the plan-your-stops question.
  await page.evaluate(() => {
    localStorage.removeItem('tlws-navigator-planned-stop-v1');
    localStorage.removeItem('tlws-navigator-trip-plan-asked-v2');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const ask = page.locator('[data-trip-plan-first]');
  const askSeen = await ask.count();
  check(
    `${w}px: the plan-your-stops question is offered when no plan exists`,
    askSeen > 0,
    `count=${askSeen}`,
  );
  if (askSeen > 0) {
    const heading = await ask.first().innerText();
    check(
      `${w}px: it uses the approved wording`,
      /Plan your stops before you drive\?/.test(heading),
      heading.split('\n')[0],
    );
  }

  if (askSeen > 0) {
    for (const [label, sel] of [
      ['Plan My Stops', '[data-plan-my-stops]'],
      ['Just Drive', '[data-just-drive]'],
    ]) {
      const el = page.locator(sel).first();
      const box = await el.boundingBox().catch(() => null);
      check(
        `${w}px: "${label}" meets the touch floor`,
        box && box.height >= TOUCH_FLOOR,
        box ? `h=${Math.round(box.height)}` : 'missing',
      );
    }
    // Planning is never forced: Just Drive dismisses and does not come back.
    await page.locator('[data-just-drive]').first().click();
    await page.waitForTimeout(400);
    check(
      `${w}px: Just Drive dismisses the prompt`,
      (await page.locator('[data-trip-plan-first]').count()) === 0,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    check(
      `${w}px: …and it stays dismissed after a reload of the SAME trip`,
      (await page.locator('[data-trip-plan-first]').count()) === 0,
    );

    /*
     * A DIFFERENT TRIP ASKS AGAIN. Simulated by moving the stored answer onto
     * another trip key — exactly what changing the destination, or finishing
     * the trip, does to it. The per-key rule itself is proved deterministically
     * in the unit harness; this confirms the wiring is real on the rendered
     * screen rather than only in the pure function.
     */
    await page.evaluate(() => {
      localStorage.setItem(
        'tlws-navigator-trip-plan-asked-v2',
        JSON.stringify({ v: 2, answeredForTrip: 'trip:some-other-destination' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    check(
      `${w}px: a different trip asks again`,
      (await page.locator('[data-trip-plan-first]').count()) > 0,
    );
    // The destination search underneath is untouched by any of this.
    check(
      `${w}px: the destination search is still available`,
      (await page.locator('input[type="search"], input[type="text"]').count()) > 0,
    );
  }

  await ctx.close();
}
await browser.close();
console.log(`\nTP-1 mobile viewports: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('failing:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

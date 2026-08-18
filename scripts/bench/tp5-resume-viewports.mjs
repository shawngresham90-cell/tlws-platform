/*
 * TP-5 — resume from the planned stop, measured on a phone.
 *
 * The journeys the harness cannot run: real reloads, real localStorage,
 * the clock-entry gate, and the tap that issues the resumed quote. Same
 * interception architecture as the corridor bench — the two endpoints are
 * served canned responses computed by the REAL engine, the browser runs
 * the real UI, and the network never happens.
 *
 * WHAT IT ASSERTS, at 360 / 390 / 430 px:
 *   - sending a parking stop writes the resume context
 *   - the Continue Trip card survives a RELOAD (R2)
 *   - with clocks from before the stop, the card offers ONLY the
 *     clock-entry door — no continue button exists (R4)
 *   - once clocks are entered after the stop, the continue tap issues a
 *     quote whose origin is the stored stop and whose destination is the
 *     original one, with the still-ahead via and its dwell (R5/R6/R8)
 *   - End Trip clears the context for good (R10)
 *   - buttons clear the 44px touch floor; the screen never scrolls sideways
 *
 *   node scripts/bench/tp5-resume-viewports.mjs --port 3421
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pkg from 'playwright';
const { chromium } = pkg;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = arg('port', '3421');
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [360, 390, 430];
const HEIGHTS = { 360: 640, 390: 844, 430: 932 };
const TOUCH_FLOOR = 44;

const CLOCKS_KEY = 'tlws-navigator-clocks-v1';
const RESUME_KEY = 'tlws-trip-resume-v1';

// ---- canned quotes computed by the real engine -----------------------
const workDir = mkdtempSync(path.join(tmpdir(), 'tp5-bench-'));
const genBundle = path.join(workDir, 'gen.cjs');
const genOut = path.join(workDir, 'quotes.json');
execFileSync('npx', [
  'esbuild',
  'scripts/bench/tp2-corridor-gen.ts',
  '--bundle',
  '--platform=node',
  '--alias:@=./src',
  `--outfile=${genBundle}`,
  '--log-level=error',
]);
execFileSync('node', [genBundle, genOut], { stdio: 'inherit' });
const SCENARIOS = JSON.parse(readFileSync(genOut, 'utf8'));

const PLACES = {
  dalton: {
    id: 'bench-dalton',
    title: 'Dalton, GA',
    address: 'Dalton, GA, United States',
    position: { lat: 34.7698, lng: -84.9702 },
    facility: 'city',
    distanceMi: null,
  },
  atlanta: {
    id: 'bench-atlanta',
    title: 'Atlanta, GA',
    address: 'Atlanta, GA, United States',
    position: { lat: 33.749, lng: -84.388 },
    facility: 'city',
    distanceMi: null,
  },
  macon: {
    id: 'bench-macon',
    title: 'Macon, GA',
    address: 'Macon, GA, United States',
    position: { lat: 32.8407, lng: -83.6324 },
    facility: 'city',
    distanceMi: null,
  },
};

/** A valid clock record for the storage authority, entered at `atMs`. */
const clockRecord = (atMs) =>
  JSON.stringify({
    v: 1,
    entered: {
      drivingMin: 660,
      windowMin: 840,
      untilBreakMin: 480,
      cycleMin: 4200,
      cycleRule: '70/8',
    },
    enteredAtMs: atMs,
    fromFreshShift: false,
  });

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

  let scenario = 'limited';
  let lastQuoteBody = null;
  await page.route('**/api/trip-planner/quote', (route) => {
    try {
      lastQuoteBody = JSON.parse(route.request().postData() ?? 'null');
    } catch {
      lastQuoteBody = null;
    }
    return route.fulfill({ json: SCENARIOS[scenario].quote });
  });
  await page.route('**/api/trip-planner/destination-search**', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const match = Object.entries(PLACES).find(([k]) => q.includes(k));
    return route.fulfill({ json: { ok: true, places: match ? [match[1]] : [] } });
  });

  await page.goto(`${BASE}/trip-planner`, { waitUntil: 'networkidle' });
  // Clocks entered BEFORE the stop will be sent — one hour ago.
  await page.evaluate(
    ([key, rec]) => localStorage.setItem(key, rec),
    [CLOCKS_KEY, clockRecord(Date.now() - 3_600_000)],
  );

  // ---- plan Dalton → (Atlanta, 60 min dwell) → Macon and send a stop --
  const pick = async (slot, query, title) => {
    const box = page.locator(`[data-destination-search="${slot}"]`);
    await box.locator('input').fill(query);
    const result = page.locator('ul[aria-label="Destination search results"] button', {
      hasText: title,
    });
    await result.first().waitFor({ timeout: 10_000 });
    await result.first().click();
  };
  await pick('origin', 'Dalton GA', 'Dalton, GA');
  await pick('destination', 'Macon GA', 'Macon, GA');
  await pick('via', 'Atlanta GA', 'Atlanta, GA');
  await page.locator('[data-via-dwell-preset="60"]').click();

  await page.locator('[data-plan-button]').click();
  const send = page.locator('[data-send-to-navigator]').first();
  await send.waitFor({ timeout: 10_000 });
  await send.click();
  await page.locator('[data-planned-stop-sent]').waitFor({ timeout: 10_000 });
  const stored = await page.evaluate((key) => localStorage.getItem(key), RESUME_KEY);
  check(`${w}px: sending the stop writes the resume context`, stored !== null);
  const storedRecord = stored === null ? null : JSON.parse(stored);
  check(
    `${w}px: the context carries the original destination`,
    storedRecord?.originalDestination?.label === 'Macon, GA',
  );

  // ---- R2: the offer survives a reload -------------------------------
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-trip-resume]').waitFor({ timeout: 10_000 });
  check(
    `${w}px: the Continue Trip card survives reload`,
    (await page.locator('[data-trip-resume]').count()) === 1,
  );
  check(
    `${w}px: the card names the stop and the destination`,
    (await page.locator('[data-resume-to]').innerText()).includes('Macon, GA') &&
      (await page.locator('[data-resume-from]').innerText()).length > 0,
  );
  check(
    `${w}px: the still-ahead via rides along with its dwell`,
    (await page.locator('[data-resume-via]').innerText()).includes('Atlanta, GA') &&
      (await page.locator('[data-resume-via]').innerText()).includes('60 min'),
  );

  // ---- R4: clocks from before the stop cannot continue ----------------
  check(
    `${w}px: stale clocks offer only the clock-entry door`,
    (await page.locator('[data-resume-update-clocks]').count()) === 1 &&
      (await page.locator('[data-resume-continue]').count()) === 0,
  );
  const doorBox = await page.locator('[data-resume-update-clocks]').boundingBox();
  check(
    `${w}px: the clock-entry door meets the touch floor`,
    doorBox !== null && doorBox.height >= TOUCH_FLOOR,
  );

  // ---- the driver enters fresh clocks (in the Navigator) --------------
  await page.evaluate(
    ([key, rec]) => localStorage.setItem(key, rec),
    [CLOCKS_KEY, clockRecord(Date.now() + 1_000)],
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-resume-continue]').waitFor({ timeout: 10_000 });
  const contBox = await page.locator('[data-resume-continue]').boundingBox();
  check(
    `${w}px: fresh clocks unlock the continue tap, at full touch size`,
    contBox !== null && contBox.height >= TOUCH_FLOOR,
  );

  // ---- R5/R6/R8: the tap issues the resumed quote ---------------------
  scenario = 'reachable';
  lastQuoteBody = null;
  await page.locator('[data-resume-continue]').click();
  await page.locator('[data-trip-plan]').waitFor({ timeout: 10_000 });
  check(
    `${w}px: the resumed origin is the stored stop, verbatim`,
    lastQuoteBody !== null &&
      lastQuoteBody.origin?.label === storedRecord?.plannedStop?.label &&
      lastQuoteBody.origin?.position?.lat === storedRecord?.plannedStop?.position?.lat &&
      lastQuoteBody.origin?.position?.lng === storedRecord?.plannedStop?.position?.lng,
    JSON.stringify(lastQuoteBody?.origin),
  );
  check(
    `${w}px: the resumed destination is the original one`,
    lastQuoteBody?.destination?.label === 'Macon, GA',
  );
  check(
    `${w}px: the still-ahead via and its dwell ride the resumed request`,
    lastQuoteBody?.via?.label === 'Atlanta, GA' &&
      lastQuoteBody?.viaDwellMin === 60 &&
      lastQuoteBody?.viaDwellQualifiesForBreak === false,
  );
  check(
    `${w}px: a live plan replaces the card`,
    (await page.locator('[data-trip-resume]').count()) === 0,
  );

  // ---- R10: End Trip clears the context for good ----------------------
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-trip-resume]').waitFor({ timeout: 10_000 });
  const endBox = await page.locator('[data-resume-end-trip]').boundingBox();
  check(`${w}px: End Trip meets the touch floor`, endBox !== null && endBox.height >= TOUCH_FLOOR);
  await page.locator('[data-resume-end-trip]').click();
  await page.waitForTimeout(300);
  check(
    `${w}px: End Trip removes the card and the stored context`,
    (await page.locator('[data-trip-resume]').count()) === 0 &&
      (await page.evaluate((key) => localStorage.getItem(key), RESUME_KEY)) === null,
  );

  // ---- the screen never scrolls sideways ------------------------------
  const overflow = await page.evaluate(
    () => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  );
  check(`${w}px: no horizontal overflow`, overflow <= 0, `overflow=${overflow}px`);

  await ctx.close();
}

await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`TP-5 resume viewports: ${pass} passed, ${fail} failed`);
if (problems.length > 0) {
  console.log('failing:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}

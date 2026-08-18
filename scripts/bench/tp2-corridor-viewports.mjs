/*
 * TP-2 — the corridor trip plan, measured on a phone.
 *
 * WHY INTERCEPTION. The Your Trip Plan section renders from a live quote,
 * which needs HERE routing and directory data — neither exists offline.
 * So this bench intercepts the TWO endpoints the journey touches and
 * serves deterministic fixture data computed by the REAL composeQuote
 * (see tp2-corridor-gen.ts): the browser runs the real UI end-to-end and
 * the network never happens. No database, no providers, no secrets.
 *
 * WHAT IT ASSERTS, at 360 / 390 / 430 px:
 *   - the via picker renders and its controls clear the touch floor
 *   - the driver can search Dalton / Atlanta / Macon and choose each end
 *   - a cycle-limited plan renders chronological events in engine order,
 *     ending at the clock-update boundary with the approved wording
 *   - a fresh-clock plan ends at the Destination with no parking stop
 *   - a multi-break plan (TP-3) renders BOTH breaks chronologically and
 *     the break card notes the further break
 *   - the screen never scrolls sideways
 *
 *   node scripts/bench/tp2-corridor-viewports.mjs --port 3421
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

// ---- generate the canned quote responses with the real engine ---------
const workDir = mkdtempSync(path.join(tmpdir(), 'tp2-bench-'));
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

/** Canned search results per query, shaped as DestinationCandidate. */
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

  // Which canned quote the next Plan tap receives.
  let scenario = 'limited';
  await page.route('**/api/trip-planner/quote', (route) =>
    route.fulfill({ json: SCENARIOS[scenario].quote }),
  );
  await page.route('**/api/trip-planner/destination-search**', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const match = Object.entries(PLACES).find(([k]) => q.includes(k));
    return route.fulfill({ json: { ok: true, places: match ? [match[1]] : [] } });
  });

  await page.goto(`${BASE}/trip-planner`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // ---- the via picker exists and is usable ---------------------------
  const viaSearch = page.locator('[data-destination-search="via"]');
  check(`${w}px: the optional via picker renders`, (await viaSearch.count()) === 1);

  // ---- choose Dalton → Atlanta (via) → Macon -------------------------
  const pick = async (slot, query, title) => {
    const box = page.locator(`[data-destination-search="${slot}"]`);
    await box.locator('input').fill(query);
    const result = page.locator('ul[aria-label="Destination search results"] button', {
      hasText: title,
    });
    await result.first().waitFor({ timeout: 10_000 });
    const bb = await result.first().boundingBox();
    check(
      `${w}px: ${slot} result card meets the touch floor`,
      bb !== null && bb.height >= TOUCH_FLOOR,
      bb ? `h=${Math.round(bb.height)}` : 'no box',
    );
    await result.first().click();
  };
  await pick('origin', 'Dalton GA', 'Dalton, GA');
  await pick('destination', 'Macon GA', 'Macon, GA');
  await pick('via', 'Atlanta GA', 'Atlanta, GA');

  const removeVia = page.locator('[data-remove-via]');
  check(`${w}px: the chosen via can be removed`, (await removeVia.count()) === 1);
  const rb = await removeVia.boundingBox();
  check(
    `${w}px: the remove-via control meets the touch floor`,
    rb !== null && rb.height >= TOUCH_FLOOR,
  );

  // ---- scenario 1: the cycle-limited plan ----------------------------
  await page.locator('[data-plan-button]').click();
  await page.locator('[data-trip-plan]').waitFor({ timeout: 10_000 });
  const limitedKinds = await page
    .locator('[data-trip-event]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-trip-event')));
  check(
    `${w}px: limited plan renders the engine's own event order`,
    limitedKinds.join('>') === SCENARIOS.limited.expectedKinds.join('>'),
    limitedKinds.join('>'),
  );
  check(
    `${w}px: the clock-update boundary wording renders`,
    (await page.locator('[data-trip-clock-update]').innerText()).includes(
      'Update your clocks after this stop',
    ),
  );
  const sendBtn = page.locator('[data-send-to-navigator]').first();
  if ((await sendBtn.count()) > 0) {
    const sb = await sendBtn.boundingBox();
    check(
      `${w}px: Send to Navigator still meets the touch floor beside the plan`,
      sb !== null && sb.height >= TOUCH_FLOOR,
    );
  } else {
    check(`${w}px: parking cards render beside the limited plan`, false, 'no send button');
  }

  // ---- scenario 2: fresh clocks reach Macon --------------------------
  scenario = 'reachable';
  await page.locator('[data-plan-button]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-trip-plan-status="reachable"]').waitFor({ timeout: 10_000 });
  const reachKinds = await page
    .locator('[data-trip-event]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-trip-event')));
  check(
    `${w}px: reachable plan ends at the Destination`,
    reachKinds.join('>') === SCENARIOS.reachable.expectedKinds.join('>') &&
      reachKinds[reachKinds.length - 1] === 'destination',
    reachKinds.join('>'),
  );
  check(
    `${w}px: no parking stop is invented when the drive is coverable`,
    !reachKinds.includes('parking') && !reachKinds.includes('clock-update'),
  );

  // ---- scenario 3: two required breaks (TP-3) ------------------------
  scenario = 'twoBreaks';
  await page.locator('[data-plan-button]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-further-break]').waitFor({ timeout: 10_000 });
  const twoBreakKinds = await page
    .locator('[data-trip-event]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-trip-event')));
  check(
    `${w}px: the multi-break plan renders the engine's own event order`,
    twoBreakKinds.join('>') === SCENARIOS.twoBreaks.expectedKinds.join('>'),
    twoBreakKinds.join('>'),
  );
  check(
    `${w}px: both 30-minute breaks appear chronologically`,
    twoBreakKinds.filter((k) => k === 'break').length >= 2,
  );
  check(
    `${w}px: the break card admits the further break`,
    (await page.locator('[data-further-break]').innerText()).includes('Another 30-minute break'),
  );

  // ---- the screen never scrolls sideways -----------------------------
  const overflow = await page.evaluate(
    () => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  );
  check(`${w}px: no horizontal overflow`, overflow <= 0, `overflow=${overflow}px`);

  await ctx.close();
}

await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`TP-2 corridor viewports: ${pass} passed, ${fail} failed`);
if (problems.length > 0) {
  console.log('failing:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}

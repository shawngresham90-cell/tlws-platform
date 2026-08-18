/*
 * TP-6 — the road-test evidence panel, measured on a phone.
 *
 * WHAT IT ASSERTS, at 360 / 390 / 430 px:
 *   - with no arm flag, the panel simply does not exist (FT1)
 *   - armed, it renders LAST — below the whole planning workflow, never
 *     between the driver and a plan
 *   - the parked-only notice is visible
 *   - outcome chips record, meet the touch floor, and SURVIVE A RELOAD
 *   - a note containing coordinates is stored scrubbed (FT2, in-browser)
 *   - End road test and Delete-all behave, and delete empties storage
 *   - the screen never scrolls sideways
 *
 *   node scripts/bench/tp6-field-test-viewports.mjs --port 3421
 */
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

const ARM_KEY = 'tlws-field-test-arm-v1';
const SESSIONS_KEY = 'tlws-field-test-sessions-v1';

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

  // ---- FT1: unarmed devices see nothing ------------------------------
  await page.goto(`${BASE}/trip-planner`, { waitUntil: 'networkidle' });
  check(
    `${w}px: no arm flag, no panel — the mode does not exist for the public`,
    (await page.locator('[data-field-test-panel]').count()) === 0,
  );

  // ---- armed: the panel appears, last and legible --------------------
  await page.evaluate(
    ([key]) => localStorage.setItem(key, JSON.stringify({ v: 1, armed: true })),
    [ARM_KEY],
  );
  await page.reload({ waitUntil: 'networkidle' });
  const panel = page.locator('[data-field-test-panel]');
  await panel.waitFor({ timeout: 10_000 });
  check(`${w}px: armed, the panel renders`, (await panel.count()) === 1);
  const panelBox = await panel.boundingBox();
  const planBox = await page.locator('[data-plan-button]').boundingBox();
  check(
    `${w}px: the panel sits BELOW the planning workflow`,
    panelBox !== null && planBox !== null && panelBox.y > planBox.y,
  );
  check(
    `${w}px: the parked-only rule is stated on the panel itself`,
    (await page.locator('[data-field-test-parked-notice]').innerText()).includes('safely parked'),
  );

  // ---- start a session, record outcomes ------------------------------
  const start = page.locator('[data-field-test-start]');
  const startBox = await start.boundingBox();
  check(
    `${w}px: Road Test Started meets the touch floor`,
    startBox !== null && startBox.height >= TOUCH_FLOOR,
  );
  await start.click();
  await page.locator('[data-field-test-active]').waitFor({ timeout: 10_000 });

  const chip = page.locator('[data-field-test-chip="parking-outcome:full"]');
  const chipBox = await chip.boundingBox();
  check(
    `${w}px: outcome chips meet the touch floor`,
    chipBox !== null && chipBox.height >= TOUCH_FLOOR,
    chipBox ? `h=${Math.round(chipBox.height)}` : 'no box',
  );
  await chip.click();
  await page.locator('[data-field-test-chip="buffer-outcome:about-right"]').click();
  await page.locator('[data-field-test-chip="eta-variance:10-20m"]').click();
  check(
    `${w}px: recorded chips read back as pressed`,
    (await chip.getAttribute('aria-pressed')) === 'true',
  );

  // ---- a note with coordinates is scrubbed before storage ------------
  await page
    .locator('[data-field-test-note-input]')
    .fill('lot full near 34.7698, -84.9702 — second entrance easier');
  await page.locator('[data-field-test-note-add]').click();
  await page.waitForTimeout(200);
  const stored = await page.evaluate(([key]) => localStorage.getItem(key), [SESSIONS_KEY]);
  check(
    `${w}px: the stored note carries no coordinates (scrubbed at entry)`,
    stored !== null && !stored.includes('34.7698') && stored.includes('second entrance easier'),
  );

  // ---- FT7 in-browser: evidence survives a reload --------------------
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-field-test-active]').waitFor({ timeout: 10_000 });
  check(
    `${w}px: observations survive a reload`,
    (await page
      .locator('[data-field-test-chip="parking-outcome:full"]')
      .getAttribute('aria-pressed')) === 'true',
  );

  // ---- end + delete ---------------------------------------------------
  await page.locator('[data-field-test-end]').click();
  await page.locator('[data-field-test-start]').waitFor({ timeout: 10_000 });
  check(
    `${w}px: ending returns to the start state, evidence kept`,
    (await page.evaluate(([key]) => localStorage.getItem(key), [SESSIONS_KEY])) !== null,
  );
  await page.locator('[data-field-test-delete-all]').click();
  await page.waitForTimeout(200);
  check(
    `${w}px: delete-all removes the panel and every stored record`,
    (await page.locator('[data-field-test-panel]').count()) === 0 &&
      (await page.evaluate(
        ([a, s]) => localStorage.getItem(a) === null && localStorage.getItem(s) === null,
        [ARM_KEY, SESSIONS_KEY],
      )),
  );

  // ---- the screen never scrolls sideways ------------------------------
  const overflow = await page.evaluate(
    () => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
  );
  check(`${w}px: no horizontal overflow`, overflow <= 0, `overflow=${overflow}px`);

  await ctx.close();
}

await browser.close();
console.log(`TP-6 field-test viewports: ${pass} passed, ${fail} failed`);
if (problems.length > 0) {
  console.log('failing:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}

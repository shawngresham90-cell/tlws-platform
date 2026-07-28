/**
 * DRIVER-FIRST NAVIGATION — Playwright verification of the redesign against a
 * real local Next.js server, at the three phone widths the redesign targets:
 * 320px, 375px and 390px. Asserts the things unit tests can't:
 *
 *   - no horizontal overflow on any redesigned screen at any width
 *   - the persistent bottom bar (Parking | Trip Planner | HOS) is present and
 *     tappable (>=48px) on every screen at phone widths, and hidden on desktop
 *   - Parking flow walks State → Interstate → Direction → ordered list, with
 *     the LOW MM / HIGH MM toggle and the never-guess unpositioned section
 *   - Trip Planner opens on step 1 only (clocks hidden until Continue)
 *   - HOS Calculator opens on "What are you checking?" with four modes, and
 *     selecting a mode reveals only that mode's fields
 *
 * Prereq: `npm run build`. Then: node scripts/e2e-driver-first.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3131;
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [320, 375, 390];

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start within ${timeoutMs}ms`);
}

/** True when the page does not scroll sideways (1px tolerance for rounding). */
async function noHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

/** The persistent bottom bar with its three tools, all >=48px tall. */
async function assertBottomBar(page, label) {
  const bar = page.locator('nav[aria-label="Driver tools"]');
  check(`${label}: bottom bar present`, (await bar.count()) === 1);
  const links = bar.locator('a');
  check(`${label}: bottom bar has 3 tools`, (await links.count()) === 3);
  const texts = (await links.allInnerTexts()).join(' ');
  check(
    `${label}: bar labels Parking/Trip Planner/HOS`,
    /parking/i.test(texts) && /trip planner/i.test(texts) && /hos/i.test(texts),
  );
  let minH = Infinity;
  for (const box of await Promise.all((await links.all()).map((l) => l.boundingBox()))) {
    if (box) minH = Math.min(minH, box.height);
  }
  check(`${label}: bar targets >=48px tall`, minH >= 48, minH);
  const fixed = await bar.evaluate((el) => getComputedStyle(el).position);
  check(`${label}: bar is fixed to viewport`, fixed === 'fixed', fixed);
}

// detached → own process group, so the final kill(-pid) reaps the real
// next-server child, not just the npx wrapper (a survivor would squat on the
// port and serve a stale build to the next run).
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
  detached: true,
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

let browser;
try {
  await waitForServer(`${BASE}/directory/parking`);
  // Warm the routes once (cold compile / first ISR fill) before timing-sensitive runs.
  for (const p of ['/directory/parking', '/trip-planner', '/tools/hos-calculator']) {
    await fetch(`${BASE}${p}`).catch(() => {});
  }
  // The remote environment pre-installs Chromium at /opt/pw-browsers; when the
  // playwright package pins a build that isn't present, launch the installed one.
  browser = await chromium.launch(
    existsSync(chromium.executablePath()) ? {} : { executablePath: '/opt/pw-browsers/chromium' },
  );

  for (const width of WIDTHS) {
    const label = `${width}px`;
    const ctx = await browser.newContext({
      viewport: { width, height: 740 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    /* ------------------------------------------------ parking flow, 4 steps */
    // NOTE: this environment's egress policy blocks Supabase, so every data
    // read fails soft to its empty state. The flow's STRUCTURE (routes,
    // pickers, toggle, honest empty states, no overflow, bottom bar) is fully
    // testable offline via fixed URLs; data-driven grids are asserted only
    // when data is actually reachable.
    await page.goto(`${BASE}/directory/parking`, { waitUntil: 'networkidle' });
    check(`${label} parking hub: no horizontal overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} parking hub`);
    check(
      `${label} parking hub: Where-are-you flow section`,
      /where are you\?/i.test(await page.locator('main').innerText()),
    );
    const stateLinkCount = await page.locator('main a[href^="/directory/parking/"]').count();
    if (stateLinkCount === 0) {
      console.log(`note[${label}]: DB unreachable here — state grid empty, using fixed URLs`);
    } else {
      check(`${label} parking hub: state grid rendered`, stateLinkCount > 0);
    }

    // Step 2: interstate picker (GA). With no DB it must show the honest
    // empty state, never a dead-end 500.
    await page.goto(`${BASE}/directory/parking/ga`, { waitUntil: 'networkidle' });
    check(`${label} interstate picker: no overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} interstate picker`);
    const pickerText = await page.locator('main').innerText();
    check(
      `${label} interstate picker: heading or honest empty state`,
      /which interstate\?/i.test(pickerText),
      pickerText.slice(0, 80),
    );
    check(
      `${label} interstate picker: never a blank dead-end`,
      /I-\d/.test(pickerText) || /no interstate-tagged truck parking/i.test(pickerText),
    );

    // Unknown state must 404, not render garbage.
    const bogus = await page.goto(`${BASE}/directory/parking/zz`, { waitUntil: 'networkidle' });
    check(`${label} state validation: /zz is 404`, bogus && bogus.status() === 404);

    // Step 3: direction picker — exactly the two real directions for the
    // route number (I-75 odd → northbound/southbound), pure logic, no DB.
    await page.goto(`${BASE}/directory/parking/ga/i-75`, { waitUntil: 'networkidle' });
    check(`${label} direction picker: no overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} direction picker`);
    const dirLinks = page.locator('main a[href^="/directory/parking/ga/i-75/"]');
    check(`${label} direction picker: exactly 2 directions`, (await dirLinks.count()) === 2);
    const dirText = (await dirLinks.allInnerTexts()).join(' ');
    check(
      `${label} direction picker: I-75 offers north/south only`,
      /northbound/i.test(dirText) && /southbound/i.test(dirText) && !/eastbound/i.test(dirText),
      dirText,
    );
    // Wrong-axis direction for an odd interstate must 404.
    const wrongDir = await page.goto(`${BASE}/directory/parking/ga/i-75/eastbound`, {
      waitUntil: 'networkidle',
    });
    check(`${label} direction validation: I-75 eastbound is 404`, wrongDir?.status() === 404);

    // Step 4: the ordered corridor list.
    await page.goto(`${BASE}/directory/parking/ga/i-75/northbound`, { waitUntil: 'networkidle' });
    check(`${label} corridor list: no overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} corridor list`);
    const toggle = page.getByRole('button', { name: /MM/ });
    check(`${label} corridor list: LOW/HIGH MM toggle present`, (await toggle.count()) === 1);
    const bodyText = await page.locator('main').innerText();
    check(
      `${label} corridor list: honest labels only (no guessed positions)`,
      /truck spaces|Truck spaces unknown|No truck parking|position not verified|No position-verified listings/i.test(
        bodyText,
      ),
    );
    // The toggle flips the order label.
    const before = await toggle.innerText();
    await toggle.click();
    const after = await toggle.innerText();
    check(`${label} corridor list: toggle flips order`, before !== after, `${before}→${after}`);
    // Directions/Details buttons are tappable when listings exist.
    const detailBtns = page.locator('main a', { hasText: /^Details$/ });
    if ((await detailBtns.count()) > 0) {
      const box = await detailBtns.first().boundingBox();
      check(`${label} corridor list: Details >=48px`, box && box.height >= 48, box?.height);
    }

    /* -------------------------------------------------- trip planner wizard */
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'networkidle' });
    check(`${label} planner: no overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} planner`);
    const stepList = await page.locator('ol').first().innerText();
    check(
      `${label} planner: 3-step indicator`,
      /where to/i.test(stepList) && /clocks/i.test(stepList) && /plan/i.test(stepList),
      stepList.slice(0, 80),
    );
    // Step 1 visible, step 2 (clocks) hidden until Continue.
    check(
      `${label} planner: destination field on step 1`,
      (await page.locator('input:visible').count()) > 0,
    );
    const clocksHidden = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('div[hidden]'));
      return els.some((el) => /your clocks right now/i.test(el.textContent || ''));
    });
    check(`${label} planner: clocks hidden on step 1`, clocksHidden);
    const cont = page.getByRole('button', { name: /continue — enter your clocks/i });
    check(`${label} planner: Continue gated until route chosen`, await cont.isDisabled());

    /* ------------------------------------------------- HOS opening screen */
    await page.goto(`${BASE}/tools/hos-calculator`, { waitUntil: 'networkidle' });
    check(`${label} hos: no overflow`, await noHorizontalOverflow(page));
    await assertBottomBar(page, `${label} hos`);
    const hosText = await page.locator('main').innerText();
    check(`${label} hos: asks what are you checking`, /what are you checking/i.test(hosText));
    for (const mode of ['My current clocks', '7/3 split', '8/2 split', 'Full 10-hour break']) {
      check(
        `${label} hos: mode "${mode}" offered`,
        (await page.getByRole('button', { name: mode }).count()) === 1,
      );
    }
    // Selecting a split mode shows only split fields (plus the back control).
    await page.getByRole('button', { name: '7/3 split' }).click();
    await page.waitForTimeout(200);
    const afterPick = await page.locator('main').innerText();
    check(`${label} hos: back control after pick`, /check something else/i.test(afterPick));
    check(`${label} hos: opening menu gone after pick`, !/what are you checking/i.test(afterPick));
    check(`${label} hos: no overflow after mode pick`, await noHorizontalOverflow(page));

    check(`${label}: no console/page errors`, errors.length === 0, errors.slice(0, 4));
    await ctx.close();
  }

  /* ------------------------------------------- desktop: bar must be hidden */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/directory/parking`, { waitUntil: 'networkidle' });
    const visible = await page
      .locator('nav[aria-label="Driver tools"]')
      .isVisible()
      .catch(() => false);
    check('desktop: bottom bar hidden at 1280px', !visible);
    await ctx.close();
  }
} catch (err) {
  failed++;
  console.log('FAIL: e2e harness error', err && err.message ? err.message : err);
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
}

console.log(`\ndriver-first e2e: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

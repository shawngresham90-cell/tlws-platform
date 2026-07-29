/**
 * CAT SCALE DIRECTORY — Playwright verification against a real production
 * build at 320/375/390px. Asserts what unit tests can't:
 *
 *   - Browse Route structure: hub fast-find, interstate picker, direction
 *     picker (two real directions), corridor list with LOW → HIGH toggle,
 *     no false "MM" labels, honest empty/unverified sections, 404s
 *   - Near Me: location requested ONLY on tap; granted → radius chips
 *     (20/50/100/All) and synchronized map+list; denied → manual city/ZIP
 *     fallback with an honest no-match message; NOTHING persisted to
 *     localStorage/sessionStorage/cookies afterward
 *   - keyboard reachability with visible focus
 *   - axe-core: zero serious/critical issues on the new pages
 *   - no horizontal overflow anywhere at any width
 *   - existing Parking / Trip Planner / HOS screens still render with the
 *     bottom bar (regression spot-check; their full suite runs separately)
 *
 * Prereqs: `npm run build`, `npm i --no-save axe-core` (dev-only).
 * Run: node scripts/e2e-cat-scales.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3171;
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [320, 375, 390];
const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

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

async function noHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

async function runAxe(page, label) {
  await page.addScriptTag({ content: AXE_SOURCE });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
    });
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.impact}:${v.id}`);
  });
  check(`${label}: zero serious/critical axe issues`, result.length === 0, result);
}

// detached → own process group so cleanup reaps the real next-server child.
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
  await waitForServer(`${BASE}/directory/cat-scales`);
  for (const p of ['/directory/cat-scales', '/directory/cat-scales/near-me']) {
    await fetch(`${BASE}${p}`).catch(() => {});
  }
  browser = await chromium.launch(
    existsSync(chromium.executablePath()) ? {} : { executablePath: '/opt/pw-browsers/chromium' },
  );

  /* ---------------------------------------- browse route at each width */
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

    // Hub keeps its URL and gains the fast-find section.
    const hub = await page.goto(`${BASE}/directory/cat-scales`, { waitUntil: 'networkidle' });
    check(`${label} hub: 200 at existing URL`, hub?.status() === 200);
    check(`${label} hub: no overflow`, await noHorizontalOverflow(page));
    const hubText = await page.locator('main').innerText();
    check(`${label} hub: fast-find section`, /find a scale fast/i.test(hubText));
    check(
      `${label} hub: near-me entry`,
      (await page.locator('a[href="/directory/cat-scales/near-me"]').count()) >= 1,
    );

    // Interstate picker — honest empty state offline, never a 500.
    await page.goto(`${BASE}/directory/cat-scales/ga`, { waitUntil: 'networkidle' });
    check(`${label} interstate picker: no overflow`, await noHorizontalOverflow(page));
    const pickerText = await page.locator('main').innerText();
    check(`${label} interstate picker: heading`, /which interstate\?/i.test(pickerText));
    check(
      `${label} interstate picker: interstates or honest empty state`,
      /I-\d/.test(pickerText) || /no interstate-tagged cat scale/i.test(pickerText),
    );
    const bogus = await page.goto(`${BASE}/directory/cat-scales/zz`, { waitUntil: 'networkidle' });
    check(`${label} state validation: /zz is 404`, bogus?.status() === 404);
    // Canadian provinces are not US runtime surface.
    const ab = await page.goto(`${BASE}/directory/cat-scales/ab`, { waitUntil: 'networkidle' });
    check(`${label} canada exclusion: /ab is 404`, ab?.status() === 404);

    // Direction picker: exactly the two real directions.
    await page.goto(`${BASE}/directory/cat-scales/ga/i-75`, { waitUntil: 'networkidle' });
    const dirLinks = page.locator('main a[href^="/directory/cat-scales/ga/i-75/"]');
    check(`${label} direction picker: exactly 2 directions`, (await dirLinks.count()) === 2);
    const wrongDir = await page.goto(`${BASE}/directory/cat-scales/ga/i-75/eastbound`, {
      waitUntil: 'networkidle',
    });
    check(`${label} direction validation: I-75 eastbound 404`, wrongDir?.status() === 404);

    // Corridor list: toggle, honest wording, no MM invention.
    await page.goto(`${BASE}/directory/cat-scales/ga/i-75/northbound`, {
      waitUntil: 'networkidle',
    });
    check(`${label} corridor: no overflow`, await noHorizontalOverflow(page));
    const toggle = page.getByRole('button', { name: /LOW → HIGH|HIGH → LOW/ });
    check(`${label} corridor: order toggle present`, (await toggle.count()) === 1);
    const before = await toggle.innerText();
    await toggle.click();
    check(`${label} corridor: toggle flips`, (await toggle.innerText()) !== before);
    const corridorText = await page.locator('main').innerText();
    check(`${label} corridor: no false MM label`, !/\bMM \d/.test(corridorText));

    check(`${label}: no console/page errors`, errors.length === 0, errors.slice(0, 4));
    await ctx.close();
  }

  /* ------------------------------- near me: permission GRANTED (390px) */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 740 },
      hasTouch: true,
      isMobile: true,
      geolocation: { latitude: 33.749, longitude: -84.388 },
      permissions: ['geolocation'],
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/directory/cat-scales/near-me`, { waitUntil: 'networkidle' });
    check('near-me: no overflow', await noHorizontalOverflow(page));
    const pageText = await page.locator('main').innerText();
    check('near-me: privacy promise shown', /never stored or tracked/i.test(pageText));

    await runAxe(page, 'near-me (pre-location)');

    await page.getByRole('button', { name: /use my location/i }).click();
    await page.waitForTimeout(600);
    const radiusChips = page.getByRole('button', { name: /^(20 mi|50 mi|100 mi|All)$/ });
    check('near-me: 20/50/100/All radius chips appear', (await radiusChips.count()) === 4);
    check(
      'near-me: 50 mi selected by default',
      (await page.getByRole('button', { name: '50 mi' }).getAttribute('aria-pressed')) === 'true',
    );
    await page.getByRole('button', { name: '20 mi' }).click();
    check(
      'near-me: radius switch works',
      (await page.getByRole('button', { name: '20 mi' }).getAttribute('aria-pressed')) === 'true',
    );
    const statusText = await page.locator('main').innerText();
    check(
      'near-me: distances labeled approximate straight-line',
      /approximate straight-line distance/i.test(statusText),
    );
    check(
      'near-me: accessible list region present',
      (await page.locator('ul[aria-label="Nearest CAT Scales"], p.placard').count()) >= 1,
    );

    // Privacy: NOTHING persisted after using location.
    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    check(
      'near-me: zero location persistence (localStorage/sessionStorage/cookies)',
      storage.local === 0 && storage.session === 0 && storage.cookie === '',
      storage,
    );

    await runAxe(page, 'near-me (post-location)');
    await ctx.close();
  }

  /* ------------------------------- near me: permission DENIED (375px) */
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 740 },
      hasTouch: true,
      isMobile: true,
      permissions: [], // geolocation NOT granted → prompt auto-denied headlessly
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/directory/cat-scales/near-me`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /use my location/i }).click();
    const denied = page.locator('[role="status"]', { hasText: /denied|type a city/i });
    await denied.first().waitFor({ state: 'visible', timeout: 15000 });
    check('near-me denied: fallback guidance appears', (await denied.count()) >= 1);

    // Manual fallback path — offline DB means an honest no-match message,
    // never invented coordinates.
    await page.locator('#near-me-query').fill('Atlanta, GA');
    await page.getByRole('button', { name: /^Go$/ }).click();
    await page.waitForTimeout(300);
    const afterManual = await page.locator('main').innerText();
    check(
      'near-me denied: manual input answers (results or honest no-match)',
      /within \d+ miles|never guess coordinates/i.test(afterManual),
      afterManual.slice(0, 160),
    );
    await ctx.close();
  }

  /* --------------------------------- keyboard reachability + visible focus */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/directory/cat-scales/near-me`, { waitUntil: 'networkidle' });
    const reached = await page.evaluate(() => {
      const hits = [];
      let el = document.body;
      for (let i = 0; i < 40 && hits.length < 3; i++) {
        // Walk the tab order like a keyboard user.
        const focusables = Array.from(
          document.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])'),
        );
        const idx = focusables.indexOf(document.activeElement);
        const next = focusables[idx + 1] ?? focusables[0];
        next?.focus();
        el = document.activeElement;
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT')) {
          hits.push(el.tagName);
        }
      }
      return hits;
    });
    check('keyboard: interactive elements reachable in tab order', reached.length >= 3, reached);
    // Focus ring is styled via focus-visible ring classes on every control.
    const focusRing = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /use my location/i.test(b.textContent || ''),
      );
      return btn ? btn.className.includes('focus-visible:ring') : false;
    });
    check('keyboard: visible focus styling on primary control', focusRing);
    await ctx.close();
  }

  /* ------------------------ axe on the browse-route pages (390px) */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 740 } });
    const page = await ctx.newPage();
    for (const p of ['/directory/cat-scales', '/directory/cat-scales/ga/i-75/northbound']) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
      await runAxe(page, `axe ${p}`);
    }
    await ctx.close();
  }

  /* ------------------- regression spot-check: existing tools unchanged */
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 740 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    for (const [p, marker] of [
      ['/directory/parking', /where are you\?/i],
      ['/trip-planner', /where to\?/i],
      ['/tools/hos-calculator', /what are you checking\?/i],
    ]) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
      const text = await page.locator('main').innerText();
      check(`regression ${p}: signature content present`, marker.test(text));
      check(
        `regression ${p}: bottom bar present`,
        (await page.locator('nav[aria-label="Driver tools"]').count()) === 1,
      );
      check(`regression ${p}: no overflow`, await noHorizontalOverflow(page));
    }
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

console.log(`\ncat-scales e2e: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

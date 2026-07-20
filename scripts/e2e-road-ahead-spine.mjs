/**
 * THE ROAD AHEAD — WebGL truck-spine tier verification (Playwright, real
 * headless Chromium with software WebGL). Confirms the capability ladder:
 *   - desktop-class (fine pointer, WebGL) upgrades to the 'full' tier and mounts
 *     the spine <canvas> behind the page;
 *   - a touch/mobile context stays on 'lite' (no canvas, no three.js);
 *   - reduced motion stays 'lite'.
 * Also screenshots the 3D drive and asserts no console errors.
 *
 * Prereq: npm run build. Then: node scripts/e2e-road-ahead-spine.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3127;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.SHOT_DIR || '/tmp';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

async function waitHydrated(page) {
  for (let i = 0; i < 60; i++) {
    const v = await page.getAttribute('[data-ra-hydrated]', 'data-ra-hydrated').catch(() => null);
    if (v === 'true') return true;
    await page.waitForTimeout(250);
  }
  throw new Error('page did not hydrate (data-ra-hydrated) within 15s');
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

let browser;
try {
  await waitForServer(`${BASE}/road-ahead`);
  // Warm the route so the first real navigation is not a cold compile.
  await fetch(`${BASE}/road-ahead`).catch(() => {});
  browser = await chromium.launch();

  /* ------------------------------------------- desktop-class → full tier */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e)));
    // A client-side exception replaces the page with Next's error screen.
    const crashed = () =>
      page
        .locator('text=Application error')
        .count()
        .then((n) => n > 0);

    await page.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitHydrated(page);
    // The tier upgrades on requestIdleCallback; give it a moment, then poll.
    let tier = 'lite';
    for (let i = 0; i < 40; i++) {
      tier = await page.getAttribute('[data-ra-tier]', 'data-ra-tier');
      if (tier === 'full') break;
      await page.waitForTimeout(250);
    }
    check('desktop: capability tier upgrades to full', tier === 'full', tier);
    // HARD REQUIREMENT: a spine render error must never take the page down — the
    // error boundary drops to the lite scenes instead of Next's crash screen.
    await page.waitForTimeout(1200);
    check('desktop: page never shows the crash screen', !(await crashed()));
    // The spine mounts a WebGL <canvas> behind the page.
    await page.waitForSelector('canvas', { timeout: 8000 }).catch(() => {});
    const canvasCount = await page.locator('canvas').count();
    check('desktop: spine canvas mounted', canvasCount >= 1, canvasCount);
    // R3F already owns the canvas' WebGL context; probing getContext() with a
    // different type would itself log a browser error, so just confirm the
    // canvas was sized and rendered into (non-zero backing store).
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c && c.width > 0 && c.height > 0;
    });
    check('desktop: spine canvas rendered (non-zero backing store)', drawn, drawn);

    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/ra-spine-desktop.png` });
    // Scroll to the end so the truck reaches the school + dawn.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/ra-spine-dawn.png` });

    check('desktop: no console/page errors', errors.length === 0, errors.slice(0, 4));
    await ctx.close();
  }

  /* ------------------------------------------------ mobile/touch → lite */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitHydrated(page);
    await page.waitForTimeout(1200);
    const tier = await page.getAttribute('[data-ra-tier]', 'data-ra-tier');
    check('mobile: stays on lite tier (no WebGL)', tier === 'lite', tier);
    check('mobile: no spine canvas', (await page.locator('canvas').count()) === 0);
    await ctx.close();
  }

  /* ---------------------------------------------- reduced motion → lite */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitHydrated(page);
    await page.waitForTimeout(1200);
    const tier = await page.getAttribute('[data-ra-tier]', 'data-ra-tier');
    check('reduced-motion: stays on lite tier', tier === 'lite', tier);
    check('reduced-motion: no spine canvas', (await page.locator('canvas').count()) === 0);
    await ctx.close();
  }
} catch (err) {
  failed++;
  console.log('FAIL: spine harness error', err && err.message ? err.message : err);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

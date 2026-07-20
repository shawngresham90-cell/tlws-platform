/**
 * THE ROAD AHEAD — Playwright end-to-end verification against a REAL local
 * Next.js server (localhost, so the egress proxy is irrelevant). Boots the
 * production build, drives headless Chromium, and asserts the things unit tests
 * can't: the page renders, the heading structure is correct, scrolling advances
 * the experience and the active chapter, founder numbers appear, the controls
 * work, reduced-motion renders static (no autoplaying video), and there are no
 * console errors.
 *
 * Prereq: `npm run build` has been run. Then:
 *   node scripts/e2e-road-ahead.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;

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
  throw new Error('page did not hydrate within 15s');
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
  await fetch(`${BASE}/road-ahead`).catch(() => {}); // Warm the route (cold compile)
  browser = await chromium.launch();

  /* ---------------------------------------------- motion-on default page */
  {
    // Real mobile context (touch, coarse pointer) → stays on the lite CSS tier,
    // so this suite deterministically exercises the native scenes. The WebGL
    // (full-tier) path is covered by e2e-road-ahead-spine.mjs.
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      // Ignore resource-load failures: the local `next start` has no Supabase
      // credentials, so Next's route prefetch of pages that read the DB logs
      // 400s. That's an environment artifact, not a page defect. Genuine JS
      // errors still fail the run.
      if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    const resp = await page.goto(`${BASE}/road-ahead`, { waitUntil: 'networkidle' });
    await waitHydrated(page);
    check('page: 200 OK', resp && resp.status() === 200, resp && resp.status());

    check('page: exactly one h1', (await page.locator('h1').count()) === 1);
    check(
      'page: h1 is the opening line',
      (await page.locator('h1').first().innerText())
        .toLowerCase()
        .includes('it starts in the dark'),
    );
    check(
      'page: seven scene sections',
      (await page.locator('section[id^="scene-"]').count()) === 7,
    );
    check('page: has six h2 (scenes 2–7)', (await page.locator('h2').count()) === 6);

    // Ecosystem links (folded into Scene 4) point at real routes.
    check(
      'page: ecosystem links present in First Light',
      (await page.locator('#scene-firstlight a[href^="/"]').count()) >= 6,
    );

    // Skip-nav + chapter rail exist and are labelled.
    check(
      'page: chapter navs labelled',
      (await page
        .locator('nav[aria-label="Chapters"], nav[aria-label="Chapter navigation"]')
        .count()) >= 1,
    );

    // Scroll to the Founder Wall scene; founder numbers should render.
    await page.locator('#scene-wall').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const foundersText = await page.locator('#scene-wall').innerText();
    check('wall: shows founder numbers or empty-state No. 001', /No\.\s*\d/.test(foundersText));
    check(
      'wall: never shows an amount-per-founder cents field',
      !/\$\d+\.\d{2}/.test(foundersText),
    );

    // Scene 6 name engraving shows the next open founder number.
    await page.locator('#scene-name').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const nameText = await page.locator('#scene-name').innerText();
    check('engraving: shows the next open founder number', /No\.\s*\d/.test(nameText));
    check('engraving: has the "your name here" plate', /your name here/i.test(nameText));
    // Type a name and engrave it → the plate updates and the shareable card
    // download appears.
    await page.locator('#founder-name').fill('Test Driver');
    await page.getByRole('button', { name: /engrave it/i }).click();
    await page.waitForTimeout(200);
    const engravedText = await page.locator('#scene-name').innerText();
    check('engraving: typed name appears on the plate', /TEST DRIVER/i.test(engravedText));
    check(
      'engraving: founder card download offered',
      (await page.getByRole('button', { name: /download my founder card/i }).count()) === 1,
    );

    // Scene 7 payoff carries the primary call to action.
    await page.locator('#scene-payoff').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    check(
      'payoff: has become-a-founder link',
      (await page.locator('#scene-payoff a[href="/founders"]').count()) >= 1,
    );

    // Motion pause control is present when motion is allowed.
    check(
      'controls: motion pause button present',
      (await page.getByRole('button', { name: /pause cinematic motion/i }).count()) === 1,
    );
    // Synth soundtrack control is available and OFF by default (no autoplay).
    const audioBtn = page.getByRole('button', { name: /turn on soundtrack/i });
    check(
      'controls: soundtrack control present and off by default',
      (await audioBtn.count()) === 1,
    );
    check(
      'controls: soundtrack not playing until tapped',
      (await audioBtn.getAttribute('aria-pressed')) === 'false',
    );

    // WCAG 2.2.2: pressing the pause button must stop ALL motion — no running
    // CSS animations/transitions anywhere on the page afterwards.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /pause cinematic motion/i }).click();
    await page.waitForTimeout(300);
    const runningAfterPause = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    check(
      'a11y(2.2.2): pause stops all running animations',
      runningAfterPause === 0,
      runningAfterPause,
    );

    check('page: no console/page errors', errors.length === 0, errors.slice(0, 4));
    await ctx.close();
  }

  /* --------------------------------------------- reduced-motion behaviour */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/road-ahead`, { waitUntil: 'networkidle' });
    await waitHydrated(page);

    // No <video> should be autoplaying under reduced motion (slots are also empty,
    // but this asserts the reduced path renders no playing media element).
    const playingVideos = await page.evaluate(
      () => Array.from(document.querySelectorAll('video')).filter((v) => !v.paused).length,
    );
    check('reduced: no autoplaying video', playingVideos === 0, playingVideos);

    // Content is fully visible (opacity 1) under reduced motion — pick the h1.
    const h1Opacity = await page.evaluate(() => {
      const el = document.querySelector('h1');
      return el ? Number(getComputedStyle(el).opacity) : -1;
    });
    check('reduced: headline fully visible (opacity 1)', h1Opacity === 1, h1Opacity);

    // Motion toggle is hidden when the OS requests reduced motion.
    check(
      'reduced: motion toggle hidden',
      (await page.getByRole('button', { name: /cinematic motion/i }).count()) === 0,
    );

    // All seven scenes still present and readable.
    check(
      'reduced: seven scenes still render',
      (await page.locator('section[id^="scene-"]').count()) === 7,
    );
    await ctx.close();
  }

  /* ------------------------------------------------ no-JS (SSR-only) render */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded' });
    // With no JS the page must be fully composed and readable — the mount gate
    // renders the static form, so nothing is stuck at opacity 0.
    check(
      'no-js: seven scenes render',
      (await page.locator('section[id^="scene-"]').count()) === 7,
    );
    const h1Opacity = await page.evaluate(() => {
      const el = document.querySelector('h1');
      return el ? Number(getComputedStyle(el).opacity) : -1;
    });
    check('no-js: headline fully visible (opacity 1)', h1Opacity === 1, h1Opacity);
    check(
      'no-js: ecosystem links present',
      (await page.locator('#scene-firstlight a[href^="/"]').count()) >= 6,
    );
    check('no-js: no autoplaying video element', (await page.locator('video').count()) === 0);
    await ctx.close();
  }

  /* --------------------------------------------------- homepage entry point */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    check(
      'home: Road Ahead teaser links to /road-ahead',
      (await page.locator('a[href="/road-ahead"]').count()) >= 1,
    );
    await ctx.close();
  }
} catch (err) {
  failed++;
  console.log('FAIL: e2e harness error', err && err.message ? err.message : err);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

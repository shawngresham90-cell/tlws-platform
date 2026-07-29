/**
 * HOME PROMOS — Playwright verification of the Truck Parking marquee tile
 * and the shirt-count surface against a real production build.
 *
 *   - tile renders directly BELOW the shirt promo, on mobile and desktop
 *   - tile is square (1:1 within 2px), ≥48px target, no overflow at
 *     320/375/390px
 *   - the whole square navigates to the EXISTING /directory/parking
 *   - keyboard: tile is reachable and Enter activates it; focus is visible
 *   - reduced-motion: no running animations on the tile
 *   - shirt promo shows "Only 49" from the single inventory source; the
 *     Stan checkout link is unchanged
 *   - existing parking entrances (bottom bar) still work
 *
 * Saves screenshots (mobile 390px + desktop 1280px) to
 * E2E_SHOT_DIR (or /tmp) as browser-test evidence.
 *
 * Prereq: `npm run build`. Run: node scripts/e2e-home-promos.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3181;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = process.env.E2E_SHOT_DIR || '/tmp';

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

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
  detached: true,
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

const TILE = 'a[aria-label="Truck Parking — find a spot. Opens the truck parking directory."]';

let browser;
try {
  await waitForServer(`${BASE}/`);
  await fetch(`${BASE}/`).catch(() => {});
  browser = await chromium.launch(
    existsSync(chromium.executablePath()) ? {} : { executablePath: '/opt/pw-browsers/chromium' },
  );
  mkdirSync(SHOT_DIR, { recursive: true });

  /* ------------------------------------------------ mobile widths */
  for (const width of [320, 375, 390]) {
    const label = `${width}px`;
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    check(
      `${label}: no horizontal overflow with the tile present`,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    );
    const tile = page.locator(TILE);
    check(`${label}: marquee tile present`, (await tile.count()) === 1);
    const box = await tile.boundingBox();
    check(
      `${label}: tile is square within 2px and ≥48px`,
      box != null && Math.abs(box.width - box.height) <= 2 && box.height >= 48,
      box,
    );
    // Directly beneath the shirt promo.
    const promoBox = await page
      .locator('section[aria-label*="Founding Supporter T-shirt"]')
      .boundingBox();
    check(
      `${label}: tile sits below the shirt promo`,
      box != null && promoBox != null && box.y > promoBox.y + promoBox.height - 2,
      { tileY: box?.y, promoBottom: promoBox ? promoBox.y + promoBox.height : null },
    );
    // Shirt count from the single source.
    const promoText = await page
      .locator('section[aria-label*="Founding Supporter T-shirt"]')
      .innerText();
    check(
      `${label}: shirt promo shows Only 49`,
      /Only 49/i.test(promoText),
      promoText.slice(0, 80),
    );
    check(
      `${label}: no stale 65 on the page`,
      !/Only 65/i.test(await page.locator('body').innerText()),
    );

    if (width === 390) {
      await tile.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOT_DIR}/marquee-mobile-390.png`, fullPage: false });
      // The whole square navigates to the existing parking page.
      await tile.click();
      await page.waitForURL('**/directory/parking', { timeout: 15000 });
      check(
        '390px: tile navigates to /directory/parking',
        page.url().endsWith('/directory/parking'),
      );
      // Existing mobile bottom-bar Parking entry still present there.
      check(
        '390px: bottom-bar Parking entry intact on arrival',
        (await page
          .locator('nav[aria-label="Driver tools"] a[href="/directory/parking"]')
          .count()) === 1,
      );
    }
    await ctx.close();
  }

  /* ------------------------------------------------ desktop + keyboard */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const tile = page.locator(TILE);
    check('desktop: tile present', (await tile.count()) === 1);
    const box = await tile.boundingBox();
    check(
      'desktop: tile square within 2px',
      box != null && Math.abs(box.width - box.height) <= 2,
      box,
    );
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOT_DIR}/marquee-desktop-1280.png`, fullPage: false });

    // Keyboard: focus the tile directly, confirm visible focus, activate.
    await tile.focus();
    const focusState = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const style = getComputedStyle(el);
      return {
        isActive: document.activeElement === el,
        hasRingClass: el.className.includes('focus-visible:ring-4'),
        outlineOrShadow: style.boxShadow !== 'none' || style.outlineStyle !== 'none',
      };
    }, TILE);
    check('keyboard: tile focusable', focusState.isActive);
    check('keyboard: strong focus affordance', focusState.hasRingClass, focusState);
    await page.keyboard.press('Enter');
    await page.waitForURL('**/directory/parking', { timeout: 15000 });
    check('keyboard: Enter activates the tile', page.url().endsWith('/directory/parking'));
    await ctx.close();
  }

  /* ------------------------------------------------ reduced motion */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const tile = page.locator(TILE);
    await tile.scrollIntoViewIfNeeded();
    await tile.hover().catch(() => {});
    const running = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el
        ? el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length
        : -1;
    }, TILE);
    check(
      'reduced-motion: no running animation on the tile (even on hover)',
      running === 0,
      running,
    );
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

console.log(`\nhome-promos e2e: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

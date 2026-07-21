import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3125;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.SHOT_DIR || '/tmp';
// Env override lets this run against the pre-installed browser in sandboxes.
const EXECUTABLE = process.env.PW_CHROMIUM || undefined;

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
let failure = null;
try {
  await waitForServer(`${BASE}/books`);
  browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});

  const titles = [
    'The Trucker’s Carnivore Cookbook',
    'The DOT Survival Guide',
    'Defensive Driving For Truck Drivers',
    'Discipline Over Everything',
    'Broken But Built',
    'Meth Is the Devil’s Poison',
  ];
  // Books that ship a real cover image (Defensive Driving intentionally has none).
  const coverAlts = [
    'The Trucker’s Carnivore Cookbook — book cover',
    'The DOT Survival Guide — book cover',
    'Discipline Over Everything — book cover',
    'Broken But Built — book cover',
    'Meth Is the Devil’s Poison — book cover',
  ];

  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE}/books`, { waitUntil: 'load' });

    // Cover images are lazy (only the featured book is priority). Scroll the
    // page in steps so each enters the viewport and next/image fetches it,
    // then wait until every cover <img> has actually decoded.
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(
      () => {
        const covers = [...document.querySelectorAll('img[alt$="book cover"]')];
        return covers.length >= 5 && covers.every((i) => i.complete && i.naturalWidth > 0);
      },
      { timeout: 30000 },
    );

    const body = await page.textContent('body');
    for (const t of titles) if (!body.includes(t)) throw new Error(`MISSING title (${label}): ${t}`);

    const buyLinks = await page.locator('a:has-text("Buy on Amazon")').count();
    if (buyLinks !== 6) throw new Error(`expected 6 Buy on Amazon links, got ${buyLinks} (${label})`);

    // Assert each real cover is a loaded <img>, not the typographic fallback.
    for (const alt of coverAlts) {
      const img = page.locator(`img[alt="${alt}"]`);
      if ((await img.count()) !== 1) throw new Error(`cover <img> missing (${label}): ${alt}`);
      const natural = await img.evaluate((el) => el.naturalWidth);
      if (!natural || natural < 1) throw new Error(`cover did not load (${label}): ${alt}`);
    }

    await page.screenshot({ path: `${OUT}/books-${label}.png`, fullPage: true });

    await page.goto(`${BASE}/#books`, { waitUntil: 'load' });
    const section = page.locator('#books');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await section.screenshot({ path: `${OUT}/home-books-${label}.png` });

    console.log(`${label}: 6/6 titles, ${buyLinks} buy links, ${coverAlts.length} covers decoded`);
    await page.close();
  }
  console.log('screenshots written; all covers verified rendering');
} catch (e) {
  failure = e;
  console.error('VERIFY FAILED:', e.message);
} finally {
  await browser?.close();
  server.kill('SIGKILL');
}
process.exit(failure ? 1 : 0);

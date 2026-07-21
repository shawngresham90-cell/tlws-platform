import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3125;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.SHOT_DIR || '/tmp';

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
  await waitForServer(`${BASE}/books`);
  browser = await chromium.launch();

  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${BASE}/books`, { waitUntil: 'load' });
    await page.screenshot({ path: `${OUT}/books-${label}.png`, fullPage: true });

    await page.goto(`${BASE}/#books`, { waitUntil: 'load' });
    const section = page.locator('#books');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await section.screenshot({ path: `${OUT}/home-books-${label}.png` });

    // Sanity assertions: all four real titles present on /books.
    await page.goto(`${BASE}/books`, { waitUntil: 'load' });
    const body = await page.textContent('body');
    const titles = [
      'The Trucker’s Carnivore Cookbook',
      'The DOT Survival Guide',
      'Defensive Driving For Truck Drivers',
      'Discipline Over Everything',
      'Broken But Built',
      'Meth Is the Devil’s Poison',
    ];
    for (const t of titles) {
      if (!body.includes(t)) throw new Error(`MISSING on /books (${label}): ${t}`);
    }
    const buyLinks = await page.locator('a:has-text("Buy on Amazon")').count();
    if (buyLinks !== 6) throw new Error(`expected 6 Buy on Amazon links, got ${buyLinks}`);
    console.log(`${label}: ${titles.length}/${titles.length} titles render, ${buyLinks} buy links`);
    await page.close();
  }
  console.log('screenshots written');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

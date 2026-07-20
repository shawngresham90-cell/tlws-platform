import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 3124;
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
  await waitForServer(`${BASE}/road-ahead`);
  browser = await chromium.launch();

  // Desktop opening
  const d = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await d.newPage();
  await dp.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dp.waitForTimeout(600);
  await dp.screenshot({ path: `${OUT}/ra-night.png` });

  await dp.evaluate(() => document.querySelector('#scene-firstlight').scrollIntoView());
  await dp.waitForTimeout(700);
  await dp.screenshot({ path: `${OUT}/ra-firstlight.png` });

  await dp.evaluate(() => document.querySelector('#scene-wall').scrollIntoView());
  await dp.waitForTimeout(700);
  await dp.screenshot({ path: `${OUT}/ra-wall.png` });

  await dp.evaluate(() => document.querySelector('#scene-name').scrollIntoView());
  await dp.waitForTimeout(700);
  await dp.screenshot({ path: `${OUT}/ra-engraving.png` });

  // Mobile opening
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/road-ahead`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${OUT}/ra-mobile-night.png` });

  console.log('screenshots written to', OUT);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

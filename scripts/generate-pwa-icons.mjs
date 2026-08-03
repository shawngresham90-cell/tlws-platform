/**
 * One-shot generator for the PWA icon set in public/icons/.
 *
 * The mark is NOT new branding: it reproduces the existing approved favicon
 * (src/app/icon.tsx) at installable sizes — "TL" in a heavy sans on the
 * favicon's dark surface, with the thumbnail-yellow period that ties the
 * mark to the YouTube identity. Same three colors, same composition.
 *
 * Maskable variants render the same mark smaller so it survives the ~80%
 * circular safe zone Android applies to adaptive icons; the background
 * bleeds to every edge as the spec requires.
 *
 * Run (icons are committed — rerun only if the favicon design changes):
 *   node scripts/generate-pwa-icons.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

// Colors copied verbatim from src/app/icon.tsx — do not restyle here.
const BG = '#0E0E0E';
const FG = '#F5F5F5';
const PERIOD = '#FFEB00';

const ICONS = [
  { file: 'icon-192.png', size: 192, fontRatio: 0.56 },
  { file: 'icon-512.png', size: 512, fontRatio: 0.56 },
  // Safe-zone: keep the mark inside the central 80% for adaptive masks.
  { file: 'icon-maskable-192.png', size: 192, fontRatio: 0.4 },
  { file: 'icon-maskable-512.png', size: 512, fontRatio: 0.4 },
  // iOS home-screen icon (apple-touch-icon); iOS applies its own rounding.
  // Moved to src/app/apple-icon.png after generation — the Next file
  // convention there injects the <link rel="apple-touch-icon"> automatically.
  { file: 'apple-icon.png', size: 180, fontRatio: 0.56 },
];

const page = (size, fontRatio) => `<!doctype html>
<meta charset="utf-8">
<body style="margin:0">
  <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
              background:${BG};color:${FG};font-family:sans-serif;font-weight:800;
              font-size:${Math.round(size * fontRatio)}px;letter-spacing:-0.02em;">
    TL<span style="color:${PERIOD}">.</span>
  </div>
</body>`;

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const tab = await browser.newPage({ viewport: { width: 600, height: 600 } });

for (const { file, size, fontRatio } of ICONS) {
  await tab.setContent(page(size, fontRatio));
  await tab.locator('div').screenshot({ path: `public/icons/${file}` });
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}

await browser.close();

/**
 * Heading-up feasibility probe — the measurement behind
 * docs/operations/navigator-heading-up-blocker.md.
 *
 * Two questions, answered against the INSTALLED leaflet package (the
 * exact renderer the Navigator ships):
 *
 *   1. Does Leaflet expose any map-bearing / rotation API?  (No.)
 *   2. If the container is CSS-rotated instead — the "cheap" fake the
 *      final milestone explicitly forbids — what measurably breaks?
 *      (Coordinate math desynchronizes: latLngToContainerPoint disagrees
 *      with the marker's real screen position by ~168 px at 45°; and a
 *      drag straight UP moves the map center SOUTH.)
 *
 * Nothing leaves the machine: the map uses a blank in-memory tile layer,
 * no network, no keys. Playwright is installed ad hoc like the other
 * bench scripts:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *   node scripts/bench/navigator-rotation-probe.mjs
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import pkg from 'playwright';
const { chromium } = pkg;
import { readFileSync } from 'node:fs';

const leafletJs = readFileSync('node_modules/leaflet/dist/leaflet-src.js', 'utf8');
const leafletCss = readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 600 } });
await page.setContent('<div id="m" style="position:absolute;inset:0"></div>');
await page.addStyleTag({ content: leafletCss });
await page.addScriptTag({ content: leafletJs });
// No tile network: a blank tile layer, so nothing loads externally.
await page.evaluate(() => {
  window.map = L.map('m', { zoomControl: false, attributionControl: false }).setView([35, -85], 13);
  const Blank = L.TileLayer.extend({
    createTile: function () {
      const t = document.createElement('div');
      t.style.background = '#333';
      return t;
    },
  });
  new Blank().addTo(window.map);
  window.marker = L.marker([35, -85]).addTo(window.map);
  window.line = L.polyline([
    [35, -85],
    [35.01, -85],
  ]).addTo(window.map);
});
await page.waitForTimeout(400);

// --- 1. native rotation API? ----------------------------------------------
const api = await page.evaluate(() => ({
  hasBearing: typeof window.map.setBearing === 'function' || 'bearing' in window.map.options,
  keys: Object.keys(window.map.__proto__).filter((k) => /bearing|rotat/i.test(k)),
  leafletVersion: L.version,
}));
console.log('native rotation API:', JSON.stringify(api));

// --- 2. CSS-rotate the container and measure what breaks ------------------
await page.evaluate(() => {
  const c = window.map.getContainer();
  c.style.transform = 'rotate(45deg)';
  c.style.transformOrigin = '50% 50%';
});
await page.waitForTimeout(200);

// 2a. Does Leaflet's own coordinate math know about the rotation?
const mathCheck = await page.evaluate(() => {
  const marker = window.marker;
  // Where Leaflet THINKS the marker is in container coords:
  const lp = window.map.latLngToContainerPoint(marker.getLatLng());
  // Where the marker ACTUALLY is on screen:
  const r = marker._icon.getBoundingClientRect();
  const cRect = window.map.getContainer().getBoundingClientRect();
  const actualX = r.left + r.width / 2 - cRect.left;
  const actualY = r.top + r.height - cRect.top; // icon anchor is bottom-center
  return {
    leafletSays: { x: Math.round(lp.x), y: Math.round(lp.y) },
    screenIs: { x: Math.round(actualX), y: Math.round(actualY) },
  };
});
console.log('marker: leaflet coords vs real screen position:', JSON.stringify(mathCheck));

// 2b. Does dragging move the map in the direction of the finger?
const dragCheck = await page.evaluate(async () => {
  const start = window.map.getCenter();
  const c = window.map.getContainer();
  const rect = c.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const ev = (type, x, y) =>
    c.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  ev('mousedown', cx, cy);
  document.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy - 100 }),
  );
  document.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy - 100 }),
  );
  document.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy - 100 }),
  );
  await new Promise((r) => setTimeout(r, 300));
  const end = window.map.getCenter();
  return {
    dLat: Number((end.lat - start.lat).toFixed(6)),
    dLng: Number((end.lng - start.lng).toFixed(6)),
  };
});
console.log('drag straight UP on a 45-deg rotated map -> center delta:', JSON.stringify(dragCheck));
console.log('  (unrotated, dragging up should move center NORTH only: dLat>0, dLng==0)');

await browser.close();

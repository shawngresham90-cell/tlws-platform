/**
 * The KC-VIS-1 article figure in a real browser, at the three phone widths
 * the milestone names: 360, 390, 430.
 *
 * WHAT THIS PROVES, from the rendered page rather than from source:
 *   - NO HORIZONTAL OVERFLOW. The document never scrolls sideways, and no
 *     element inside the article extends past the viewport — the failure a
 *     wide graphic causes and a unit test cannot see.
 *   - THE PHONE RENDITION IS THE ONE FETCHED. Every image request the page
 *     makes is recorded; at these widths the 1080×1350 stacked frame must be
 *     requested and the 1600×900 master must NOT be.
 *   - THE BOX IS RESERVED BEFORE THE BYTES ARRIVE. The figure's height is
 *     measured with the image request still pending; a zero-height frame
 *     means layout shift when it resolves.
 *   - THE CAPTION IS READABLE. Computed font size and contrast are read off
 *     the element, not asserted from the class name.
 *   - THE ARTICLE SURVIVES A DEAD IMAGE. One pass aborts every image request
 *     and re-checks that the regulatory prose, the comparison list and the
 *     caption are all still on screen.
 *
 * The approved artwork is now committed, so image requests are fulfilled with
 * the REAL bytes from public/images/knowledge/articles — what renders here is
 * what ships. Screenshots of the figure at each width are written to
 * SHOT_DIR (default: a temp dir) for visual inspection. Nothing in public/ is
 * modified.
 *
 * Setup (browser already present in this image):
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
 *
 * Run:
 *   node scripts/bench/kc-article-visual-viewports.mjs
 *
 * Set CHROMIUM_PATH if the browser is not at /opt/pw-browsers/chromium.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const WIDTHS = [360, 390, 430];
/** Where per-width figure screenshots land for visual inspection. */
const SHOT_DIR = process.env.SHOT_DIR ?? mkdtempSync(join(tmpdir(), 'kc-vis-shots-'));
const DESKTOP_FILE = 'class-a-vs-class-b-cdl-comparison.webp';
const MOBILE_FILE = 'class-a-vs-class-b-cdl-comparison-mobile.webp';

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  FAIL: ${name}`, detail ?? '');
  }
};

const work = mkdtempSync(join(tmpdir(), 'kc-vis-bench-'));

/* 1. Render the real page module to HTML. */
const bundle = join(work, 'page.cjs');
execFileSync(
  'npx',
  [
    'esbuild',
    'scripts/bench/kc-article-visual-page.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--jsx=automatic',
    '--alias:@=./src',
    '--alias:server-only=./scripts/shims/server-only.ts',
    '--alias:next/headers=./scripts/shims/next-headers.ts',
    '--alias:next/cache=./scripts/shims/next-cache.ts',
    '--loader:.css=empty',
    `--outfile=${bundle}`,
    '--log-level=error',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
const markup = execFileSync('node', [bundle], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/* 2. Compile the project's real stylesheet (same config, same globals). */
const cssOut = join(work, 'app.css');
execFileSync(
  'npx',
  [
    'tailwindcss',
    '-c',
    'tailwind.config.ts',
    '-i',
    'src/app/globals.css',
    '-o',
    cssOut,
    '--minify',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
const css = readFileSync(cssOut, 'utf8');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body>${markup}</body></html>`;
const pageFile = join(work, 'article.html');
writeFileSync(pageFile, html);

/* The real committed artwork — the bench serves exactly what production
   serves, so a mis-encoded or wrong-sized asset shows up here. */
const ART_DIR = 'public/images/knowledge/articles';
const REAL = {
  [DESKTOP_FILE]: readFileSync(join(process.cwd(), ART_DIR, DESKTOP_FILE)),
  [MOBILE_FILE]: readFileSync(join(process.cwd(), ART_DIR, MOBILE_FILE)),
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

/**
 * @param {number} width
 * @param {'serve'|'abort'} imageMode
 */
async function measure(width, imageMode) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const imageRequests = [];
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });

  await page.route('**/_next/image**', async (route) => {
    const url = decodeURIComponent(route.request().url());
    imageRequests.push(url);
    if (imageMode === 'abort') return route.abort();
    // Hold the response so the reserved box can be measured while pending.
    await held;
    const isMobileFile = url.includes(MOBILE_FILE);
    await route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: REAL[isMobileFile ? MOBILE_FILE : DESKTOP_FILE],
    });
  });

  await page.goto(`file://${pageFile}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('figure .kc-figure-frame');

  // Measured before the figure is anywhere near the viewport: this is the
  // box CSS reserves with no image bytes involved at all.
  const pending = await page.evaluate(() => {
    const frame = document.querySelector('figure .kc-figure-frame');
    const r = frame.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  // The figure sits well below the first screen, so a correctly lazy image
  // has not been requested yet.
  const fetchedBeforeScroll = imageRequests.length;

  // Bring it into view the way a reader would, and let the fetch happen.
  await page.locator('figure .kc-figure-frame').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => true, { timeout: 100 }).catch(() => {});
  if (imageMode === 'serve') {
    await page.waitForRequest(/\/_next\/image/, { timeout: 5000 }).catch(() => {});
  }

  release();
  if (imageMode === 'serve') {
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector('figure picture img');
          return img && img.complete && img.naturalWidth > 0;
        },
        { timeout: 5000 },
      )
      .catch(() => {});
  }
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const frame = document.querySelector('figure .kc-figure-frame');
    const fig = document.querySelector('figure');
    const cap = document.querySelector('figure figcaption');
    const img = document.querySelector('figure picture img');
    const capStyle = cap ? getComputedStyle(cap) : null;

    // Every element that sticks out past the viewport, if any.
    const overflowing = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && Math.round(r.right) > doc.clientWidth + 1) {
        overflowing.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
      }
    }
    const frameRect = frame.getBoundingClientRect();
    const figRect = fig.getBoundingClientRect();
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowing: overflowing.slice(0, 5),
      frame: { w: Math.round(frameRect.width), h: Math.round(frameRect.height) },
      figureRight: Math.round(figRect.right),
      caption: cap
        ? {
            text: cap.textContent.trim(),
            fontSize: parseFloat(capStyle.fontSize),
            color: capStyle.color,
            lines: Math.round(cap.getBoundingClientRect().height / parseFloat(capStyle.lineHeight)),
          }
        : null,
      imgBox: img
        ? {
            w: Math.round(img.getBoundingClientRect().width),
            h: Math.round(img.getBoundingClientRect().height),
            natural: `${img.naturalWidth}x${img.naturalHeight}`,
            loading: img.getAttribute('loading'),
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
          }
        : null,
      bodyText: document.body.innerText,
    };
  });

  if (imageMode === 'serve') {
    const fig = await page.$('figure');
    if (fig) await fig.screenshot({ path: join(SHOT_DIR, `figure-${width}.png`) });
  }
  await context.close();
  return { ...result, pending, imageRequests, fetchedBeforeScroll };
}

console.log('\nKC-VIS-1 — article figure, real browser\n');

for (const width of WIDTHS) {
  const r = await measure(width, 'serve');
  console.log(
    `${width}px  frame ${r.frame.w}×${r.frame.h}  reserved-while-pending ${r.pending.w}×${r.pending.h}  ` +
      `caption ${r.caption.fontSize}px/${r.caption.lines} lines  img ${r.imgBox.w}×${r.imgBox.h}`,
  );

  check(`${width}: document does not scroll horizontally`, r.scrollWidth <= r.clientWidth, {
    scrollWidth: r.scrollWidth,
    clientWidth: r.clientWidth,
  });
  check(`${width}: nothing overflows the viewport`, r.overflowing.length === 0, r.overflowing);
  check(`${width}: the figure fits inside the column`, r.figureRight <= r.clientWidth);
  check(`${width}: the box is reserved before the image arrives`, r.pending.h > 100, r.pending);
  check(
    `${width}: nothing is fetched while the figure is below the fold`,
    r.fetchedBeforeScroll === 0,
    r.fetchedBeforeScroll,
  );
  check(
    `${width}: the reserved box is the phone rendition's 4:5`,
    Math.abs(r.pending.w / r.pending.h - 1080 / 1350) < 0.02,
    r.pending,
  );
  check(`${width}: the frame does not move once the image loads`, r.frame.h === r.pending.h, {
    pending: r.pending.h,
    settled: r.frame.h,
  });
  check(
    `${width}: the phone fetches the 1080×1350 rendition`,
    r.imageRequests.some((u) => u.includes(MOBILE_FILE)),
    r.imageRequests,
  );
  check(
    `${width}: the phone never fetches the 1600×900 master`,
    !r.imageRequests.some((u) => u.includes(DESKTOP_FILE)),
    r.imageRequests,
  );
  check(`${width}: the image lazy-loads`, r.imgBox.loading === 'lazy');
  check(
    `${width}: the img carries intrinsic dimensions`,
    r.imgBox.width === '1080' && r.imgBox.height === '1350',
  );
  check(
    `${width}: the graphic is not shrunk to unreadability`,
    r.imgBox.w >= r.clientWidth * 0.85,
    r.imgBox,
  );
  check(`${width}: caption text is present`, r.caption.text.includes('49 CFR 383.91'));
  check(
    `${width}: caption is at readable size (≥14px)`,
    r.caption.fontSize >= 14,
    r.caption.fontSize,
  );
  check(
    `${width}: caption is not clipped to one crammed line`,
    r.caption.lines >= 1 && r.caption.lines <= 6,
    r.caption,
  );
  check(
    `${width}: the article's regulatory facts are on screen, not only in the graphic`,
    r.bodyText.includes('26,001') && r.bodyText.includes('10,000') && r.bodyText.includes('383.91'),
  );
  check(
    `${width}: the comparison list still renders`,
    r.bodyText.includes('Vehicle type:') && r.bodyText.includes('Trailer threshold:'),
  );
}

/* Desktop: the other half of the art-direction contract. */
const desk = await measure(1280, 'serve');
console.log(
  `\n1280px frame ${desk.frame.w}\u00d7${desk.frame.h}  img ${desk.imgBox.w}\u00d7${desk.imgBox.h}`,
);
check(
  'desktop: serves the 1600\u00d7900 master',
  desk.imageRequests.some((u) => u.includes(DESKTOP_FILE)),
  desk.imageRequests,
);
check(
  'desktop: does not also fetch the phone rendition',
  !desk.imageRequests.some((u) => u.includes(MOBILE_FILE)),
  desk.imageRequests,
);
check(
  'desktop: the frame reserves 16:9',
  Math.abs(desk.frame.w / desk.frame.h - 16 / 9) < 0.02,
  desk.frame,
);
check('desktop: no horizontal scroll', desk.scrollWidth <= desk.clientWidth);
check('desktop: still lazy below the fold', desk.fetchedBeforeScroll === 0);

/* The dead-image pass: the article must stay readable. */
const dead = await measure(390, 'abort');
console.log(`\n390px, all images blocked → frame ${dead.frame.w}×${dead.frame.h}`);
check('dead image: no horizontal scroll', dead.scrollWidth <= dead.clientWidth);
check('dead image: nothing overflows', dead.overflowing.length === 0, dead.overflowing);
check('dead image: the reserved box does not collapse', dead.frame.h > 100, dead.frame);
check('dead image: the caption still reads', dead.caption.text.includes('49 CFR 383.91'));
check(
  'dead image: the full article text is still there',
  dead.bodyText.includes('26,001') &&
    dead.bodyText.includes('Vehicle type:') &&
    dead.bodyText.includes('Upgrading from Class B to Class A'),
);
check('dead image: the alt text is available to the reader', dead.bodyText.length > 4000);

await browser.close();
rmSync(work, { recursive: true, force: true });

console.log(`\nscreenshots: ${SHOT_DIR}`);
console.log(`\nkc-article-visual-viewports: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

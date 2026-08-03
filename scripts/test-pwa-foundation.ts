/**
 * Offline tests for the PWA foundation: manifest, icons, service worker,
 * route policy, offline shell, and lifecycle wiring.
 *
 * The service worker is plain JS in public/ and cannot import the TypeScript
 * policy module, so the two carry duplicate literals by construction. The
 * parity checks here are what make that duplication safe: change the policy
 * in src/lib/pwa/route-policy.ts without carrying it into public/sw.js (or
 * vice versa) and this harness fails.
 *
 * Safety assertions mirror the milestone's hard rules: no caching of
 * /api/, /admin or /go/; no cached page HTML ever (network-only navigations);
 * no skipWaiting at install time; offline shell self-contained and explicit
 * that live road data and navigation do not work offline.
 *
 * Run:
 *   npx esbuild scripts/test-pwa-foundation.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-pwa-foundation.cjs && node /tmp/test-pwa-foundation.cjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import manifest from '@/app/manifest';
import {
  NEVER_HANDLE_PREFIXES,
  DYNAMIC_LIVE_PREFIXES,
  CACHEABLE_ASSET_PREFIXES,
  PRECACHE_URLS,
  classifyRoute,
  isCacheableAsset,
} from '@/lib/pwa/route-policy';
import { shouldRegisterServiceWorker, isUpdateReady } from '@/lib/pwa/lifecycle';
import { InstallCard } from '@/components/pwa/InstallCard';
import tailwindConfig from '../tailwind.config';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const ROOT = process.cwd();
const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
const offline = readFileSync(join(ROOT, 'public/offline.html'), 'utf8');
// Safety greps must run against code, not the worker's own documentation —
// the header comment legitimately *mentions* skipWaiting and clients.claim.
const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ----------------------------------------------------------- manifest */
{
  const m = manifest();
  check('manifest: standalone display', m.display === 'standalone', m.display);
  check('manifest: start_url and scope are root', m.start_url === '/' && m.scope === '/');
  check(
    'manifest: short name fits Android launcher (≤12 chars)',
    (m.short_name ?? '').length <= 12,
  );

  const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<
    string,
    string | Record<string, string>
  >;
  const asphalt = (colors.asphalt as Record<string, string>).DEFAULT;
  check('manifest: theme color is the asphalt token', m.theme_color === asphalt, m.theme_color);
  check(
    'manifest: background color is the asphalt token',
    m.background_color === asphalt,
    m.background_color,
  );

  const icons = m.icons ?? [];
  check('manifest: has 192 + 512 in both any and maskable', icons.length === 4, icons);
  for (const icon of icons) {
    const src = String(icon.src);
    check(`manifest: ${src} exists in public/`, existsSync(join(ROOT, 'public', src)));
    // PNG IHDR: width/height are big-endian uint32 at byte offsets 16/20.
    const buf = readFileSync(join(ROOT, 'public', src));
    const side = Number(String(icon.sizes).split('x')[0]);
    check(
      `manifest: ${src} pixels match declared ${icon.sizes}`,
      buf.readUInt32BE(16) === side && buf.readUInt32BE(20) === side,
      `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`,
    );
  }
  check(
    'manifest: apple touch icon ships via file convention',
    existsSync(join(ROOT, 'src/app/apple-icon.png')),
  );
}

/* -------------------------------------- policy ↔ worker literal parity */
{
  for (const prefix of NEVER_HANDLE_PREFIXES) {
    check(`sw parity: never-handle '${prefix}' present in sw.js`, sw.includes(`'${prefix}'`));
  }
  for (const prefix of CACHEABLE_ASSET_PREFIXES) {
    check(`sw parity: asset prefix '${prefix}' present in sw.js`, sw.includes(`'${prefix}'`));
  }
  for (const url of PRECACHE_URLS) {
    check(`sw parity: precache '${url}' present in sw.js`, sw.includes(`'${url}'`));
    check(`sw parity: precache '${url}' exists in public/`, existsSync(join(ROOT, 'public', url)));
  }

  // The worker must not carry prefixes the policy module doesn't know about.
  const swNever = sw.match(/NEVER_HANDLE_PREFIXES = \[([^\]]*)\]/)?.[1] ?? '';
  const swNeverList = [...swNever.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  check(
    'sw parity: never-handle lists are identical',
    JSON.stringify(swNeverList) === JSON.stringify([...NEVER_HANDLE_PREFIXES]),
    swNeverList,
  );
  const swAssets = sw.match(/CACHEABLE_ASSET_PREFIXES = \[([^\]]*)\]/)?.[1] ?? '';
  const swAssetList = [...swAssets.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  check(
    'sw parity: cacheable-asset lists are identical',
    JSON.stringify(swAssetList) === JSON.stringify([...CACHEABLE_ASSET_PREFIXES]),
    swAssetList,
  );
}

/* ------------------------------------------------- worker safety rules */
{
  check('sw safety: ignores non-GET requests', sw.includes("request.method !== 'GET'"));
  check(
    'sw safety: ignores cross-origin requests',
    sw.includes('url.origin !== self.location.origin'),
  );
  check(
    'sw safety: navigations are network-first with only the offline shell as fallback',
    /mode === 'navigate'[\s\S]{0,200}fetch\(request\)\.catch\(\(\) => caches\.match\('\/offline\.html'\)\)/.test(
      sw,
    ),
  );
  // No page HTML is ever written to a cache: the only cache.put lives in the
  // asset path, and the navigate branch contains none.
  check('sw safety: exactly one cache.put (the asset path)', sw.match(/cache\.put/g)?.length === 1);
  check(
    'sw safety: only clean same-origin responses are cached',
    sw.includes("response.ok && response.type === 'basic'"),
  );
  check(
    'sw safety: asset cache is bounded',
    /ASSET_CACHE_MAX = \d+/.test(sw) && sw.includes('trimCache'),
  );
  check(
    'sw safety: no skipWaiting at install — only via explicit message',
    !/'install'[\s\S]{0,300}skipWaiting/.test(swCode) && /SKIP_WAITING/.test(swCode),
  );
  check('sw safety: never claims running clients', !swCode.includes('clients.claim'));
  check(
    'sw safety: versioned caches with cleanup',
    sw.includes("VERSION = 'v") && sw.includes('caches.delete'),
  );
}

/* --------------------------------------------------- route classification */
{
  const cases: Array<[string, ReturnType<typeof classifyRoute>]> = [
    ['/api/trip-planner/plan', 'private-sensitive'],
    ['/api/lead', 'private-sensitive'],
    ['/admin', 'private-sensitive'],
    ['/admin/directory/import', 'private-sensitive'],
    ['/go/loves', 'private-sensitive'],
    ['/trip-planner', 'dynamic-live'],
    ['/directory/parking/ga', 'dynamic-live'],
    ['/tools/hos-calculator', 'dynamic-live'],
    ['/', 'public-static'],
    ['/academy', 'public-static'],
    ['/knowledge/dot-compliance', 'public-static'],
    ['/store', 'public-static'],
  ];
  for (const [path, expected] of cases) {
    check(`classify: ${path} → ${expected}`, classifyRoute(path) === expected, classifyRoute(path));
  }
  check('classify: dynamic-live prefixes stay declared', DYNAMIC_LIVE_PREFIXES.length >= 3);

  check(
    'assets: hashed build output is cacheable',
    isCacheableAsset('/_next/static/chunks/app.js'),
  );
  check('assets: fonts are cacheable', isCacheableAsset('/fonts/anton-400.woff2'));
  check('assets: API is never a cacheable asset', !isCacheableAsset('/api/lead'));
  check('assets: page HTML is never a cacheable asset', !isCacheableAsset('/trip-planner'));
}

/* -------------------------------------------------------- offline shell */
{
  check('offline: is noindex', offline.includes('name="robots" content="noindex"'));
  check(
    'offline: no external requests (self-contained shell)',
    !/(?:src|href)="https?:\/\//.test(offline),
  );
  const refs = [...offline.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  check(
    'offline: every referenced asset is precached by the worker',
    refs.every((r) => (PRECACHE_URLS as readonly string[]).includes(r)),
    refs,
  );
  check(
    'offline: states the navigation limit in plain words',
    offline.includes('does not provide offline truck navigation'),
  );
  check(
    'offline: warns that live road data is not saved stale',
    /parking/i.test(offline) && /weather/i.test(offline) && /Hours of\s+Service/i.test(offline),
  );
  check('offline: carries the brand mark', offline.includes('Trucking Life with Shawn'));
}

/* ------------------------------------------------------------ lifecycle */
{
  const base = { supportsServiceWorker: true, isSecureContext: true, isProduction: true };
  check('lifecycle: registers in a production secure context', shouldRegisterServiceWorker(base));
  check(
    'lifecycle: never registers in dev',
    !shouldRegisterServiceWorker({ ...base, isProduction: false }),
  );
  check(
    'lifecycle: never registers without the API',
    !shouldRegisterServiceWorker({ ...base, supportsServiceWorker: false }),
  );
  check(
    'lifecycle: never registers in an insecure context',
    !shouldRegisterServiceWorker({ ...base, isSecureContext: false }),
  );

  check('lifecycle: installed-behind-a-controller is an update', isUpdateReady('installed', true));
  check('lifecycle: first install is not an update', !isUpdateReady('installed', false));
  check('lifecycle: activating state is not update-ready', !isUpdateReady('activating', true));
}

/* ----------------------------------------------------- component wiring */
{
  check(
    'install card: renders nothing before client detection runs',
    renderToStaticMarkup(createElement(InstallCard)) === '',
  );

  const layout = readFileSync(join(ROOT, 'src/app/layout.tsx'), 'utf8');
  check('layout: mounts PwaLifecycle once', layout.includes('<PwaLifecycle />'));
  check('layout: sets the asphalt theme color', /themeColor: '#141414'/.test(layout));

  const apps = readFileSync(join(ROOT, 'src/app/(marketing)/apps/page.tsx'), 'utf8');
  check('apps page: hosts the install card', apps.includes('<InstallCard />'));

  const netlify = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
  check(
    'netlify: sw.js must revalidate at the CDN',
    /for = "\/sw\.js"[\s\S]{0,200}max-age=0, must-revalidate/.test(netlify),
  );
  check(
    'netlify: offline shell must revalidate at the CDN',
    /for = "\/offline\.html"[\s\S]{0,200}max-age=0, must-revalidate/.test(netlify),
  );
}

console.log(`\npwa-foundation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

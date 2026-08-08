/**
 * Network degradation on the driving surface (Block 2, priority G).
 *
 * Two things are covered. What the driver is TOLD when the network goes
 * away mid-trip — which is one specific thing, not the site-wide banner's
 * much broader claim — and the layering defect that let a site-wide
 * banner paint over the maneuver card.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-network-degraded.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-net.cjs && node /tmp/test-net.cjs
 */
import { readFileSync } from 'node:fs';
import { offlineNotice, OFFLINE_NAVIGATING, OFFLINE_IDLE } from '@/lib/navigator/network-status';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ===================== what the driver is told ==========================
{
  check(
    'online says nothing at all',
    offlineNotice({ online: true, navigating: true }) === null &&
      offlineNotice({ online: true, navigating: false }) === null,
  );
  // navigator.onLine is optimistic: false is reliable, true is not, and
  // unknown is not a claim either way.
  check(
    'unknown network says nothing — silence beats a guess',
    offlineNotice({ online: null, navigating: true }) === null,
  );
  check(
    'offline mid-trip names the ONE capability that is lost',
    offlineNotice({ online: false, navigating: true }) === OFFLINE_NAVIGATING &&
      /Rerouting is unavailable/.test(OFFLINE_NAVIGATING),
  );
  // The route, its geometry and its maneuvers were downloaded at planning
  // time and live in memory; matching, off-route detection and arrival are
  // pure. Telling a driver at 65 mph that guidance is gone would be false.
  check(
    'offline mid-trip does NOT claim guidance has stopped',
    /guidance continues/.test(OFFLINE_NAVIGATING) &&
      !/parking|weather|Hours of Service/i.test(OFFLINE_NAVIGATING),
  );
  check(
    'offline before a trip says the thing that is actually true then',
    offlineNotice({ online: false, navigating: false }) === OFFLINE_IDLE &&
      /new route cannot be planned/.test(OFFLINE_IDLE),
  );
}

// ===================== the layering defect ==============================
{
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  const pwa = readFileSync('src/components/pwa/PwaLifecycle.tsx', 'utf8');
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');

  // The conditions that made the defect: the site banner is fixed at
  // top-16 with z-40, and it is mounted AFTER {children} in the root
  // layout. At equal z-index, later-in-DOM wins — so it painted over the
  // driving surface 64 px down, which is where the maneuver card is.
  const bannerZ40 = /fixed inset-x-0 top-16 z-40/.test(pwa);
  const bannerAfterChildren = layout.indexOf('<PwaLifecycle') > layout.indexOf('{children}');
  check('layering: the site banner is still fixed at top-16 z-40', bannerZ40);
  check('layering: it is still mounted after {children}', bannerAfterChildren);
  check(
    'layering: so the driving surface must sit ABOVE it',
    /fixed inset-0 z-50 overflow-y-auto/.test(screen),
  );
  check(
    'layering: and the old equal-z shell class is gone',
    !/fixed inset-0 z-40 overflow-y-auto/.test(screen),
  );

  // Having taken the whole viewport, the surface owes the driver its own
  // network line — otherwise covering the banner would just hide the
  // information.
  check(
    'layering: the driving surface says its own thing about the network',
    screen.includes('offlineText={offlineNotice({ online, navigating: fullScreen })}') &&
      screen.includes('{offlineText}'),
  );
  check(
    'layering: the notice is a live region, like the status line',
    /\{offlineText \?/.test(screen) && screen.includes('aria-live="polite"'),
  );
  check(
    'layering: it is a SEPARATE line — it never replaces the status text',
    screen.includes('{statusText[view.status]}'),
  );
  check(
    'layering: online/offline listeners are removed on unmount',
    screen.includes("window.addEventListener('offline', goOffline)") &&
      screen.includes("window.removeEventListener('offline', goOffline)"),
  );
  check(
    'layering: the optimistic true is never turned into a claim by the caller',
    /useState<boolean \| null>\(null\)/.test(screen),
  );
}

// ===================== the fetch path stays honest ======================
{
  const port = readFileSync('src/components/navigator/route-port.ts', 'utf8');
  check(
    'fetch: route requests carry a timeout, so a dead network cannot hang a trip',
    /AbortSignal\.timeout\(TIMEOUT_MS\)/.test(port),
  );
  check(
    'fetch: a network failure is a typed outcome, never a thrown error',
    /catch \{[\s\S]{0,120}kind: 'failure', reason: 'network'/.test(port),
  );
  check('fetch: provider detail is never echoed to the client', !/HERE_API_KEY|apiKey/.test(port));
}

console.log(`navigator-network-degraded: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

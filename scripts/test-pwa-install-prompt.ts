/**
 * Offline tests for the PWA install-eligibility detection. No network, no
 * browser, no jsdom — every case is a synthetic environment snapshot, which is
 * the whole point of the module taking data rather than a `Window`. Run:
 *
 *   npx esbuild scripts/test-pwa-install-prompt.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-pwa-install-prompt.cjs && node /tmp/test-pwa-install-prompt.cjs
 *
 * The user-agent strings below are real-world formats. The load-bearing ones are
 * the near-misses: an iOS browser that is not Safari, an in-app webview, and an
 * iPad that claims to be a Mac. Those are the cases a naive `/iphone|ipad/`
 * check gets wrong, so most of the assertions here are about what must NOT be
 * detected as installable.
 */
import {
  installAvailability,
  isAndroidBrowser,
  isInAppBrowser,
  isIosSafari,
  isStandalone,
  readInstallEnvironment,
  type InstallEnvironment,
} from '@/lib/pwa/install-prompt';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* ------------------------------------------------------------- user agents */

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ Safari reports a desktop Mac UA. Identical to a real iMac except maxTouchPoints.
  ipadOsAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iosEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 EdgiOS/126.0.2592.87 Mobile/15E148 Safari/605.1.15',
  iosOpera:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPiOS/16.0.0 Mobile/15E148 Safari/9537.53',
  facebookInApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.47.108]',
  instagramInApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 336.0.0.32.90',
  googleAppInApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 GSA/318.0.642352716 Safari/604.1',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Safari/537.36',
  desktopFirefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
};

function env(overrides: Partial<InstallEnvironment> = {}): InstallEnvironment {
  return {
    userAgent: '',
    maxTouchPoints: 0,
    navigatorStandalone: false,
    displayModeStandalone: false,
    ...overrides,
  };
}

/* ------------------------------------------------------- iOS Safari: yes */

check('iPhone Safari is iOS Safari', isIosSafari(env({ userAgent: UA.iphoneSafari })));
check('iPad Safari is iOS Safari', isIosSafari(env({ userAgent: UA.ipadSafari })));
check(
  'iPadOS reporting a Mac UA is iOS Safari when touch points indicate a tablet',
  isIosSafari(env({ userAgent: UA.ipadOsAsMac, maxTouchPoints: 5 })),
);

/* -------------------------------------------------------- iOS Safari: no */

check(
  'the same Mac UA with no touch points is a real desktop Mac, not an iPad',
  !isIosSafari(env({ userAgent: UA.ipadOsAsMac, maxTouchPoints: 0 })),
);
check(
  'one touch point is still a Mac (trackpad), not an iPad',
  !isIosSafari(env({ userAgent: UA.ipadOsAsMac, maxTouchPoints: 1 })),
);
check('Chrome on iOS is not iOS Safari', !isIosSafari(env({ userAgent: UA.iosChrome })));
check('Firefox on iOS is not iOS Safari', !isIosSafari(env({ userAgent: UA.iosFirefox })));
check('Edge on iOS is not iOS Safari', !isIosSafari(env({ userAgent: UA.iosEdge })));
check('Opera on iOS is not iOS Safari', !isIosSafari(env({ userAgent: UA.iosOpera })));
check(
  'the Facebook in-app browser is not iOS Safari',
  !isIosSafari(env({ userAgent: UA.facebookInApp })),
);
check(
  'the Instagram in-app browser is not iOS Safari',
  !isIosSafari(env({ userAgent: UA.instagramInApp })),
);
check(
  'the Google app in-app browser is not iOS Safari (it carries a Safari token)',
  !isIosSafari(env({ userAgent: UA.googleAppInApp })),
);
check('Android Chrome is not iOS Safari', !isIosSafari(env({ userAgent: UA.androidChrome })));
check('desktop Safari is not iOS Safari', !isIosSafari(env({ userAgent: UA.desktopSafari })));
check(
  'desktop Chrome is not iOS Safari even with a Mac UA and reported touch points',
  !isIosSafari(env({ userAgent: UA.desktopChrome, maxTouchPoints: 5 })),
);
check('desktop Firefox is not iOS Safari', !isIosSafari(env({ userAgent: UA.desktopFirefox })));

/* ------------------------------------------------------- in-app webviews */

check('Facebook webview is flagged in-app', isInAppBrowser(UA.facebookInApp));
check('Instagram webview is flagged in-app', isInAppBrowser(UA.instagramInApp));
check('Google app webview is flagged in-app', isInAppBrowser(UA.googleAppInApp));
check('Android WebView (; wv) is flagged in-app', isInAppBrowser(UA.androidWebView));
check('iPhone Safari is not flagged in-app', !isInAppBrowser(UA.iphoneSafari));
check('Android Chrome is not flagged in-app', !isInAppBrowser(UA.androidChrome));

/* --------------------------------------------------------------- Android */

check(
  'Android Chrome is an Android browser',
  isAndroidBrowser(env({ userAgent: UA.androidChrome })),
);
check(
  'an Android WebView is not treated as an installable Android browser',
  !isAndroidBrowser(env({ userAgent: UA.androidWebView })),
);
check(
  'iPhone Safari is not an Android browser',
  !isAndroidBrowser(env({ userAgent: UA.iphoneSafari })),
);

/* ------------------------------------------------------ already installed */

check(
  'navigator.standalone marks an installed iOS app',
  isStandalone(env({ userAgent: UA.iphoneSafari, navigatorStandalone: true })),
);
check(
  'display-mode: standalone marks an installed app',
  isStandalone(env({ userAgent: UA.androidChrome, displayModeStandalone: true })),
);
check('a normal browser tab is not standalone', !isStandalone(env({ userAgent: UA.iphoneSafari })));

/* --------------------------------------------------------- availability */

check(
  'iPhone Safari, not installed → manual add-to-home-screen',
  installAvailability(env({ userAgent: UA.iphoneSafari })).kind === 'ios-manual',
);
check(
  'iPadOS-as-Mac with touch, not installed → manual add-to-home-screen',
  installAvailability(env({ userAgent: UA.ipadOsAsMac, maxTouchPoints: 5 })).kind === 'ios-manual',
);
check(
  'Android Chrome → a browser prompt is possible',
  installAvailability(env({ userAgent: UA.androidChrome })).kind === 'browser-prompt',
);
check(
  'installed wins over platform (iOS)',
  installAvailability(env({ userAgent: UA.iphoneSafari, navigatorStandalone: true })).kind ===
    'installed',
);
check(
  'installed wins over platform (Android)',
  installAvailability(env({ userAgent: UA.androidChrome, displayModeStandalone: true })).kind ===
    'installed',
);
check(
  'Chrome on iOS offers no install route',
  installAvailability(env({ userAgent: UA.iosChrome })).kind === 'unsupported',
);
check(
  'the Instagram webview offers no install route',
  installAvailability(env({ userAgent: UA.instagramInApp })).kind === 'unsupported',
);
check(
  'desktop Safari offers no install route',
  installAvailability(env({ userAgent: UA.desktopSafari })).kind === 'unsupported',
);

/* ------------------------------------------- malformed / missing input */

const MALFORMED: unknown[] = [
  '',
  '   ',
  'Safari',
  'iPhone',
  '<script>',
  'Mozilla/5.0',
  null,
  undefined,
  42,
  {},
  [],
];
for (const bad of MALFORMED) {
  const label = JSON.stringify(bad) ?? String(bad);
  let threw = false;
  let availability = '';
  try {
    availability = installAvailability(env({ userAgent: bad as string })).kind;
  } catch {
    threw = true;
  }
  check(`malformed user agent ${label} does not throw`, !threw);
  check(
    `malformed user agent ${label} fails closed (never ios-manual)`,
    availability !== 'ios-manual',
    availability,
  );
}

check(
  'a bare "iPhone" token without Safari is not enough to claim iOS Safari',
  !isIosSafari(env({ userAgent: 'iPhone' })),
);
check(
  'a bare "Safari" token without a device is not enough to claim iOS Safari',
  !isIosSafari(env({ userAgent: 'Safari' })),
);

/* --------------------------------------- reading a real (or absent) Window */

check(
  'readInstallEnvironment(undefined) returns a blank, fail-closed snapshot',
  JSON.stringify(readInstallEnvironment(undefined)) ===
    JSON.stringify({
      userAgent: '',
      maxTouchPoints: 0,
      navigatorStandalone: false,
      displayModeStandalone: false,
    }),
);

{
  // A window with no navigator at all — the shape SSR and some webviews present.
  const bare = { matchMedia: undefined } as unknown as Window;
  let threw = false;
  try {
    readInstallEnvironment(bare);
  } catch {
    threw = true;
  }
  check('readInstallEnvironment survives a window with no navigator', !threw);
  check(
    'a window with no navigator resolves to unsupported',
    installAvailability(readInstallEnvironment(bare)).kind === 'unsupported',
  );
}

{
  // matchMedia throwing is real in locked-down webviews; it must not take the page down.
  const hostile = {
    navigator: { userAgent: UA.iphoneSafari, maxTouchPoints: 5 },
    matchMedia: () => {
      throw new Error('blocked');
    },
  } as unknown as Window;
  let threw = false;
  let snapshot = readInstallEnvironment(hostile);
  try {
    snapshot = readInstallEnvironment(hostile);
  } catch {
    threw = true;
  }
  check('readInstallEnvironment survives matchMedia throwing', !threw);
  check('a throwing matchMedia reads as not-installed', snapshot.displayModeStandalone === false);
  check(
    'the rest of the snapshot still resolves correctly',
    snapshot.userAgent === UA.iphoneSafari && snapshot.maxTouchPoints === 5,
  );
}

{
  const installedIphone = {
    navigator: { userAgent: UA.iphoneSafari, maxTouchPoints: 5, standalone: true },
    matchMedia: () => ({ matches: false }) as MediaQueryList,
  } as unknown as Window;
  check(
    'a real installed iPhone window reads as installed',
    installAvailability(readInstallEnvironment(installedIphone)).kind === 'installed',
  );
}

{
  const negativeTouch = {
    navigator: { userAgent: UA.ipadOsAsMac, maxTouchPoints: -3 },
    matchMedia: () => ({ matches: false }) as MediaQueryList,
  } as unknown as Window;
  check(
    'a nonsensical negative maxTouchPoints is floored to 0, not trusted',
    readInstallEnvironment(negativeTouch).maxTouchPoints === 0,
  );
}

/* ------------------------------------------------------------ determinism */

{
  const e = env({ userAgent: UA.iphoneSafari, maxTouchPoints: 5 });
  const a = JSON.stringify(installAvailability(e));
  const b = JSON.stringify(installAvailability(e));
  check('repeated calls on the same snapshot agree', a === b, { a, b });
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

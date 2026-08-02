/**
 * Install-eligibility detection for a future "add TLWS to your home screen"
 * surface. Pure decision logic only — this module renders nothing, registers no
 * listeners, touches no DOM, and imports nothing from React or Next.
 *
 * There is no service worker or web app manifest in TLWS today, so nothing here
 * is wired to a UI yet. It exists because the detection itself is the hard part
 * and it is worth having settled, reviewed, and tested before the PWA milestone
 * starts rather than during it.
 *
 * Why detection is hard, in one paragraph. iOS Safari never fires
 * `beforeinstallprompt` and has no programmatic install — the only route is the
 * user tapping Share → Add to Home Screen, so the app must *tell* them. That
 * makes "is this really iOS Safari?" a load-bearing question, and the user-agent
 * string answers it badly: Chrome, Firefox, Edge and Opera on iOS are all
 * WebKit underneath and all carry `Safari` in their UA, but none of them can add
 * to the home screen. In-app browsers (Instagram, Facebook, the Google app)
 * carry `Safari` too and also cannot. And since iPadOS 13, Safari on iPad
 * reports itself as a desktop Mac, so an iPad looks exactly like an iMac except
 * for `maxTouchPoints`. Every one of those cases is a wrong answer that would
 * either show install instructions to someone who cannot follow them or hide
 * them from someone who needs them.
 *
 * Provenance: the behaviour modelled here was identified during the read-only
 * audit of the partner PWA project (see docs/donor-audit-extraction.md). That
 * archive shipped without a LICENSE, without an authorship record, and without
 * git history, so nothing was copied from it. This is an independent
 * implementation written against the documented behaviour and the described
 * cases; the API shape, the environment-snapshot approach, and the availability
 * union below are TLWS's own.
 */

/**
 * Everything the decision needs, captured as plain data. Taking a snapshot
 * rather than a `Window` is what makes every function below testable from
 * synthetic input — no jsdom, no globals, no browser.
 */
export type InstallEnvironment = {
  /** Raw `navigator.userAgent`. Non-strings and absent values are treated as ''. */
  userAgent: string;
  /** `navigator.maxTouchPoints`. The only signal separating iPad from Mac. */
  maxTouchPoints: number;
  /** iOS-only `navigator.standalone` — true once launched from the home screen. */
  navigatorStandalone: boolean;
  /** Result of `matchMedia('(display-mode: standalone)')` — the cross-browser signal. */
  displayModeStandalone: boolean;
};

/** What install route, if any, is open to this visitor. */
export type InstallAvailability =
  /** Already running as an installed app — offer nothing. */
  | { kind: 'installed' }
  /** iOS Safari: no programmatic install exists; show Share → Add to Home Screen. */
  | { kind: 'ios-manual' }
  /** Chromium-family: `beforeinstallprompt` may fire, so a real prompt is possible. */
  | { kind: 'browser-prompt' }
  /** No install path — an iOS in-app webview, an alternative iOS browser, or a desktop browser. */
  | { kind: 'unsupported' };

/**
 * Alternative browsers on iOS. All are WebKit and all carry `Safari` in the UA,
 * but none of them expose Add to Home Screen, so each must be excluded by its
 * own vendor token.
 */
const IOS_ALTERNATIVE_BROWSERS = /\b(?:crios|fxios|edgios|opios|opt\/|duckduckgo|brave)/i;

/**
 * Embedded webviews. A visitor arriving from a link in Instagram or Facebook is
 * inside a host app's browser that cannot install anything, and telling them to
 * "tap Share" points at a share sheet that shares the *post*, not the site.
 *
 * `fban`/`fbav`/`fbios`/`fb_iab` are Facebook's family, `gsa/` is the Google
 * app's in-app browser, and `; wv)` is the standard Android WebView marker.
 */
const IN_APP_BROWSERS =
  /\b(?:fban|fbav|fbios|fb_iab|instagram|line\/|gsa\/|twitter|tiktok|musical_ly|bytedancewebview|snapchat|linkedinapp|pinterest|whatsapp)|;\s*wv\)/i;

/**
 * Desktop/Android Chromium and Firefox. Real Safari's UA contains none of these.
 * Excluding them keeps a touchscreen-capable Chromium browser reporting a
 * Macintosh UA from being mistaken for iPadOS Safari.
 */
const NON_SAFARI_ENGINES = /\b(?:chrome|chromium|crmo|edg|edga|edge|opr|firefox|fxios)\//i;

/** iPadOS reports a Mac UA; a real Mac reports 0 or 1 touch points, an iPad reports 5. */
const IPAD_MIN_TOUCH_POINTS = 2;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * True for an embedded webview that cannot install. Exported because the answer
 * is useful on its own — it is also the reason to suppress an install nudge
 * entirely rather than show a different one.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSERS.test(text(userAgent));
}

/**
 * True only for genuine iOS/iPadOS Safari, which is the only browser on Apple
 * hardware that can add to the home screen.
 *
 * The checks run exclusions first and the positive test last, deliberately: it
 * is much safer to fail closed (miss an eligible visitor) than to fail open and
 * tell someone in the Instagram browser to look for a Share button that will not
 * do what we said it would.
 */
export function isIosSafari(env: InstallEnvironment): boolean {
  const ua = text(env.userAgent);
  if (ua === '') return false;
  if (isInAppBrowser(ua)) return false;
  if (IOS_ALTERNATIVE_BROWSERS.test(ua)) return false;
  if (NON_SAFARI_ENGINES.test(ua)) return false;
  if (!/safari/i.test(ua)) return false;

  if (/\b(?:iphone|ipad|ipod)\b/i.test(ua)) return true;
  // iPadOS 13+ Safari: indistinguishable from desktop Safari except for touch.
  return /macintosh/i.test(ua) && toTouchPoints(env.maxTouchPoints) >= IPAD_MIN_TOUCH_POINTS;
}

/** True for Android, excluding the in-app webviews that cannot install. */
export function isAndroidBrowser(env: InstallEnvironment): boolean {
  const ua = text(env.userAgent);
  if (ua === '' || isInAppBrowser(ua)) return false;
  return /android/i.test(ua);
}

/**
 * True when the page is already running as an installed app. Two signals
 * because neither covers everything: `navigator.standalone` is iOS-only and
 * predates the standard, `display-mode: standalone` is the standard and is what
 * Chromium reports.
 */
export function isStandalone(env: InstallEnvironment): boolean {
  return env.navigatorStandalone === true || env.displayModeStandalone === true;
}

/**
 * The single answer a caller actually wants. Order matters: an installed app is
 * installed regardless of which browser installed it, so that case is checked
 * before anything else.
 */
export function installAvailability(env: InstallEnvironment): InstallAvailability {
  if (isStandalone(env)) return { kind: 'installed' };
  if (isIosSafari(env)) return { kind: 'ios-manual' };
  if (isAndroidBrowser(env)) return { kind: 'browser-prompt' };
  return { kind: 'unsupported' };
}

function toTouchPoints(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Read-only adapter from a real `Window` to the snapshot above. Every access is
 * defensive: `navigator` may be missing under SSR, `matchMedia` is absent in
 * older embedded webviews, and reading either can throw inside a locked-down
 * webview. A browser we cannot interrogate is reported as a plain, non-installed
 * environment, which resolves to `unsupported` — the correct fail-closed answer.
 *
 * This reads; it never writes. Nothing here mutates the DOM or registers a
 * listener, which is what keeps the module free of side effects at import time.
 */
export function readInstallEnvironment(win: Window | undefined): InstallEnvironment {
  const blank: InstallEnvironment = {
    userAgent: '',
    maxTouchPoints: 0,
    navigatorStandalone: false,
    displayModeStandalone: false,
  };
  if (!win) return blank;

  try {
    const nav = win.navigator as (Navigator & { standalone?: boolean }) | undefined;
    let displayModeStandalone = false;
    try {
      displayModeStandalone = win.matchMedia?.('(display-mode: standalone)')?.matches === true;
    } catch {
      // matchMedia is absent or throws in some embedded webviews — treat as not installed.
    }
    return {
      userAgent: text(nav?.userAgent),
      maxTouchPoints: toTouchPoints(nav?.maxTouchPoints),
      navigatorStandalone: nav?.standalone === true,
      displayModeStandalone,
    };
  } catch {
    return blank;
  }
}

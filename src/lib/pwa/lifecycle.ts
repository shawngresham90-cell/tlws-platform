/**
 * Pure decision logic for the service-worker lifecycle — the testable half of
 * src/components/pwa/PwaLifecycle.tsx, in the same spirit as
 * install-prompt.ts: plain data in, plain answer out, no DOM, no React.
 */

/** Everything the registration decision needs, captured as plain data. */
export type RegistrationEnvironment = {
  /** `'serviceWorker' in navigator`. */
  supportsServiceWorker: boolean;
  /** `window.isSecureContext` — SWs only work on HTTPS or localhost anyway. */
  isSecureContext: boolean;
  /** `process.env.NODE_ENV === 'production'`. */
  isProduction: boolean;
};

/**
 * Register only in a production build, in a secure context, where the API
 * exists. The production gate matters most: a worker registered against a
 * dev server outlives the dev session and then serves cached dev assets to
 * the next `npm run dev`, which reads as impossible-to-debug staleness.
 */
export function shouldRegisterServiceWorker(env: RegistrationEnvironment): boolean {
  return env.supportsServiceWorker && env.isSecureContext && env.isProduction;
}

/**
 * True when a freshly-installed worker is an *update* rather than the first
 * install: an update has a predecessor controlling the page. Only updates
 * warrant telling anyone anything — a first install changes nothing about
 * the current session.
 */
export function isUpdateReady(newWorkerState: string, hasController: boolean): boolean {
  return newWorkerState === 'installed' && hasController;
}

/** Window event dispatched when a new service worker is installed and waiting. */
export const SW_UPDATE_READY_EVENT = 'tlws:sw-update-ready';

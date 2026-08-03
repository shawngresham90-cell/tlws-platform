'use client';

import { useEffect, useState } from 'react';
import {
  shouldRegisterServiceWorker,
  isUpdateReady,
  SW_UPDATE_READY_EVENT,
} from '@/lib/pwa/lifecycle';
import { trackEvent } from '@/lib/analytics';

/**
 * Site-wide PWA runtime: registers the service worker and shows the offline
 * banner. Mounted once in the root layout; renders nothing while online.
 *
 * Registration is production-only (see lib/pwa/lifecycle for why) and the
 * update path is deliberately passive: when a new worker finishes installing
 * behind a live page we dispatch `tlws:sw-update-ready` on window and record
 * an analytics event — nothing reloads, nothing is hijacked. The new version
 * takes over on the next natural visit. A future "update available" control
 * can listen for that event and message SKIP_WAITING when the user asks.
 *
 * The offline banner is the driver-safety surface for the whole site,
 * Trip Planner included: the moment connectivity drops, every page says so,
 * and says that live road data cannot be trusted stale. It sits below the
 * sticky header (top-16) so it never covers navigation.
 */
export function PwaLifecycle() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      trackEvent('pwa_offline');
    };
    const goOnline = () => setOffline(false);

    // navigator.onLine is optimistic (true can be wrong, false is reliable),
    // which is the right bias for a banner that must not cry wolf.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setOffline(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    if (
      !shouldRegisterServiceWorker({
        supportsServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        isSecureContext: typeof window !== 'undefined' && window.isSecureContext === true,
        isProduction: process.env.NODE_ENV === 'production',
      })
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (isUpdateReady(worker.state, navigator.serviceWorker.controller !== null)) {
              window.dispatchEvent(new CustomEvent(SW_UPDATE_READY_EVENT));
              trackEvent('pwa_update_ready');
            }
          });
        });
      })
      .catch(() => {
        // Registration failure degrades to a plain website — never surfaced.
      });
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-16 z-40 border-b border-diesel-700 bg-diesel px-4 py-2 text-center text-sm font-semibold text-ink"
    >
      You&apos;re offline — live parking, routes, weather and Hours of Service data is unavailable
      until you reconnect.
    </div>
  );
}

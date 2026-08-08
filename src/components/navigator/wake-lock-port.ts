'use client';

import type { WakePort, WakeSentinel } from '@/lib/navigator/screen-wake';

/**
 * Browser WakePort — the one place Navigator touches
 * `navigator.wakeLock`. Everything about WHEN to hold a lock lives in
 * `screen-wake.ts`; this file only translates.
 *
 * Degrades silently: no API, no lock, no error thrown at the driving
 * screen. Safari added support in 16.4 and Firefox for Android still
 * lacks it, so "unsupported" is an ordinary outcome, not a failure.
 */
type WakeLockLike = {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
};
type WakeLockSentinelLike = {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
};

export function createBrowserWakePort(): WakePort {
  const api =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator
      ? (navigator.wakeLock as unknown as WakeLockLike)
      : null;

  if (api === null) return { supported: false, request: async () => null };

  return {
    supported: true,
    async request(): Promise<WakeSentinel | null> {
      const lock = await api.request('screen');
      return {
        release: () => {
          // The promise is deliberately dropped: a release that fails has
          // nothing left to do, and the caller is often unmounting.
          void lock.release().catch(() => {});
        },
        onRelease: (cb) => lock.addEventListener('release', cb),
      };
    },
  };
}

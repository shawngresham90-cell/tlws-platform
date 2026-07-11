'use client';

import { useEffect } from 'react';

/**
 * Fires a single, fire-and-forget "this listing was viewed" beacon (Milestone
 * 25 most-viewed foundation). Client-only by design: bots that don't run JS
 * never count. It sends ONLY the listing id — no location, no identifiers — to
 * a same-origin endpoint that rate-limits and privacy-filters server-side.
 * Guards against duplicate sends within a session. Never blocks or affects
 * render; failures are ignored.
 */
export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const key = `dv:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage unavailable — still send once per mount.
    }
    const body = JSON.stringify({ id });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/directory/view', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch {
      // fall through to fetch
    }
    fetch('/api/directory/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [id]);
  return null;
}

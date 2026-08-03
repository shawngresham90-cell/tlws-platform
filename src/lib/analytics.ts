/**
 * Lightweight analytics dispatch. Fires an event into whatever analytics layer
 * happens to be present (Plausible, GA/GTM dataLayer, or Vercel Analytics) and
 * is a silent no-op when none is configured — so "add analytics events if
 * available" is satisfied without pulling in a dependency or coupling to a
 * specific vendor. Client-only.
 */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    plausible?: (name: string, opts?: { props?: Record<string, unknown> }) => void;
    dataLayer?: Array<Record<string, unknown>>;
    va?: (event: string, payload?: Record<string, unknown>) => void;
  };
  // Each sink is isolated. They used to share one try/catch, so a vendor that
  // threw took the remaining sinks down with it — the event vanished from
  // every other destination with no signal. One bad script should cost one
  // sink, not all of them.
  attempt(() => w.plausible?.(name, props ? { props } : undefined));
  attempt(() => w.dataLayer?.push({ event: name, ...props }));
  attempt(() => w.va?.('event', { name, ...props }));
}

/** Run a sink, swallowing anything it throws. Analytics must never break a form. */
function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    // Deliberately silent: a reporting failure is not a user-facing failure.
  }
}

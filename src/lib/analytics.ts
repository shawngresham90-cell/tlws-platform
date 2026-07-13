/**
 * Lightweight analytics dispatch. Fires an event into whatever analytics layer
 * happens to be present (Plausible, GA/GTM dataLayer, or Vercel Analytics) and
 * is a silent no-op when none is configured — so "add analytics events if
 * available" is satisfied without pulling in a dependency or coupling to a
 * specific vendor. Client-only.
 */
/** Revenue-event names used by TrackedCta (Search & Revenue Optimization). */
export type AnalyticsEvent =
  | 'affiliate_click'
  | 'sponsor_click'
  | 'reserve_cta_click'
  | (string & {});

export type AnalyticsProps = Record<string, unknown>;

/** Hostname of an outbound link, for event context ("truckparkingclub.com"). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as {
      plausible?: (name: string, opts?: { props?: Record<string, unknown> }) => void;
      dataLayer?: Array<Record<string, unknown>>;
      va?: (event: string, payload?: Record<string, unknown>) => void;
    };
    w.plausible?.(name, props ? { props } : undefined);
    w.dataLayer?.push({ event: name, ...props });
    w.va?.('event', { name, ...props });
  } catch {
    // Analytics must never break the form.
  }
}

'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { DIRECTORY_EVENTS, listingEventProps, type ListingContext } from '@/lib/directory/funnel';

/**
 * Directory analytics, through the EXISTING vendor-agnostic `trackEvent`
 * dispatcher — no new vendor, no cookie, no paid tool. When no analytics layer
 * is present `trackEvent` is a silent no-op, so this is inert by default.
 *
 * Two jobs:
 *   1. Fire one listing-view event per mount.
 *   2. Attach ONE delegated click listener for outbound actions, so the
 *      server-rendered anchors keep working untouched — they only gain a
 *      `data-dir-event` attribute. Tracking never blocks or delays navigation:
 *      the handler is passive and any throw is swallowed by `trackEvent`.
 *
 * Only bounded, non-personal context is sent (listing id/slug/category/state/
 * corridor). Never a URL the user typed, an address, a phone number, or a
 * message body.
 */
const OUTBOUND: Record<string, string> = {
  directions: DIRECTORY_EVENTS.directionsClick,
  website: DIRECTORY_EVENTS.websiteClick,
  phone: DIRECTORY_EVENTS.phoneClick,
  map: DIRECTORY_EVENTS.mapInteract,
};

export function DirectoryEvents({ listing }: { listing: ListingContext }) {
  // Keep the latest context without re-attaching the listener on every render.
  const ctxRef = useRef(listing);
  ctxRef.current = listing;

  // One view event per listing per mount.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = listing.id ?? listing.slug ?? null;
    if (!key || viewedRef.current === key) return;
    viewedRef.current = key;
    trackEvent(DIRECTORY_EVENTS.listingView, listingEventProps(listing));
  }, [listing]);

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      const target = ev.target as Element | null;
      const el = target?.closest?.('[data-dir-event]');
      if (!el) return;
      const kind = el.getAttribute('data-dir-event');
      const name = kind ? OUTBOUND[kind] : undefined;
      if (!name) return;
      trackEvent(name, listingEventProps(ctxRef.current, { action: kind }));
    }
    document.addEventListener('click', onClick, { passive: true });
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}

/**
 * Page-level view event for directory index and category surfaces, where there
 * is no single listing. Fires once per mount.
 */
export function DirectorySurfaceEvent({
  surface,
  category,
  state,
}: {
  surface: 'hub' | 'category';
  category?: string | null;
  state?: string | null;
}) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackEvent(
      surface === 'hub' ? DIRECTORY_EVENTS.directoryView : DIRECTORY_EVENTS.categoryView,
      listingEventProps({ category, state }, { surface }),
    );
  }, [surface, category, state]);
  return null;
}

'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { STORE_EVENTS } from '@/lib/store/analytics';

/**
 * Fires a store page-view event once on mount. `event` picks which one
 * (store / product / category); `props` carries only non-personal context
 * (product slug, category slug).
 */
export function StoreEvents({
  event,
  props,
}: {
  event: (typeof STORE_EVENTS)[keyof typeof STORE_EVENTS];
  props?: Record<string, string>;
}) {
  useEffect(() => {
    trackEvent(event, props);
  }, [event, props]);
  return null;
}

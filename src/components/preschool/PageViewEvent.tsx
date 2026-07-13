'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * Fires the privacy-safe `preschool_page_view` event once on mount (same
 * pattern as ApplyForm's `application_started`). No path, referrer, or user
 * data is attached — the event name is the entire payload.
 */
export function PageViewEvent() {
  useEffect(() => {
    trackEvent(PRESCHOOL_EVENTS.pageView);
  }, []);
  return null;
}

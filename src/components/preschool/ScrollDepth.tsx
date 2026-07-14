'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * Fires `preschool_scroll_depth` once per threshold (25/50/75/100) per page
 * view. Payload is the percentage only — no URLs, no user data. Passive
 * listener; removes itself once all thresholds have fired.
 */
export function ScrollDepth() {
  useEffect(() => {
    const fired = new Set<number>();
    const thresholds = [25, 50, 75, 100];
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = ((window.scrollY / scrollable) * 100) | 0;
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          trackEvent(PRESCHOOL_EVENTS.scrollDepth, { percent: t });
        }
      }
      if (fired.size === thresholds.length) window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}

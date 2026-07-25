'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

/**
 * Fires `page_not_found` once on mount with the dead path, so broken links
 * (ours or someone else's) show up in analytics instead of staying invisible.
 * Uses the shared dispatcher, so it is a silent no-op unless analytics is
 * configured. Path only — no user data, no referrer.
 */
export function NotFoundEvent() {
  const pathname = usePathname();
  useEffect(() => {
    trackEvent('page_not_found', { path: pathname });
  }, [pathname]);
  return null;
}

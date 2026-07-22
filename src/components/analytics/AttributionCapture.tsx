'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureAttribution } from '@/lib/attribution';

/**
 * Site-wide first-touch attribution capture. Renders nothing; on every
 * route change it records any utm_* params (and the outside referrer) from
 * the current URL into sessionStorage, so a driver who lands on an article
 * from an ad and later applies still carries their source. First touch wins
 * — later params never overwrite earlier ones (see lib/attribution).
 *
 * Reads window.location directly (not useSearchParams) so the root layout
 * keeps static rendering — no Suspense/CSR-bailout requirement.
 */
export function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
  }, [pathname]);

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import {
  PRESCHOOL_EVENTS,
  PRESCHOOL_PRICE_LABEL,
  PRESCHOOL_PURCHASE_REL,
  PRESCHOOL_PURCHASE_URL,
} from '@/lib/preschool/constants';

/**
 * Mobile-only sticky purchase bar. Appears once the visitor scrolls past the
 * hero (so it never doubles the above-the-fold CTA) and then stays visible.
 * Renders nothing on sm+ screens via CSS, adds no layout shift (fixed
 * overlay; the page reserves bottom padding separately), and goes through the
 * same exact URL + rel + analytics event as every other purchase button.
 *
 * Stacks directly ABOVE the persistent mobile tool bar, which owns bottom-0
 * at z-50: the offset is the bar's exact 56px (3.5rem) min-height plus the
 * device safe-area inset the bar absorbs, so the two never overlap. (Before
 * this offset both bars docked at bottom-0 and the higher-z tool bar covered
 * the purchase CTA's lower half on phones.) Keep the 3.5rem in lockstep with
 * MobileToolBar's min-h-[56px] — scripts/test-mobile-toolbar.ts pins both.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-40 border-t border-line bg-asphalt/95 p-3 backdrop-blur sm:hidden">
      <a
        href={PRESCHOOL_PURCHASE_URL}
        target="_blank"
        rel={PRESCHOOL_PURCHASE_REL}
        onClick={() =>
          trackEvent(PRESCHOOL_EVENTS.purchaseCtaClick, { placement: 'sticky-mobile' })
        }
        className="flex w-full items-center justify-center rounded-card bg-signal px-4 py-3 font-display text-base uppercase tracking-wide text-asphalt"
      >
        Start CDL Pre-School — {PRESCHOOL_PRICE_LABEL}
      </a>
      <p className="mt-1.5 text-center text-[10px] text-muted">
        Opens secure Stan Store checkout in a new tab
      </p>
    </div>
  );
}

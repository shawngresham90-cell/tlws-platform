'use client';

import { useEffect, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { AMAZON_REL, amazonProductUrl } from '@/lib/store/amazon';
import { productActive } from '@/lib/store/products';
import { STORE_EVENTS } from '@/lib/store/analytics';
import type { StoreProduct } from '@/lib/store/types';

/**
 * Mobile-only sticky Amazon bar on a product page. Renders NOTHING unless the
 * product passes the activation gate (valid ASIN + verified title + licensed
 * image), matching AmazonCta, so a sticky bar can never point at a product the
 * owner hasn't fully confirmed. For an active product it appears after the hero
 * scrolls away and stays put; the page reserves bottom space (no layout shift).
 */
export function StickyAmazonCta({ product }: { product: StoreProduct }) {
  const url = productActive(product) ? amazonProductUrl(product.asin) : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!url) return;
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [url]);

  if (!url || !visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-asphalt/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
      <a
        href={url}
        target="_blank"
        rel={AMAZON_REL}
        onClick={() =>
          trackEvent(STORE_EVENTS.amazonCtaClick, { product: product.slug, placement: 'sticky-mobile' })
        }
        className="flex w-full items-center justify-center rounded-card bg-signal px-4 py-3 font-display text-base uppercase tracking-wide text-asphalt"
      >
        View on Amazon
      </a>
      <p className="mt-1.5 text-center text-[10px] text-muted">
        Affiliate link — opens Amazon in a new tab
      </p>
    </div>
  );
}

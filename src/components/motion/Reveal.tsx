'use client';

import { useEffect, useRef } from 'react';

/**
 * Section reveal — the one scroll-motion primitive on the platform
 * (docs/design/cinematic-motion-rules.md). A 220ms opacity/translate entrance
 * applied only to elements still below the viewport when JS runs, so:
 *
 * - SSR output is fully visible (no-JS, crawlers, reduced motion, slow JS);
 * - nothing at or above the fold ever flashes;
 * - only opacity/transform animate — zero layout shift;
 * - `prefers-reduced-motion` exits before any state is applied.
 *
 * Server components pass through as children (RSC slot), so wrapping a
 * section in <Reveal> adds no client JS to the section itself.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;
    // Only elements comfortably below the viewport animate; everything the
    // visitor can already (or nearly) see stays put.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    el.dataset.reveal = 'pending';
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.reveal = 'in';
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

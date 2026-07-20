'use client';

import { useEffect, useRef, useState } from 'react';
import { yearAt } from './spine/consts';

/**
 * The travel-year readout — a small fixed "odometer" that makes the decades
 * explicit as you scroll: the real years (2009 → 2026), then the promise
 * (2036 → 2076). It interpolates the same year scale the 3D mile markers use,
 * so the DOM and the WebGL drive always agree on *when* you are.
 *
 * Pure decoration (aria-hidden): the scenes carry the story. It updates on
 * scroll, so it counts as motion — gated by `reduced` (prefers-reduced-motion
 * OR the pause control): when reduced it attaches no listeners and renders
 * nothing.
 */
export function YearOdometer({ reduced }: { reduced: boolean }) {
  const [year, setYear] = useState<number | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) {
      setYear(null);
      return;
    }
    const update = () => {
      raf.current = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      setYear(yearAt(window.scrollY / max));
    };
    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduced]);

  if (reduced || year === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 left-4 z-40 rounded-full border border-line bg-asphalt/80 px-4 py-2 backdrop-blur"
    >
      <span className="font-display text-sm tabular-nums tracking-[0.2em] text-signal">{year}</span>
      <span className="ml-2 text-[9px] font-semibold uppercase tracking-widest text-muted">
        {year <= 2026 ? 'the road so far' : 'the road ahead'}
      </span>
    </div>
  );
}

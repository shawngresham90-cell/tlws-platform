'use client';

import { useEffect, useRef, useState } from 'react';
import { yearAt } from './spine/consts';

/**
 * FM-2: the travel-year readout — a small fixed "odometer" that makes the
 * decades explicit. It interpolates the same year scale the 3D mile markers
 * use, so the DOM and the road always agree on *when* you are.
 *
 * Pure decoration (aria-hidden): the chapters carry the story. Renders on all
 * tiers (it reinforces the timeline even on lite), but never under
 * prefers-reduced-motion — a constantly-updating counter is motion.
 */
export function YearOdometer() {
  const [year, setYear] = useState<number | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (year === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 left-4 z-40 rounded-full border border-line bg-asphalt/80 px-4 py-2 backdrop-blur"
    >
      <span className="font-display text-sm tracking-[0.2em] text-signal tabular-nums">{year}</span>
      <span className="ml-2 text-[9px] font-semibold uppercase tracking-widest text-muted">
        {year <= 2026 ? 'the road so far' : 'the road ahead'}
      </span>
    </div>
  );
}

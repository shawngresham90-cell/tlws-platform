'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * FM-2 chapter treatment: a one-time rise-and-fade reveal plus an optional
 * giant translucent "era stamp" behind the content — the documentary device
 * that ties each DOM chapter to the decade the 3D road is passing.
 *
 * Children are server-rendered and always present in the HTML (SEO/a11y
 * unchanged); this wrapper only animates their entrance. Reduced motion ⇒
 * everything is simply visible.
 */
export function ChapterReveal({ era, children }: { era?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReduced(true);
      setOn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      {era && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-8 right-0 select-none font-display text-7xl leading-none text-ink/[0.05] sm:-top-14 sm:text-[10rem] ${
            reduced ? '' : `transition-opacity duration-1000 ${on ? 'opacity-100' : 'opacity-0'}`
          }`}
        >
          {era}
        </span>
      )}
      <div
        className={
          reduced
            ? 'relative'
            : `relative transition-all duration-700 ${on ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`
        }
      >
        {children}
      </div>
    </div>
  );
}

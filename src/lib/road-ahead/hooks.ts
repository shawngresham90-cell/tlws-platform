'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp01, crossViewportProgress } from './scroll-math';

/**
 * Client hooks powering THE ROAD AHEAD's scroll choreography. All the number
 * crunching lives in scroll-math.ts (pure, tested); these hooks only wire real
 * scroll/resize/matchMedia events to React state, rAF-throttled and passive so
 * the main thread stays free on mobile.
 */

/** useLayoutEffect on the client, useEffect on the server (no SSR warning). */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * False during SSR and the first client render, true after mount. The experience
 * uses this to render the fully-composed STATIC page for the server/no-JS/first
 * paint (so nothing is ever invisible without JS or before hydration), then turn
 * the cinematic motion on only once the client is live.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Tracks `prefers-reduced-motion`. SSR-safe: starts `false` (matching the server
 * render to avoid a hydration mismatch), then syncs on mount and on change. When
 * true, callers render the static, fully-composed layout with no transforms.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * One shared timeline for the whole page: overall scroll progress (for the
 * progress rail) and the active chapter (nearest to viewport center, for the
 * rail highlight + skip-nav). Always on — this is navigation, not motion, so it
 * serves reduced-motion users too. A single rAF-throttled listener drives both.
 */
export function useRoadAheadTimeline(chapterCount: number) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const registerCbs = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map());

  // Return a STABLE callback per index. The parent calls registerChapter(i)
  // inline on every render (including once per scroll frame); handing back the
  // same function keeps each chapter's callback ref identity constant, so React
  // never detaches/reattaches the section refs on the scroll hot path.
  const registerChapter = useCallback((i: number) => {
    let cb = registerCbs.current.get(i);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        refs.current[i] = el;
      };
      registerCbs.current.set(i, cb);
    }
    return cb;
  }, []);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const doc = document.documentElement;
      const max = doc.scrollHeight - vh;
      setScrollProgress(max > 0 ? clamp01(window.scrollY / max) : 0);

      const center = vh / 2;
      let best = 0;
      let bestDist = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActiveChapter(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // chapterCount is a proxy for "the number of registered refs changed".
  }, [chapterCount]);

  return { scrollProgress, activeChapter, registerChapter };
}

/**
 * Whether a ref'd element is at/near the viewport (IntersectionObserver with a
 * generous rootMargin). Used to gate video playback so footage only decodes when
 * its chapter is on-screen — critical on mobile once real footage lands, where
 * five off-screen autoplaying videos would otherwise decode at once. Disabled →
 * always false (no observer, no playback).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
  rootMargin = '200px',
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setInView(false);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true); // no observer available → don't suppress content
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, rootMargin]);

  return { ref, inView };
}

/**
 * Per-element crossing progress (0→1) as it moves through the viewport, for
 * parallax/depth. Returns a fixed 0 and attaches no listeners when `enabled` is
 * false (reduced motion) — callers render static in that case, so the value is
 * unused and no work happens.
 */
export function useElementProgress<T extends HTMLElement = HTMLDivElement>(enabled: boolean) {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  // Layout effect so the first measurement lands before the browser paints —
  // when `enabled` flips true on mount, the element's real progress is applied
  // synchronously, with no flash of a not-yet-revealed (opacity 0) frame.
  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      setProgress(crossViewportProgress(rect.top, rect.height, vh));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);

  return { ref, progress: enabled ? progress : 0 };
}

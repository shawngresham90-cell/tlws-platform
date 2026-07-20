'use client';

import { useEffect, useRef } from 'react';

/**
 * GSAP scene-transition layer — a lazy, capability-gated cinematic flourish.
 *
 * GSAP + ScrollTrigger are imported dynamically (never in the route-initial
 * bundle) and only when this component is mounted, which the experience does
 * ONLY when motion is allowed. As each scene crosses into view a soft light
 * bloom pulses across a single fixed overlay — a Hollywood-style transition beat
 * that layers on top of the native scroll engine without touching its `--p`
 * timeline (GSAP runs on its own ticker). When the visitor pauses or the OS asks
 * for reduced motion the experience unmounts this layer, which kills every
 * trigger and tween, so no motion lingers. If GSAP fails to load, the native
 * experience simply stands on its own.
 */
export default function GsapTransitions() {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let killed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        if (killed) return;
        gsap.registerPlugin(ScrollTrigger);
        const overlay = overlayRef.current;
        const sections = Array.from(document.querySelectorAll('section[id^="scene-"]'));

        const triggers = sections.map((section, i) =>
          ScrollTrigger.create({
            trigger: section,
            start: 'top 62%',
            onEnter: () => {
              if (!overlay || i === 0) return; // no flash before the opening scene
              gsap.fromTo(
                overlay,
                { opacity: 0 },
                { opacity: 0.16, duration: 0.28, ease: 'power2.inOut', yoyo: true, repeat: 1 },
              );
            },
          }),
        );

        cleanup = () => {
          triggers.forEach((t) => t.kill());
          if (overlay) gsap.killTweensOf(overlay);
        };
      } catch {
        /* GSAP unavailable — the native experience stands on its own. */
      }
    })();

    return () => {
      killed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        opacity: 0,
        background:
          'radial-gradient(120% 80% at 50% 42%, rgba(255,235,0,0.10), rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 70%)',
      }}
    />
  );
}

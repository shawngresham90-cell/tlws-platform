'use client';

import { useEffect, useRef } from 'react';
import styles from './road-ahead.module.css';

/**
 * GSAP scene-transition layer — a lazy, capability-gated cinematic flourish.
 *
 * GSAP + ScrollTrigger are imported dynamically (never in the route-initial
 * bundle) and only when this component is mounted, which the experience does
 * ONLY when motion is allowed. As each scene crosses into view TWO beats fire on
 * a single fixed overlay: a soft mood-tinted bloom pulses, and a bright light
 * flare rakes diagonally across the frame — a movie-trailer "cut" that reads like
 * a passing headlight or a camera flare. The tint warms as the drive progresses
 * (cool night → gold wall/payoff). GSAP runs on its own ticker and never touches
 * the native scroll `--p` timeline. When the visitor pauses or the OS asks for
 * reduced motion the experience unmounts this layer, killing every trigger and
 * tween, so no motion lingers. If GSAP fails to load, the native experience
 * simply stands on its own.
 */

// Per-scene flare accent (index-aligned to the seven scene sections). The drive
// warms from cold night light into the gold of the wall and the payoff.
const SCENE_FLARE = [
  'rgba(200,220,255,0.9)', // 1 night — cold
  'rgba(210,225,255,0.85)', // 2 pre-trip — cold
  'rgba(190,210,245,0.85)', // 3 grind — cold blue
  'rgba(255,236,190,0.9)', // 4 first light — dawn warm
  'rgba(255,235,0,0.95)', // 5 wall — signal gold
  'rgba(255,235,0,0.95)', // 6 name — signal gold
  'rgba(255,224,150,0.95)', // 7 payoff — warm gold
];

export default function GsapTransitions() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);

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
        const bloom = bloomRef.current;
        const streak = streakRef.current;
        const sections = Array.from(document.querySelectorAll('section[id^="scene-"]'));

        const triggers = sections.map((section, i) =>
          ScrollTrigger.create({
            trigger: section,
            start: 'top 62%',
            onEnter: () => {
              if (i === 0 || !bloom || !streak) return; // no flash before the opening scene
              const flare = SCENE_FLARE[i] ?? SCENE_FLARE[SCENE_FLARE.length - 1];
              // Mood bloom: a soft tinted swell that blooms and fades.
              gsap.set(bloom, { ['--flare']: flare });
              gsap.fromTo(
                bloom,
                { opacity: 0 },
                { opacity: 0.18, duration: 0.3, ease: 'power2.inOut', yoyo: true, repeat: 1 },
              );
              // Light flare: a bright diagonal rake that crosses the frame once.
              gsap.set(streak, { ['--flare']: flare });
              gsap.fromTo(
                streak,
                { xPercent: -140, opacity: 0 },
                {
                  xPercent: 140,
                  opacity: 1,
                  duration: 0.72,
                  ease: 'power2.out',
                  onComplete: () => gsap.set(streak, { opacity: 0 }),
                },
              );
            },
          }),
        );

        cleanup = () => {
          triggers.forEach((t) => t.kill());
          if (bloom) gsap.killTweensOf(bloom);
          if (streak) gsap.killTweensOf(streak);
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
    <div ref={overlayRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-30">
      <div ref={bloomRef} className={styles.transBloom} />
      <div ref={streakRef} className={styles.transStreak} />
    </div>
  );
}

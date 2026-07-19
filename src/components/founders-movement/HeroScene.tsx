'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { enableSound } from './audio';

/**
 * Founders Movement — POC cinematic hero (dependency-free).
 *
 * A CSS/SVG stand-in for the production R3F scene described in
 * docs/founders-movement-experience.md: pre-dawn highway, one truck crossing,
 * sunrise bleeding onto the horizon with the school as a distant silhouette.
 *
 * Contracts honored here exactly as in production:
 *  - prefers-reduced-motion ⇒ no ignition sequence, final frame rendered
 *    statically, counter shows its final value immediately.
 *  - The sequence is skippable (any key/click/scroll jumps to the end state).
 *  - Audio never starts by itself — "Enter with sound" is the only trigger
 *    here, and it replays nothing; it just adds atmosphere.
 *  - All information (H1, count, CTAs) lives in real DOM, never canvas-only.
 */
export function HeroScene({
  founderCount,
  visual = 'css',
}: {
  founderCount: number;
  /**
   * 'css' paints the scene with the Phase-0 CSS/SVG layers; 'canvas' hides
   * them (the FM-1 WebGL spine renders the world behind this component) and
   * keeps only the content layer plus a contrast scrim.
   */
  visual?: 'css' | 'canvas';
}) {
  // 'ignition' plays the one-time opening; 'settled' is the resting frame.
  const [phase, setPhase] = useState<'ignition' | 'settled'>('ignition');
  const [reduced, setReduced] = useState(false);
  const [count, setCount] = useState(0);
  const settledRef = useRef(false);

  // Reduced-motion users skip straight to the settled frame.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setPhase('settled');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Ignition timeline (6s) — skippable by scroll, click, or any key.
  useEffect(() => {
    if (phase !== 'ignition') return;
    const settle = () => setPhase('settled');
    const t = window.setTimeout(settle, 6000);
    const skip = () => settle();
    window.addEventListener('scroll', skip, { passive: true, once: true });
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('scroll', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [phase]);

  // Founder counter: counts up once on settle; instant under reduced motion.
  useEffect(() => {
    if (phase !== 'settled' || settledRef.current) return;
    settledRef.current = true;
    if (reduced || founderCount === 0) {
      setCount(founderCount);
      return;
    }
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setCount(Math.round(founderCount * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced, founderCount]);

  const settled = phase === 'settled';
  const css = visual === 'css';

  return (
    <div
      className={`relative isolate flex min-h-[92svh] flex-col justify-end overflow-hidden ${css ? 'bg-asphalt' : 'bg-transparent'}`}
    >
      {/* Canvas mode: the WebGL spine draws the world; keep a text scrim only. */}
      {!css && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-asphalt/80 via-asphalt/30 to-transparent"
        />
      )}
      {css && (
        <>
          {/* Sky: pre-dawn base warming to a sunrise band on the horizon. */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 transition-opacity duration-[2500ms] ${settled ? 'opacity-100' : 'opacity-0'}`}
            style={{
              background:
                'linear-gradient(to bottom, #0b0f14 0%, #101820 42%, #3b2a18 62%, rgba(249,115,22,0.55) 72%, #1a1208 78%, #0b0f14 100%)',
            }}
          />
          {/* Distant school silhouette on the horizon (pure CSS blocks). */}
          <div
            aria-hidden="true"
            className={`absolute left-[58%] top-[66%] h-10 w-40 transition-opacity delay-500 duration-1000 ${settled ? 'opacity-70' : 'opacity-0'}`}
          >
            <div className="absolute bottom-0 left-0 h-6 w-28 bg-black/90" />
            <div className="absolute bottom-6 left-3 h-2 w-16 bg-black/90" />
            <div className="absolute bottom-2 left-2 h-1 w-24 bg-signal/70 blur-[2px]" />
            <div className="absolute bottom-6 left-20 h-4 w-1 bg-black/90" />
          </div>

          {/* Road: perspective plane with a dashed centerline. */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[38%] overflow-hidden">
            <div
              className="absolute inset-x-[-30%] bottom-[-4%] top-0 bg-[#151a20]"
              style={{ transform: 'perspective(640px) rotateX(58deg)', transformOrigin: '50% 0%' }}
            >
              <div
                className={`absolute left-1/2 top-0 h-full w-[6px] -translate-x-1/2 ${settled && !reduced ? 'fm-dashes' : ''}`}
                style={{
                  background:
                    'repeating-linear-gradient(to bottom, rgba(249,115,22,0.9) 0 48px, transparent 48px 120px)',
                }}
              />
            </div>
            {/* Fog bank hugging the road. */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-asphalt/0 via-asphalt/40 to-transparent" />
          </div>

          {/* Headlights + truck silhouette crossing once during ignition. */}
          <div
            aria-hidden="true"
            className={`absolute bottom-[26%] left-0 h-16 w-full ${reduced ? 'hidden' : ''}`}
          >
            <svg
              viewBox="0 0 260 80"
              className={`h-16 w-auto ${settled ? 'opacity-0' : 'fm-truck opacity-90'}`}
            >
              {/* Original, generic semi-truck silhouette. */}
              <g fill="#05070a">
                <rect x="10" y="34" width="150" height="30" rx="2" />
                <path d="M160 64V26c0-2 1-3 3-3h38c8 0 12 3 16 9l12 18c2 3 3 6 3 9v5h-72z" />
                <circle cx="52" cy="66" r="10" />
                <circle cx="86" cy="66" r="10" />
                <circle cx="196" cy="66" r="10" />
              </g>
              <circle cx="230" cy="52" r="3" fill="rgba(255,220,160,0.95)" />
              <path d="M232 50l26-7v14l-26-4z" fill="rgba(255,210,140,0.25)" />
            </svg>
          </div>
        </>
      )}

      {/* Content layer — real DOM, always present. */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-28 sm:px-8">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.3em] text-signal transition-opacity duration-700 ${settled ? 'opacity-100' : 'opacity-0'}`}
        >
          Trucking Life
        </p>
        <h1
          className={`mt-3 font-display text-4xl uppercase leading-[0.95] text-white transition-all duration-700 sm:text-6xl ${settled ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
        >
          The Founders <span className="text-signal">Movement</span>
        </h1>
        <p
          className={`mt-5 max-w-xl text-base text-muted transition-opacity delay-200 duration-700 sm:text-lg ${settled ? 'opacity-100' : 'opacity-0'}`}
        >
          One driver. Seventeen years. A school being built by the people it will serve —{' '}
          <span className="font-semibold text-white">
            {count > 0 ? `${count} founder${count === 1 ? '' : 's'} strong` : 'founders wanted'}
          </span>
          .
        </p>
        <div
          className={`mt-8 flex flex-wrap items-center gap-4 transition-opacity delay-300 duration-700 ${settled ? 'opacity-100' : 'opacity-0'}`}
        >
          <Link
            href="/founders#join"
            className="rounded-card bg-signal px-6 py-3 font-semibold text-asphalt transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Join the Founders Movement
          </Link>
          <button
            type="button"
            onClick={() => void enableSound()}
            className="rounded-card border border-line px-6 py-3 font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Enter with sound
          </button>
        </div>
        {!settled && (
          <p className="mt-6 text-xs uppercase tracking-widest text-muted">
            Rolling in… <span className="sr-only">Press any key to skip the intro.</span>
            <button
              type="button"
              onClick={() => setPhase('settled')}
              className="ml-2 underline decoration-signal underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              Skip intro
            </button>
          </p>
        )}
      </div>

      {/* Scoped keyframes for the POC (production uses the R3F timeline). */}
      <style>{`
        @keyframes fm-truck-cross {
          0% {
            transform: translateX(-30vw);
            opacity: 0;
          }
          12% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(105vw);
            opacity: 0.9;
          }
        }
        .fm-truck {
          animation: fm-truck-cross 5.2s cubic-bezier(0.2, 0.7, 0.4, 1) 0.4s both;
        }
        @keyframes fm-dash-roll {
          from {
            background-position-y: 0;
          }
          to {
            background-position-y: 240px;
          }
        }
        .fm-dashes {
          animation: fm-dash-roll 2.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fm-truck,
          .fm-dashes {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

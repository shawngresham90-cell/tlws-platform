'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FOOTAGE_SCENES } from '@/lib/road-ahead/footage-manifest';
import { setCinemaProgress } from './progress';
import { VideoLayer } from './VideoLayer';

/**
 * THE ROAD AHEAD — the cinematic enhancement layer (plan §1.1, §3).
 *
 * Lazy-loaded (never in the initial bundle, never on the lite/reduced-motion
 * tier). This is the "conductor": it dynamically imports GSAP + ScrollTrigger,
 * ties one ScrollTrigger to the SSR-rendered cinematic track, and publishes a
 * single normalized progress value to the shared store every tick. The footage
 * layers and the reused R3F spine subscribe to that store — nothing owns its
 * own clock.
 *
 * It only ever *adds* fixed background layers behind content that is already
 * fully rendered and readable, so there is no layout shift and nothing is lost
 * if GSAP or WebGL fails mid-visit (the layers simply never reveal).
 *
 * `road-ahead-cinema` below is a deliberate minification-surviving marker so the
 * performance-budget gate can find and size this lazy chunk.
 */
const CINEMA_MARKER = 'road-ahead-cinema';

// The reused, unmodified FM spine — the existing 3D system, lazy-loaded here to
// prove the architecture is extended rather than rewritten.
const SpineCanvas = dynamic(() => import('@/components/founders-movement/spine/SpineCanvas'), {
  ssr: false,
});

const SCENE_SPLIT = 0.5; // progress 0→0.5 = dark road, 0.5→1 = the montage

export function CinematicLayer({ withSpine }: { withSpine: boolean }) {
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [activeScene, setActiveScene] = useState('scene1_dark_road');
  const [spineFailed, setSpineFailed] = useState(false);
  const sceneRef = useRef(activeScene);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let killed = false;
    let trigger: { kill: () => void } | null = null;

    (async () => {
      const track = document.getElementById('road-ahead-track');
      if (!track) return;
      const gsapMod = await import('gsap');
      const gsap = gsapMod.gsap ?? gsapMod.default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);
      setReady(true);

      // A real GSAP tween: the letterbox + grade fade in as the film begins.
      if (rootRef.current) {
        gsap.fromTo(
          rootRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.8, ease: 'power2.out' },
        );
      }

      trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onToggle: (self: { isActive: boolean }) => setInView(self.isActive),
        onUpdate: (self: { progress: number; getVelocity: () => number }) => {
          const p = self.progress;
          const scene = p < SCENE_SPLIT ? 'scene1_dark_road' : 'scene2_montage';
          setCinemaProgress({ progress: p, velocity: self.getVelocity() / 2000, scene });
          if (scene !== sceneRef.current) {
            sceneRef.current = scene;
            setActiveScene(scene);
          }
        },
      });
      ScrollTrigger.refresh();
    })();

    return () => {
      killed = true;
      trigger?.kill();
    };
  }, []);

  const visible = ready && inView;

  return (
    <div
      ref={rootRef}
      data-cinema={CINEMA_MARKER}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      {/* Reused R3F 3D drive (top tier only), unmodified from the FM prototype. */}
      {withSpine && !spineFailed && <SpineCanvas onFail={() => setSpineFailed(true)} />}

      {/* Footage scenes, cross-faded by the conductor. */}
      <VideoLayer
        scene={FOOTAGE_SCENES.scene1_dark_road}
        active={activeScene === 'scene1_dark_road'}
        sceneStart={0}
        sceneEnd={SCENE_SPLIT}
      />
      <VideoLayer
        scene={FOOTAGE_SCENES.scene2_montage}
        active={activeScene === 'scene2_montage'}
        sceneStart={SCENE_SPLIT}
        sceneEnd={1}
      />

      {/* Grade + 2.39:1 letterbox — the "trailer" feel (treatment Part 3). */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
      <div className="absolute inset-x-0 top-0 h-[8vh] bg-black sm:h-[10vh]" />
      <div className="absolute inset-x-0 bottom-0 h-[8vh] bg-black sm:h-[10vh]" />
    </div>
  );
}

export default CinematicLayer;

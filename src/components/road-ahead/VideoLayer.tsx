'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clipPoster,
  clipSources,
  footageReady,
  type ClipVariant,
  type FootageScene,
} from '@/lib/road-ahead/footage-manifest';
import { getCinemaProgress, subscribeCinemaProgress } from './progress';

/**
 * THE ROAD AHEAD — the footage layer (plan §4.4).
 *
 * A fixed, full-bleed background of stacked clip panels for one scene. Which
 * panel is visible is driven imperatively from the shared progress store (no
 * per-frame React re-render) so a montage advances with the visitor's thumb —
 * scroll is the throttle.
 *
 * Poster-first and fail-soft: when no CDN host is configured (`footageReady()`
 * is false), each panel renders a graded placeholder carrying the clip's
 * muted-first caption instead of a `<video>`. Real footage drops in later with
 * zero code change — only the manifest's CDN base and uploaded files.
 */
export function VideoLayer({
  scene,
  active,
  sceneStart,
  sceneEnd,
}: {
  scene: FootageScene;
  /** True while this scene owns the frame; drives play/pause + visibility. */
  active: boolean;
  /** Global progress where this scene begins / ends (0–1), to pick the beat. */
  sceneStart: number;
  sceneEnd: number;
}) {
  const [variant, setVariant] = useState<ClipVariant>('desktop');
  const ready = footageReady();
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    setVariant(window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop');
  }, []);

  // Imperatively cross-fade panels from the progress store; pick the montage
  // beat by how far progress has moved through this scene's slice.
  useEffect(() => {
    const n = scene.clips.length;
    const apply = () => {
      const { progress } = getCinemaProgress();
      let idx = 0;
      if (n > 1) {
        const span = Math.max(1e-6, sceneEnd - sceneStart);
        const local = Math.min(0.999, Math.max(0, (progress - sceneStart) / span));
        idx = Math.min(n - 1, Math.floor(local * n));
      }
      panelRefs.current.forEach((el, i) => {
        if (el) el.style.opacity = activeRef.current && i === idx ? '1' : '0';
      });
      // Only the visible video should be playing.
      videoRefs.current.forEach((v, i) => {
        if (!v) return;
        if (activeRef.current && i === idx) void v.play().catch(() => {});
        else v.pause();
      });
    };
    apply();
    return subscribeCinemaProgress(apply);
  }, [scene, sceneStart, sceneEnd]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid={`road-ahead-video-${scene.id}`}
    >
      {scene.clips.map((clip, i) => {
        const sources = clipSources(clip, variant);
        const poster = clipPoster(clip);
        return (
          <div
            key={clip.id}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: 0 }}
          >
            {ready && sources.length > 0 ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                className="h-full w-full object-cover"
                muted
                playsInline
                loop
                preload="metadata"
                poster={poster ?? undefined}
              >
                {sources.map((s) => (
                  <source key={s.src} src={s.src} type={s.type} />
                ))}
              </video>
            ) : (
              // Fail-soft placeholder: a graded panel that still tells the story.
              <div className="flex h-full w-full items-end bg-gradient-to-b from-[#0a0f16] via-[#131c26] to-[#1d2430]">
                <p className="w-full max-w-3xl px-6 pb-24 font-display text-sm uppercase tracking-[0.2em] text-white/45 sm:pb-32 sm:text-base">
                  {clip.caption}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

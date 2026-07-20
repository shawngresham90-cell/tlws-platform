'use client';

import type { CSSProperties } from 'react';
import { hasFootage, type VideoSlot } from '@/lib/road-ahead/assets';
import { useInView } from '@/lib/road-ahead/hooks';
import styles from './road-ahead.module.css';

/**
 * The full-bleed backdrop for a chapter. Renders, in order of preference:
 *   1. looping footage (only when motion is allowed, a `src` is supplied, AND
 *      the chapter is on/near screen — so footage never decodes off-screen),
 *   2. a still poster (when supplied), or
 *   3. the slot's brand gradient — always present, so a chapter is never blank.
 *
 * The backdrop is decorative (`aria-hidden`): the chapter's own text carries all
 * meaning, so screen readers skip the atmosphere. Any spoken/graphic footage can
 * still ship a captions track via the slot. ALL motion here — video, parallax
 * drift, and the drifting key light — is gated by `reduced` (which the
 * experience derives from `prefers-reduced-motion` OR the user's pause control),
 * so the pause button genuinely stops everything, satisfying WCAG 2.2.2.
 */
export function CinematicVideo({
  slot,
  progress = 0.5,
  reduced,
  priority = false,
  spineActive = false,
}: {
  slot: VideoSlot;
  /** 0→1 crossing progress for the parallax drift. */
  progress?: number;
  /** True = no motion: render a static still instead of playing video. */
  reduced: boolean;
  /** Eager-load the first chapter's media; lazy for the rest. */
  priority?: boolean;
  /** WebGL truck spine is live behind the page. */
  spineActive?: boolean;
}) {
  // Only observe (and only ever play) when motion is on and footage exists.
  const { ref, inView } = useInView<HTMLDivElement>(!reduced && hasFootage(slot));
  const showVideo = !reduced && hasFootage(slot) && (inView || priority);
  const mediaStyle = { ['--p']: progress } as CSSProperties;
  // When the 3D spine is driving and this scene has no footage yet, drop the
  // gradient so the continuous truck drive shows through; keep the vignette for
  // text contrast. Footage (when supplied) still wins and stays opaque.
  const transparent = spineActive && !hasFootage(slot);

  return (
    <div
      ref={ref}
      className={styles.backdrop}
      aria-hidden="true"
      style={{ background: transparent ? 'transparent' : slot.gradient }}
    >
      {showVideo ? (
        <video
          className={styles.backdropMedia}
          style={mediaStyle}
          autoPlay
          muted
          loop
          playsInline
          preload={priority ? 'auto' : 'metadata'}
          poster={slot.poster ?? undefined}
        >
          {slot.src ? <source src={slot.src} type="video/mp4" /> : null}
          {slot.webmSrc ? <source src={slot.webmSrc} type="video/webm" /> : null}
          {slot.captionsSrc ? (
            <track kind="captions" src={slot.captionsSrc} srcLang="en" label="English" default />
          ) : null}
        </video>
      ) : slot.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed backdrop, not content
        <img
          className={styles.backdropMedia}
          style={reduced ? undefined : mediaStyle}
          src={slot.poster}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : null}
      {!reduced && !transparent ? <span className={styles.keyLight} /> : null}
      <span className={styles.vignette} />
    </div>
  );
}

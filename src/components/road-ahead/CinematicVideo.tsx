'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { hasAnyFootage, hasFootage, hasYouTube, type VideoSlot } from '@/lib/road-ahead/assets';
import { useInView } from '@/lib/road-ahead/hooks';
import styles from './road-ahead.module.css';

/**
 * True when the browser/network is asking us to conserve data — an explicit
 * Save-Data header, or a slow (2g) effective connection. In those cases we skip
 * the looping clip and show the poster/gradient instead, so a heavy backdrop
 * never lands on a metered or slow phone. SSR-safe (defaults to false).
 */
function usePrefersLightMedia(): boolean {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
        addEventListener?: (type: 'change', listener: () => void) => void;
        removeEventListener?: (type: 'change', listener: () => void) => void;
      };
    };
    const conn = nav.connection;
    if (!conn) return;
    const evaluate = () =>
      setLight(Boolean(conn.saveData) || /(^|-)2g$/.test(conn.effectiveType ?? ''));
    evaluate();
    conn.addEventListener?.('change', evaluate);
    return () => conn.removeEventListener?.('change', evaluate);
  }, []);
  return light;
}

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
  // If a clip fails to load/decode (missing file, aborted on a flaky network),
  // latch it off and fall back to the poster/gradient — never a broken element.
  const [failed, setFailed] = useState(false);
  const lightMedia = usePrefersLightMedia();
  // Native file always wins for quality/perf. A YouTube-Unlisted mapping is the
  // lower-priority fallback used only when no local clip exists yet.
  const canPlayVideo = !reduced && hasFootage(slot) && !failed && !lightMedia;
  const canPlayYouTube = !reduced && !hasFootage(slot) && hasYouTube(slot) && !failed && !lightMedia;
  // Only observe (and only ever play) when some clip could actually play, so
  // media never decodes off-screen.
  const { ref, inView } = useInView<HTMLDivElement>(canPlayVideo || canPlayYouTube);
  const showVideo = canPlayVideo && (inView || priority);
  const showYouTube = canPlayYouTube && (inView || priority);
  const mediaStyle = { ['--p']: progress } as CSSProperties;
  // When the 3D spine is driving and this scene has NO footage of any kind yet,
  // drop the gradient so the continuous truck drive shows through; keep the
  // vignette for text contrast. Any footage (file or YouTube) stays opaque.
  const transparent = spineActive && !hasAnyFootage(slot);

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
          onError={() => setFailed(true)}
        >
          {/* WebM first: VP9-capable browsers pick the smaller payload; MP4 is
              the universal fallback. */}
          {slot.webmSrc ? <source src={slot.webmSrc} type="video/webm" /> : null}
          {slot.src ? <source src={slot.src} type="video/mp4" /> : null}
          {slot.captionsSrc ? (
            <track kind="captions" src={slot.captionsSrc} srcLang="en" label="English" default />
          ) : null}
        </video>
      ) : showYouTube && slot.youtubeId ? (
        // Privacy-enhanced (youtube-nocookie) cover-fit background clip. Muted +
        // looped + controls-off so it reads as ambient footage, not an embed. The
        // wrapper crops the fixed 16:9 iframe to fill any aspect (see .ytCover).
        <div className={styles.ytCover} style={mediaStyle}>
          <iframe
            className={styles.ytFrame}
            src={`https://www.youtube-nocookie.com/embed/${slot.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${slot.youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0`}
            title=""
            aria-hidden="true"
            tabIndex={-1}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            loading={priority ? 'eager' : 'lazy'}
          />
        </div>
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

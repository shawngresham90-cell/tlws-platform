'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  effectiveEdit,
  hasAnyFootage,
  hasFootage,
  hasYouTube,
  type ColorGrade,
  type FootageEdit,
  type VideoSlot,
} from '@/lib/road-ahead/assets';
import { useInView } from '@/lib/road-ahead/hooks';
import { duckForReveal, soundOn } from './audio';
import styles from './road-ahead.module.css';

// The precise YouTube segment/speed player (YouTube IFrame API) is only needed
// when a moment trims a YouTube source or slows it — lazy-loaded so its code and
// the external API script never touch the initial bundle or whole-clip embeds.
const YouTubeCinema = dynamic(() => import('./YouTubeCinema'), { ssr: false });

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

/** Small-screen detection so per-moment `mobile` overrides can apply. SSR-safe. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

const GRADE_CLASS: Record<ColorGrade, string> = {
  none: '',
  night: styles.gradeNight,
  dawn: styles.gradeDawn,
  noir: styles.gradeNoir,
  warm: styles.gradeWarm,
  steel: styles.gradeSteel,
  cool: styles.gradeCool,
};

/** Build the shared media style: parallax `--p`, crop (object-position + zoom). */
function mediaStyleFor(progress: number, edit: FootageEdit): CSSProperties {
  const s: CSSProperties = { ['--p']: progress } as CSSProperties;
  if (edit.zoom && edit.zoom >= 1) (s as Record<string, unknown>)['--zoom'] = edit.zoom;
  if (edit.crop) s.objectPosition = edit.crop;
  return s;
}

/**
 * The full-bleed backdrop for a chapter. Renders, in order of preference:
 *   1. looping footage (only when motion is allowed, footage is supplied, AND
 *      the chapter is on/near screen — so footage never decodes off-screen),
 *   2. a still poster (when supplied), or
 *   3. the slot's brand gradient — always present, so a chapter is never blank.
 *
 * A slot may carry a cinematic EDIT (footage.json): a start/end segment, playback
 * speed, loop, crop/zoom reframe, color grade, fade, and audio duck — so one long
 * source can supply many scenes. Native `<video>` applies all of it directly;
 * a trimmed/slowed YouTube source uses the lazy IFrame-API player, while a
 * whole-clip YouTube embed stays a plain, script-free nocookie iframe.
 *
 * The backdrop is decorative (`aria-hidden`). ALL motion is gated by `reduced`
 * (prefers-reduced-motion OR the pause control), satisfying WCAG 2.2.2.
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
  const [failed, setFailed] = useState(false);
  const lightMedia = usePrefersLightMedia();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);

  const edit = effectiveEdit(slot, isMobile);

  const canPlayVideo = !reduced && hasFootage(slot) && !failed && !lightMedia;
  const canPlayYouTube = !reduced && !hasFootage(slot) && hasYouTube(slot) && !failed && !lightMedia;
  const { ref, inView } = useInView<HTMLDivElement>(canPlayVideo || canPlayYouTube);
  const showVideo = canPlayVideo && (inView || priority);
  const showYouTube = canPlayYouTube && (inView || priority);

  const mediaStyle = mediaStyleFor(progress, edit);
  const gradeClass = GRADE_CLASS[edit.grade] ?? '';
  // A trimmed or slowed YouTube source needs the IFrame-API player; a whole clip
  // stays a plain nocookie iframe (no external script).
  const youtubePrecise = edit.end != null || edit.speed != null;
  const fadeStyle: CSSProperties =
    edit.fadeIn && !reduced ? { animation: `raMediaFade ${edit.fadeIn}s ease-out both` } : {};

  // Native <video>: apply the segment (seek to start, loop start→end), playback
  // speed, and audio duck. Whole-clip slots (no start/end) use the native loop
  // attribute and behave exactly as before.
  const hasSegment = edit.start != null || edit.end != null;
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showVideo) return;
    if (edit.speed && edit.speed > 0) el.playbackRate = edit.speed;
    const start = edit.start ?? 0;
    const onMeta = () => {
      if (edit.start != null && Number.isFinite(el.duration)) {
        try {
          el.currentTime = start;
        } catch {
          /* seek may fail pre-buffer; the timeupdate handler recovers */
        }
      }
    };
    const onTime = () => {
      if (edit.end != null && el.currentTime >= edit.end) {
        el.currentTime = start;
      }
    };
    const onEnded = () => {
      if (edit.loop) {
        el.currentTime = start;
        void el.play().catch(() => {});
      }
    };
    el.addEventListener('loadedmetadata', onMeta);
    if (edit.end != null) el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [showVideo, edit.start, edit.end, edit.speed, edit.loop]);

  // Duck the ambience beds while a `duck` moment is on screen (only if sound on).
  useEffect(() => {
    if ((showVideo || showYouTube) && edit.duck && soundOn()) duckForReveal();
  }, [showVideo, showYouTube, edit.duck]);

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
          ref={videoRef}
          className={cnMedia(gradeClass)}
          style={{ ...mediaStyle, ...fadeStyle }}
          autoPlay
          muted
          // Whole-clip loop via the native attribute; a trimmed segment loops via
          // the effect above (start→end), so don't double-loop it.
          loop={edit.loop && !hasSegment}
          playsInline
          preload={priority || hasSegment ? 'auto' : 'metadata'}
          poster={slot.poster ?? undefined}
          onError={() => setFailed(true)}
        >
          {slot.webmSrc ? <source src={slot.webmSrc} type="video/webm" /> : null}
          {slot.src ? <source src={slot.src} type="video/mp4" /> : null}
          {slot.captionsSrc ? (
            <track kind="captions" src={slot.captionsSrc} srcLang="en" label="English" default />
          ) : null}
        </video>
      ) : showYouTube && slot.youtubeId && youtubePrecise && !isMobile ? (
        // Trimmed/slowed YouTube moment → precise IFrame-API player (lazy).
        <YouTubeCinema
          videoId={slot.youtubeId}
          start={edit.start}
          end={edit.end}
          speed={edit.speed}
          className={cnCover(gradeClass)}
          style={{ ...mediaStyle, ...fadeStyle }}
        />
      ) : showYouTube && slot.youtubeId ? (
        // Whole-clip (or mobile) YouTube → plain, script-free nocookie iframe.
        // `start` still begins at the moment; loop replays the clip.
        <div className={cnCover(gradeClass)} style={{ ...mediaStyle, ...fadeStyle }}>
          <iframe
            className={styles.ytFrame}
            src={youtubeSrc(slot.youtubeId, edit)}
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
          className={cnMedia(gradeClass)}
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

function cnMedia(grade: string): string {
  return grade ? `${styles.backdropMedia} ${grade}` : styles.backdropMedia;
}
function cnCover(grade: string): string {
  return grade ? `${styles.ytCover} ${grade}` : styles.ytCover;
}

/** Build the plain nocookie embed URL, honouring a `start` offset when set. */
function youtubeSrc(id: string, edit: FootageEdit): string {
  const start = edit.start != null ? `&start=${Math.floor(edit.start)}` : '';
  return (
    `https://www.youtube-nocookie.com/embed/${id}` +
    `?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&rel=0` +
    `&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0${start}`
  );
}

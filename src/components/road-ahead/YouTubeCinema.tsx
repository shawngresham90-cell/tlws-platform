'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import styles from './road-ahead.module.css';

/**
 * Precise, ambient YouTube playback for a TRIMMED or SLOWED moment — plays a
 * `start`–`end` segment on loop at an optional speed, muted, controls-off, via
 * the YouTube IFrame Player API (privacy-enhanced nocookie host). This is the
 * ONLY path that loads the external API script, and CinematicVideo only mounts
 * it when a moment actually needs segment/speed control — whole-clip embeds stay
 * script-free. Lazy-loaded via next/dynamic, so nothing here is in the initial
 * bundle. If the API fails to load, it renders nothing over the gradient — never
 * a broken element.
 */

type YTPlayer = {
  mute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YT API missing after load'));
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => reject(new Error('YT API failed to load'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

export default function YouTubeCinema({
  videoId,
  start,
  end,
  speed,
  className,
  style,
}: {
  videoId: string;
  start: number | null;
  end: number | null;
  speed: number | null;
  className?: string;
  style?: CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let timer = 0;
    const from = start ?? 0;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            cc_load_policy: 0,
            start: Math.floor(from),
          },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              const p = e.target;
              p.mute();
              if (speed && speed > 0) p.setPlaybackRate(speed);
              if (start != null) p.seekTo(from, true);
              p.playVideo();
              const tick = () => {
                if (cancelled || !player) return;
                try {
                  if (end != null && player.getCurrentTime() >= end) player.seekTo(from, true);
                } catch {
                  /* player not ready — try again next tick */
                }
                timer = window.setTimeout(tick, 250);
              };
              tick();
            },
          },
        });
      })
      .catch(() => {
        /* API unavailable — leave the gradient showing, never a broken element. */
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [videoId, start, end, speed]);

  return (
    <div className={className} style={style}>
      <div ref={hostRef} className={styles.ytFrame} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy — the cinematic chunk (GSAP + conductor + video layer, and on the top
// tier the reused R3F spine) is never in the initial payload and is fetched
// only after the ladder decides this device should get it.
const CinematicLayer = dynamic(() => import('./CinematicLayer'), { ssr: false });

/**
 * THE ROAD AHEAD — capability ladder (plan §1.3, extends the FM ExperienceShell
 * pattern). The SSR story is always fully rendered by the page; this only ever
 * *adds* the cinematic enhancement behind it.
 *
 *   lite  — prefers-reduced-motion OR Save-Data: nothing mounts; the static
 *           server-rendered story is the whole experience (a11y + no-JS parity).
 *   video — everyone else without desktop-class WebGL (mobile is primary):
 *           GSAP conductor + footage layer, no 3D.
 *   full  — desktop-class device with WebGL: adds the reused R3F spine.
 */
type Tier = 'lite' | 'video' | 'full';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function RoadAheadExperience() {
  const [tier, setTier] = useState<Tier>('lite');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    if (reduced || nav.connection?.saveData === true) return; // stay lite

    const desktopClass =
      window.matchMedia('(pointer: fine)').matches &&
      (nav.deviceMemory === undefined || nav.deviceMemory >= 4);
    const full = desktopClass && webglAvailable();

    const promote = () => setTier(full ? 'full' : 'video');
    // Defer to idle so first paint + the SSR story are never delayed.
    const idle =
      'requestIdleCallback' in window
        ? (cb: () => void) => (window as Window).requestIdleCallback!(cb, { timeout: 2500 })
        : (cb: () => void) => window.setTimeout(cb, 350);
    idle(promote);
  }, []);

  if (tier === 'lite') return null;
  return <CinematicLayer withSpine={tier === 'full'} />;
}

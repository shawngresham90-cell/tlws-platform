'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { HeroScene } from './HeroScene';

const SpineCanvas = dynamic(() => import('./spine/SpineCanvas'), { ssr: false });

/**
 * FM-1 capability ladder. Decides, on the client, whether this visit gets the
 * WebGL spine or stays on the CSS "lite" tier — and the decision can only ever
 * *add* the canvas behind content that is already fully rendered, so there is
 * no layout shift and nothing to lose if WebGL dies mid-visit.
 *
 *   never (stay lite):  prefers-reduced-motion · Save-Data · no WebGL context
 *   auto (idle):        fine-pointer devices (desktop-class) with ≥4GB memory
 *   tap to upgrade:     everyone else (the "Play the drive" button)
 *
 * The SSR payload always renders the lite HeroScene, so first paint, SEO and
 * no-JS visitors are identical to the Phase-0 prototype.
 */
type Tier = 'lite' | 'offer' | 'spine';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function ExperienceShell({ founderCount }: { founderCount: number }) {
  const [tier, setTier] = useState<Tier>('lite');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const saveData = nav.connection?.saveData === true;
    if (reduced || saveData || !webglAvailable()) return; // stay lite, no offer
    const desktopClass =
      window.matchMedia('(pointer: fine)').matches &&
      (nav.deviceMemory === undefined || nav.deviceMemory >= 4);
    if (desktopClass) {
      const idle =
        'requestIdleCallback' in window
          ? (cb: () => void) => (window as Window).requestIdleCallback!(cb, { timeout: 2500 })
          : (cb: () => void) => window.setTimeout(cb, 350);
      idle(() => setTier('spine'));
    } else {
      setTier('offer');
    }
  }, []);

  return (
    <>
      {tier === 'spine' && <SpineCanvas onFail={() => setTier('lite')} />}
      <HeroScene founderCount={founderCount} visual={tier === 'spine' ? 'canvas' : 'css'} />
      {tier === 'offer' && (
        <div className="relative z-10 -mt-10 flex justify-center pb-6">
          <button
            type="button"
            onClick={() => setTier('spine')}
            className="rounded-full border border-line bg-asphalt/85 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            Play the drive
          </button>
        </div>
      )}
    </>
  );
}

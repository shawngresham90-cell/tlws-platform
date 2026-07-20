'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { founderNumberWidth, type WallFounder } from '@/lib/road-ahead/founder-number';
import type { FounderTier } from '@/lib/community/founders';
import { useMounted } from '@/lib/road-ahead/hooks';
import { enableSound, disableSound, soundOn, subscribeSound } from './audio';
import { FounderPlaque } from './FounderPlaque';
import styles from './road-ahead.module.css';

/**
 * The Founder Wall as a wall of real materials. Founders are grouped into tier
 * bands, top of the wall first — premium brass sponsor plaques, then forged-iron
 * and brushed-steel plaques, then a course of carved red-clay bricks. Higher
 * tiers get larger, more impressive plaques. Each plaque carves its own name as
 * the visitor reaches it (see FounderPlaque); this component lays out the bands,
 * offers the "Enter with sound" control (browsers block audio until a click),
 * and collapses to a flat, fully-readable wall under reduced motion.
 *
 * Empty state is intentional and inviting: an empty wall shows founder No. 001 is
 * still open, which is the whole point of the chapter.
 */

type BandSpec = {
  key: string;
  heading: string;
  tiers: FounderTier[];
  size: 'lg' | 'md' | 'sm';
  /** grid layout for this band's plaques */
  grid: string;
  /** true = lay the plaques into a mortar course (bricks) */
  course?: boolean;
};

const BANDS: BandSpec[] = [
  {
    key: 'sponsor',
    heading: 'Founding Sponsors',
    tiers: ['equipment_sponsor', 'student_sponsor'],
    size: 'lg',
    grid: 'grid grid-cols-1 gap-4',
  },
  {
    key: 'iron',
    heading: 'Iron Founders',
    tiers: ['iron'],
    size: 'md',
    grid: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
  },
  {
    key: 'steel',
    heading: 'Steel Founders',
    tiers: ['steel'],
    size: 'md',
    grid: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
  },
  {
    key: 'brick',
    heading: 'Brick Founders',
    tiers: ['brick'],
    size: 'sm',
    grid: 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4',
    course: true,
  },
];

/** The wall-scoped sound gate. Browsers block audio until an explicit click, so
 * the synchronized carving scrapes only play after the visitor opts in here. */
function SoundGate() {
  const mounted = useMounted();
  const [on, setOn] = useState(false);
  // Sync to the engine's current state on mount — the visitor may have enabled
  // sound from the global control before reaching the wall — then follow changes.
  useEffect(() => {
    setOn(soundOn());
    return subscribeSound(setOn);
  }, []);
  if (!mounted) return null;
  return (
    <button
      type="button"
      onClick={() => (on ? disableSound() : void enableSound())}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-2 rounded-card border px-4 py-2 font-display text-sm uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        on
          ? 'border-signal/60 text-signal'
          : 'border-signal bg-signal text-asphalt hover:bg-signal-600',
      )}
    >
      <span aria-hidden="true">{on ? '♪' : '▶'}</span>
      {on ? 'Sound on' : 'Enter with sound'}
    </button>
  );
}

export function FounderWall3D({
  founders,
  progress,
  reduced,
}: {
  founders: WallFounder[];
  /** 0→1 reveal progress for the wall's entrance. */
  progress: number;
  reduced: boolean;
}) {
  const width = founderNumberWidth(founders.length || 1);

  if (founders.length === 0) {
    return (
      <div className={cn('relative overflow-hidden rounded-card p-10 text-center', styles.matIron)}>
        <p className={cn('font-display text-4xl', styles.founderNumber, styles.carveMetalDark)}>
          No. 001
        </p>
        <p className={cn('mt-3 font-display text-xl uppercase', styles.carveMetalDark)}>
          The wall is waiting
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
          Be the first name drivers see. Founder number one is open.
        </p>
      </div>
    );
  }

  const wrapStyle = reduced ? undefined : ({ ['--p']: progress } as CSSProperties);

  return (
    <div className={cn(!reduced && styles.reveal)} style={wrapStyle}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SoundGate />
        <span className="text-xs text-muted">
          Turn on sound to hear each name carved. It works silently too.
        </span>
      </div>

      <div className="flex flex-col gap-8">
        {BANDS.map((band) => {
          const inBand = founders.filter((f) => band.tiers.includes(f.tier));
          if (inBand.length === 0) return null;
          return (
            <section key={band.key} aria-label={band.heading}>
              <h3 className="mb-3 font-display text-sm uppercase tracking-[0.25em] text-muted">
                {band.heading}
              </h3>
              <ul
                className={cn(
                  'list-none',
                  band.grid,
                  !reduced && styles.plaqueBand,
                  band.course && styles.brickCourse,
                )}
              >
                {inBand.map((f) => (
                  <li key={f.id}>
                    <FounderPlaque
                      founder={f}
                      numberWidth={width}
                      size={band.size}
                      reduced={reduced}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

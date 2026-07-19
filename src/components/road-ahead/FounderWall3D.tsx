'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { founderNumberWidth, type WallFounder } from '@/lib/road-ahead/founder-number';
import { FounderTile3D } from './FounderTile3D';
import styles from './road-ahead.module.css';

/**
 * The 3D Founder Wall. Real published founders (built into a stable sequence by
 * founder-number.ts) rendered in a perspective grid that rakes toward the viewer
 * as the chapter scrolls in, each tile carrying its own depth. Under reduced
 * motion it collapses to a flat, fully-readable grid — same data, no 3D.
 *
 * Empty state is intentional and inviting: an empty wall shows that founder
 * No. 001 is still open, which is the whole point of the chapter.
 */
export function FounderWall3D({
  founders,
  progress,
  reduced,
}: {
  founders: WallFounder[];
  /** 0→1 reveal progress driving the wall tilt/depth. */
  progress: number;
  reduced: boolean;
}) {
  const width = founderNumberWidth(founders.length || 1);

  if (founders.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-asphalt-800 p-10 text-center">
        <p className={cn('font-display text-4xl text-signal', styles.founderNumber)}>No. 001</p>
        <p className="mt-3 font-display text-xl uppercase text-ink">The wall is waiting</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Be the first name drivers see. Founder number one is open.
        </p>
      </div>
    );
  }

  const stageStyle = reduced ? undefined : ({ ['--p']: progress } as CSSProperties);

  return (
    <div className={cn(!reduced && styles.stage)}>
      <ul
        className={cn(
          'grid list-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
          !reduced && styles.wall,
        )}
        style={stageStyle}
      >
        {founders.map((f, i) => (
          <li key={f.id}>
            <FounderTile3D
              founder={f}
              numberWidth={width}
              depth={((i % 4) - 1.5) * 22}
              reduced={reduced}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  formatFounderNumber,
  isSafeExternalUrl,
  type WallFounder,
} from '@/lib/road-ahead/founder-number';
import styles from './road-ahead.module.css';

/**
 * One founder on the 3D wall: their founder number, name, tier, and optional
 * business link. Never shows an amount — contribution amounts are private and
 * never leave the DB. `depth` gives the tile its own Z distance so the wall
 * reads as real 3D during the scroll reveal; under reduced motion the tile is a
 * flat, static card (no transform, no sheen animation).
 */
export function FounderTile3D({
  founder,
  numberWidth,
  depth,
  reduced,
}: {
  founder: WallFounder;
  numberWidth: number;
  depth: number;
  reduced: boolean;
}) {
  const style = reduced ? undefined : ({ ['--z']: depth } as CSSProperties);
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card border border-line bg-asphalt-800 p-4',
        !reduced && styles.tile,
      )}
      style={style}
    >
      {!reduced ? <span className={styles.tileSheen} aria-hidden="true" /> : null}
      <p className={cn('font-display text-2xl text-signal sm:text-3xl', styles.founderNumber)}>
        {formatFounderNumber(founder.wallNumber, numberWidth)}
      </p>
      <p className="mt-1 font-display text-base uppercase leading-tight text-ink sm:text-lg">
        {founder.displayName}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {founder.tierLabel}
      </p>
      {founder.businessName ? (
        isSafeExternalUrl(founder.businessUrl) ? (
          <a
            href={founder.businessUrl ?? undefined}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="mt-2 inline-block text-xs text-muted underline-offset-2 hover:text-signal hover:underline"
          >
            {founder.businessName}
          </a>
        ) : (
          <p className="mt-2 text-xs text-muted">{founder.businessName}</p>
        )
      ) : null}
    </div>
  );
}

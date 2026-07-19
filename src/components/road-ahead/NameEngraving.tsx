'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatFounderNumber } from '@/lib/road-ahead/founder-number';
import styles from './road-ahead.module.css';

/**
 * Scene 6 — the cinematic name engraving. No video: a brushed-metal founder
 * plate with the next open founder number and an engraved "your name here",
 * crossed once by a rake of light as the scene scrolls in (the "cut"). It is
 * meant to feel like a plaque on a wall, not a form field — the personal beat
 * right before the call to put your name down for real. Presentational: the
 * scene wrapper owns the section, ref, and scroll progress.
 */
export function NameEngraving({
  nextNumber,
  numberWidth,
  progress,
  reduced,
}: {
  nextNumber: number;
  numberWidth: number;
  /** 0→1 reveal progress driving the engraving light. */
  progress: number;
  reduced: boolean;
}) {
  const sweepStyle = reduced ? undefined : ({ ['--p']: progress } as CSSProperties);
  return (
    <div className="mx-auto max-w-2xl">
      <div className={cn('relative px-6 py-12 sm:px-12 sm:py-16', styles.plate)}>
        {!reduced ? (
          <span className={styles.etchSweep} style={sweepStyle} aria-hidden="true" />
        ) : null}
        <p className={cn('text-center text-xs uppercase tracking-[0.35em]', styles.engraved)}>
          Founder
        </p>
        <p
          className={cn(
            'mt-4 text-center font-display text-6xl sm:text-7xl',
            styles.founderNumber,
            styles.engravedSignal,
          )}
        >
          {formatFounderNumber(nextNumber, numberWidth)}
        </p>
        <div className="mx-auto mt-6 h-px w-24 bg-line" />
        <p
          className={cn(
            'mt-6 text-center font-display text-3xl uppercase tracking-wider sm:text-4xl',
            styles.engraved,
          )}
        >
          Your name here
        </p>
      </div>
      <p className="mt-6 text-center text-lg text-muted">
        Every founder is engraved on the wall in the order they stepped up. This plate is still
        blank. The next number is yours.
      </p>
    </div>
  );
}

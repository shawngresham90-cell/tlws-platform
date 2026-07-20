'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatFounderNumber } from '@/lib/road-ahead/founder-number';
import { cueEngrave, duckForReveal } from './audio';
import { downloadFounderCard, sanitizeFounderName } from './founder-card';
import styles from './road-ahead.module.css';

/**
 * Scene 6 — the cinematic name engraving. No video: a brushed-metal founder
 * plate with the next open founder number and a light rake (the "cut"). A
 * visitor can type their name to see it engraved onto the plate — accompanied by
 * the synth engrave thump and an audio duck — and download a shareable Founder
 * Card PNG. The name lives only in local state (no upload, no persistence, no
 * account); it is purely the emotional beat before the real call to action.
 */
export function NameEngraving({
  nextNumber,
  numberWidth,
  progress,
  reduced,
  tierLabel,
}: {
  nextNumber: number;
  numberWidth: number;
  /** 0→1 reveal progress driving the engraving light. */
  progress: number;
  reduced: boolean;
  tierLabel?: string;
}) {
  const sweepStyle = reduced ? undefined : ({ ['--p']: progress } as CSSProperties);
  const [draft, setDraft] = useState('');
  const [engravedName, setEngravedName] = useState('');

  const engrave = (e: FormEvent) => {
    e.preventDefault();
    const clean = sanitizeFounderName(draft);
    if (!clean) return;
    setEngravedName(clean);
    // Atmosphere only (no-ops when the soundtrack is off).
    cueEngrave();
    duckForReveal();
  };

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
            'mt-6 break-words text-center font-display text-3xl uppercase tracking-wider sm:text-4xl',
            engravedName ? styles.engravedSignal : styles.engraved,
          )}
        >
          {engravedName || 'Your name here'}
        </p>
      </div>

      {!engravedName ? (
        <form onSubmit={engrave} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          <label htmlFor="founder-name" className="sr-only">
            Your name
          </label>
          <input
            id="founder-name"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={40}
            autoComplete="name"
            placeholder="Type your name"
            className="flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink placeholder:text-muted focus-visible:border-signal focus-visible:outline-none"
          />
          <button
            type="submit"
            className="rounded-card bg-signal px-5 py-3 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            Engrave it
          </button>
        </form>
      ) : (
        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3">
          <p className="text-center text-lg text-ink" aria-live="polite">
            That&rsquo;s how it looks on the wall,{' '}
            <span className="font-semibold text-signal">{engravedName}</span>. Take it with you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                downloadFounderCard({
                  name: engravedName,
                  number: nextNumber,
                  numberWidth,
                  tierLabel,
                })
              }
              className="rounded-card bg-signal px-5 py-3 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              Download my founder card
            </button>
            <button
              type="button"
              onClick={() => {
                setEngravedName('');
                setDraft('');
              }}
              className="rounded-card border border-line px-5 py-3 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              Try another name
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Just a preview — your real place on the wall is claimed on the Founders page. Nothing here
        is saved or shared.
      </p>
    </div>
  );
}

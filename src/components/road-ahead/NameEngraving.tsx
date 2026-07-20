'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatFounderNumber } from '@/lib/road-ahead/founder-number';
import { cueEngrave, cueCarveTick, cueCarveFinish, duckForReveal, soundOn } from './audio';
import { downloadFounderCard, sanitizeFounderName } from './founder-card';
import styles from './road-ahead.module.css';

/**
 * Scene 6 — the cinematic name INDUCTION. A visitor types their name and taps
 * "See it on the wall." The lights draw down, the plate pushes toward the lens,
 * and their name is cut into brushed steel letter by letter — sparks, a rising
 * glow, synchronized carve audio, and a final weld-flash reveal — before the
 * Founder Card is offered. It should feel like being inducted into something
 * historic.
 *
 * The name lives only in local state (no upload, no persistence, no account).
 * Under reduced motion it reveals instantly and statically; with sound off the
 * whole sequence still plays, just silent.
 */

const CARVE_STEP_MS = 64;
/** The founding class year — a brand constant stamped on the induction plate,
 * not a live clock (stable across renders, no Date dependency). */
const FOUNDING_YEAR = 2026;
type Phase = 'idle' | 'carving' | 'done';

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
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const resultRef = useRef<HTMLParagraphElement>(null);
  const timers = useRef<number[]>([]);

  const glyphs = Array.from(name);

  // Move focus to the confirmation once the induction completes, so keyboard/AT
  // users aren't dropped to <body> when the form is replaced.
  useEffect(() => {
    if (phase === 'done') resultRef.current?.focus();
  }, [phase]);

  // Clear any scheduled carve audio/timers on unmount.
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const engrave = (e: FormEvent) => {
    e.preventDefault();
    const clean = sanitizeFounderName(draft);
    if (!clean) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setName(clean);

    if (reduced) {
      setPhase('done');
      return;
    }

    setPhase('carving');
    cueEngrave();
    duckForReveal();
    const chars = Array.from(clean);
    const total = chars.length * CARVE_STEP_MS;
    if (soundOn()) {
      chars.forEach((ch, i) => {
        if (ch.trim() === '') return;
        timers.current.push(window.setTimeout(() => cueCarveTick('metal', i), i * CARVE_STEP_MS));
      });
      timers.current.push(window.setTimeout(() => cueCarveFinish('metal'), total));
    }
    timers.current.push(window.setTimeout(() => setPhase('done'), total + 520));
  };

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setName('');
    setDraft('');
    setPhase('idle');
  };

  // 'carving' animates the letters in; 'done'/reduced holds them fully carved.
  const carveState = !reduced && phase === 'carving' ? styles.carveGo : styles.carveStatic;

  const carveVars = {
    ['--n']: glyphs.length,
    ['--step']: `${CARVE_STEP_MS}ms`,
    ['--dust']: 'rgba(255,245,200,0.95)',
  } as CSSProperties;

  const inducting = phase !== 'idle';

  return (
    <div className="mx-auto max-w-2xl">
      <div className={cn('relative', inducting && !reduced && styles.inductStage)}>
        {inducting && !reduced ? <span className={styles.plateHalo} aria-hidden="true" /> : null}
        <div
          className={cn(
            'relative px-6 py-12 sm:px-12 sm:py-16',
            styles.plate,
            inducting && !reduced && styles.inducting,
          )}
        >
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
              name ? styles.engravedSignal : styles.engraved,
            )}
          >
            {name ? (
              <>
                <span className="sr-only">{name}</span>
                <span className={cn(styles.carve, carveState)} style={carveVars} aria-hidden="true">
                  <span className={styles.chisel} />
                  {glyphs.map((ch, i) => (
                    <span key={i} className={styles.glyph} style={{ ['--i']: i } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              </>
            ) : (
              'Your name here'
            )}
          </p>
          <p
            className={cn(
              'mt-7 text-[10px] uppercase tracking-[0.4em] sm:text-xs',
              styles.hallmark,
              phase === 'done' && styles.hallmarkStruck,
            )}
          >
            <span className={styles.hallmarkRule} aria-hidden="true" />
            Founding Class · {FOUNDING_YEAR}
            <span className={styles.hallmarkRule} aria-hidden="true" />
          </p>
        </div>
      </div>

      {phase !== 'done' ? (
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
            See it on the wall
          </button>
        </form>
      ) : (
        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3">
          <p
            ref={resultRef}
            tabIndex={-1}
            className="text-center text-lg text-ink focus-visible:outline-none"
            aria-live="polite"
          >
            That&rsquo;s how it looks on the wall,{' '}
            <span className="font-semibold text-signal">{name}</span> — Founder{' '}
            {formatFounderNumber(nextNumber, numberWidth)}. Take it with you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                downloadFounderCard({ name, number: nextNumber, numberWidth, tierLabel })
              }
              className="rounded-card bg-signal px-5 py-3 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              Download my founder card
            </button>
            <button
              type="button"
              onClick={reset}
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

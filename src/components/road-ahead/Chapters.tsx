'use client';

import { useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { useElementProgress } from '@/lib/road-ahead/hooks';
import { subBeat } from '@/lib/road-ahead/scroll-math';
import type { VideoSlot } from '@/lib/road-ahead/assets';
import { ECOSYSTEM_PILLARS } from '@/lib/road-ahead/ecosystem';
import { type WallFounder } from '@/lib/road-ahead/founder-number';
import type { CampaignProgress } from '@/lib/community/founders';
import { CinematicVideo } from './CinematicVideo';
import { FounderWall3D } from './FounderWall3D';
import { NameEngraving } from './NameEngraving';
import styles from './road-ahead.module.css';

/**
 * The seven scenes of THE ROAD AHEAD (locked treatment). Scenes 1–4 and 7 are
 * footage-backed narrative beats (footage slot → gradient fallback); Scene 5 is
 * the 3D Founder Wall and Scene 6 the name engraving — both video-free by
 * design. A single reveal mapping is shared: content reaches full opacity by the
 * time a scene reaches viewport center and holds it. Under `reduced`, every
 * reveal is forced to its final, static state.
 */

type Register = (el: HTMLElement | null) => void;

/** Props for a footage-backed scene. `spineActive` = the WebGL truck drive is live. */
type SceneProps = {
  reduced: boolean;
  register: Register;
  spineActive?: boolean;
  /** Resolved backdrop slot for this scene (footage if dropped in, else gradient). */
  backdrop: VideoSlot | null;
};

/** Attach both the parallax-progress ref and the timeline registration to one node. */
function useChapter(reduced: boolean, register: Register) {
  const { ref, progress } = useElementProgress<HTMLElement>(!reduced);
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      ref.current = el;
      register(el);
    },
    [ref, register],
  );
  return { setRef, progress };
}

/** Style for a reveal element at local progress `p` (undefined under reduced motion). */
function reveal(p: number, reduced: boolean): CSSProperties | undefined {
  return reduced ? undefined : ({ ['--p']: p } as CSSProperties);
}

const SECTION_CLASS = 'relative flex min-h-[100svh] w-full items-center';

/* --------------------------------------------------------- 1. Night Drive */

export function ChapterNight({ reduced, register, spineActive, backdrop }: SceneProps) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.15, 0.5);
  return (
    <section id="scene-night" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      {backdrop ? (
        <CinematicVideo
          slot={backdrop}
          progress={progress}
          reduced={reduced}
          spineActive={spineActive}
          priority
        />
      ) : null}
      <Container className="py-28 text-center sm:py-32">
        <p className={cn('eyebrow', styles.settle)} style={reveal(p, reduced)}>
          The Road Ahead
        </p>
        <h1
          className={cn('display-hero mx-auto mt-4 max-w-4xl', styles.settle)}
          style={reveal(p, reduced)}
        >
          It starts in the dark
        </h1>
        <p
          className={cn('mx-auto mt-6 max-w-xl text-lg text-muted sm:text-xl', styles.reveal)}
          style={reveal(p, reduced)}
        >
          Long hours. Empty roads. Just headlights and the discipline to keep going. This is the
          life — and where it can lead.
        </p>
        <div className={cn('mt-10 flex items-center justify-center', !reduced && styles.scrollCue)}>
          <span className="flex flex-col items-center gap-2 text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-widest">Scroll</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </span>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- 2. The Pre-Trip */

export function ChapterPreTrip({ reduced, register, spineActive, backdrop }: SceneProps) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.15, 0.5);
  return (
    <section id="scene-pretrip" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      {backdrop ? (
        <CinematicVideo
          slot={backdrop}
          progress={progress}
          reduced={reduced}
          spineActive={spineActive}
        />
      ) : null}
      <Container className="py-28">
        <div className="max-w-3xl">
          <p className={cn('eyebrow', styles.reveal)} style={reveal(p, reduced)}>
            Before the wheels turn
          </p>
          <h2 className={cn('display-section mt-4', styles.settle)} style={reveal(p, reduced)}>
            The job is won before you roll
          </h2>
          <p
            className={cn('mt-6 text-lg leading-relaxed text-ink', styles.reveal)}
            style={reveal(reduced ? 1 : subBeat(progress, 0.2, 0.55), reduced)}
          >
            The walk-around. The lights, the tires, the air brakes. Backing it in clean. Nobody
            films the pre-trip — but it&rsquo;s where a professional is made. Trucking Life teaches
            the craft the right way, from day one.
          </p>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- 3. The Grind */

export function ChapterGrind({ reduced, register, spineActive, backdrop }: SceneProps) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.15, 0.5);
  return (
    <section id="scene-grind" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      {backdrop ? (
        <CinematicVideo
          slot={backdrop}
          progress={progress}
          reduced={reduced}
          spineActive={spineActive}
        />
      ) : null}
      <Container className="py-28">
        <div className="ml-auto max-w-3xl text-right">
          <p className={cn('eyebrow', styles.reveal)} style={reveal(p, reduced)}>
            The miles nobody sees
          </p>
          <h2 className={cn('display-section mt-4', styles.settle)} style={reveal(p, reduced)}>
            Rain, truck stops, and 3 a.m.
          </h2>
          <p
            className={cn('mt-6 text-lg leading-relaxed text-ink', styles.reveal)}
            style={reveal(reduced ? 1 : subBeat(progress, 0.2, 0.55), reduced)}
          >
            The empty highway. The rain on the glass. The late nights that ask everything of you.
            It&rsquo;s a hard life — and it&rsquo;s a good one, when someone shows you how to run it
            right.
          </p>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- 4. First Light */

export function ChapterFirstLight({ reduced, register, spineActive, backdrop }: SceneProps) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.1, 0.45);
  return (
    <section id="scene-firstlight" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      {backdrop ? (
        <CinematicVideo
          slot={backdrop}
          progress={progress}
          reduced={reduced}
          spineActive={spineActive}
        />
      ) : null}
      <Container className="py-28">
        <p className={cn('eyebrow', styles.reveal)} style={reveal(p, reduced)}>
          Then the sun comes up
        </p>
        <h2
          className={cn('display-section mt-4 max-w-3xl', styles.settle)}
          style={reveal(p, reduced)}
        >
          This is what we built for the road ahead
        </h2>
        <p
          className={cn('mt-4 max-w-2xl text-lg text-muted', styles.reveal)}
          style={reveal(reduced ? 1 : subBeat(progress, 0.15, 0.5), reduced)}
        >
          One place for the whole journey — from your first permit question to your first paycheck
          behind the wheel.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM_PILLARS.map((pillar, i) => {
            const cardP = reduced ? 1 : subBeat(progress, 0.15 + i * 0.03, 0.5 + i * 0.03);
            return (
              <Link
                key={pillar.id}
                href={pillar.href}
                className={cn(
                  'group flex flex-col rounded-card border border-line bg-asphalt/80 p-6 backdrop-blur transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
                  styles.reveal,
                )}
                style={reveal(cardP, reduced)}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-signal">
                  {pillar.tagline}
                </span>
                <span className="mt-2 font-display text-xl uppercase text-ink group-hover:text-signal">
                  {pillar.name}
                </span>
                <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {pillar.blurb}
                </span>
                <span className="mt-4 text-sm font-semibold text-signal">Explore →</span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------- 5. The Founder Wall */

export function ChapterWall({
  reduced,
  register,
  founders,
  progress: campaign,
}: {
  reduced: boolean;
  register: Register;
  founders: WallFounder[];
  progress: CampaignProgress;
}) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.1, 0.4);
  return (
    <section id="scene-wall" ref={setRef} className={cn('relative w-full py-28', styles.chapter)}>
      <div className={styles.backdrop} aria-hidden="true" style={{ background: '#0b0b0b' }}>
        {!reduced ? <span className={styles.spotlight} /> : null}
        <span className={styles.vignette} />
      </div>
      <Container>
        <p className={cn('eyebrow', styles.reveal)} style={reveal(p, reduced)}>
          The Founders Wall
        </p>
        <h2
          className={cn('display-section mt-4 max-w-3xl', styles.settle)}
          style={reveal(p, reduced)}
        >
          The names that build it
        </h2>
        <p
          className={cn('mt-6 max-w-2xl text-lg leading-relaxed text-muted', styles.reveal)}
          style={reveal(reduced ? 1 : subBeat(progress, 0.15, 0.5), reduced)}
        >
          The school gets built by the drivers who believe in it first. Every founder takes a number
          on the wall — a permanent place in how this started.
        </p>

        <div className="mt-10">
          <FounderWall3D founders={founders} reduced={reduced} campaign={campaign} />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- 6. Name Engraving */

export function ChapterName({
  reduced,
  register,
  nextNumber,
  numberWidth,
}: {
  reduced: boolean;
  register: Register;
  nextNumber: number;
  numberWidth: number;
}) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.1, 0.45);
  const etchP = reduced ? 1 : subBeat(progress, 0.2, 0.7);
  return (
    <section id="scene-name" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      <div className={styles.backdrop} aria-hidden="true" style={{ background: '#0b0b0b' }}>
        {!reduced ? <span className={styles.spotlight} /> : null}
        <span className={styles.vignette} />
      </div>
      <Container className="py-28">
        <p className={cn('eyebrow text-center', styles.reveal)} style={reveal(p, reduced)}>
          Your name
        </p>
        <h2
          className={cn('display-section mt-4 text-center', styles.settle)}
          style={reveal(p, reduced)}
        >
          This is where your name goes
        </h2>
        <div className="mt-10">
          <NameEngraving
            nextNumber={nextNumber}
            numberWidth={numberWidth}
            progress={etchP}
            reduced={reduced}
          />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------ 7. The Payoff */

export function ChapterPayoff({ reduced, register, spineActive, backdrop }: SceneProps) {
  const { setRef, progress } = useChapter(reduced, register);
  const p = reduced ? 1 : subBeat(progress, 0.15, 0.5);
  return (
    <section id="scene-payoff" ref={setRef} className={cn(SECTION_CLASS, styles.chapter)}>
      {backdrop ? (
        <CinematicVideo
          slot={backdrop}
          progress={progress}
          reduced={reduced}
          spineActive={spineActive}
        />
      ) : null}
      <Container className="py-28 text-center">
        <p className={cn('eyebrow', styles.reveal)} style={reveal(p, reduced)}>
          This is who it&rsquo;s for
        </p>
        <h2
          className={cn('display-hero mx-auto mt-4 max-w-3xl', styles.settle)}
          style={reveal(p, reduced)}
        >
          Put your name on the wall
        </h2>
        <p
          className={cn('mx-auto mt-6 max-w-xl text-lg text-muted sm:text-xl', styles.reveal)}
          style={reveal(reduced ? 1 : subBeat(progress, 0.2, 0.55), reduced)}
        >
          Somewhere a new driver is about to get the keys — because founders made it possible. Take
          your place among them, and help the next one get their shot.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href="/founders">Become a founder</Button>
          <Button href="/" variant="ghost">
            Explore Trucking Life
          </Button>
        </div>
      </Container>
    </section>
  );
}

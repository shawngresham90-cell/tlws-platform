'use client';

import { useState } from 'react';
import { useMounted, useReducedMotion, useRoadAheadTimeline } from '@/lib/road-ahead/hooks';
import { ROAD_AHEAD_CHAPTERS } from '@/lib/road-ahead/chapters';
import { founderNumberWidth, type WallFounder } from '@/lib/road-ahead/founder-number';
import type { CampaignProgress } from '@/lib/community/founders';
import { ProgressRail } from './ProgressRail';
import { MotionToggle } from './MotionToggle';
import { AudioController } from './AudioController';
import {
  ChapterNight,
  ChapterPreTrip,
  ChapterGrind,
  ChapterFirstLight,
  ChapterWall,
  ChapterName,
  ChapterPayoff,
} from './Chapters';

/**
 * Client orchestrator for THE ROAD AHEAD. Owns the one piece of shared state the
 * chapters need — whether motion is allowed — and the scroll timeline that feeds
 * the progress rail and chapter navigation. Motion is off when the OS requests
 * reduced motion OR the visitor taps pause; either way `reduced` flows down and
 * every chapter renders its static, fully-readable form.
 *
 * All heavy data (the built founder sequence, the campaign totals) is computed
 * on the server and passed in as plain props, so the first paint is complete and
 * SEO-visible before any client work runs.
 */
export function RoadAheadExperience({
  founders,
  campaign,
}: {
  founders: WallFounder[];
  campaign: CampaignProgress;
}) {
  const prefersReduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const mounted = useMounted();
  // Static (fully-composed, no motion) until the client is live, so the server
  // and no-JS render is never blank and hydration always matches. Motion turns
  // on only after mount, and off whenever the OS or the visitor asks for it.
  const reduced = !mounted || prefersReduced || paused;

  const { scrollProgress, activeChapter, registerChapter } = useRoadAheadTimeline(
    ROAD_AHEAD_CHAPTERS.length,
  );

  const nextNumber = founders.length + 1;
  const numberWidth = founderNumberWidth(nextNumber);

  return (
    <div className="relative bg-asphalt" data-ra-hydrated={mounted ? 'true' : 'false'}>
      {/* Accessible skip-to-chapter navigation — visible on keyboard focus. */}
      <nav aria-label="Chapters" className="sr-only focus-within:not-sr-only">
        <ul className="fixed left-2 top-2 z-50 flex flex-wrap gap-2 rounded-card border border-line bg-asphalt p-2">
          {ROAD_AHEAD_CHAPTERS.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.anchor}`}
                className="rounded-card px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink underline-offset-2 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ProgressRail
        chapters={ROAD_AHEAD_CHAPTERS}
        activeChapter={activeChapter}
        scrollProgress={scrollProgress}
      />

      {/* Cinematic controls cluster. */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col gap-3">
        <AudioController />
        {/* Only after mount, and only when the OS isn't already forcing reduced
            motion — so it never flashes into the server HTML then vanishes. */}
        {mounted && !prefersReduced ? (
          <MotionToggle paused={paused} onToggle={() => setPaused((v) => !v)} />
        ) : null}
      </div>

      <ChapterNight reduced={reduced} register={registerChapter(0)} />
      <ChapterPreTrip reduced={reduced} register={registerChapter(1)} />
      <ChapterGrind reduced={reduced} register={registerChapter(2)} />
      <ChapterFirstLight reduced={reduced} register={registerChapter(3)} />
      <ChapterWall
        reduced={reduced}
        register={registerChapter(4)}
        founders={founders}
        progress={campaign}
      />
      <ChapterName
        reduced={reduced}
        register={registerChapter(5)}
        nextNumber={nextNumber}
        numberWidth={numberWidth}
      />
      <ChapterPayoff reduced={reduced} register={registerChapter(6)} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils/cn';

// GSAP scene-transition layer — code-split so gsap is never in the route-initial
// bundle; only fetched when mounted (motion-on).
const GsapTransitions = dynamic(() => import('./GsapTransitions'), { ssr: false });
import {
  useCinemaTier,
  useMounted,
  useReducedMotion,
  useRoadAheadTimeline,
} from '@/lib/road-ahead/hooks';
import { ROAD_AHEAD_CHAPTERS } from '@/lib/road-ahead/chapters';
import { founderNumberWidth, type WallFounder } from '@/lib/road-ahead/founder-number';
import type { SceneId, VideoSlot } from '@/lib/road-ahead/assets';
import type { CampaignProgress } from '@/lib/community/founders';
import {
  cueAirBrake,
  disableSound,
  setActiveScene,
  setSuppliedTrack,
  subscribeSound,
} from './audio';
import { ProgressRail } from './ProgressRail';
import { MotionToggle } from './MotionToggle';
import { AudioController } from './AudioController';
import { SpineLayer } from './SpineLayer';
import { YearOdometer } from './YearOdometer';
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
  backdrops,
  suppliedAudio,
}: {
  founders: WallFounder[];
  campaign: CampaignProgress;
  /** Resolved per-scene backdrop slots (server-scanned footage → gradient fallback). */
  backdrops: Record<SceneId, VideoSlot | null>;
  /** Resolved file-backed music/narration srcs (null until a track is dropped in). */
  suppliedAudio: { music: string | null; narration: string | null };
}) {
  const prefersReduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const mounted = useMounted();
  // Static (fully-composed, no motion) until the client is live, so the server
  // and no-JS render is never blank and hydration always matches. Motion turns
  // on only after mount, and off whenever the OS or the visitor asks for it.
  const reduced = !mounted || prefersReduced || paused;

  // WebGL truck-spine tier: only on capable, motion-on devices (the hook gates
  // pointer/memory/WebGL/Save-Data). `spineFailed` latches a context-loss so we
  // never retry a dead GPU. When the spine is live the narrative scenes go
  // transparent so the continuous 3D drive shows through behind them.
  const tier = useCinemaTier(!reduced);
  const [spineFailed, setSpineFailed] = useState(false);
  const spineActive = tier === 'full' && !reduced && !spineFailed;

  const { scrollProgress, activeChapter, registerChapter } = useRoadAheadTimeline(
    ROAD_AHEAD_CHAPTERS.length,
  );

  // Cross-fade the ambience beds to the active scene whenever it changes (and
  // once sound is enabled). No-op while sound is off; pure atmosphere.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => subscribeSound(setSoundOn), []);
  // Stop all audio (synth + any looping supplied music) when leaving the page,
  // so nothing keeps playing across a client-side route change.
  useEffect(() => () => disableSound(), []);
  // Register any dropped-in music/narration so it plays when sound is enabled.
  useEffect(() => {
    setSuppliedTrack('music', suppliedAudio.music);
    setSuppliedTrack('narration', suppliedAudio.narration);
  }, [suppliedAudio.music, suppliedAudio.narration]);
  useEffect(() => {
    if (!soundOn) return;
    const chapter = ROAD_AHEAD_CHAPTERS[activeChapter];
    if (!chapter) return;
    setActiveScene(chapter.id);
    // The pre-trip beat gets its signature air-brake release.
    if (chapter.id === 'preTrip') cueAirBrake();
  }, [soundOn, activeChapter]);

  const nextNumber = founders.length + 1;
  const numberWidth = founderNumberWidth(nextNumber);

  return (
    <div
      className={cn('relative', !spineActive && 'bg-asphalt')}
      data-ra-hydrated={mounted ? 'true' : 'false'}
      data-ra-tier={spineActive ? 'full' : 'lite'}
    >
      {spineActive ? <SpineLayer onFail={() => setSpineFailed(true)} /> : null}
      {/* GSAP transition flourishes — mounted only when motion is allowed, so a
          pause / reduced-motion unmount kills every trigger and tween. */}
      {mounted && !reduced ? <GsapTransitions /> : null}
      <YearOdometer reduced={reduced} />
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

      <ChapterNight
        reduced={reduced}
        register={registerChapter(0)}
        spineActive={spineActive}
        backdrop={backdrops.nightDrive}
      />
      <ChapterPreTrip
        reduced={reduced}
        register={registerChapter(1)}
        spineActive={spineActive}
        backdrop={backdrops.preTrip}
      />
      <ChapterGrind
        reduced={reduced}
        register={registerChapter(2)}
        spineActive={spineActive}
        backdrop={backdrops.theGrind}
      />
      <ChapterFirstLight
        reduced={reduced}
        register={registerChapter(3)}
        spineActive={spineActive}
        backdrop={backdrops.firstLight}
      />
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
      <ChapterPayoff
        reduced={reduced}
        register={registerChapter(6)}
        spineActive={spineActive}
        backdrop={backdrops.thePayoff}
      />
    </div>
  );
}

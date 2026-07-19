import Link from 'next/link';
import { Section } from '@/components/ui';
import { RoadAheadExperience } from '@/components/road-ahead/RoadAheadExperience';
import { WallScene } from '@/components/founders-movement/WallScene';
import type { WallFounder } from '@/components/founders-movement/WallScene';
import { SoundToggle } from '@/components/founders-movement/SoundToggle';
import { ChapterReveal } from '@/components/founders-movement/ChapterReveal';
import { YearOdometer } from '@/components/founders-movement/YearOdometer';
import { LegacySignature } from '@/components/founders-movement/LegacySignature';
import { getCampaignProgress, getPublicFounders } from '@/lib/community/founders';
import { toWallFounders, nextFounderNumber } from '@/lib/road-ahead/wall';
import { FOOTAGE_SCENES, MONTAGE_CARDS } from '@/lib/road-ahead/footage-manifest';
import { FOUNDER_TIERS } from '@/components/community/tiers';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * /road-ahead — THE ROAD AHEAD cinematic prototype (Phase 0.5).
 *
 * An ISOLATED, noindex prototype route implementing the approved cinematic
 * treatment as engineering. The production Founders Wall at /founders and the
 * earlier /founders-movement prototype are BOTH untouched.
 *
 * Non-negotiables proven here (see docs/road-ahead-engineering-plan.md):
 *  - the full story is server-rendered HTML and reads with zero JS, audio, or
 *    3D (the accessibility + no-JS spine);
 *  - the cinematic enhancement (GSAP conductor + footage layer + reused R3F
 *    spine) is lazy-loaded and only ever *added* behind that story, gated by a
 *    capability ladder that never fires under reduced-motion or Save-Data;
 *  - founder data is read-only (public rows only); nothing is written and no
 *    payment is ever taken from this route.
 */
export const metadata = buildMetadata({
  title: 'The Road Ahead (Preview) | Trucking Life',
  description:
    'A cinematic preview of the Founders Movement — the dark road, seventeen years, and the wall the trucking community is building.',
  path: '/road-ahead',
  noindex: true,
});

export const revalidate = 60;

// Six-waypoint ecosystem highway (treatment Scene 4). The road IS the roadmap.
const WAYPOINTS = [
  'CDL School',
  'GPS Navigation',
  'Community',
  'Voice Corridors',
  'Marketplace',
  'Mobile Apps',
] as const;

export default async function RoadAheadPage() {
  const [progress, publicFounders] = await Promise.all([
    getCampaignProgress(),
    getPublicFounders(),
  ]);
  const wallFounders: WallFounder[] = toWallFounders(publicFounders);
  const nextNumber = nextFounderNumber(wallFounders.length, progress.founder_count);
  const montage = FOOTAGE_SCENES.scene2_montage;

  return (
    <>
      {/* Capability ladder — mounts the lazy cinematic layer behind this story. */}
      <RoadAheadExperience />

      {/*
        SCENE 1 + SCENE 2 — the cinematic track the GSAP conductor scrubs.
        Transparent so the fixed footage/3D layer shows through when it mounts;
        on the lite tier this is simply a dark, readable opening.
      */}
      <section id="road-ahead-track" className="relative">
        {/* Scene 1 — The Dark Road */}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
          <div className="max-w-2xl text-center">
            <p className="font-display text-xs uppercase tracking-[0.4em] text-signal">
              The Founders Movement
            </p>
            <h1 className="mt-4 font-display text-5xl uppercase leading-none tracking-tight text-white sm:text-7xl">
              The Road Ahead
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-lg text-muted">
              &ldquo;Every driver remembers the first time somebody handed &rsquo;em the keys… and
              believed they wouldn&rsquo;t wreck it.&rdquo;
            </p>
            <p className="mt-3 font-display text-sm uppercase tracking-[0.3em] text-ink">— Shawn</p>
            <p className="mt-16 text-xs uppercase tracking-[0.3em] text-muted/70">
              Scroll to drive ↓
            </p>
          </div>
        </div>

        {/* Scene 2 — 17 Years (the montage; captions carry it with zero video) */}
        <div className="relative z-10 flex min-h-screen items-center px-6 py-24">
          <div className="max-w-2xl">
            <ul className="space-y-2">
              {MONTAGE_CARDS.map((card) => (
                <li
                  key={card}
                  className="font-display text-4xl uppercase leading-tight tracking-tight text-white sm:text-6xl"
                >
                  {card}
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-xl text-lg text-muted">
              Seventeen years. Zero violations. Every one of those miles taught one thing — this
              industry doesn&rsquo;t have a driver problem. It has a{' '}
              <span className="text-white">training</span> problem.
            </p>
            <ul className="mt-8 grid list-none gap-2 border-l-2 border-signal/40 pl-5 text-sm text-muted">
              {montage.clips.map((clip) => (
                <li key={clip.id}>{clip.caption}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Scene 3 — The Problem */}
      <Section className="relative border-y border-line bg-asphalt/80">
        <ChapterReveal era="THE PROBLEM">
          <div className="max-w-2xl">
            <h2 className="display-section text-white">They build schools to cash checks</h2>
            <p className="mt-4 text-muted">
              Rush &rsquo;em through, sign the paper, put &rsquo;em on the road scared. I turned
              down that money. I&rsquo;m building it the right way — even if I&rsquo;ve gotta build
              it brick by brick.
            </p>
          </div>
        </ChapterReveal>
      </Section>

      {/* Scene 4 — The Answer / the ecosystem highway */}
      <Section className="relative border-b border-line bg-asphalt-800/85">
        <ChapterReveal era="THE ANSWER">
          <div className="mb-8 max-w-2xl">
            <h2 className="display-section text-white">Trucking Life Academy</h2>
            <p className="mt-2 font-display text-sm uppercase tracking-[0.3em] text-signal">
              Dalton, Georgia
            </p>
            <p className="mt-4 text-muted">
              A school built by a driver, for drivers. Real training, real standards — and behind it
              a whole ecosystem. The road doesn&rsquo;t end; that&rsquo;s the point.
            </p>
          </div>
          <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WAYPOINTS.map((w, i) => (
              <li key={w} className="rounded-card border border-line bg-asphalt-800 p-5 text-white">
                <span className="font-display text-xs uppercase tracking-widest text-signal">
                  Waypoint {i + 1}
                </span>
                <p className="mt-1 font-display text-lg uppercase">{w}</p>
              </li>
            ))}
          </ul>
        </ChapterReveal>
      </Section>

      {/* Scene 5 — The Wall (real founder data + in-memory Induction) */}
      <Section className="relative border-b border-line bg-asphalt/80">
        <ChapterReveal era="THE WALL">
          <div className="mb-8 max-w-2xl">
            <h2 className="display-section text-white">The names who didn&rsquo;t wait</h2>
            <p className="mt-4 text-muted">
              {progress.founder_count > 0
                ? `${progress.founder_count} founders already have their names on the wall.`
                : 'The wall is waiting for its first names.'}{' '}
              Before the doors ever opened, they built them — owner-operators, companies, families,
              drivers just like you.
            </p>
          </div>
          <WallScene founders={wallFounders} nextNumber={nextNumber} />
          <p className="mt-8 text-sm italic text-muted">
            Read the names slowly. Someday, somebody will be looking for yours.
          </p>
        </ChapterReveal>
      </Section>

      {/* Scene 6 — The Emotional Climax */}
      <Section className="relative border-b border-line bg-asphalt-800/85">
        <ChapterReveal era="THE CLIMAX">
          <div className="max-w-2xl">
            <p className="text-lg text-muted">
              One day a kid&rsquo;s gonna walk through these doors scared to death, just like you
              were. On the way in, they&rsquo;ll pass a wall — and on that wall is the name of every
              man and woman who said:{' '}
              <span className="text-white">
                &ldquo;I got you. Somebody taught me. Now it&rsquo;s my turn.&rdquo;
              </span>
            </p>
            <p className="mt-6 font-display text-2xl uppercase tracking-wide text-signal">
              That name could be yours. Forever.
            </p>
            <p className="mt-8 text-xs italic tracking-wide text-muted">
              &ldquo;The thoughts of the diligent tend only to plenteousness.&rdquo; — Proverbs 21:5
            </p>
          </div>
        </ChapterReveal>
      </Section>

      {/* Scene 7 — The Call */}
      <Section className="relative">
        <ChapterReveal era="THE CALL">
          <div className="max-w-2xl">
            <h2 className="display-section text-white">Put your name on it</h2>
            <div className="mt-6 space-y-1 font-display text-xl uppercase tracking-wide text-white">
              <p>Trucks built this country.</p>
              <p>Drivers kept it alive.</p>
              <p>Now drivers are building what comes next.</p>
              <p className="text-signal">Your name. On the wall. Before the doors open.</p>
            </div>
            <p className="mt-6 text-sm text-muted">
              This is not a donation. It is a place in the founding generation of Trucking Life.
            </p>
          </div>

          {/* Tier cards — real tier labels/blurbs; amounts intentionally not
              hard-coded (see tiers.ts) and set on the real Founders flow. */}
          <ul className="mt-8 grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FOUNDER_TIERS.map((tier) => (
              <li
                key={tier.value}
                className="rounded-card border border-line bg-asphalt-800 p-5 text-white"
              >
                <p className="font-display text-lg uppercase tracking-wide text-signal">
                  {tier.label}
                </p>
                <p className="mt-2 text-sm text-muted">{tier.blurb}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.35em] text-signal">
            I was here when it began.
          </p>
          <LegacySignature />

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/founders#join"
              className="rounded-card bg-signal px-6 py-3 font-semibold text-asphalt transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              Claim my spot on the wall →
            </Link>
            <Link
              href="/founders"
              className="rounded-card border border-line px-6 py-3 font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              See the real Founders Wall
            </Link>
          </div>
        </ChapterReveal>
      </Section>

      <YearOdometer />
      <SoundToggle />
    </>
  );
}

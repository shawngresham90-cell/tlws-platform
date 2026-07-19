import Link from 'next/link';
import { Section } from '@/components/ui';
import { ExperienceShell } from '@/components/founders-movement/ExperienceShell';
import { WallScene } from '@/components/founders-movement/WallScene';
import { SoundToggle } from '@/components/founders-movement/SoundToggle';
import { getCampaignProgress } from '@/lib/community/founders';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * /founders-movement — PROTOTYPE (Phase 0 of the cinematic Founders Movement
 * experience; see docs/founders-movement-experience.md).
 *
 * Deliberately noindex while in prototype: the production Founders Wall at
 * /founders remains the canonical page. This route proves the architecture's
 * non-negotiables — full server-rendered story HTML, reduced-motion parity,
 * opt-in-only audio, keyboard-first wall interaction — with zero new
 * dependencies and zero changes to founder data.
 */
export const metadata = buildMetadata({
  title: 'The Founders Movement (Preview) | Trucking Life',
  description:
    'A cinematic preview of the Founders Movement — the road, the mission, the wall, and the school the trucking community is building.',
  path: '/founders-movement',
  noindex: true,
});

export const revalidate = 60;

const BUILT: { name: string; href: string; blurb: string }[] = [
  { name: 'Knowledge Center', href: '/knowledge', blurb: 'Authority guides on the real rules.' },
  { name: 'Practice Tests', href: '/practice-tests', blurb: 'Free CDL exam prep that works.' },
  { name: 'Directory', href: '/directory', blurb: 'Trucker-friendly places, mapped.' },
  { name: 'Trip Planner', href: '/trip-planner', blurb: 'Plan the run before the wheels roll.' },
  {
    name: 'HOS guides',
    href: '/knowledge/hours-of-service',
    blurb: 'Every clock, in plain English.',
  },
  { name: 'CDL Pre-School', href: '/cdl-pre-school', blurb: 'Start before school starts.' },
  { name: 'Academy', href: '/academy', blurb: 'The school this movement is building.' },
];

const FUTURE: { name: string; note: string }[] = [
  { name: 'The physical CDL school', note: 'Dalton, GA — the heart of the movement' },
  { name: 'Truck-safe GPS planning', note: 'in progress' },
  { name: 'Driver community', note: 'planned' },
  { name: 'Voice corridors', note: 'planned' },
  { name: 'Marketplace', note: 'planned' },
  { name: 'Mobile apps', note: 'planned' },
];

export default async function FoundersMovementPage() {
  const progress = await getCampaignProgress();

  return (
    <>
      {/* Scene 0 — ignition hero; the shell decides lite vs WebGL spine. */}
      <ExperienceShell founderCount={progress.founder_count} />

      {/* Scene 1 — the road / Shawn's beginning. */}
      <Section className="border-b border-line bg-asphalt/70">
        <div className="max-w-2xl">
          <h2 className="display-section">The road came first</h2>
          <p className="mt-4 text-muted">
            Seventeen years behind the wheel. Zero violations. Every mile of it taught the same
            lesson: nobody makes it out here alone. Trucking Life started as one driver showing the
            next driver what the manual doesn&apos;t.
          </p>
        </div>
      </Section>

      {/* Scene 2 — the trainer / education mission. */}
      <Section className="border-b border-line bg-asphalt-800/85">
        <div className="max-w-2xl">
          <h2 className="display-section">From driver to teacher</h2>
          <p className="mt-4 text-muted">
            Trainer, then instructor, then a classroom bigger than any cab: free tools and straight
            answers for every driver coming up. The mission never changed — put prepared, confident
            drivers in seats.
          </p>
        </div>
      </Section>

      {/* Scene 3 — already built (real links, crawlable). */}
      <Section className="border-b border-line bg-asphalt/70">
        <div className="mb-8 max-w-2xl">
          <h2 className="display-section">Already on the road</h2>
          <p className="mt-4 text-muted">Built free for drivers, and already rolling:</p>
        </div>
        <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUILT.map((item) => (
            <li key={item.href} className="rounded-card border border-line bg-asphalt-800 p-5">
              <Link
                href={item.href}
                className="font-display text-lg uppercase text-signal underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
              >
                {item.name}
              </Link>
              <p className="mt-1 text-sm text-muted">{item.blurb}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Scene 4 — the future ecosystem (honestly labeled). */}
      <Section className="border-b border-line bg-asphalt-800/85">
        <div className="mb-8 max-w-2xl">
          <h2 className="display-section">Where the road goes next</h2>
          <p className="mt-4 text-muted">
            The movement funds what comes next. No promises dressed as products — this is the build
            list, labeled honestly.
          </p>
        </div>
        <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FUTURE.map((item) => (
            <li key={item.name} className="rounded-card border border-dashed border-line p-5">
              <p className="font-display text-lg uppercase text-white">{item.name}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {item.note}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Scenes 5–6 — approaching the wall + interactive wall (placeholder). */}
      <Section className="border-b border-line bg-asphalt/70">
        <div className="mb-8 max-w-2xl">
          <h2 className="display-section">The people building it</h2>
          <p className="mt-4 text-muted">
            {progress.founder_count > 0
              ? `${progress.founder_count} founders already have their names on the wall.`
              : 'The wall is waiting for its first names.'}{' '}
            Every tier is a different material; every tile is a person or business that said
            &quot;build it.&quot;
          </p>
        </div>
        <WallScene founderCount={progress.founder_count} />
      </Section>

      {/* Scene 7 — the school stands. */}
      <Section className="border-b border-line bg-asphalt-800/85">
        <div className="max-w-2xl">
          <h2 className="display-section">A school you can park a truck at</h2>
          <p className="mt-4 text-muted">
            Trucking Life Academy — Dalton, Georgia. A physical CDL school with real trucks, a real
            range, and instructors who drove first. Founded not by investors, but by the wall of
            names beside its front door.
          </p>
        </div>
      </Section>

      {/* Scene 8 — legacy CTA. */}
      <Section>
        <div className="max-w-2xl">
          <h2 className="display-section">Put your name on it</h2>
          <p className="mt-4 text-muted">
            Years from now, drivers who never met you will back out of that lot with a CDL and a
            career. The wall will say who made it possible.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/founders#join"
              className="rounded-card bg-signal px-6 py-3 font-semibold text-asphalt transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              Take your place on the wall
            </Link>
            <Link
              href="/founders"
              className="rounded-card border border-line px-6 py-3 font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              See the real Founders Wall
            </Link>
          </div>
        </div>
      </Section>

      <SoundToggle />
    </>
  );
}

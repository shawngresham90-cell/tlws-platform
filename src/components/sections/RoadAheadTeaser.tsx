import Link from 'next/link';
import { Container } from '@/components/ui';
import { CinematicStill } from '@/components/media/CinematicStill';

/**
 * THE MOVEMENT (cinematic flow beat 7) — the homepage's single entry point
 * into THE ROAD AHEAD, the flagship cinematic experience. Boundary rules
 * (docs/design/cinematic-homepage-delta.md): exactly one premium story card,
 * one already-approved poster still, one CTA. No scene system, no chapter
 * transitions, no audio — the cinematic weight lives on /road-ahead itself.
 *
 * The poster is an existing approved ROAD AHEAD scene still (28 KB), served
 * through next/image. Its story beats moved to <JourneyStrip>.
 */
export function RoadAheadTeaser() {
  return (
    <section
      aria-labelledby="road-ahead-teaser"
      className="relative overflow-hidden border-b border-line bg-asphalt"
    >
      {/* Above the section bg, below the relative content — negative z-index
          would hide this behind the section's own background. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 120% at 15% 0%, rgba(245,166,35,0.10) 0%, rgba(245,166,35,0) 45%), linear-gradient(180deg, #1A1A1C 0%, #141414 100%)',
        }}
      />
      <Container className="relative py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">The Road Ahead</p>
            <h2 id="road-ahead-teaser" className="display-section mt-3">
              See where the whole road goes
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted">
              A guided drive through everything Trucking Life is — the school, the tools, and the
              founders building it. Finish knowing exactly where you fit.
            </p>
            <div className="mt-8">
              <Link
                href="/road-ahead"
                className="inline-flex items-center gap-3 rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
                Take the drive
              </Link>
            </div>
          </div>

          {/* One approved still, one restrained hover — the only cinematic
              crossover the homepage gets */}
          <Link
            href="/road-ahead"
            aria-label="Take the drive — THE ROAD AHEAD"
            className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            <CinematicStill
              src="/road-ahead/poster/empty-highway.jpg"
              alt="Tractor-trailer on a fog-lit highway under sodium lights — scene still from THE ROAD AHEAD"
              width={752}
              height={416}
              sizes="(max-width: 1024px) 100vw, 560px"
              label="Scene still"
              caption="The Road Ahead — the full guided drive"
              imgClassName="transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}

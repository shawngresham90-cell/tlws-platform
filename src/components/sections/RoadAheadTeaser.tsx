import Link from 'next/link';
import { Container } from '@/components/ui';

/**
 * Homepage entry point into THE ROAD AHEAD — the flagship experience. A single
 * cinematic band, placed high on the page, that invites the visitor to take the
 * full guided drive through the whole ecosystem. Server component, no client JS;
 * the cinematic weight lives on /road-ahead itself.
 */
export function RoadAheadTeaser() {
  return (
    <section
      aria-labelledby="road-ahead-teaser"
      className="relative overflow-hidden border-b border-line bg-asphalt"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(120% 120% at 15% 0%, rgba(255,235,0,0.10) 0%, rgba(255,235,0,0) 45%), linear-gradient(180deg, #161616 0%, #0E0E0E 100%)',
        }}
      />
      <Container className="py-16 sm:py-20">
        <p className="eyebrow">The Road Ahead</p>
        <h2 id="road-ahead-teaser" className="display-section mt-3 max-w-3xl">
          See where the whole road goes
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          A guided drive through everything Trucking Life is — the school, the tools, and the
          founders building it. Finish knowing exactly where you fit.
        </p>
        <div className="mt-8">
          <Link
            href="/road-ahead"
            className="inline-flex items-center gap-3 rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
            Take the drive
          </Link>
        </div>
      </Container>
    </section>
  );
}

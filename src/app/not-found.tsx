import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { NotFoundEvent } from '@/components/seo/NotFoundEvent';

/**
 * Branded 404. Next's built-in not-found page injects
 * `body{color:#000;background:#fff}` inline, which overrides the dark theme
 * and leaves a white void between the (still dark) header and footer — and it
 * gives a lost visitor nowhere to go. This replaces it with an on-brand page
 * that routes the visitor back to the destinations that matter.
 *
 * Still returns HTTP 404 (Next sets the status for this file convention), so
 * crawlers keep treating the URL as gone.
 */
// No canonical here on purpose: a 404 answers at many URLs, and pointing them
// all at one canonical would invite indexing. noindex/nofollow instead.
export const metadata: Metadata = {
  title: 'Page not found — Trucking Life with Shawn',
  description: 'That road is closed. Here are the exits back to the main routes.',
  robots: { index: false, follow: false },
};

/** Highest-value existing destinations for a visitor who landed on a dead URL. */
const EXITS: Array<{ href: string; label: string; blurb: string }> = [
  {
    href: '/academy',
    label: 'CDL Academy',
    blurb: 'CDL-A training in Dalton, GA — curriculum, requirements, and how to apply.',
  },
  {
    href: '/cdl-pre-school',
    label: 'CDL Pre-School',
    blurb: 'Self-paced prep before you ever set foot in a school.',
  },
  {
    href: '/practice-tests',
    label: 'Practice Tests',
    blurb: 'Free CDL permit practice tests — general knowledge, air brakes, and more.',
  },
  {
    href: '/directory',
    label: 'Truck Stop Directory',
    blurb: 'Parking, scales, showers, and services by interstate and exit.',
  },
  {
    href: '/trip-planner',
    label: 'Trip Planner',
    blurb: 'Truck-legal routing with Hours of Service built in.',
  },
  {
    href: '/knowledge',
    label: 'Knowledge Center',
    blurb: 'DOT compliance, Hours of Service, and career guides in plain trucker talk.',
  },
];

export default function NotFound() {
  return (
    <Section>
      <NotFoundEvent />
      <div className="max-w-2xl">
        <Eyebrow>404 — Wrong exit</Eyebrow>
        <h1 className="font-display text-section uppercase text-ink">
          This page took an exit that isn&apos;t there
        </h1>
        <p className="mt-4 text-lg text-muted">
          The link is broken, the page moved, or the address has a typo. Nothing is wrong with your
          truck — pick a route below and keep rolling.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button href="/">Back to the home page</Button>
          <Button href="/knowledge/search" variant="secondary">
            Search the Knowledge Center
          </Button>
        </div>
      </div>

      <h2 className="mt-14 font-display text-2xl uppercase text-ink">Main routes</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXITS.map((exit) => (
          <li key={exit.href}>
            <Link
              href={exit.href}
              className="block h-full rounded-card border border-line bg-cab p-5 transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
            >
              <p className="font-display text-lg uppercase text-ink">{exit.label}</p>
              <p className="mt-2 text-sm text-muted">{exit.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

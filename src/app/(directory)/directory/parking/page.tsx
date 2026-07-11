import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { DirectoryBrowser } from '@/components/directory';
import { getEntries } from '@/lib/directory/data';
import { listingListSchemaWithReviews } from '@/lib/directory/seo';
import { getDirectoryFacets } from '@/lib/directory/data';
import { RelatedLinks } from '@/components/directory';
import { categoryScopeLinks } from '@/lib/directory/scope-links';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

// Listings come from the database now (Milestone 12) — refresh periodically
// in addition to the on-save revalidation the admin actions trigger.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Truck Parking Directory — Free, Paid & Reserved Parking | Trucking Life with Shawn',
  description:
    'Find truck parking: free spots, paid and reserved parking, truck stops, rest areas, safe locations, and driver-submitted spots. Reserve guaranteed parking through TruckParkingClub.',
  path: '/directory/parking',
});

const TPC_URL = 'https://truckparkingclub.com';

type ParkingType = {
  title: string;
  icon: string;
  description: string;
};

const PARKING_TYPES: ParkingType[] = [
  {
    title: 'Free Parking',
    icon: '🆓',
    description:
      'No-cost spots that actually hold trucks — and the honest notes on which fill up by 5 PM.',
  },
  {
    title: 'Paid Parking',
    icon: '💵',
    description:
      'Pay-to-park lots where a few bucks buys you a guaranteed shutdown instead of an hour of circling.',
  },
  {
    title: 'Reserved Parking',
    icon: '📅',
    description:
      'Book a spot before you arrive. Reserve ahead through TruckParkingClub and roll in knowing it’s yours.',
  },
  {
    title: 'Truck Stops',
    icon: '⛽',
    description:
      'The big lots — fuel, food, showers, and parking counts, so you know your odds before the exit.',
  },
  {
    title: 'Rest Areas',
    icon: '🛣️',
    description:
      'State rest areas and welcome centers — time limits, truck spaces, and which ones to skip.',
  },
  {
    title: 'Safe Parking Locations',
    icon: '🔒',
    description:
      'Lit, patrolled, and driver-vetted spots — because a safe night’s sleep is part of the job.',
  },
  {
    title: 'Driver-Submitted Parking',
    icon: '🤝',
    description:
      'Spots called in by drivers who run these lanes. Drivers helping drivers — submissions open soon.',
  },
];

export default async function TruckParkingPage() {
  const [entries, facets] = await Promise.all([getEntries('parking'), getDirectoryFacets()]);
  const listings = await listingListSchemaWithReviews(entries, 'Truck Parking', '/directory/parking');

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: 'Truck Parking', path: '/directory/parking' },
          ]),
          ...(listings ? [listings] : []),
        ]}
      />

      {/* Hero */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Directory · Truck Parking</Eyebrow>
          <h1 className="display-section">Stop circling for a spot</h1>
          <p className="mt-4 text-muted">
            This directory covers it all — <strong className="text-ink">free parking</strong> when
            you can get it, and <strong className="text-ink">paid or reserved parking</strong> when
            a guaranteed spot beats an hour of hunting. Truck stops, rest areas, safe locations,
            and spots called in by drivers who run these lanes.
          </p>
          <p className="mt-3 text-sm text-muted">
            This is the foundation page — the full searchable parking map and database are being
            built on top of it. What’s here now: the categories we cover and the fastest way to
            lock in a reserved spot tonight.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/directory/map" className="font-semibold text-signal underline-offset-4 hover:underline">
              🗺️ View on map →
            </Link>
          </p>
        </div>
      </Section>

      {/* Reserve CTA — TruckParkingClub */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="rounded-card border border-line bg-asphalt p-8 sm:p-10">
          <div className="max-w-2xl">
            <Eyebrow>Reserve ahead</Eyebrow>
            <h2 className="display-section">Guarantee tonight’s spot</h2>
            <p className="mt-4 text-muted">
              Done gambling on an open space at 7 PM? Reserve paid parking ahead through{' '}
              <strong className="text-ink">TruckParkingClub</strong> — pick the lot, book the spot,
              park without the stress.
            </p>
          </div>
          <div className="mt-6">
            <a
              href={TPC_URL}
              target="_blank"
              rel="noopener sponsored"
              className="inline-flex items-center justify-center rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
            >
              Reserve paid parking through TruckParkingClub →
            </a>
            <p className="mt-3 text-xs text-muted">Affiliate link coming soon.</p>
          </div>
        </div>
      </Section>

      {/* Parking types */}
      <Section className="border-b border-line">
        <div className="mb-10 max-w-2xl">
          <Eyebrow>What we cover</Eyebrow>
          <h2 className="display-section">Every kind of parking</h2>
          <p className="mt-4 text-muted">
            Listings for each category go live as the database is built out.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PARKING_TYPES.map((t) => (
            <div
              key={t.title}
              className="flex flex-col rounded-card border border-line bg-asphalt-800 p-6"
            >
              <div
                aria-hidden="true"
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-card border border-line bg-asphalt-700 text-3xl"
              >
                {t.icon}
              </div>
              <h3 className="font-display text-xl uppercase text-signal">{t.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{t.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Live listings — published rows from the directory database */}
      <Section id="listings" className="border-b border-line bg-asphalt-800">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>Browse parking</Eyebrow>
          <h2 className="display-section">Find a spot</h2>
          <p className="mt-4 text-muted">
            Every published parking location in the directory — search by name or filter by state
            and city. Verified locations are being loaded state by state.
          </p>
        </div>
        <DirectoryBrowser categoryTitle="Truck Parking" entries={entries} />
      </Section>

      {/* Back to hub */}
      <Section className="border-b border-line">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase text-ink">More from the directory</h2>
            <p className="mt-2 text-sm text-muted">
              Truck stops, washes, tires, weigh stations, and CAT scales are on the way.
            </p>
          </div>
          <Link
            href="/directory"
            className="inline-flex items-center justify-center rounded-card border border-line px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
          >
            Browse the directory →
          </Link>
        </div>
        <RelatedLinks groups={categoryScopeLinks(facets)} />
      </Section>
    </>
  );
}

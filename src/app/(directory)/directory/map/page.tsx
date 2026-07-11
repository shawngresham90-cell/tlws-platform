import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { MapExplorer } from '@/components/map/MapExplorer';
import { getEntriesWithCoordinates, getDirectoryFacets } from '@/lib/directory/data';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * The public directory map (Milestone 19). The page itself is static + ISR:
 * only coordinate-ready published listings are serialized in (server-side
 * filter — never the full table), and every interactive concern lives in the
 * MapExplorer client island. Filter/location states are client-only, so no
 * arbitrary query-parameter pages exist to index — the canonical is always
 * /directory/map.
 */

export const metadata = buildMetadata({
  title: 'Truck Stop & Parking Map — Interactive Directory | Trucking Life with Shawn',
  description:
    'Interactive map of verified truck stops, truck parking, CAT scales, washes, and weigh stations. Filter by amenity, search near you, and get directions — built by drivers.',
  path: '/directory/map',
});

export const revalidate = 300;

export default async function DirectoryMapPage() {
  const [entries, facets] = await Promise.all([getEntriesWithCoordinates(), getDirectoryFacets()]);
  const stateNamesByCode = Object.fromEntries(DIRECTORY_STATES.map((s) => [s.code, s.name]));
  const statesWithCoords = [...new Set(entries.map((e) => e.state))].sort();
  const interstatesWithCoords = [
    ...new Set(entries.map((e) => e.interstate).filter((i): i is string => Boolean(i))),
  ].sort();

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Directory', path: '/directory' },
          { name: 'Map', path: '/directory/map' },
        ])}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Directory · Map</Eyebrow>
          <h1 className="display-section">The directory, on the map</h1>
          <p className="mt-4 text-muted">
            Every verified listing with confirmed coordinates — truck stops, parking, CAT scales,
            washes, and weigh stations. Filter by what you need, search near you, and get
            directions. Coordinates are verified batch by batch, so this map grows with the
            directory;{' '}
            <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
              the full list view
            </Link>{' '}
            always shows everything.
          </p>
        </div>

        <div className="mt-8">
          <MapExplorer
            entries={entries}
            states={statesWithCoords}
            interstates={interstatesWithCoords}
            stateNamesByCode={stateNamesByCode}
          />
        </div>

        <p className="mt-10 text-xs text-muted">
          Map data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-signal"
          >
            OpenStreetMap
          </a>{' '}
          contributors. Facet counts refresh as new coordinates are verified:{' '}
          {facets.states.length} state{facets.states.length === 1 ? '' : 's'} covered in the
          directory so far.
        </p>
      </Section>
    </>
  );
}

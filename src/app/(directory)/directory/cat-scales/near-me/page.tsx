import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  getCatScaleMapEntries,
  getCatScalePublishedCount,
  getEntriesWithCoordinates,
} from '@/lib/directory/data';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { CatScaleNearMe } from '@/components/directory/CatScaleNearMe';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'CAT Scales Near Me — 20 / 50 / 100 Mile Search | Trucking Life with Shawn',
  description:
    'Find the closest certified CAT Scale: use your location or enter a city/ZIP, filter to 20, 50 or 100 miles, and get directions. Distances are approximate straight-line miles.',
  path: '/directory/cat-scales/near-me',
});

/**
 * Near Me mode. Location is requested ONLY after the driver taps "Use my
 * location", is kept in component state for this page view only, and is
 * never stored, tracked, persisted, or logged. Runtime data is
 * published-only (query + RLS).
 */
export default async function CatScaleNearMePage() {
  const [scales, coordinatePool, publishedTotal] = await Promise.all([
    getCatScaleMapEntries(),
    getEntriesWithCoordinates(),
    getCatScalePublishedCount(),
  ]);
  // The search pool exists only so the city/ZIP box can resolve to a real
  // area. Project it to the six fields search reads before it crosses the
  // server->client boundary — the full rows were this page's largest payload.
  const searchPool = coordinatePool.map(({ name, city, state, zip, lat, lng }) => ({
    name,
    city,
    state,
    zip,
    lat,
    lng,
  }));
  const stateNamesByCode = Object.fromEntries(DIRECTORY_STATES.map((s) => [s.code, s.name]));

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Directory', path: '/directory' },
          { name: 'CAT Scales', path: '/directory/cat-scales' },
          { name: 'Near Me', path: '/directory/cat-scales/near-me' },
        ])}
      />
      <Section className="!py-10 sm:!py-14">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>CAT Scales · Near me</Eyebrow>
          <h1 className="display-section">The closest certified scale</h1>
          <p className="mt-3 text-muted">
            Tap the button to use your location, or type a city or ZIP. Your location is used once,
            on this page only — never stored or tracked.
          </p>
          {publishedTotal > scales.length ? (
            <p className="doc-caption mt-3 text-muted">
              Distance search covers the {scales.length} published scales with verified coordinates
              today (of {publishedTotal} listed). The rest appear in{' '}
              <Link
                className="text-signal underline underline-offset-4"
                href="/directory/cat-scales"
              >
                the full directory
              </Link>{' '}
              and gain coordinates as verification continues.
            </p>
          ) : null}
          <div className="mt-6">
            <CatScaleNearMe scales={scales} searchPool={searchPool} stateNames={stateNamesByCode} />
          </div>
          <p className="doc-caption mt-8">
            <Link className="text-muted hover:text-signal" href="/directory/cat-scales">
              ← CAT Scale directory
            </Link>
          </p>
        </div>
      </Section>
    </>
  );
}

import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { getAllPublishedEntries } from '@/lib/directory/data';
import {
  largestTruckStops,
  statesByCategory,
  categoryTotals,
  totalKnownParkingSpaces,
  interstatesByCoverage,
} from '@/lib/directory/stats';
import { getCategory } from '@/lib/directory/categories';
import { interstateSlug } from '@/lib/directory/interstates';
import { stateByCode } from '@/lib/directory/states';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Truck Stop Directory Statistics — Largest Stops, Most Scales & Parking',
  description:
    'Live statistics from the directory: the largest truck stops by parking spaces, states with the most CAT scales, tire shops, truck washes and hotels, and corridor coverage.',
  path: '/directory/stats',
});

/** Ranking sections: which categories get a "states with the most X" table. */
const CATEGORY_RANKINGS = [
  { slug: 'cat-scales', heading: 'Most CAT Scales' },
  { slug: 'parking', heading: 'Most truck parking locations' },
  { slug: 'hotels-truck-parking', heading: 'Most hotels with truck parking' },
  { slug: 'tire-repair', heading: 'Most tire & repair shops' },
  { slug: 'truck-washes', heading: 'Most truck washes' },
] as const;

export default async function StatsPage() {
  const entries = await getAllPublishedEntries();
  const largest = largestTruckStops(entries, 10);
  const totals = categoryTotals(entries);
  const parking = totalKnownParkingSpaces(entries);
  const corridors = interstatesByCoverage(entries, 8);

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Directory', path: '/directory' },
          { name: 'Statistics', path: '/directory/stats' },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/directory" className="hover:text-signal">
            Directory
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Statistics</span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · Statistics</Eyebrow>
          <h1 className="display-section">The directory in numbers</h1>
          <p className="mt-4 text-muted">
            Live figures computed from {entries.length} published locations — nothing estimated.
            Parking-space totals only count listings with a verified space count (
            {parking.listings} listings, {parking.spaces.toLocaleString()} spaces).
          </p>
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="font-display text-2xl uppercase text-ink">Largest truck stops</h2>
        <p className="mt-2 text-sm text-muted">By verified truck-parking space count.</p>
        <ol className="mt-4 grid gap-3">
          {largest.map(({ entry, value }, i) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-card border border-line bg-asphalt p-4"
            >
              <span className="text-sm">
                <span aria-hidden="true" className="mr-3 font-display text-lg text-signal">
                  {i + 1}
                </span>
                {entry.detailSlug ? (
                  <Link
                    href={`/directory/location/${entry.detailSlug}`}
                    className="font-semibold text-ink hover:text-signal"
                  >
                    {entry.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{entry.name}</span>
                )}{' '}
                <span className="text-muted">
                  — {entry.city}, {entry.state}
                  {entry.interstate ? ` · ${entry.interstate}` : ''}
                  {entry.exitNumber ? ` Exit ${entry.exitNumber}` : ''}
                </span>
              </span>
              <span className="whitespace-nowrap text-sm font-semibold text-signal">
                🅿️ ~{value} spaces
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {CATEGORY_RANKINGS.map(({ slug, heading }, idx) => {
        const rows = statesByCategory(entries, slug, 5);
        if (rows.length === 0) return null;
        const cat = getCategory(slug);
        return (
          <Section key={slug} className={`border-b border-line ${idx % 2 === 0 ? '' : 'bg-asphalt-800'}`}>
            <h2 className="font-display text-2xl uppercase text-ink">{heading}</h2>
            <ol className="mt-4 grid gap-2 sm:max-w-md">
              {rows.map((r) => {
                const st = stateByCode(r.state);
                return (
                  <li key={r.state} className="flex items-center justify-between rounded-card border border-line bg-asphalt px-4 py-2 text-sm">
                    {st ? (
                      <Link href={`/directory/${st.slug}`} className="text-ink hover:text-signal">
                        {r.stateName}
                      </Link>
                    ) : (
                      <span className="text-ink">{r.stateName}</span>
                    )}
                    <span className="text-muted">{r.count}</span>
                  </li>
                );
              })}
            </ol>
            {cat && (
              <p className="mt-3 text-sm">
                <Link
                  href={`/directory/${cat.slug}`}
                  className="text-signal underline-offset-4 hover:underline"
                >
                  Browse all {cat.title} →
                </Link>
              </p>
            )}
          </Section>
        );
      })}

      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="font-display text-2xl uppercase text-ink">Corridor coverage</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {corridors.map((c) => {
            const slug = interstateSlug(c.interstate);
            return slug ? (
              <Link
                key={c.interstate}
                href={`/directory/${slug}`}
                className="inline-block rounded-card border border-line bg-asphalt px-4 py-2 text-sm text-ink transition-colors hover:border-signal hover:text-signal"
              >
                {c.interstate} ({c.count})
              </Link>
            ) : null;
          })}
        </div>
        <h2 className="mt-10 font-display text-2xl uppercase text-ink">Listings by category</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {totals.map((t) => (
            <Link
              key={t.slug}
              href={`/directory/${t.slug}`}
              className="inline-block rounded-card border border-line bg-asphalt px-4 py-2 text-sm text-ink transition-colors hover:border-signal hover:text-signal"
            >
              {t.title} ({t.count})
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link href="/directory/browse" className="text-signal underline-offset-4 hover:underline">
            🧭 Browse by brand, city, state, interstate & category →
          </Link>
        </p>
      </Section>
    </>
  );
}

import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { getAllPublishedEntries } from '@/lib/directory/data';
import { groupByCity } from '@/lib/directory/brands';
import { stateByCode } from '@/lib/directory/states';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Truck Stops & Services by City | Truck Stop Directory',
  description:
    'Every city in the directory with published truck stops, parking, scales, washes, tire shops and hotels — grouped by state with live location counts.',
  path: '/directory/browse/cities',
});

export default async function CitiesIndexPage() {
  const entries = await getAllPublishedEntries();
  const cities = groupByCity(entries);
  const byState = new Map<string, typeof cities>();
  for (const c of cities) {
    const list = byState.get(c.state) ?? [];
    list.push(c);
    byState.set(c.state, list);
  }
  const states = [...byState.keys()].sort();

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Directory', path: '/directory' },
          { name: 'Browse', path: '/directory/browse' },
          { name: 'Cities', path: '/directory/browse/cities' },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/directory" className="hover:text-signal">
            Directory
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/directory/browse" className="hover:text-signal">
            Browse
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Cities</span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · Cities</Eyebrow>
          <h1 className="display-section">Browse by city</h1>
          <p className="mt-4 text-muted">
            {cities.length} cities with published locations, grouped by state — from single-stop
            interchange towns to clusters like West Memphis and Knoxville.
          </p>
        </div>
      </Section>
      {states.map((code) => {
        const st = stateByCode(code);
        const list = byState.get(code)!;
        return (
          <Section key={code} className="border-b border-line odd:bg-asphalt-800">
            <h2 className="font-display text-2xl uppercase text-ink">
              <Link href={st ? `/directory/${st.slug}` : '#'} className="hover:text-signal">
                {st?.name ?? code}
              </Link>
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {list
                .slice()
                .sort((a, b) => a.city.localeCompare(b.city))
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/directory/browse/cities/${c.slug}`}
                    className="inline-block rounded-card border border-line bg-asphalt px-4 py-2 text-sm text-ink transition-colors hover:border-signal hover:text-signal"
                  >
                    {c.city} ({c.entries.length})
                  </Link>
                ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}

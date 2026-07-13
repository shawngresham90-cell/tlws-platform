import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { getAllPublishedEntries, getDirectoryFacets } from '@/lib/directory/data';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';
import { stateByCode } from '@/lib/directory/states';
import { interstateSlug } from '@/lib/directory/interstates';
import { groupByBrand, groupByCity } from '@/lib/directory/brands';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Browse the Truck Stop Directory — by Brand, City, State, Interstate & Category',
  description:
    'Five ways into the directory: browse truck stops and services by brand (Pilot, Love’s, TA…), by city, by state, by interstate corridor, or by service category.',
  path: '/directory/browse',
});

const chip =
  'inline-block rounded-card border border-line bg-asphalt-800 px-4 py-2 text-sm text-ink transition-colors hover:border-signal hover:text-signal';

export default async function BrowseHubPage() {
  const [entries, facets] = await Promise.all([getAllPublishedEntries(), getDirectoryFacets()]);
  const brands = groupByBrand(entries);
  const cities = groupByCity(entries).slice(0, 24);

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Directory', path: '/directory' },
          { name: 'Browse', path: '/directory/browse' },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/directory" className="hover:text-signal">
            Directory
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Browse</span>
        </nav>
        <div className="max-w-2xl">
          <Eyebrow>Directory · Browse</Eyebrow>
          <h1 className="display-section">Five ways in</h1>
          <p className="mt-4 text-muted">
            Every published location, sliced the way you actually look for it — the brand you run
            with, the city you shut down in, the state you’re crossing, the corridor you live on,
            or the service you need right now.
          </p>
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="font-display text-2xl uppercase text-ink">Browse by brand</h2>
        <p className="mt-2 text-sm text-muted">
          Chains derived from the business names on published listings.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {brands.map(({ brand, entries: es }) => (
            <Link key={brand.slug} href={`/directory/browse/brands/${brand.slug}`} className={chip}>
              {brand.name} ({es.length})
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link href="/directory/browse/brands" className="text-signal underline-offset-4 hover:underline">
            All brands →
          </Link>
        </p>
      </Section>

      <Section className="border-b border-line">
        <h2 className="font-display text-2xl uppercase text-ink">Browse by city</h2>
        <p className="mt-2 text-sm text-muted">The biggest truck-service cities in the directory.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {cities.map((c) => (
            <Link key={c.slug} href={`/directory/browse/cities/${c.slug}`} className={chip}>
              {c.city}, {c.state} ({c.entries.length})
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link href="/directory/browse/cities" className="text-signal underline-offset-4 hover:underline">
            All cities →
          </Link>
        </p>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="font-display text-2xl uppercase text-ink">Browse by state</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {facets.states.map((code) => {
            const st = stateByCode(code);
            return st ? (
              <Link key={code} href={`/directory/${st.slug}`} className={chip}>
                {st.name} ({facets.countsByState[code] ?? 0})
              </Link>
            ) : null;
          })}
        </div>
      </Section>

      <Section className="border-b border-line">
        <h2 className="font-display text-2xl uppercase text-ink">Browse by interstate</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {facets.interstates.map((designation) => {
            const slug = interstateSlug(designation);
            return slug ? (
              <Link key={designation} href={`/directory/${slug}`} className={chip}>
                {designation} corridor ({facets.countsByInterstate[designation] ?? 0})
              </Link>
            ) : null;
          })}
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <h2 className="font-display text-2xl uppercase text-ink">Browse by category</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {DIRECTORY_CATEGORIES.map((c) => (
            <Link key={c.slug} href={categoryHref(c)} className={chip}>
              {c.icon} {c.title}
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link href="/directory/stats" className="text-signal underline-offset-4 hover:underline">
            📊 Directory statistics — largest stops, most scales, most parking →
          </Link>
        </p>
      </Section>
    </>
  );
}

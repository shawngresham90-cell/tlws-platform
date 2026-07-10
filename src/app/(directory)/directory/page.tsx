import { Section, Eyebrow } from '@/components/ui';
import { CategoryCardGrid } from '@/components/directory';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const metadata = buildMetadata({
  title:
    'Driver Directory — Parking, Truck Stops, Scales, Repair & More | Trucking Life with Shawn',
  description:
    'The driver-built directory: truck parking, truck stops, CAT scales, truck washes, tire repair, weigh stations, hotels with truck parking, CDL schools, and roadside service.',
  path: '/directory',
});

/**
 * The /directory hub — every category card comes from the shared registry
 * (lib/directory/categories), so adding a directory there adds it here, to the
 * engine's static pages, and to the sitemap in one move. All nine categories
 * link to real pages now: Truck Parking to its foundation page, the rest to
 * the shared Directory Engine page.
 */
export default function DirectoryPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Driver Directory',
            description: 'Directory categories for truck drivers.',
            itemListElement: DIRECTORY_CATEGORIES.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.title,
              url: `${SITE.url}${categoryHref(c)}`,
            })),
          },
        ]}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>The Driver Directory</Eyebrow>
          <h1 className="display-section">Know your stop before the exit</h1>
          <p className="mt-4 text-muted">
            Parking, fuel, washes, tires, scales, schools, and breakdown help — the stuff you
            actually need on the road, built by drivers, for drivers. Every directory below is open;
            verified locations are being loaded state by state.
          </p>
        </div>
        <div className="mt-10">
          <CategoryCardGrid categories={DIRECTORY_CATEGORIES} />
        </div>
      </Section>
    </>
  );
}

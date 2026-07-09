import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const metadata = buildMetadata({
  title: 'Driver Directory — Parking, Truck Stops, Washes, Scales & More | Trucking Life with Shawn',
  description:
    'The driver-built directory: truck parking, truck stops, truck washes, tire repair, weigh stations, and CAT scales. Know your stop before the exit — built by a 17-year driver.',
  path: '/directory',
});

type Category = {
  slug: string;
  title: string;
  icon: string;
  description: string;
  /** Route when the category page exists. Omit = coming soon (no dead links). */
  href?: string;
};

const CATEGORIES: Category[] = [
  {
    slug: 'parking',
    title: 'Truck Parking',
    icon: '🅿️',
    description:
      'Free, paid, and reserved parking — truck stops, rest areas, and safe spots to shut down for the night.',
    href: '/directory/parking',
  },
  {
    slug: 'truck-stops',
    title: 'Truck Stops',
    icon: '⛽',
    description: 'Fuel, food, showers, and amenities — what’s actually at the exit before you take it.',
  },
  {
    slug: 'truck-washes',
    title: 'Truck Washes',
    icon: '🚿',
    description: 'Where to get the tractor and trailer cleaned up without burning half a day.',
  },
  {
    slug: 'tire-repair',
    title: 'Tire Repair',
    icon: '🛞',
    description: 'Tire shops and road service — because blowouts don’t wait for business hours.',
  },
  {
    slug: 'weigh-stations',
    title: 'Weigh Stations',
    icon: '⚖️',
    description: 'Know the coops on your route before you roll up on one.',
  },
  {
    slug: 'cat-scales',
    title: 'CAT Scales',
    icon: '📏',
    description: 'Certified scales to check your axles before the DOT checks them for you.',
  },
];

function CategoryCard({ category }: { category: Category }) {
  const body = (
    <>
      <div
        aria-hidden="true"
        className="mb-4 flex aspect-[5/2] items-center justify-center rounded-card border border-line bg-asphalt-700 text-5xl"
      >
        {category.icon}
      </div>
      <h2 className="font-display text-xl uppercase text-signal">{category.title}</h2>
      <p className="mt-2 flex-1 text-sm text-muted">{category.description}</p>
      {category.href ? (
        <span className="mt-4 inline-flex self-start rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors group-hover:bg-signal-600">
          Open directory →
        </span>
      ) : (
        <span className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Coming soon
        </span>
      )}
    </>
  );

  const cardClasses =
    'group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors';

  if (!category.href) {
    return <div className={cardClasses}>{body}</div>;
  }
  return (
    <Link href={category.href} className={`${cardClasses} hover:border-signal`}>
      {body}
    </Link>
  );
}

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
            itemListElement: CATEGORIES.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.title,
              ...(c.href ? { url: `${SITE.url}${c.href}` } : {}),
            })),
          },
        ]}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>The Driver Directory</Eyebrow>
          <h1 className="display-section">Know your stop before the exit</h1>
          <p className="mt-4 text-muted">
            Parking, fuel, washes, tires, scales — the stuff you actually need on the road, built
            by drivers, for drivers. Truck Parking is live now; the rest of the directory rolls
            out from here.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </Section>
    </>
  );
}

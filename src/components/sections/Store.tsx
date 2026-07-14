import Link from 'next/link';
import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import { AmazonDisclosure } from '@/components/store/AmazonDisclosure';

/**
 * Homepage teaser for the Trucking Life Store. Shows a few categories and a
 * link into /store. Includes the Amazon disclosure because affiliate links
 * live one click away.
 */
export function Store() {
  const featured = STORE_CATEGORIES.slice(0, 6);
  return (
    <Section id="store" className="border-b border-line">
      <SectionHeading
        eyebrow="Trucking Life Store"
        title="Gear a driver actually recommends"
        intro="Dash cams, 12V fridges, bunk upgrades, and road-tested trucker gear — hand-picked, with an honest reason for every pick."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((c) => (
          <Link
            key={c.slug}
            href={storeCategoryHref(c.slug)}
            className="flex items-center gap-3 rounded-card border border-line bg-asphalt-800 px-4 py-3 transition-colors hover:border-signal"
          >
            <span aria-hidden="true" className="text-2xl">
              {c.icon}
            </span>
            <span className="font-display text-sm uppercase text-ink">{c.title}</span>
          </Link>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-4">
        <Button href="/store">Browse the store</Button>
        <AmazonDisclosure variant="inline" />
      </div>
    </Section>
  );
}

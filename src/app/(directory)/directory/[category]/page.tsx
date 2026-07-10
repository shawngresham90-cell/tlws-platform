import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { DirectoryHero, DirectoryBrowser } from '@/components/directory';
import { ENGINE_CATEGORIES, getCategory } from '@/lib/directory/categories';
import { getEntries } from '@/lib/directory/data';
import { listingListSchema } from '@/lib/directory/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * The Directory Engine page (Milestone 11). One route statically renders every
 * category in the registry that doesn't have a hand-built page — today that's
 * all of them except Truck Parking (its literal /directory/parking route takes
 * precedence over this dynamic segment and is untouched). Adding a directory
 * later = one registry entry; this page, its SEO, search, and filters come free.
 */
export const dynamicParams = false;

// Listings come from the database now (Milestone 12) — refresh periodically
// in addition to the on-save revalidation the admin actions trigger.
export const revalidate = 300;

export function generateStaticParams() {
  return ENGINE_CATEGORIES.map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const category = getCategory(params.category);
  if (!category || category.customHref) return {};
  return buildMetadata({
    title: category.seoTitle,
    description: category.seoDescription,
    path: `/directory/${category.slug}`,
  });
}

export default async function DirectoryCategoryPage({ params }: { params: { category: string } }) {
  const category = getCategory(params.category);
  if (!category || category.customHref) notFound();

  const entries = await getEntries(category.slug);
  const listings = listingListSchema(
    entries,
    category.slug,
    category.title,
    `/directory/${category.slug}`,
  );

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Directory', path: '/directory' },
            { name: category.title, path: `/directory/${category.slug}` },
          ]),
          ...(listings ? [listings] : []),
        ]}
      />

      <DirectoryHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Directory', href: '/directory' },
          { name: category.title },
        ]}
        eyebrow={`Directory · ${category.title}`}
        title={category.heroTitle}
        intro={category.heroIntro}
      />

      <Section>
        <DirectoryBrowser categoryTitle={category.title} entries={entries} />
        <p className="mt-10 text-sm text-muted">
          Looking for something else?{' '}
          <Link href="/directory" className="text-signal underline-offset-4 hover:underline">
            Browse all directories →
          </Link>
        </p>
      </Section>
    </>
  );
}

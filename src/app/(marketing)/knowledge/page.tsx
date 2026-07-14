import Link from 'next/link';
import { Container, Section, Eyebrow } from '@/components/ui';
import { CategoryCard } from '@/components/kc/CategoryCard';
import { ArticleCard } from '@/components/kc/ArticleCard';
import { SearchBox } from '@/components/kc/SearchBox';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { getCategories, getFeaturedArticles, getLatestArticles } from '@/lib/kc/queries';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;
export const metadata = buildMetadata({
  title: 'Knowledge Center — Trucking & CDL Guides',
  description:
    'Plain-English trucking guides: DOT compliance, Hours of Service, CDL training, careers, and health on the road. Built by a 17-year driver.',
  path: '/knowledge',
});

export default async function KnowledgeHome() {
  const [categories, featured, latest] = await Promise.all([
    getCategories(),
    getFeaturedArticles(3),
    getLatestArticles(6),
  ]);
  const slugById = Object.fromEntries(categories.map((c) => [c.id, c.slug]));

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Knowledge Center', path: '/knowledge' },
        ])}
      />
      <div className="border-b border-line bg-asphalt py-16 sm:py-20">
        <Container>
          <Breadcrumbs crumbs={[{ name: 'Home', href: '/' }, { name: 'Knowledge Center' }]} />
          <Eyebrow>Knowledge Center</Eyebrow>
          <h1 className="display-hero max-w-3xl text-5xl sm:text-6xl">
            Straight answers for <span className="text-signal">working drivers.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            DOT rules, Hours of Service, CDL prep, careers, and staying healthy on the road —
            written plain, verified against the regs, from a driver with 17 years and zero
            violations.
          </p>
          <div className="mt-8">
            <SearchBox />
          </div>
        </Container>
      </div>

      <Section>
        <Eyebrow>Browse by topic</Eyebrow>
        <h2 className="display-section mb-8">Categories</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </Section>

      {featured.length > 0 && (
        <Section className="border-t border-line bg-asphalt-800">
          <Eyebrow>Featured</Eyebrow>
          <h2 className="display-section mb-8">Start here</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {featured.map((a) => (
              <ArticleCard key={a.id} article={a} categorySlug={slugById[a.category_id] ?? ''} />
            ))}
          </div>
        </Section>
      )}

      {latest.length > 0 && (
        <Section className="border-t border-line">
          <Eyebrow>Latest</Eyebrow>
          <h2 className="display-section mb-8">Recently published</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} categorySlug={slugById[a.category_id] ?? ''} />
            ))}
          </div>
        </Section>
      )}

      <Section className="border-t border-line">
        <Container>
          <p className="text-sm text-muted">
            Reading up before you roll?{' '}
            <Link href="/store" className="font-semibold text-signal hover:underline">
              The Trucking Life Store
            </Link>{' '}
            rounds up the road-tested gear that goes with the guides — dash cams, bunk
            upgrades, and cab essentials.
          </p>
        </Container>
      </Section>
    </>
  );
}

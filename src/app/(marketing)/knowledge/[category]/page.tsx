import { notFound } from 'next/navigation';
import { Section } from '@/components/ui';
import { CategoryNav } from '@/components/kc/CategoryNav';
import { CategoryHero } from '@/components/kc/CategoryHero';
import { ArticleCard } from '@/components/kc/ArticleCard';
import { Pagination } from '@/components/kc/Pagination';
import { KcNextSteps } from '@/components/kc/KcNextSteps';
import { getCategories, getCategoryBySlug, getCategoryArticles } from '@/lib/kc/queries';
import { PAGE_SIZE } from '@/lib/kc/types';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

/** One parser for the page param, so metadata and page can never disagree. */
function pageFrom(searchParams?: { page?: string }): number {
  return Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams?: { page?: string };
}) {
  const cat = await getCategoryBySlug(params.category);
  // Unknown category 404s — emit no canonical and no robots directives for it,
  // matching the directory pages' miss convention.
  if (!cat) return {};
  // Pages 2+ are real, linked, crawlable URLs with different articles, so each
  // needs its own canonical and a distinct title rather than all 200-ing as
  // duplicates of page 1.
  const page = pageFrom(searchParams);
  const base = cat.meta_title ?? `${cat.name} — Knowledge Center`;
  return buildMetadata({
    title: page > 1 ? `${base} — Page ${page}` : base,
    description: cat.meta_description ?? cat.description ?? undefined,
    path: page > 1 ? `/knowledge/${cat.slug}?page=${page}` : `/knowledge/${cat.slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams: { page?: string };
}) {
  const cat = await getCategoryBySlug(params.category);
  if (!cat) notFound();

  const page = pageFrom(searchParams);
  const [categories, { articles, total }] = await Promise.all([
    getCategories(),
    getCategoryArticles(cat.id, page),
  ]);
  const slugById = Object.fromEntries(categories.map((c) => [c.id, c.slug]));

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Knowledge Center', path: '/knowledge' },
          { name: cat.name, path: `/knowledge/${cat.slug}` },
        ])}
      />
      <CategoryHero slug={cat.slug} name={cat.name} description={cat.description} />

      <Section>
        <CategoryNav categories={categories} activeSlug={cat.slug} />
        {articles.length === 0 ? (
          <p className="text-muted">No articles here yet — check back soon.</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  categorySlug={slugById[a.category_id] ?? cat.slug}
                />
              ))}
            </div>
            <Pagination
              basePath={`/knowledge/${cat.slug}`}
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
        <KcNextSteps categorySlug={cat.slug} />
      </Section>
    </>
  );
}

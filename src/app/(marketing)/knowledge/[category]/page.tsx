import { notFound } from 'next/navigation';
import { Container, Section, Eyebrow } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { CategoryNav } from '@/components/kc/CategoryNav';
import { ArticleCard } from '@/components/kc/ArticleCard';
import { Pagination } from '@/components/kc/Pagination';
import { SearchBox } from '@/components/kc/SearchBox';
import { getCategories, getCategoryBySlug, getCategoryArticles } from '@/lib/kc/queries';
import { PAGE_SIZE } from '@/lib/kc/types';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { category: string } }) {
  const cat = await getCategoryBySlug(params.category);
  if (!cat)
    return buildMetadata({ title: 'Category not found', path: `/knowledge/${params.category}` });
  return buildMetadata({
    title: cat.meta_title ?? `${cat.name} — Knowledge Center`,
    description: cat.meta_description ?? cat.description ?? undefined,
    path: `/knowledge/${cat.slug}`,
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

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
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
      <div className="border-b border-line bg-asphalt py-14 sm:py-16">
        <Container>
          <Breadcrumbs
            crumbs={[
              { name: 'Home', href: '/' },
              { name: 'Knowledge Center', href: '/knowledge' },
              { name: cat.name },
            ]}
          />
          <Eyebrow>Knowledge Center</Eyebrow>
          <h1 className="display-hero max-w-3xl text-4xl sm:text-5xl">{cat.name}</h1>
          {cat.description && (
            <p className="mt-4 max-w-2xl text-lg text-muted">{cat.description}</p>
          )}
          <div className="mt-8">
            <SearchBox />
          </div>
        </Container>
      </div>

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
      </Section>
    </>
  );
}

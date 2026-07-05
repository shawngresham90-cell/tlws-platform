import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { TableOfContents } from '@/components/kc/TableOfContents';
import { AuthorBlock } from '@/components/kc/AuthorBlock';
import { FaqBlock } from '@/components/kc/FaqBlock';
import { SourcesBlock } from '@/components/kc/SourcesBlock';
import { RelatedArticles } from '@/components/kc/RelatedArticles';
import {
  getArticle,
  getCategories,
  getCategoryBySlug,
  getRelated,
  getAllArticleRefs,
} from '@/lib/kc/queries';
import { renderMarkdown } from '@/lib/kc/mdx';
import { articleSchema, faqSchema } from '@/lib/kc/schema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const revalidate = 300;

export async function generateStaticParams() {
  const refs = await getAllArticleRefs();
  return refs.map((r) => ({ category: r.category, slug: r.slug }));
}

export async function generateMetadata({ params }: { params: { category: string; slug: string } }) {
  const article = await getArticle(params.category, params.slug);
  if (!article)
    return buildMetadata({
      title: 'Article not found',
      path: `/knowledge/${params.category}/${params.slug}`,
    });
  return buildMetadata({
    title: article.meta_title ?? article.title,
    description: article.meta_description ?? article.excerpt ?? undefined,
    path: `/knowledge/${params.category}/${article.slug}`,
    image: article.hero_image_url ?? undefined,
    type: 'article',
  });
}

export default async function ArticlePage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const [article, category] = await Promise.all([
    getArticle(params.category, params.slug),
    getCategoryBySlug(params.category),
  ]);
  if (!article || !category) notFound();

  const [categories, related] = await Promise.all([getCategories(), getRelated(article)]);
  const slugById = Object.fromEntries(categories.map((c) => [c.id, c.slug]));
  const { html, toc } = renderMarkdown(article.body_mdx ?? '');
  const url = `${SITE.url}/knowledge/${category.slug}/${article.slug}`;

  const schemas = [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Knowledge Center', path: '/knowledge' },
      { name: category.name, path: `/knowledge/${category.slug}` },
      { name: article.title, path: `/knowledge/${category.slug}/${article.slug}` },
    ]),
    articleSchema(article, category, url),
    faqSchema(article),
  ].filter(Boolean);

  return (
    <>
      {schemas.map((s, i) => (
        <JsonLd key={i} schema={s as object} />
      ))}

      <article className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <Breadcrumbs
            crumbs={[
              { name: 'Home', href: '/' },
              { name: 'Knowledge Center', href: '/knowledge' },
              { name: category.name, href: `/knowledge/${category.slug}` },
              { name: article.title },
            ]}
          />

          <p className="eyebrow mb-3">{category.name}</p>
          <h1 className="display-hero text-4xl sm:text-5xl">{article.title}</h1>
          {article.excerpt && <p className="mt-5 text-lg text-muted">{article.excerpt}</p>}

          <div className="mt-8">
            <AuthorBlock article={article} />
          </div>

          {toc.length >= 2 && (
            <div className="mt-8">
              <TableOfContents items={toc} />
            </div>
          )}

          <div
            className="mt-8 text-lg"
            // Body is server-rendered from trusted DB content via our own renderer.
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <FaqBlock faqs={article.faqs} />
          <SourcesBlock sources={article.sources} />
          <RelatedArticles articles={related} categorySlugById={slugById} />
        </Container>
      </article>
    </>
  );
}

import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { TableOfContents } from '@/components/kc/TableOfContents';
import { AuthorBlock } from '@/components/kc/AuthorBlock';
import { FaqBlock } from '@/components/kc/FaqBlock';
import { SourcesBlock } from '@/components/kc/SourcesBlock';
import { RelatedArticles } from '@/components/kc/RelatedArticles';
import { KcNextSteps } from '@/components/kc/KcNextSteps';
import { ArticleFigure } from '@/components/kc/ArticleFigure';
import {
  getArticle,
  getCategories,
  getCategoryBySlug,
  getRelated,
  getAllArticleRefs,
} from '@/lib/kc/queries';
import { renderMarkdown } from '@/lib/kc/mdx';
import { articleImageUrl, articleVisual, splitHtmlAfterHeading } from '@/lib/kc/article-visuals';
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
  // Unknown article 404s — emit no canonical and no robots directives for it,
  // matching the directory pages' miss convention.
  if (!article) return {};
  // `getArticle` resolves the category by exact slug match, so on this
  // success path `params.category` IS the canonical category slug — the same
  // value the page body reads as `category.slug`. One registry lookup, one
  // resolver, so og:image and twitter:image (both filled by buildMetadata
  // from this single `image`) match the schema image and the inline figure.
  const visual = articleVisual(params.category, article.slug);
  return buildMetadata({
    title: article.meta_title ?? article.title,
    description: article.meta_description ?? article.excerpt ?? undefined,
    path: `/knowledge/${params.category}/${article.slug}`,
    image: articleImageUrl(article.hero_image_url, visual),
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

  // An approved article graphic, when one is registered for this article
  // (KC-VIS-1). The body itself is never rewritten: the rendered HTML is cut
  // after the configured heading and the figure goes between the two halves,
  // so the markdown renderer stays image-free and the article's regulatory
  // text is byte-for-byte what the database holds. No registry entry, no
  // configured heading, or a heading the body doesn't contain — the article
  // renders exactly as it did before.
  const visual = articleVisual(category.slug, article.slug);
  const split = visual?.afterHeadingId ? splitHtmlAfterHeading(html, visual.afterHeadingId) : null;

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

          {visual && split ? (
            <>
              <div
                className="mt-8 text-lg"
                // Body is server-rendered from trusted DB content via our own renderer.
                // Both halves are exactly the bytes renderMarkdown produced — the
                // figure is a sibling element, never spliced into the HTML string.
                dangerouslySetInnerHTML={{ __html: split.before }}
              />
              <ArticleFigure visual={visual} />
              {/* No top margin: the figure carries its own, and the first block
                  of the remaining body brings its own heading/paragraph margin. */}
              <div className="text-lg" dangerouslySetInnerHTML={{ __html: split.after }} />
            </>
          ) : (
            <>
              {/* A registered visual whose heading anchor didn't match (or that
                  configures none) still renders — above the body rather than
                  silently disappearing. The harness pins the anchor for every
                  registered article, so this is a safety net, not a live path. */}
              {visual && <ArticleFigure visual={visual} className="mt-8" />}
              <div
                className="mt-8 text-lg"
                // Body is server-rendered from trusted DB content via our own renderer.
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>
          )}

          <FaqBlock faqs={article.faqs} />
          <SourcesBlock sources={article.sources} />
          <RelatedArticles articles={related} categorySlugById={slugById} />
          <KcNextSteps categorySlug={category.slug} />
        </Container>
      </article>
    </>
  );
}

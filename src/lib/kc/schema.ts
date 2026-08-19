import { SITE } from '@/lib/seo/site';
import { articleImageUrl, articleVisual } from './article-visuals';
import type { KcArticle, KcCategory } from './types';

/** Article schema (rich result + AI legibility). */
export function articleSchema(article: KcArticle, category: KcCategory, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.meta_description ?? article.excerpt ?? undefined,
    articleSection: category.name,
    // Omit rather than emit keywords: "" for a tagless article.
    ...(article.tags.length > 0 ? { keywords: article.tags.join(', ') } : {}),
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at,
    author: {
      '@type': 'Person',
      name: article.author_name,
      description: article.author_bio ?? undefined,
    },
    publisher: { '@id': `${SITE.url}/#organization` },
    mainEntityOfPage: url,
    // Resolved, never read straight off the row: an article with no
    // `hero_image_url` may still publish an approved registry graphic, and
    // the schema image must be the same asset the page renders and the
    // social card advertises. `articleImageUrl` is the one place that
    // decision is made — callers cannot pass a different image.
    image: articleImageUrl(article.hero_image_url, articleVisual(category.slug, article.slug)),
  };
}

/** FAQ schema — only when the article actually has FAQs. */
export function faqSchema(article: KcArticle) {
  if (!article.faqs?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

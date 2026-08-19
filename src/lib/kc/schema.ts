import { SITE } from '@/lib/seo/site';
import { articleVisualImageUrl } from './article-visuals';
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
    // Same authority the page metadata uses: an explicit hero first, then the
    // curated article visual. Absolute, because JSON-LD is read away from the
    // page that served it. A pending visual contributes nothing.
    image: article.hero_image_url ?? articleVisualImageUrl(article.slug, SITE.url) ?? undefined,
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

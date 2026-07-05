import { SITE } from '@/lib/seo/site';
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
    keywords: article.tags.join(', '),
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at,
    author: {
      '@type': 'Person',
      name: article.author_name,
      description: article.author_bio ?? undefined,
    },
    publisher: { '@id': `${SITE.url}/#organization` },
    mainEntityOfPage: url,
    image: article.hero_image_url ?? undefined,
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

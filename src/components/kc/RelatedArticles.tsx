import { ArticleCard } from './ArticleCard';
import type { KcArticleCard } from '@/lib/kc/types';

/** Related articles — internal linking that keeps readers (and crawlers) moving. */
export function RelatedArticles({
  articles,
  categorySlugById,
}: {
  articles: KcArticleCard[];
  categorySlugById: Record<string, string>;
}) {
  if (!articles.length) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-16 border-t border-line pt-10">
      <h2 id="related-heading" className="display-section text-2xl mb-6">
        Keep reading
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            categorySlug={categorySlugById[a.category_id] ?? ''}
          />
        ))}
      </div>
    </section>
  );
}

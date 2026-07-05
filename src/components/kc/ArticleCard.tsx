import Link from 'next/link';
import type { KcArticleCard } from '@/lib/kc/types';

/** Article teaser card. categorySlug is resolved by the caller for the href. */
export function ArticleCard({
  article,
  categorySlug,
}: {
  article: KcArticleCard;
  categorySlug: string;
}) {
  return (
    <article className="group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal">
      <h3 className="font-display text-lg uppercase text-ink group-hover:text-signal">
        <Link
          href={`/knowledge/${categorySlug}/${article.slug}`}
          className="after:absolute after:inset-0 relative"
        >
          {article.title}
        </Link>
      </h3>
      {article.excerpt && <p className="mt-2 flex-1 text-sm text-muted">{article.excerpt}</p>}
      <p className="mt-4 text-xs uppercase tracking-wide text-muted">
        {article.reading_time_min ? `${article.reading_time_min} min read` : 'Read'} →
      </p>
    </article>
  );
}

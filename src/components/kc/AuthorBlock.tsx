import type { KcArticle } from '@/lib/kc/types';

/** Author + last-updated + verification badge. E-E-A-T signal for SEO. */
export function AuthorBlock({ article }: { article: KcArticle }) {
  const updated = new Date(article.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-asphalt-800 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-lg uppercase text-ink">{article.author_name}</p>
        {article.author_bio && (
          <p className="mt-1 max-w-md text-sm text-muted">{article.author_bio}</p>
        )}
      </div>
      <div className="text-sm text-muted sm:text-right">
        <p>
          Last updated <span className="text-ink">{updated}</span>
        </p>
        {article.reg_verified && article.reg_verified_date && (
          <p className="mt-1 text-signal">
            ✓ Last reviewed against the eCFR{' '}
            <span className="whitespace-nowrap">
              {new Date(`${article.reg_verified_date}T00:00:00`).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

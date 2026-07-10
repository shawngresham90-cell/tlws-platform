import { Button } from '@/components/ui';

/**
 * Two honest empty states:
 *  - "building": the category has no data yet (pre-database) — say so plainly
 *    instead of showing a blank grid.
 *  - "no-results": data exists but the search/filters matched nothing.
 */
export function DirectoryEmptyState({
  variant,
  categoryTitle,
  onClear,
}: {
  variant: 'building' | 'no-results';
  categoryTitle: string;
  /** Provided by the browser so "clear filters" works without a reload. */
  onClear?: () => void;
}) {
  if (variant === 'no-results') {
    return (
      <div className="rounded-card border border-dashed border-line bg-asphalt-800 p-10 text-center">
        <p className="font-display text-2xl text-ink">No matches</p>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Nothing in {categoryTitle} fits that search and filter combination. Widen the search or
          clear the filters.
        </p>
        {onClear && (
          <div className="mt-6 flex justify-center">
            <Button type="button" variant="ghost" onClick={onClear}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-card border border-dashed border-line bg-asphalt-800 p-10 text-center">
      <p className="font-display text-2xl text-ink">The {categoryTitle} list is being built</p>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Verified locations are being loaded state by state — no filler, no scraped junk. Check back
        soon, and when driver submissions open you can help fill the map.
      </p>
    </div>
  );
}

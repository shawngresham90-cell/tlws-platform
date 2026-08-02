'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { DirectProductCard } from './DirectProductCard';
import { filterDirectProducts, type DirectProduct } from '@/lib/store/direct';
import { trackEvent } from '@/lib/analytics';
import { STORE_EVENTS } from '@/lib/store/analytics';

const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt';

/**
 * Search + category filter for the direct storefront. Filtering itself is the
 * pure `filterDirectProducts` in lib/store/direct.ts (tested there); this only
 * wires the controls. Search is deferred so typing stays smooth, and a settled
 * query fires one analytics event carrying the query text and nothing else.
 */
export function DirectStoreBrowser({
  products,
  categories,
}: {
  products: DirectProduct[];
  categories: string[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => filterDirectProducts(products, { query: deferredQuery, category }),
    [products, deferredQuery, category],
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => query.trim() && trackEvent(STORE_EVENTS.search, { query: query.trim() })}
          placeholder="Search guides, coaching, merch…"
          aria-label="Search Trucking Life products"
          className={inputClasses}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value) trackEvent(STORE_EVENTS.categoryView, { category: e.target.value });
          }}
          aria-label="Filter by category"
          className={inputClasses}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-sm text-muted" role="status" aria-live="polite">
        {results.length} product{results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-asphalt-800 p-8 text-center text-muted">
          No products match that search.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <DirectProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

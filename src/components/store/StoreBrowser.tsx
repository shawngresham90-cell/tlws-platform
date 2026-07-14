'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { StoreProduct } from '@/lib/store/types';
import { filterAndSortProducts, type StoreSort } from '@/lib/store/search';
import { STORE_CATEGORIES } from '@/lib/store/categories';
import { trackEvent } from '@/lib/analytics';
import { STORE_EVENTS } from '@/lib/store/analytics';
import { ProductCard } from './ProductCard';

const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt';

/**
 * Client search / category filter / sort over the catalog. Pure filtering
 * lives in lib/store/search.ts (tested); this just wires the controls. Search
 * is deferred so typing stays smooth, and a settled query fires one analytics
 * event (query text only — no personal data).
 */
export function StoreBrowser({
  products,
  initialCategory = '',
}: {
  products: StoreProduct[];
  initialCategory?: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<StoreSort>('featured');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => filterAndSortProducts(products, { query: deferredQuery, category, sort }),
    [products, deferredQuery, category, sort],
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => query.trim() && trackEvent(STORE_EVENTS.search, { query: query.trim() })}
          placeholder="Search gear (dash cam, cooler, seat…)"
          aria-label="Search store products"
          className={inputClasses}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className={inputClasses}
        >
          <option value="">All categories</option>
          {STORE_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as StoreSort)}
          aria-label="Sort products"
          className={inputClasses}
        >
          <option value="featured">Recommended</option>
          <option value="name">Name A–Z</option>
          <option value="category">Category</option>
        </select>
      </div>

      <p className="mt-4 text-sm text-muted" role="status" aria-live="polite">
        {results.length} product{results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-asphalt-800 p-8 text-center text-muted">
          No products match that search yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

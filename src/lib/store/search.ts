import type { StoreProduct } from './types';
import { productReadiness } from './products';

/** Store browse controls — search + category filter + sort. Pure, testable. */

export type StoreSort = 'featured' | 'name' | 'category';
export type StoreFilter = {
  query?: string;
  category?: string; // '' or undefined = all
  sort?: StoreSort;
};

function haystack(p: StoreProduct): string {
  return [p.name, p.tagline, p.description, p.category, ...p.benefits].join(' ').toLowerCase();
}

export function filterAndSortProducts(
  products: StoreProduct[],
  { query, category, sort = 'featured' }: StoreFilter,
): StoreProduct[] {
  let out = products;

  if (category) out = out.filter((p) => p.category === category);

  const q = (query ?? '').trim().toLowerCase();
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    out = out.filter((p) => {
      const h = haystack(p);
      return tokens.every((t) => h.includes(t));
    });
  }

  const sorted = [...out];
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'category':
      sorted.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      break;
    case 'featured':
    default:
      // Live (buyable) first, then featured, then name — surfaces what a
      // visitor can actually act on without ever fabricating a price/ASIN.
      sorted.sort((a, b) => {
        const la = productReadiness(a).live ? 1 : 0;
        const lb = productReadiness(b).live ? 1 : 0;
        if (la !== lb) return lb - la;
        const fa = a.featured ? 1 : 0;
        const fb = b.featured ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return a.name.localeCompare(b.name);
      });
      break;
  }
  return sorted;
}

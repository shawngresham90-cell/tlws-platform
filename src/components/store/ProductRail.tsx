import type { StoreProduct } from '@/lib/store/types';
import { ProductCard } from './ProductCard';

/**
 * A titled row of product cards — used for Related products and "Frequently
 * Bought Together". The optional caption is where we make honest framing
 * explicit (e.g. FBT is Shawn's suggested pairing, not Amazon purchase data).
 */
export function ProductRail({
  title,
  products,
  caption,
  headingId,
}: {
  title: string;
  products: StoreProduct[];
  caption?: string;
  headingId?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-2xl uppercase text-ink">
        {title}
      </h2>
      {caption && <p className="mt-1 text-sm text-muted">{caption}</p>}
      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

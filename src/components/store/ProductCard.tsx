import Link from 'next/link';
import type { StoreProduct } from '@/lib/store/types';
import { priceLabel, productHref, productReadiness, ratingLabel, displayName } from '@/lib/store/products';
import { storeCategory } from '@/lib/store/categories';
import { ProductImage } from './ProductImage';
import { AmazonCta } from './AmazonCta';

/**
 * One product on the grid. Links to its detail page; shows the Amazon button
 * only when live (AmazonCta handles the placeholder state). Price renders only
 * when confirmed — never a guessed figure.
 */
export function ProductCard({
  product,
  headingLevel = 'h3',
}: {
  product: StoreProduct;
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  const cat = storeCategory(product.category);
  const price = priceLabel(product);
  const rating = ratingLabel(product);
  const { live } = productReadiness(product);

  return (
    <div className="flex flex-col rounded-card border border-line bg-asphalt-800 p-5">
      <Link href={productHref(product.slug)} className="group">
        <ProductImage product={product} />
      </Link>
      {cat && (
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{cat.title}</p>
      )}
      <Heading className="mt-1 font-display text-lg uppercase text-ink">
        <Link href={productHref(product.slug)} className="transition-colors hover:text-signal">
          {displayName(product)}
        </Link>
      </Heading>
      <p className="mt-2 flex-1 text-sm text-muted">{product.tagline}</p>
      {rating && (
        <p className="mt-2 text-xs text-muted">
          <span aria-hidden="true" className="text-signal">
            ★
          </span>{' '}
          {rating} on Amazon
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        {price ? (
          <span className="font-display text-lg text-ink">{price}</span>
        ) : (
          <span className="text-xs text-muted">Price at Amazon</span>
        )}
        {live ? (
          <AmazonCta product={product} placement="card" className="px-4 py-2 text-xs" />
        ) : (
          <Link
            href={productHref(product.slug)}
            className="text-sm font-semibold text-signal underline-offset-4 hover:underline"
          >
            See the pick →
          </Link>
        )}
      </div>
    </div>
  );
}

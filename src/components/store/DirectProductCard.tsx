import Image from 'next/image';
import Link from 'next/link';
import { DirectCta } from './DirectCta';
import {
  directPriceLabel,
  directProductHref,
  shirtStockLabel,
  type DirectProduct,
} from '@/lib/store/direct';

/**
 * Card for a direct (Stan) product. Shows a price ONLY when one is confirmed —
 * an unconfirmed price renders nothing at all rather than a dash, a "from", or
 * any other stand-in that could read as a number.
 *
 * The founder shirt's stock line is read from shirt-inventory.ts through
 * `shirtStockLabel()`; no count is written at this call site.
 */
export function DirectProductCard({ product }: { product: DirectProduct }) {
  const price = directPriceLabel(product);
  const href = directProductHref(product.slug);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-asphalt-800">
      <Link href={href} className="block" aria-label={product.name}>
        <div className="relative aspect-square w-full bg-asphalt">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {product.badge && (
            <span className="rounded-card border border-line px-2 py-0.5 text-xs uppercase tracking-wide text-signal">
              {product.badge}
            </span>
          )}
          <span className="text-xs uppercase tracking-wide text-muted">{product.category}</span>
        </div>

        <h3 className="mt-3 font-display text-lg uppercase leading-tight text-ink">
          <Link href={href} className="hover:text-signal">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 flex-1 text-sm text-muted">{product.tagline}</p>

        {product.slug === 'founding-member-shirt' && (
          <p className="mt-2 text-sm text-signal">{shirtStockLabel()}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          {price ? (
            <span className="font-display text-lg uppercase text-ink">{price}</span>
          ) : (
            <span className="text-sm text-muted">Price coming soon</span>
          )}
          <DirectCta product={product} placement="card" />
        </div>
      </div>
    </article>
  );
}

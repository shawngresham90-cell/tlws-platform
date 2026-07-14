import Image from 'next/image';
import type { StoreProduct } from '@/lib/store/types';

/**
 * Product visual. Amazon product images can't be hot-linked without the
 * Product Advertising API license, so when no licensed `imageUrl` is present
 * (every placeholder today) we render a branded icon tile — never a scraped
 * Amazon asset. When the owner supplies a licensed image, it renders instead.
 */
export function ProductImage({
  product,
  className = '',
}: {
  product: StoreProduct;
  className?: string;
}) {
  if (product.imageUrl) {
    return (
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={480}
        height={480}
        className={`aspect-square w-full rounded-card object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${product.name} — image coming soon`}
      className={`flex aspect-square w-full items-center justify-center rounded-card border border-line bg-asphalt-800 ${className}`}
    >
      <span aria-hidden="true" className="text-5xl sm:text-6xl">
        {product.icon}
      </span>
    </div>
  );
}

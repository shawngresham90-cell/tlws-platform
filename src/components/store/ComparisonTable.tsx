import Link from 'next/link';
import type { StoreProduct } from '@/lib/store/types';
import { priceLabel, productHref, productReadiness, ratingLabel } from '@/lib/store/products';
import { AmazonCta } from './AmazonCta';

/**
 * Side-by-side comparison for a buying guide. Shows only honest, editorial
 * columns (the pick, who it's for, a highlight). Rating and price cells render
 * a verified value ONLY when the owner has supplied it — otherwise a plain
 * "Coming soon", never a fabricated number. The action column shows the active
 * Amazon button only for live products (AmazonCta enforces this).
 */
export function ComparisonTable({ products }: { products: StoreProduct[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">Comparison of picks in this guide</caption>
        <thead>
          <tr className="border-b border-line bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="p-3 font-semibold">
              Pick
            </th>
            <th scope="col" className="p-3 font-semibold">
              Best for
            </th>
            <th scope="col" className="p-3 font-semibold">
              Highlight
            </th>
            <th scope="col" className="p-3 font-semibold">
              Rating
            </th>
            <th scope="col" className="p-3 font-semibold">
              Price
            </th>
            <th scope="col" className="p-3 font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const price = priceLabel(p);
            const rating = ratingLabel(p);
            const { live } = productReadiness(p);
            return (
              <tr key={p.slug} className="border-b border-line last:border-0 align-top">
                <th scope="row" className="p-3 font-display text-sm uppercase text-ink">
                  <Link href={productHref(p.slug)} className="hover:text-signal">
                    <span aria-hidden="true" className="mr-1">
                      {p.icon}
                    </span>
                    {p.name}
                  </Link>
                </th>
                <td className="p-3 text-muted">{p.recommendation}</td>
                <td className="p-3 text-muted">{p.benefits[0]}</td>
                <td className="p-3 text-ink">
                  {rating ? (
                    <span>
                      <span aria-hidden="true" className="text-signal">
                        ★
                      </span>{' '}
                      {rating}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="p-3 text-ink">{price ?? <span className="text-muted">Coming soon</span>}</td>
                <td className="p-3">
                  {live ? (
                    <AmazonCta product={p} placement="comparison" className="px-3 py-1.5 text-xs" />
                  ) : (
                    <Link
                      href={productHref(p.slug)}
                      className="whitespace-nowrap text-sm font-semibold text-signal underline-offset-4 hover:underline"
                    >
                      Details →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

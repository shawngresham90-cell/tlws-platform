import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import {
  STORE_PRODUCTS,
  priceLabel,
  ratingLabel,
  productHref,
  productReadiness,
} from '@/lib/store/products';
import { storeCategory } from '@/lib/store/categories';
import { productTypeMeta } from '@/lib/store/product-types';
import { AMAZON_ASSOCIATE_TAG } from '@/lib/store/amazon';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Store Catalog', robots: { index: false, follow: false } };

/**
 * Store catalog audit — read-only. The catalog is code-defined (no DB), so this
 * page just surfaces readiness: which of the 100 products still need an ASIN,
 * price, rating, review count, or licensed image before their Amazon buttons
 * can go live. No writes; editing the catalog is a code change
 * (lib/store/products.ts) or a fill of docs/store/owner-fill-template.csv.
 */
export default function AdminStorePage() {
  requireAdmin();
  const rows = STORE_PRODUCTS.map((p) => ({ p, r: productReadiness(p) }));
  const total = rows.length;
  const liveCount = rows.filter((x) => x.r.live).length;
  const missing = {
    asin: rows.filter((x) => !x.r.hasAsin).length,
    price: rows.filter((x) => !x.r.hasPrice).length,
    rating: rows.filter((x) => !x.r.hasRating).length,
    reviews: rows.filter((x) => !x.r.hasReviewCount).length,
    image: rows.filter((x) => !x.r.hasImage).length,
  };

  const Chip = ({ label, n }: { label: string; n: number }) => (
    <span className="rounded-card border border-line px-3 py-1.5 text-sm">
      <span className="text-muted">{label} missing: </span>
      <span className={n > 0 ? 'font-semibold text-diesel-300' : 'font-semibold text-signal'}>{n}</span>
    </span>
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl uppercase text-ink">Store catalog audit</h1>
        <p className="mt-1 text-sm text-muted">
          {total} products · <span className="text-signal">{liveCount} live</span> ·{' '}
          {total - liveCount} awaiting verified Amazon data. Associate tag{' '}
          <code className="text-ink">{AMAZON_ASSOCIATE_TAG}</code>. A product goes live the moment it
          has a valid ASIN and a confirmed price — no button appears until then. Bulk-fill via{' '}
          <code className="text-ink">docs/store/owner-fill-template.csv</code>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip label="ASIN" n={missing.asin} />
        <Chip label="Price" n={missing.price} />
        <Chip label="Rating" n={missing.rating} />
        <Chip label="Reviews" n={missing.reviews} />
        <Chip label="Image" n={missing.image} />
      </div>

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">ASIN</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Reviews</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ p, r }) => (
              <tr key={p.slug} className="align-top">
                <td className="px-4 py-3">
                  <Link href={productHref(p.slug)} className="text-ink hover:text-signal">
                    {p.name}
                  </Link>
                  <span className="block text-xs text-muted">{storeCategory(p.category)?.title}</span>
                </td>
                <td className="px-4 py-3 text-muted">{productTypeMeta(p.productType).label}</td>
                <td className="px-4 py-3">
                  {r.hasAsin ? (
                    <span className="text-signal">{p.asin}</span>
                  ) : (
                    <span className="text-diesel-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {priceLabel(p) ?? <span className="text-diesel-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {ratingLabel(p) ?? <span className="text-diesel-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {r.hasReviewCount ? (
                    <span className="text-ink">{p.reviewCount}</span>
                  ) : (
                    <span className="text-diesel-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.hasImage ? (
                    <span className="text-signal">set</span>
                  ) : (
                    <span className="text-muted">icon</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.live ? (
                    <span className="rounded-card bg-signal/15 px-2 py-0.5 text-xs font-semibold text-signal">
                      LIVE
                    </span>
                  ) : (
                    <span className="text-xs text-muted">needs {r.missing.join(' + ')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        To publish a product: add its verified Amazon ASIN and price (and, if you have them, a
        verified rating + review count and a licensed image) to its entry in{' '}
        <code className="text-ink">src/lib/store/products.ts</code>, then ship. Never paste a guessed
        ASIN, price, or rating — an unconfirmed product simply stays in the &quot;Amazon link coming
        soon&quot; state, which is safe to have live.
      </p>
    </div>
  );
}

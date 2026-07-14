import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { STORE_PRODUCTS, priceLabel, productHref, productReadiness } from '@/lib/store/products';
import { storeCategory } from '@/lib/store/categories';
import { AMAZON_ASSOCIATE_TAG } from '@/lib/store/amazon';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Store Catalog', robots: { index: false, follow: false } };

/**
 * Store catalog audit — read-only. The catalog is code-defined (no DB), so this
 * page just surfaces readiness: which of the 12 products still need an ASIN,
 * price, or licensed image before their Amazon buttons can go live. No writes;
 * editing the catalog is a code change (lib/store/products.ts).
 */
export default function AdminStorePage() {
  requireAdmin();
  const rows = STORE_PRODUCTS.map((p) => ({ p, r: productReadiness(p) }));
  const liveCount = rows.filter((x) => x.r.live).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl uppercase text-ink">Store catalog audit</h1>
        <p className="mt-1 text-sm text-muted">
          {STORE_PRODUCTS.length} products · <span className="text-signal">{liveCount} live</span> ·{' '}
          {STORE_PRODUCTS.length - liveCount} awaiting data. Amazon tag{' '}
          <code className="text-ink">{AMAZON_ASSOCIATE_TAG}</code>. A product goes live the moment
          it has a valid ASIN and a confirmed price in{' '}
          <code className="text-ink">src/lib/store/products.ts</code> — no button appears until then.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-asphalt-800 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">ASIN</th>
              <th className="px-4 py-3">Price</th>
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
                </td>
                <td className="px-4 py-3 text-muted">{storeCategory(p.category)?.title}</td>
                <td className="px-4 py-3">
                  {r.hasAsin ? (
                    <span className="text-signal">{p.asin}</span>
                  ) : (
                    <span className="text-diesel">missing</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {priceLabel(p) ?? <span className="text-diesel">missing</span>}
                </td>
                <td className="px-4 py-3">
                  {r.hasImage ? (
                    <span className="text-signal">set</span>
                  ) : (
                    <span className="text-muted">placeholder icon</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.live ? (
                    <span className="rounded-card bg-signal/15 px-2 py-0.5 text-xs font-semibold text-signal">
                      LIVE
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      needs {r.missing.filter((m) => m !== 'image').join(' + ') || 'image'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        To publish a product: add its real Amazon ASIN and confirmed price (and, if licensed, an
        image URL) to its entry in <code className="text-ink">src/lib/store/products.ts</code>,
        then ship. Never paste a guessed ASIN or price — an unconfirmed product simply stays in the
        &quot;link coming soon&quot; state, which is safe to have live.
      </p>
    </div>
  );
}

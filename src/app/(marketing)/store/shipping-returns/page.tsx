import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SHIRT_SUPPORT_EMAIL } from '@/lib/store/direct';

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: 'Shipping & Returns — Trucking Life Store',
  description:
    'Shipping, dispatch, and return terms for physical products from the Trucking Life Store.',
  path: '/store/shipping-returns',
});

/**
 * Physical-product policy for the Trucking Life Store.
 *
 * EVERY STATEMENT ON THIS PAGE IS OWNER-CONFIRMED (2026-08-02). Nothing is
 * inferred, softened, or filled in from a template. In particular this page
 * does NOT claim free shipping, does NOT promise a delivery date, does NOT name
 * any fulfillment vendor other than Trucking Life With Shawn, and does NOT
 * offer refunds, exchanges, or a warranty — because none of those were
 * confirmed. Returns and size exchanges are stated plainly as not accepted,
 * which is the actual policy.
 *
 * The Founder Shirt is currently the only physical product. If another is ever
 * added, its terms must be confirmed before it is listed as purchasable — do
 * not assume these terms carry over.
 */
export default function ShippingReturnsPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Store', path: '/store' },
          { name: 'Shipping & Returns', path: '/store/shipping-returns' },
        ])}
      />

      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href="/store" className="hover:text-signal">
            Store
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Shipping &amp; Returns</span>
        </nav>
        <Eyebrow>Trucking Life Store</Eyebrow>
        <h1 className="display-hero max-w-3xl">
          Shipping &amp; returns<span className="text-signal">.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          These terms apply to physical products from the Trucking Life Store. The Founder Shirt is
          currently the only physical product. Digital guides and coaching are not shipped and are
          not covered here.
        </p>
      </Section>

      <Section className="border-b border-line">
        <div className="max-w-2xl space-y-10">
          <div>
            <h2 className="font-display text-xl uppercase text-ink">Who makes and ships it</h2>
            <p className="mt-3 text-muted">
              The shirt is a physical product. It is made and shipped by Trucking Life With Shawn.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">Checkout</h2>
            <p className="mt-3 text-muted">
              Checkout occurs through Stan Store. Stan Store shows shipping charges and estimated
              delivery information before payment.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">Dispatch</h2>
            <p className="mt-3 text-muted">
              Orders are normally dispatched within 10 business days.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">
              Damaged, incorrect, or missing orders
            </h2>
            <p className="mt-3 text-muted">Issues are reviewed on a case-by-case basis.</p>
            <p className="mt-3 text-muted">
              Report problems within 14 days of delivery or the expected delivery date.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">Returns</h2>
            <p className="mt-3 text-muted">Returns are not accepted.</p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">Size exchanges</h2>
            <p className="mt-3 text-muted">Size exchanges are not accepted.</p>
          </div>

          <div>
            <h2 className="font-display text-xl uppercase text-ink">Order support</h2>
            <p className="mt-3 text-muted">
              For order issues, contact{' '}
              <a href={`mailto:${SHIRT_SUPPORT_EMAIL}`} className="text-signal hover:underline">
                {SHIRT_SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <Link href="/store" className="text-signal hover:underline">
          ← Back to the store
        </Link>
      </Section>
    </>
  );
}

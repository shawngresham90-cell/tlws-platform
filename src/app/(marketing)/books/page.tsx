import { Section, Button, Eyebrow } from '@/components/ui';
import { ProductGrid, type Product } from '@/components/shop/ProductCard';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Books — Driver-Built Guides | Trucking Life with Shawn',
  description:
    'Books written by a driver with 17 years on the road and zero violations. Carnivore cooking in the cab, DOT survival, and road-tested discipline — on Amazon.',
  path: '/books',
});

/** Amazon Associates tag. Applied to full amazon.com links (a.co short links already carry it). */
const AMZN_TAG = 'truckinglif0d-20';

const BOOKS: Product[] = [
  {
    title: 'The Trucker’s Carnivore Cookbook',
    description:
      '100 air-fryer meals that keep you rolling — real food, cooked right in the cab. The book behind the 93-pounds-down story.',
    href: 'https://a.co/d/03cOB4V3',
    cta: 'Buy on Amazon',
  },
  {
    title: 'DOT Survival Guide',
    description:
      'Inspections, audits, and shutdowns — the playbook for staying legal and keeping your CDL when the DOT comes knocking.',
    href: `https://www.amazon.com/DOT-Survival-Guide-Truckers-Shutdowns/dp/B0FDL26V8Q?tag=${AMZN_TAG}`,
    cta: 'Buy on Amazon',
  },
  {
    title: 'Discipline Over Everything',
    description:
      'The truths nobody tells you. Road-tested discipline for drivers who want more out of this life than a paycheck.',
    href: `https://www.amazon.com/Discipline-Over-Everything-Truths-Nobody/dp/B0FK3XQL5S?tag=${AMZN_TAG}`,
    cta: 'Buy on Amazon',
  },
];

export default function BooksPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Books', path: '/books' },
        ])}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Books</Eyebrow>
          <h1 className="display-section">Driver-built books</h1>
          <p className="mt-4 text-muted">
            Written by a driver, for drivers — 17 years on the road, zero violations. No fluff,
            just the stuff that keeps you legal, healthy, and earning.
          </p>
        </div>

        <div className="mt-10">
          <ProductGrid products={BOOKS} />
        </div>

        <p className="mt-6 text-xs text-muted">
          As an Amazon Associate, purchases through these links may earn a commission — at no extra
          cost to you.
        </p>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="display-section">Want the PDFs &amp; tools?</h2>
            <p className="mt-3 text-muted">
              The DOT Survival System bundle, free CDL guides, and driver tools live on the Apps
              &amp; PDFs page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/apps">Browse Apps &amp; PDFs</Button>
            <Button
              variant="ghost"
              href="https://stan.store/TRUCKINGLIFEWITHSHAWN"
              className="whitespace-nowrap"
            >
              Visit the Stan Store
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

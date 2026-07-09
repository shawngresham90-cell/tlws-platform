import { Section, Button, Eyebrow } from '@/components/ui';
import { ProductCard, ProductGrid, type Product } from '@/components/shop/ProductCard';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Apps & PDFs — Driver Tools That Earn Their Keep | Trucking Life with Shawn',
  description:
    'The Complete DOT Survival System, free CDL guides, and driver PDFs — Hours of Service, inspections, and permit prep. Built by a 17-year driver with zero violations.',
  path: '/apps',
});

const STAN_STORE = 'https://stan.store/TRUCKINGLIFEWITHSHAWN';

/** Price known from the current bundle offer — do not invent others. */
const BUNDLE: Product = {
  title: 'The Complete DOT Survival System',
  description:
    'The full DOT app plus the book bundle — everything to stay legal, pass every inspection, and protect your CDL for good. One-time price, lifetime access. Every sale helps build the CDL school in Dalton, GA.',
  href: `${STAN_STORE}/p/the-complete-dot-truckers-life-survival-system`,
  cta: 'View Bundle',
  badge: 'Bundle',
  price: '$49',
  wasPrice: '$149',
};

const PDFS: Product[] = [
  {
    title: 'The HOS Bible',
    description:
      'Hours of Service, decoded into plain trucker talk. Keep the logbook clean — and the CDL with it.',
    cta: 'Get the PDF',
  },
  {
    title: 'Save Your CDL',
    description:
      'When your license is on the line, the first moves matter most. The playbook for protecting your CDL.',
    cta: 'Get the PDF',
  },
  {
    title: 'CDL Pre-School',
    description:
      'Permit prep the driver way — what the test actually asks, without the textbook fog.',
    cta: 'Start studying',
  },
  {
    title: '7 DOT Inspection Mistakes',
    description:
      'The mistakes that put drivers out of service — and how to dodge every one of them.',
    href: `${STAN_STORE}/p/free-7-dot-inspection-mistakes-that-cost-truckers`,
    cta: 'Get the PDF',
    badge: 'Free',
  },
  {
    title: 'The First 72 Hours',
    description:
      'Failed a drug test? Exactly what to do in the first 72 hours to protect your CDL and your job.',
    href: `${STAN_STORE}/p/-free-the-first-72-hours--what-to-do-if-you-fa`,
    cta: 'Get the PDF',
    badge: 'Free',
  },
];

export default function AppsPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Apps & PDFs', path: '/apps' },
        ])}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Apps &amp; PDFs</Eyebrow>
          <h1 className="display-section">Tools that earn their keep</h1>
          <p className="mt-4 text-muted">
            Driver tools and PDF guides that save you time, money, or your CDL — built by a driver
            with 17 years on the road and zero violations.
          </p>
        </div>

        <div className="mt-10 max-w-2xl">
          <ProductCard product={BUNDLE} />
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <div className="mb-10 max-w-2xl">
          <Eyebrow>PDF Guides</Eyebrow>
          <h2 className="display-section">Grab-and-go guides</h2>
          <p className="mt-4 text-muted">
            Two are free — take them. The rest are on the way; links go live as they drop.
          </p>
        </div>
        <ProductGrid products={PDFS} />
        <div className="mt-9">
          <Button variant="ghost" href={STAN_STORE}>
            Browse the full Stan Store
          </Button>
        </div>
      </Section>
    </>
  );
}

import { Section, Button, Eyebrow } from '@/components/ui';
import { ProductGrid, type Product } from '@/components/shop/ProductCard';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';
import { PRESCHOOL_PRICE_LABEL } from '@/lib/preschool/constants';

export const metadata = buildMetadata({
  title: 'Apps & PDFs — DOT System, Free CDL Guides & Driver Training | Trucking Life with Shawn',
  description:
    'Free CDL guides, the Complete DOT Survival System ($49), Hours of Service and CDL-protection PDFs, and permit-prep training — built by a driver with 17 years on the road and zero violations.',
  path: '/apps',
});

const STAN_STORE = 'https://stan.store/TRUCKINGLIFEWITHSHAWN';

const FREE: Product[] = [
  {
    title: '7 DOT Inspection Mistakes',
    icon: '🛑',
    badge: 'Free',
    description:
      'The seven mistakes that put drivers out of service — and how to dodge every one of them.',
    benefits: [
      'Know what inspectors look for first',
      'Dodge out-of-service orders before they happen',
      'Free — instant download',
    ],
    href: `${STAN_STORE}/p/free-7-dot-inspection-mistakes-that-cost-truckers`,
    cta: 'Get the PDF',
  },
  {
    title: 'The First 72 Hours',
    icon: '⏱️',
    badge: 'Free',
    description:
      'Failed a drug test? Exactly what to do in the first 72 hours to protect your CDL and your job.',
    benefits: [
      'The exact first steps, hour by hour',
      'Protect your CDL and your job',
      'Free — instant download',
    ],
    href: `${STAN_STORE}/p/-free-the-first-72-hours--what-to-do-if-you-fa`,
    cta: 'Get the PDF',
  },
];

/** $49 (was $149) is the only known price — never invent others. */
const DOT_SYSTEM: Product[] = [
  {
    title: 'The Complete DOT Survival System',
    icon: '🛡️',
    badge: 'Bundle',
    description:
      'The full DOT app plus the book bundle — everything to stay legal, pass every inspection, and protect your CDL for good.',
    benefits: [
      'Full DOT app access',
      'Book bundle included',
      'One-time price, lifetime access',
      'Every sale helps build the CDL school in Dalton, GA',
    ],
    price: '$49',
    wasPrice: '$149',
    href: `${STAN_STORE}/p/the-complete-dot-truckers-life-survival-system`,
    cta: 'View Bundle',
  },
];

const PDF_BOOKS: Product[] = [
  {
    title: 'The HOS Bible',
    icon: '📖',
    description:
      'Hours of Service, decoded into plain trucker talk. Keep the logbook clean — and the CDL with it.',
    benefits: [
      'HOS rules without the legal fog',
      'Keep your logbook violation-free',
      'Avoid the tickets that follow drivers for years',
    ],
    cta: 'Get the PDF',
  },
  {
    title: 'Save Your CDL',
    icon: '🪪',
    description:
      'When your license is on the line, the first moves matter most. The playbook for protecting your CDL.',
    benefits: [
      'The first moves when your license is at risk',
      'Know your rights at the roadside',
      'A step-by-step playbook, not theory',
    ],
    cta: 'Get the PDF',
  },
];

const TRAINING: Product[] = [
  {
    title: 'CDL Pre-School',
    icon: '🎓',
    badge: `Founding Student — ${PRESCHOOL_PRICE_LABEL}`,
    description:
      'Permit prep the driver way — what the test actually asks, without the textbook fog.',
    benefits: [
      'Built around what the permit test actually asks',
      'Plain talk from a CDL instructor',
      'Study from anywhere — even the passenger seat',
    ],
    href: '/cdl-pre-school',
    cta: 'Start CDL Pre-School',
  },
];

const COMING_SOON: Product[] = [
  {
    title: 'More driver tools on the way',
    icon: '🚛',
    description:
      'New apps and guides are in the shop queue. Links go live here the day they drop — check the Stan Store for the latest.',
    benefits: [],
    cta: 'Watch this space',
  },
];

function GroupSection({
  id,
  eyebrow,
  title,
  intro,
  products,
  columns = 3,
  dark = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  products: Product[];
  columns?: 2 | 3;
  dark?: boolean;
}) {
  return (
    <Section id={id} className={`border-b border-line ${dark ? 'bg-asphalt-800' : ''}`}>
      <div className="mb-10 max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display-section">{title}</h2>
        <p className="mt-4 text-muted">{intro}</p>
      </div>
      <ProductGrid products={products} columns={columns} />
    </Section>
  );
}

export default function AppsPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Apps & PDFs', path: '/apps' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'The Complete DOT Survival System',
            description:
              'The full DOT app plus the book bundle — everything to stay legal, pass every inspection, and protect your CDL.',
            brand: { '@type': 'Brand', name: SITE.brand },
            url: `${SITE.url}/apps#dot-system`,
            offers: {
              '@type': 'Offer',
              price: '49.00',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url: `${STAN_STORE}/p/the-complete-dot-truckers-life-survival-system`,
            },
          },
        ]}
      />

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Apps &amp; PDFs</Eyebrow>
          <h1 className="display-section">Tools that earn their keep</h1>
          <p className="mt-4 text-muted">
            Driver tools and PDF guides that save you time, money, or your CDL — built by a driver
            with 17 years on the road and zero violations. Start with the free ones.
          </p>
        </div>
      </Section>

      <GroupSection
        id="free"
        eyebrow="Free"
        title="Free — grab and go"
        intro="No cost, no catch. Two guides every driver should have saved on their phone."
        products={FREE}
        columns={2}
        dark
      />

      <GroupSection
        id="dot-system"
        eyebrow="DOT System"
        title="The DOT Survival System"
        intro="The flagship bundle — app plus books, one-time price, lifetime access."
        products={DOT_SYSTEM}
        columns={2}
      />

      <GroupSection
        id="books"
        eyebrow="Books"
        title="PDF books"
        intro="Deep-dive guides in PDF. Links go live as each one drops."
        products={PDF_BOOKS}
        columns={2}
        dark
      />

      <GroupSection
        id="training"
        eyebrow="Training"
        title="Training"
        intro="Learn it the driver way — from a working CDL instructor."
        products={TRAINING}
        columns={2}
      />

      <GroupSection
        id="coming-soon"
        eyebrow="Coming Soon"
        title="Coming soon"
        intro="What's next in the shop."
        products={COMING_SOON}
        columns={2}
        dark
      />

      <Section className="border-b border-line">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="display-section">Everything in one place</h2>
            <p className="mt-3 text-muted">
              Every product — books, PDFs, bundles, and freebies — lives on the Stan Store.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href={STAN_STORE}>Browse the full Stan Store</Button>
            <Button variant="ghost" href="/books">
              See the paperbacks →
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

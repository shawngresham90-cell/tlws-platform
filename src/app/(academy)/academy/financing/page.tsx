import { Section, Button, Eyebrow } from '@/components/ui';
import {
  PageHero,
  CardGrid,
  AcademyFaq,
  CtaBand,
  Placeholder,
  type Card,
} from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'Tuition & Financing — Ways to Pay for CDL Training | Trucking Life Academy',
  description:
    'How to fund CDL-A training at Trucking Life Academy in Dalton, GA: workforce grants, VA benefits, employer sponsorship, and community-funded seats. Tuition details announced soon.',
  path: '/academy/financing',
});

const ROUTES: Card[] = [
  {
    icon: '🏛️',
    title: 'Workforce Grants',
    description: (
      <>
        Programs like WIOA and state workforce funds may cover CDL training for eligible drivers
        through your local career center. <Placeholder>Program eligibility TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '🎖️',
    title: 'Veterans’ Benefits',
    description: (
      <>
        Veterans may be able to use education benefits toward CDL training.{' '}
        <Placeholder>VA / GI Bill approval status TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '🤝',
    title: 'Employer Sponsorship',
    description: (
      <>
        Many carriers sponsor training or offer tuition reimbursement once you’re hired. We can help
        you understand your options. <Placeholder>Partner carriers TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '📆',
    title: 'Payment Plans',
    description: (
      <>
        Flexible ways to spread the cost so training doesn’t mean a predatory loan.{' '}
        <Placeholder>Plan terms TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '❤️',
    title: 'Community-Funded Seats',
    description:
      'The Founders Wall lets the trucking community help fund seats for drivers who need a hand — drivers helping drivers, made real.',
    href: '/founders',
    cta: 'Fund the School',
  },
  {
    icon: '🎓',
    title: 'Scholarships',
    description: (
      <>
        Need-based and merit opportunities as the program grows.{' '}
        <Placeholder>Scholarship details TBD</Placeholder>
      </>
    ),
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'How much does CDL training cost?',
    a: 'Exact tuition is being finalized and will be published here soon. We won’t post a number until it’s final and honest.',
  },
  {
    q: 'Can I get help paying for it?',
    a: 'Yes — several routes exist: workforce grants such as WIOA, veterans’ education benefits, employer sponsorship and tuition reimbursement, payment plans, and community-funded seats through the Founders Wall. Eligibility for specific programs is still being confirmed.',
  },
  {
    q: 'Do you offer financing or payment plans?',
    a: 'Payment options are being finalized alongside tuition, with the goal of keeping training affordable without predatory lending. Details will be posted here as soon as they’re set.',
  },
  {
    q: 'What is “Fund the School”?',
    a: 'It’s our community funding effort. Through the Founders Wall, supporters in the trucking community can help fund seats for drivers who need it — the drivers-helping-drivers mission put into practice.',
  },
];

export default function FinancingPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Academy', path: '/academy' },
          { name: 'Financing', path: '/academy/financing' },
        ])}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Financing' },
        ]}
        eyebrow="Tuition & financing"
        title="Pay for training without the"
        highlight="trap."
        intro="The industry is full of schools that funnel students into predatory loans. We’re building the opposite. Here are the honest routes to fund your CDL — with exact tuition announced soon."
      >
        <Button variant="secondary" href="/founders">
          Fund the School
        </Button>
        <Button variant="ghost" href="/academy/faq">
          Read the FAQ
        </Button>
      </PageHero>

      {/* Tuition status banner */}
      <div className="border-b border-line bg-asphalt-800">
        <div className="mx-auto max-w-content px-5 py-6 sm:px-8">
          <p className="text-muted">
            <span className="font-semibold text-ink">Tuition:</span>{' '}
            <Placeholder>Pricing to be announced — no numbers are published yet</Placeholder>. We
            won’t list a figure until it’s final. No payment is processed on this site.
          </p>
        </div>
      </div>

      <Section className="border-b border-line">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>Ways to fund it</Eyebrow>
          <h2 className="display-section">Funding routes for drivers</h2>
          <p className="mt-4 text-muted">
            Not every route fits every driver, and some are still being confirmed (look for the{' '}
            <Placeholder>marked</Placeholder> items). Contact us and we’ll help you find the path
            that works for your situation.
          </p>
        </div>
        <CardGrid cards={ROUTES} />
      </Section>

      {/* Mission tie-in */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="max-w-3xl">
          <Eyebrow>Why we do it this way</Eyebrow>
          <h2 className="display-section">Nobody should mortgage their future to drive</h2>
          <p className="mt-4 text-lg text-muted">
            A CDL should open a door, not dig a hole. That’s why we’re building funding around
            grants, benefits, employer support, and community help instead of high-interest loans —
            and why the Founders Wall exists at all. Drivers helping drivers isn’t a slogan here;
            it’s how we intend to pay for seats.
          </p>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
      </Section>

      <CtaBand heading="Let’s find a way to fund your seat" />
    </>
  );
}

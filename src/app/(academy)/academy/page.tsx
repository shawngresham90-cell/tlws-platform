import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { PageHero, CardGrid, AcademyFaq, CtaBand, type Card } from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { courseSchema } from '@/lib/seo/academy-schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'Trucking Life Academy — CDL-A Training in Dalton, GA',
  description:
    'ELDT-compliant CDL-A training built by a 17-year driver with zero violations. Real equipment, driver-first instruction, in Dalton, GA off I-75. Drivers helping drivers.',
  path: '/academy',
});

const PILLARS: Card[] = [
  {
    icon: '📋',
    title: 'ELDT Compliant',
    description:
      'Training that meets the FMCSA Entry-Level Driver Training standard — the theory and behind-the-wheel hours you need to test for a Class A CDL.',
    href: '/academy/curriculum',
    cta: 'See the curriculum',
  },
  {
    icon: '🚛',
    title: 'Real Equipment',
    description:
      'You train on a real tractor and 53-foot trailer — the truck you’ll actually drive, not a simulator or a whiteboard.',
    href: '/academy/facility',
    cta: 'Tour the facility',
  },
  {
    icon: '🧭',
    title: 'Driver Instructors',
    description:
      'Taught by working drivers who’ve run the miles. Road wisdom and real accountability, not classroom-only theory.',
    href: '/academy/instructors',
    cta: 'Meet the team',
  },
  {
    icon: '✅',
    title: 'Requirements, Clear',
    description:
      'Age, license, DOT medical, and the CLP — laid out plainly so you know exactly what it takes to start.',
    href: '/academy/requirements',
    cta: 'Check requirements',
  },
  {
    icon: '💵',
    title: 'Funding Options',
    description:
      'Workforce grants, VA benefits, employer sponsorship, and community-funded seats — ways to pay for training without a payday-loan trap.',
    href: '/academy/financing',
    cta: 'Explore financing',
  },
  {
    icon: '📍',
    title: 'Dalton, GA · I-75',
    description:
      'Right on the I-75 corridor in North Georgia — convenient to Whitfield County, Calhoun, Chatsworth, Ringgold, and Chattanooga.',
    href: '/academy/cdl-school-dalton-ga',
    cta: 'Why Dalton',
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'What is Trucking Life Academy?',
    a: 'A CDL-A driver-training school in Dalton, Georgia, founded by Shawn Gresham — a 17-year driver with zero violations who trains new drivers on real equipment. The mission is simple: drivers helping drivers.',
  },
  {
    q: 'Is the training ELDT compliant?',
    a: 'Yes. The program is built around the FMCSA Entry-Level Driver Training (ELDT) standard, covering the required theory and behind-the-wheel instruction you need to test for a Class A CDL.',
  },
  {
    q: 'Do I need any experience to start?',
    a: 'No commercial experience is required. You do need to meet basic eligibility — age, a valid driver’s license, a DOT medical card, and a commercial learner’s permit (CLP). See the Requirements page for the full checklist.',
  },
  {
    q: 'How much does it cost?',
    a: 'Exact tuition is being finalized and will be published soon. In the meantime, the Financing page explains the funding routes drivers can use — workforce grants, VA benefits, employer sponsorship, and community-funded seats.',
  },
  {
    q: 'Where is the school located?',
    a: 'In Dalton, Georgia, right off the I-75 corridor — convenient to North Georgia and the Chattanooga, TN area.',
  },
];

export default function AcademyPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
          ]),
          courseSchema(),
        ]}
      />

      <PageHero
        crumbs={[{ name: 'Home', href: '/' }, { name: 'Academy' }]}
        eyebrow="Trucking Life Academy · Dalton, GA · off I-75"
        title="The CDL-A school built by a driver,"
        highlight="for drivers."
        intro="Corporate mills push bodies through a system. Trucking Life Academy trains drivers — ELDT-compliant CDL-A instruction on real trucks, real roads, and real accountability, from a man who’s run 17 years with a clean record."
      >
        <Button href="/academy/apply">Apply to the Academy</Button>
        <Button variant="secondary" href="/founders">
          Fund the School
        </Button>
        <Button variant="ghost" href="/contact">
          Contact Us
        </Button>
      </PageHero>

      {/* Credibility strip */}
      <div className="border-b border-line bg-asphalt-800">
        <div className="mx-auto grid max-w-content grid-cols-2 gap-px px-5 sm:grid-cols-4 sm:px-8">
          {[
            { big: '17 yrs', small: 'On the road' },
            { big: '0', small: 'Violations' },
            { big: 'CDL-A', small: 'What you earn' },
            { big: 'ELDT', small: 'Compliant program' },
          ].map((s) => (
            <div key={s.small} className="py-6 text-center">
              <p className="font-display text-3xl uppercase text-signal sm:text-4xl">{s.big}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{s.small}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mission */}
      <Section className="border-b border-line">
        <div className="max-w-3xl">
          <Eyebrow>The mission</Eyebrow>
          <h2 className="display-section">Drivers helping drivers</h2>
          <p className="mt-4 text-lg text-muted">
            The trucking industry is full of schools that treat students like a number and lenders
            that treat them like a mark. Trucking Life Academy is the opposite of that. Founder
            Shawn Gresham has spent 17 years in the seat with zero violations, and he built this
            school to hand that experience down the way it should be — straight, practical, and on
            the driver’s side. No fluff. No games. Just the training it takes to earn a CDL-A and
            actually be ready for the road.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="ghost" href="/academy/instructors">
              Meet the founder
            </Button>
            <Button variant="ghost" href="/knowledge">
              Free CDL resources
            </Button>
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section className="border-b border-line">
        <Eyebrow>Explore the Academy</Eyebrow>
        <h2 className="display-section mb-8">Everything you need to know</h2>
        <CardGrid cards={PILLARS} />
      </Section>

      {/* Knowledge Center tie-in */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="max-w-2xl">
          <Eyebrow>Before you enroll</Eyebrow>
          <h2 className="display-section">Start studying for free</h2>
          <p className="mt-4 text-muted">
            You don’t have to wait for day one to get ahead. The Knowledge Center is packed with
            plain-English guides on the CDL permit, the pre-trip inspection, DOT medical cards, and
            Hours of Service — all verified against the regs by a 17-year driver.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/knowledge">Open the Knowledge Center</Button>
            <Link
              href="/knowledge/search?q=CDL%20permit"
              className="inline-flex items-center font-semibold text-signal hover:underline"
            >
              Search “CDL permit” →
            </Link>
          </div>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
        <p className="mt-6 text-sm text-muted">
          More questions?{' '}
          <Link href="/academy/faq" className="font-semibold text-signal hover:underline">
            Read the full Academy FAQ →
          </Link>
        </p>
      </Section>

      <CtaBand />
    </>
  );
}

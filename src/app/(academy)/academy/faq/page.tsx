import Link from 'next/link';
import { Section, Button } from '@/components/ui';
import { PageHero, AcademyFaq, CtaBand } from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { faqPageSchema } from '@/lib/seo/academy-schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'CDL Training FAQ | Trucking Life Academy — Dalton, GA',
  description:
    'Answers about CDL-A training at Trucking Life Academy: admissions, ELDT curriculum, cost and funding, and logistics in Dalton, GA. Straight answers from a 17-year driver.',
  path: '/academy/faq',
});

const GROUPS: { heading: string; faqs: KcFaq[] }[] = [
  {
    heading: 'Admissions & eligibility',
    faqs: [
      {
        q: 'How old do I need to be?',
        a: 'You must be 18 to drive commercially within Georgia and 21 to drive across state lines or haul hazmat. Most students train toward interstate work, which requires being 21.',
      },
      {
        q: 'Do I need experience or a permit to enroll?',
        a: 'No commercial experience is required to enroll. You’ll need a commercial learner’s permit (CLP) before behind-the-wheel training, and Phase 1 of the curriculum prepares you to earn it.',
      },
      {
        q: 'What documents do I need?',
        a: 'A valid driver’s license, a DOT medical card, and eventually your CLP. A DOT drug screen and Drug & Alcohol Clearinghouse registration are also required for commercial driving. See the Requirements page for the full checklist.',
      },
    ],
  },
  {
    heading: 'Training & curriculum',
    faqs: [
      {
        q: 'Is the program ELDT compliant?',
        a: 'Yes. The curriculum is built around the FMCSA Entry-Level Driver Training standard — the required theory topics plus behind-the-wheel range and public-road instruction.',
      },
      {
        q: 'What will I train on?',
        a: 'Real Class A equipment — a tractor and a 53-foot trailer — on a training range and the I-75 corridor. You learn on the kind of rig and roads you’ll actually drive.',
      },
      {
        q: 'How long is the program?',
        a: 'Program length and schedule options are being finalized. ELDT sets required theory and behind-the-wheel proficiency rather than a single national hour count, so training runs until you’re genuinely road-ready.',
      },
      {
        q: 'Which endorsements can I prepare for?',
        a: 'We plan to offer prep for common endorsements such as Tanker, Doubles/Triples, and Hazmat. The final list will be confirmed soon.',
      },
    ],
  },
  {
    heading: 'Cost & funding',
    faqs: [
      {
        q: 'How much is tuition?',
        a: 'Exact tuition is being finalized and will be published soon. We won’t post a number until it’s final and honest.',
      },
      {
        q: 'How can I pay for training?',
        a: 'The Financing page covers the routes drivers use — workforce grants (such as WIOA), VA education benefits, employer sponsorship and tuition reimbursement, and community-funded seats through Fund the School. Availability of specific programs is still being confirmed.',
      },
      {
        q: 'Do you offer payment plans?',
        a: 'Payment options are being finalized alongside tuition. Details will be posted on the Financing page as soon as they’re set.',
      },
    ],
  },
  {
    heading: 'Location & logistics',
    faqs: [
      {
        q: 'Where is the school?',
        a: 'In Dalton, Georgia, right off the I-75 corridor in North Georgia — convenient to Whitfield County, Calhoun, Chatsworth, Ringgold, and the Chattanooga, TN area. The exact address will be published soon.',
      },
      {
        q: 'Can I tour before I enroll?',
        a: 'We want you confident before you commit. Contact us about visiting the yard; tour scheduling is being finalized.',
      },
      {
        q: 'How do I apply?',
        a: 'The online application opens soon. In the meantime, use the Contact page to start the conversation and we’ll walk you through next steps.',
      },
    ],
  },
];

const ALL_FAQS = GROUPS.flatMap((g) => g.faqs);

export default function FaqPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
            { name: 'FAQ', path: '/academy/faq' },
          ]),
          // One FAQPage node for the whole page — built from every visible Q&A.
          faqPageSchema(ALL_FAQS),
        ]}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'FAQ' },
        ]}
        eyebrow="Frequently asked questions"
        title="Straight answers,"
        highlight="no runaround."
        intro="Everything drivers ask about training at Trucking Life Academy — admissions, curriculum, cost, and logistics. Don’t see your question? Reach out on the channel."
      >
        <Button href={SITE.social.facebook} external>
          Ask on Facebook
        </Button>
        <Button variant="ghost" href="/academy/requirements">
          Check requirements
        </Button>
      </PageHero>

      {GROUPS.map((g, i) => (
        <Section key={g.heading} className={i < GROUPS.length - 1 ? 'border-b border-line' : ''}>
          {/* schema=false: the single FAQPage node above already covers every question. */}
          <AcademyFaq faqs={g.faqs} heading={g.heading} schema={false} />
        </Section>
      ))}

      <Section className="border-y border-line bg-asphalt-800">
        <div className="max-w-2xl">
          <p className="text-muted">
            Looking for free trucking and CDL guides?{' '}
            <Link href="/knowledge" className="font-semibold text-signal hover:underline">
              Visit the Knowledge Center →
            </Link>
          </p>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}

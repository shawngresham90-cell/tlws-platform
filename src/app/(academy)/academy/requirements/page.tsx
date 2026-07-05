import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import {
  PageHero,
  StepList,
  AcademyFaq,
  CtaBand,
  Placeholder,
  type Step,
} from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'CDL-A Requirements — Age, License & DOT Medical | Trucking Life Academy',
  description:
    'What you need to start CDL-A training at Trucking Life Academy in Dalton, GA: age, valid license, DOT medical card, commercial learner’s permit, and drug screening. Plain and clear.',
  path: '/academy/requirements',
});

const CHECKLIST = [
  {
    title: 'Age',
    body: (
      <>
        You must be at least 18 to drive commercially within Georgia (intrastate) and 21 to drive
        across state lines (interstate) or haul hazmat. Most students train toward interstate work.
      </>
    ),
  },
  {
    title: 'Valid driver’s license',
    body: <>A current, valid driver’s license from your home state, in good standing.</>,
  },
  {
    title: 'DOT medical card',
    body: (
      <>
        A DOT physical from a certified medical examiner and a valid Medical Examiner’s Certificate.
        Our Knowledge Center explains what to expect at the exam.
      </>
    ),
  },
  {
    title: 'Commercial learner’s permit (CLP)',
    body: (
      <>
        You’ll need your CLP before behind-the-wheel training. Phase 1 of the curriculum prepares
        you to pass the knowledge tests and obtain it.
      </>
    ),
  },
  {
    title: 'Drug & alcohol screening',
    body: (
      <>
        A DOT pre-employment drug screen and enrollment in the Drug &amp; Alcohol Clearinghouse are
        federal requirements for commercial driving.
      </>
    ),
  },
  {
    title: 'English proficiency',
    body: (
      <>
        Federal rules require the ability to read and speak English well enough to converse, respond
        to officials, read signs, and make entries on reports.
      </>
    ),
  },
];

const STEPS: Step[] = [
  {
    title: 'Confirm you’re eligible',
    body: (
      <>
        Run through the checklist above. If anything’s unclear, contact us — we’ll help you sort it
        out before you commit a dime.
      </>
    ),
  },
  {
    title: 'Get your DOT medical card',
    body: (
      <>
        Schedule a DOT physical with a certified examiner and keep your Medical Examiner’s
        Certificate handy.
      </>
    ),
  },
  {
    title: 'Apply & prep for your CLP',
    body: (
      <>
        Start your application and begin Phase 1 theory. You’ll study for and pass the CDL knowledge
        tests to earn your commercial learner’s permit.
      </>
    ),
  },
  {
    title: 'Begin behind-the-wheel training',
    body: <>With your CLP in hand, you move to range and public-road training on real equipment.</>,
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'How old do I have to be to get a CDL-A?',
    a: 'You must be 18 to drive commercially within Georgia and 21 to drive across state lines or haul hazardous materials. Most students train toward interstate driving, which requires being 21.',
  },
  {
    q: 'Do I need my CDL permit before I start?',
    a: 'You need a commercial learner’s permit (CLP) before behind-the-wheel training, but not before you enroll. Phase 1 of our curriculum prepares you to pass the knowledge tests and obtain your CLP.',
  },
  {
    q: 'What is a DOT medical card?',
    a: 'It’s the Medical Examiner’s Certificate you receive after passing a DOT physical with a certified medical examiner. It confirms you’re medically qualified to operate a commercial vehicle, and it’s required to hold a CDL.',
  },
  {
    q: 'Will a rough driving record disqualify me?',
    a: 'Certain serious violations can affect CDL eligibility. The safest move is to contact us with your situation before enrolling — we’ll give you a straight answer rather than take your money and hope.',
  },
  {
    q: 'Do you accept students from outside Georgia?',
    a: 'Training is based in Dalton, GA, off I-75, and is convenient to North Georgia and the Chattanooga, TN area. Reach out about your situation and we’ll let you know what works.',
  },
];

export default function RequirementsPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Academy', path: '/academy' },
          { name: 'Requirements', path: '/academy/requirements' },
        ])}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Requirements' },
        ]}
        eyebrow="Requirements · CDL-A"
        title="What it takes to"
        highlight="start."
        intro="No surprises. Here’s exactly what you need to begin CDL-A training — and the order to do it in. School-specific enrollment details are marked where they’re still being finalized."
      >
        <Button href="/academy/apply">Apply to the Academy</Button>
        <Button variant="ghost" href="/academy/curriculum">
          See the curriculum
        </Button>
      </PageHero>

      <Section className="border-b border-line">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>Eligibility checklist</Eyebrow>
          <h2 className="display-section">What you need before day one</h2>
          <p className="mt-4 text-muted">
            These are the baseline federal and state requirements for CDL-A training. Any
            school-specific admission items —{' '}
            <Placeholder>orientation, deposit, scheduling</Placeholder> — will be confirmed here
            soon.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {CHECKLIST.map((c) => (
            <div key={c.title} className="rounded-card border border-line bg-asphalt-800 p-6">
              <h3 className="font-display text-lg uppercase text-signal">{c.title}</h3>
              <p className="mt-2 text-sm text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>The path in</Eyebrow>
          <h2 className="display-section">From eligible to enrolled</h2>
        </div>
        <StepList steps={STEPS} />
      </Section>

      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Helpful reading</Eyebrow>
          <h2 className="display-section">Get the details, free</h2>
          <p className="mt-4 text-muted">
            The Knowledge Center covers the DOT medical exam, the CDL permit, and more — so you walk
            in prepared.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/knowledge/search?q=DOT%20medical"
              className="font-semibold text-signal hover:underline"
            >
              DOT medical card guide →
            </Link>
            <Link href="/knowledge" className="font-semibold text-signal hover:underline">
              Browse the Knowledge Center →
            </Link>
          </div>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
      </Section>

      <CtaBand heading="Meet the requirements? Let’s go." />
    </>
  );
}

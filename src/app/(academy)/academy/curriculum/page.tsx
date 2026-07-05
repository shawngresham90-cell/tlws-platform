import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import {
  PageHero,
  StepList,
  CardGrid,
  AcademyFaq,
  CtaBand,
  Placeholder,
  type Step,
  type Card,
} from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { courseSchema } from '@/lib/seo/academy-schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'CDL-A Curriculum — ELDT Theory & Behind-the-Wheel | Trucking Life Academy',
  description:
    'The Trucking Life Academy CDL-A curriculum: ELDT theory, range skills, and public-road driving on real equipment. See what you learn, phase by phase, in Dalton, GA.',
  path: '/academy/curriculum',
});

const PHASES: Step[] = [
  {
    title: 'Phase 1 — Theory & Permit Prep',
    meta: <Placeholder>hours TBD</Placeholder>,
    body: (
      <>
        The FMCSA ELDT theory curriculum: basic operation, safe operating procedures, advanced
        operating practices, vehicle systems and reporting malfunctions, and non-driving activities.
        You’ll leave this phase ready to pass the CDL knowledge tests and earn your commercial
        learner’s permit (CLP).
      </>
    ),
  },
  {
    title: 'Phase 2 — Range Skills',
    meta: <Placeholder>hours TBD</Placeholder>,
    body: (
      <>
        Behind-the-wheel training on a controlled range: pre-trip inspection, straight-line and
        offset backing, alley-dock, coupling and uncoupling, and confident low-speed control of a
        tractor-trailer before you ever hit traffic.
      </>
    ),
  },
  {
    title: 'Phase 3 — Public Road Driving',
    meta: <Placeholder>hours TBD</Placeholder>,
    body: (
      <>
        Real miles on real roads: shifting, lane control, turns and intersections, space and speed
        management, hazard perception, and driving the I-75 corridor the way you’ll actually run it.
      </>
    ),
  },
  {
    title: 'Phase 4 — Test Prep & Endorsements',
    meta: <Placeholder>hours TBD</Placeholder>,
    body: (
      <>
        Skills-test polish and CDL road-test preparation, plus optional endorsement prep such as
        Tanker (N), Doubles/Triples (T), and Hazmat (H).{' '}
        <Placeholder>Endorsement list to be finalized</Placeholder>.
      </>
    ),
  },
];

const SKILLS: Card[] = [
  {
    icon: '🔍',
    title: 'Pre-Trip Inspection',
    description: 'The full CDL pre-trip, memorized and demonstrated the way the examiner wants it.',
  },
  {
    icon: '↩️',
    title: 'Backing & Docking',
    description: 'Straight-line, offset, and alley-dock backing until it’s second nature.',
  },
  {
    icon: '⚙️',
    title: 'Shifting & Control',
    description: 'Smooth shifting, clutch control, and handling a loaded trailer with confidence.',
  },
  {
    icon: '🔗',
    title: 'Coupling',
    description: 'Coupling and uncoupling a 53-foot trailer safely, every time.',
  },
  {
    icon: '🛣️',
    title: 'On-Road Driving',
    description: 'Turns, intersections, lane changes, and interstate driving in real traffic.',
  },
  {
    icon: '⚠️',
    title: 'Hazard Awareness',
    description: 'Space management, speed management, and seeing trouble before it happens.',
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'What does ELDT mean?',
    a: 'ELDT stands for Entry-Level Driver Training — the FMCSA standard every new CDL applicant must complete before testing for a Class A or B CDL. Our curriculum is built to meet it, covering both the required theory topics and behind-the-wheel range and public-road instruction.',
  },
  {
    q: 'How long does the program take?',
    a: 'The total program length is being finalized and depends on schedule and endorsements. ELDT sets required theory topics and behind-the-wheel proficiency rather than a fixed national hour count, so training runs until you’re genuinely road-ready. Exact hours and schedule options will be published soon.',
  },
  {
    q: 'Do you help with the CDL permit (CLP)?',
    a: 'Yes. Phase 1 prepares you to pass the CDL knowledge tests and obtain your commercial learner’s permit, which you’ll need before behind-the-wheel training. Our Knowledge Center also has free permit-study guides.',
  },
  {
    q: 'Which endorsements can I train for?',
    a: 'We plan to offer preparation for common endorsements such as Tanker, Doubles/Triples, and Hazmat. The final endorsement list and any add-on details will be confirmed soon.',
  },
];

export default function CurriculumPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
            { name: 'Curriculum', path: '/academy/curriculum' },
          ]),
          courseSchema(),
        ]}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Curriculum' },
        ]}
        eyebrow="Curriculum · ELDT-compliant CDL-A"
        title="What you’ll actually"
        highlight="learn."
        intro="Four phases from classroom to open road — the FMCSA ELDT theory curriculum plus behind-the-wheel range and public-road training on real equipment. No filler, no busywork."
      >
        <Button href="/academy/requirements">Check requirements</Button>
        <Button variant="ghost" href="/academy/financing">
          See financing options
        </Button>
      </PageHero>

      <Section className="border-b border-line">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>The program</Eyebrow>
          <h2 className="display-section">From permit to CDL-A, phase by phase</h2>
          <p className="mt-4 text-muted">
            Exact hours per phase are being finalized — look for the{' '}
            <Placeholder>marked</Placeholder> items. The structure below reflects the ELDT theory
            and behind-the-wheel requirements every driver completes.
          </p>
        </div>
        <StepList steps={PHASES} />
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Core skills</Eyebrow>
        <h2 className="display-section mb-8">The behind-the-wheel skills you’ll master</h2>
        <CardGrid cards={SKILLS} />
      </Section>

      {/* KC tie-in */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Study ahead</Eyebrow>
          <h2 className="display-section">Free guides in the Knowledge Center</h2>
          <p className="mt-4 text-muted">
            Get a head start before Phase 1. Our Knowledge Center breaks down the CDL permit, the
            pre-trip inspection, and more — in plain English, verified against the regs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/knowledge/search?q=pre-trip%20inspection"
              className="font-semibold text-signal hover:underline"
            >
              Pre-trip inspection guide →
            </Link>
            <Link
              href="/knowledge/search?q=CDL%20permit"
              className="font-semibold text-signal hover:underline"
            >
              CDL permit study →
            </Link>
          </div>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
      </Section>

      <CtaBand heading="Ready to start Phase 1?" />
    </>
  );
}

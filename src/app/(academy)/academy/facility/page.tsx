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
  title: 'Facility & Training Yard — CDL School in Dalton, GA | Trucking Life Academy',
  description:
    'Tour Trucking Life Academy: a training range and real Class A equipment in Dalton, GA, right off the I-75 corridor. See where you’ll learn to drive.',
  path: '/academy/facility',
});

const FEATURES: Card[] = [
  {
    icon: '🅿️',
    title: 'Training Range',
    description: (
      <>
        A dedicated range for backing, docking, coupling, and low-speed maneuvers — space to build
        muscle memory before public roads. <Placeholder>Yard details TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '🚛',
    title: 'Real Class A Equipment',
    description: (
      <>
        Train on a real tractor and 53-foot trailer — the rig you’ll actually drive.{' '}
        <Placeholder>Exact truck/trailer specs TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '📚',
    title: 'Classroom Space',
    description: (
      <>
        A focused space for the ELDT theory curriculum and permit prep.{' '}
        <Placeholder>Classroom details TBD</Placeholder>
      </>
    ),
  },
  {
    icon: '🛣️',
    title: 'I-75 Road Access',
    description:
      'Direct access to real interstate and surface-road driving on the I-75 corridor — the roads you’ll run for a living.',
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'Where is Trucking Life Academy located?',
    a: 'In Dalton, Georgia, right off the I-75 corridor in North Georgia. The exact street address and directions will be published here soon.',
  },
  {
    q: 'What equipment will I train on?',
    a: 'Real Class A equipment — a tractor and a 53-foot trailer — so you learn on the same kind of rig you’ll drive on the job. Exact truck and trailer specifications will be confirmed soon.',
  },
  {
    q: 'Can I visit the facility before enrolling?',
    a: 'We want you to feel confident before you commit. Contact us to ask about visiting the yard — tour availability and scheduling details are being finalized.',
  },
];

export default function FacilityPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Academy', path: '/academy' },
          { name: 'Facility', path: '/academy/facility' },
        ])}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Facility' },
        ]}
        eyebrow="Facility · Dalton, GA · off I-75"
        title="Where you’ll learn to"
        highlight="drive."
        intro="A real training range and real Class A equipment on the I-75 corridor in North Georgia. You practice on the same kind of rig and the same roads you’ll run for a living."
      >
        <Button href="/academy/cdl-school-dalton-ga">Why Dalton, GA</Button>
        <Button variant="ghost" href="/academy/faq">
          Read the FAQ
        </Button>
      </PageHero>

      <Section className="border-b border-line">
        <Eyebrow>On the ground</Eyebrow>
        <h2 className="display-section mb-8">What’s on campus</h2>
        <CardGrid cards={FEATURES} columns={2} />
      </Section>

      {/* Location / directions */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Eyebrow>Getting here</Eyebrow>
            <h2 className="display-section">Dalton, Georgia</h2>
            <p className="mt-4 text-muted">
              We’re on the I-75 corridor in Whitfield County, convenient to Calhoun, Chatsworth,
              Ringgold, and the Chattanooga, TN area.
            </p>
            <ul className="mt-6 space-y-3 text-muted">
              <li>
                <span className="font-semibold text-ink">Address:</span>{' '}
                <Placeholder>Street address to be announced</Placeholder>
              </li>
              <li>
                <span className="font-semibold text-ink">Hours:</span>{' '}
                <Placeholder>Training hours to be announced</Placeholder>
              </li>
              <li>
                <span className="font-semibold text-ink">Directions:</span>{' '}
                <Placeholder>Map & directions coming soon</Placeholder>
              </li>
            </ul>
          </div>
          <div className="flex min-h-[220px] items-center justify-center rounded-card border border-dashed border-line bg-asphalt p-8 text-center">
            <p className="text-muted">
              <span className="mb-2 block text-3xl" aria-hidden="true">
                🗺️
              </span>
              <Placeholder>Map embed to be added once the address is public</Placeholder>
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
      </Section>

      <CtaBand heading="Come see it for yourself" />
    </>
  );
}

import Link from 'next/link';
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
import { ACADEMY_ADDRESS } from '@/lib/academy/program';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'Facility & Training Yard — CDL School in Dalton, GA | Trucking Life Academy',
  description: `Trucking Life Academy is at ${ACADEMY_ADDRESS.oneLine} — a training range and real Class A equipment right off the I-75 corridor. See where you’ll learn to drive, and get directions.`,
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
        Train on a real tractor and 53-foot trailer — the rig you’ll actually drive. Students train
        in manual 10-speed trucks, giving them practical experience with equipment used throughout
        the trucking industry.
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
    a: `Trucking Life Academy is at ${ACADEMY_ADDRESS.oneLine}, right off the I-75 corridor in North Georgia. Use the Get directions link on this page to open it in Google Maps.`,
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

      {/* Address band — directly under the hero, because "where is it?" is the
          question this page exists to answer and it was previously buried in a
          list two sections down, reading "Street address to be announced".

          Real selectable text in a semantic <address>, not an image or a map
          embed: a visitor has to be able to copy it, and a screen reader has to
          be able to read it. The directions link derives its URL from the same
          shared constant. */}
      <div className="border-b border-line bg-asphalt-800">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Trucking Life Academy
            </p>
            <address className="mt-1 font-display text-2xl uppercase not-italic text-ink sm:text-3xl">
              {ACADEMY_ADDRESS.oneLine}
            </address>
          </div>
          <Button variant="secondary" href={ACADEMY_ADDRESS.mapsUrl} external className="shrink-0">
            Get directions
          </Button>
        </div>
      </div>

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
                <address className="inline not-italic">{ACADEMY_ADDRESS.oneLine}</address>
              </li>
              {/* Hours keeps its placeholder on purpose — training hours are
                  genuinely not set, and inventing them here would be the exact
                  failure the address placeholder just caused in reverse. */}
              <li>
                <span className="font-semibold text-ink">Hours:</span>{' '}
                <Placeholder>Training hours to be announced</Placeholder>
              </li>
              <li>
                <span className="font-semibold text-ink">Directions:</span>{' '}
                <Link
                  href={ACADEMY_ADDRESS.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-inline font-semibold text-signal"
                >
                  Open in Google Maps →
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-card border border-line bg-asphalt p-8 text-center">
            <span className="text-3xl" aria-hidden="true">
              🗺️
            </span>
            <address className="font-display text-xl uppercase not-italic text-ink">
              {ACADEMY_ADDRESS.oneLine}
            </address>
            <Button variant="ghost" href={ACADEMY_ADDRESS.mapsUrl} external>
              Get directions
            </Button>
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

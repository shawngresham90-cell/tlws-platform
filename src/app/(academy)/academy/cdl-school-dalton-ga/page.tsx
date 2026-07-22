import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { PageHero, CardGrid, AcademyFaq, CtaBand, type Card } from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { courseSchema, localSchoolSchema } from '@/lib/seo/academy-schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'CDL School in Dalton, GA — Class A Training off I-75 | Trucking Life Academy',
  description:
    'Looking for a CDL school in Dalton, GA? Trucking Life Academy offers ELDT-compliant Class A CDL training on real equipment off I-75, serving North Georgia and the Chattanooga, TN area.',
  path: '/academy/cdl-school-dalton-ga',
});

const WHY: Card[] = [
  {
    icon: '📍',
    title: 'Right off I-75',
    description:
      'Train where you already drive. Our North Georgia location sits on the I-75 corridor in Dalton, convenient from all over Whitfield County and beyond.',
  },
  {
    icon: '🚛',
    title: 'Real local road time',
    description:
      'You practice on the same interstate and surface roads you’ll run for a living — not a closed course in some far-off city.',
  },
  {
    icon: '🧭',
    title: 'A driver who knows the area',
    description:
      'Founder Shawn Gresham has run these roads. His 17 years and zero violations back every lesson you’ll get here.',
  },
  {
    icon: '🤝',
    title: 'Drivers helping drivers',
    description:
      'A local school built on a simple mission — help North Georgia drivers earn a CDL-A the right way, without the corporate runaround.',
  },
];

const AREAS = [
  'Dalton',
  'Whitfield County',
  'Calhoun',
  'Chatsworth',
  'Ringgold',
  'Rocky Face',
  'Tunnel Hill',
  'Cleveland, TN',
  'Chattanooga, TN',
];

const FAQS: KcFaq[] = [
  {
    q: 'Is there a CDL school in Dalton, GA?',
    a: 'Yes — Trucking Life Academy is a Class A CDL school in Dalton, Georgia, off the I-75 corridor. It offers ELDT-compliant training on real equipment, founded by 17-year driver Shawn Gresham.',
  },
  {
    q: 'What areas do you serve?',
    a: 'We train drivers from across North Georgia and the I-75 corridor — including Dalton, Whitfield County, Calhoun, Chatsworth, Ringgold, and the Cleveland and Chattanooga, TN area.',
  },
  {
    q: 'Do you offer Class A CDL training?',
    a: 'Yes. Our program is ELDT-compliant CDL-A training with theory, range skills, and public-road driving on a real tractor and 53-foot trailer.',
  },
  {
    q: 'How do I get started with a Dalton CDL school?',
    a: 'Check the Requirements page to confirm eligibility, review the Curriculum, then apply online at the Academy — the application is open, takes about two minutes, and collects no payment.',
  },
];

export default function CdlSchoolDaltonPage() {
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
            { name: 'CDL School in Dalton, GA', path: '/academy/cdl-school-dalton-ga' },
          ]),
          localSchoolSchema(),
          courseSchema(),
        ]}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'CDL School in Dalton, GA' },
        ]}
        eyebrow="CDL School · Dalton, GA · off I-75"
        title="Your Class A CDL school in"
        highlight="Dalton, Georgia."
        intro="ELDT-compliant CDL-A training on real equipment, right on the I-75 corridor in North Georgia — built by a 17-year driver with zero violations, for the drivers of this region."
      >
        <Button href="/academy/apply">Apply to the Academy</Button>
        <Button variant="ghost" href="/academy/curriculum">
          See the curriculum
        </Button>
      </PageHero>

      <Section className="border-b border-line">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>Why train here</Eyebrow>
          <h2 className="display-section">A CDL school that knows these roads</h2>
          <p className="mt-4 text-muted">
            If you’re searching for a CDL school near Dalton, you don’t need a corporate mill three
            hours away. You need real training, close to home, from someone who’s driven the miles.
          </p>
        </div>
        <CardGrid cards={WHY} columns={2} />
      </Section>

      {/* Areas served */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="max-w-2xl">
          <Eyebrow>Areas served</Eyebrow>
          <h2 className="display-section">North Georgia &amp; the I-75 corridor</h2>
          <p className="mt-4 text-muted">
            Drivers come to us from across the region. If you’re near any of these, you’re close
            enough to train with us:
          </p>
        </div>
        <ul className="mt-6 flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <li
              key={a}
              className="rounded-card border border-line bg-asphalt px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {/* Program summary + internal links */}
      <Section className="border-b border-line">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>The program</Eyebrow>
          <h2 className="display-section">What Dalton drivers train on</h2>
        </div>
        <CardGrid
          cards={[
            {
              title: 'ELDT Curriculum',
              description:
                'Theory, range, and public-road driving that meets the federal standard.',
              href: '/academy/curriculum',
              cta: 'See the curriculum',
            },
            {
              title: 'Requirements',
              description:
                'Age, license, DOT medical, and the CLP — exactly what you need to start.',
              href: '/academy/requirements',
              cta: 'Check requirements',
            },
            {
              title: 'Financing',
              description: 'Grants, VA benefits, employer sponsorship, and community-funded seats.',
              href: '/academy/financing',
              cta: 'Explore financing',
            },
          ]}
        />
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
        <p className="mt-6 text-sm text-muted">
          Want the free stuff first?{' '}
          <Link href="/knowledge" className="font-semibold text-signal hover:underline">
            Browse CDL guides in the Knowledge Center →
          </Link>
        </p>
      </Section>

      <CtaBand heading="The CDL school Dalton drivers were waiting for" />
    </>
  );
}

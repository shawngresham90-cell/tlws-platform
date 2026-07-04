import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';

const PILLARS: Feature[] = [
  {
    title: 'ELDT Compliant',
    description:
      'Full 160-hour curriculum that meets the FMCSA Entry-Level Driver Training standard.',
    href: '/academy',
    cta: 'See the curriculum',
  },
  {
    title: 'Real Equipment',
    description: 'Day-cab truck and 53-foot trailer. You train on what you’ll actually drive.',
    href: '/academy',
    cta: 'Tour the yard',
  },
  {
    title: 'Driver Instructors',
    description: 'Taught by working drivers, not classroom-only trainers. Road wisdom, not theory.',
    href: '/academy',
    cta: 'Meet the team',
  },
];

export function Academy() {
  return (
    <Section id="academy" className="border-b border-line">
      <SectionHeading
        eyebrow="The Academy"
        title="CDL-A training that respects your time"
        intro="Trucking Life Academy trains working drivers and career-changers in Dalton, GA. Built to reach the people corporate schools price out or pass over."
      />
      <FeatureGrid features={PILLARS} />
      <div className="mt-9">
        <Button href="/academy">Apply to the Academy</Button>
      </div>
    </Section>
  );
}

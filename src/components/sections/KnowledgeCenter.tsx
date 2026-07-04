import { Section } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';

const TOPICS: Feature[] = [
  {
    title: 'DOT Guide',
    description:
      'Plain-English FMCSA and 49 CFR reference, verified against the eCFR before it ships.',
    href: '/dot-guide',
    cta: 'Open the guide',
  },
  {
    title: 'Hours of Service',
    description:
      'The rules that keep your CDL clean — explained the way a driver actually needs them.',
    href: '/knowledge/hours-of-service',
    cta: 'Learn HOS',
  },
  {
    title: 'Career Paths',
    description:
      'OTR, regional, local, owner-operator — how the money and the life really compare.',
    href: '/knowledge/careers',
    cta: 'Compare paths',
  },
];

export function KnowledgeCenter() {
  return (
    <Section id="knowledge" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="Knowledge Center"
        title="Straight answers, no runaround"
        intro="Free, driver-first guidance on regulations, hours, and building a trucking career. Written to be understood on a 30-minute break, not by a compliance lawyer."
      />
      <FeatureGrid features={TOPICS} />
    </Section>
  );
}

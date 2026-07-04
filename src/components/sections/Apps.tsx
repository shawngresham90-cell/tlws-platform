import { Section } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';

const APPS: Feature[] = [
  {
    title: 'DOT Reg Deck',
    description:
      'Fast FMCSA regulation lookup, verified against the eCFR. Built for roadside speed.',
    href: '/apps',
    cta: 'Open the tool',
  },
  {
    title: 'GoDataQ',
    description: 'Challenge an unfair inspection or violation. Free tier plus done-for-you help.',
    href: '/apps',
    cta: 'Fight a DataQ',
  },
];

export function Apps() {
  return (
    <Section id="apps" className="border-b border-line bg-asphalt-800">
      <SectionHeading
        eyebrow="Apps & Tools"
        title="Tools that earn their keep"
        intro="Practical driver tools — regulation lookup, DataQ challenges, and more — built to save you time, money, or your CDL."
      />
      <FeatureGrid features={APPS} columns={2} />
    </Section>
  );
}

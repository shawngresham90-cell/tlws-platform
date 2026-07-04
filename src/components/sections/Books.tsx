import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';

const BOOKS: Feature[] = [
  {
    title: 'Carnivore In The Truck',
    description: 'Eating for energy and health from the driver’s seat. Built for the road.',
    href: '/books',
    cta: 'Get the book',
  },
  {
    title: 'The HOS Bible',
    description: 'Hours of Service, decoded. Keep your logbook — and your CDL — clean.',
    href: '/books',
    cta: 'Get the book',
  },
  {
    title: '17 Years, Zero Violations',
    description: 'The habits behind a clean record, from a driver who lived it.',
    href: '/books',
    cta: 'Get the book',
  },
];

export function Books() {
  return (
    <Section id="books" className="border-b border-line">
      <SectionHeading
        eyebrow="Books"
        title="Driver-built guides"
        intro="Written by a driver, for drivers. No fluff — the stuff that keeps you legal, healthy, and earning."
      />
      <FeatureGrid features={BOOKS} />
      <div className="mt-9">
        <Button variant="ghost" href="/books">
          Browse all books
        </Button>
      </div>
    </Section>
  );
}

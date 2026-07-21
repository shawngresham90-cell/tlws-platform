import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';

/** Mirrors the published Amazon catalog on /books — real titles only. */
const BOOKS: Feature[] = [
  {
    title: 'The Trucker’s Carnivore Cookbook',
    description: '100 air-fryer meals you can cook right in the cab. Eat for energy and health.',
    href: '/books#truckers-carnivore-cookbook',
    cta: 'Get the book',
  },
  {
    title: 'The DOT Survival Guide',
    description: 'Inspections, audits, and shutdowns — decoded from 17 years of clean records.',
    href: '/books#dot-survival-guide',
    cta: 'Get the book',
  },
  {
    title: 'Defensive Driving For Truck Drivers',
    description: 'The habits and space management that keep a big truck out of trouble.',
    href: '/books#defensive-driving-for-truck-drivers',
    cta: 'Get the book',
  },
  {
    title: 'Discipline Over Everything',
    description: 'The truths nobody tells you — road-tested discipline for a bigger life.',
    href: '/books#discipline-over-everything',
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
      <FeatureGrid features={BOOKS} columns={4} />
      <div className="mt-9">
        <Button variant="ghost" href="/books">
          Browse all books
        </Button>
      </div>
    </Section>
  );
}

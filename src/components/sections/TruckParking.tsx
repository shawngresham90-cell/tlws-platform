import { Section, GuideSignCard } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/**
 * Truck Parking — TruckParkingClub affiliate lane (code SHAWN20 wired later).
 * The directory entrance renders as an interstate guide-sign panel (Night
 * Haul §1.3): the directory should read like the road's own signage, and
 * green wayfinding is the honest semantic here — parking is free driver
 * value, not a money action, so the old amber button was spending accent
 * budget the doctrine reserves for money. Heading sits above the sign like
 * every other section (the old inner nesting needed a -mt-6 hack).
 */
export function TruckParking() {
  return (
    <Section id="truck-parking" className="border-b border-line">
      <SectionHeading
        eyebrow="Truck Parking"
        title="Stop circling for a spot"
        intro="Finding safe, legal overnight parking shouldn't cost you an hour of drive time. Reserve a guaranteed spot ahead and park without the stress."
      />
      <GuideSignCard
        href="/directory/parking"
        title="Truck Parking"
        description="Free, paid, and reserved spots — state by state, exit by exit."
        cta="Find parking"
        className="max-w-xl"
      />
    </Section>
  );
}

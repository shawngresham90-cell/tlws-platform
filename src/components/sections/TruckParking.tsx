import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/** Truck Parking — TruckParkingClub affiliate lane (code SHAWN20 wired later). */
export function TruckParking() {
  return (
    <Section id="truck-parking" className="border-b border-line">
      <div className="rounded-card border border-line bg-asphalt-800 p-8 sm:p-10">
        <SectionHeading eyebrow="Truck Parking" title="Stop circling for a spot" />
        <p className="-mt-6 mb-6 max-w-2xl text-muted">
          Finding safe, legal overnight parking shouldn&apos;t cost you an hour of drive time.
          Reserve a guaranteed spot ahead and park without the stress.
        </p>
        <Button href="/directory/parking">Find parking</Button>
      </div>
    </Section>
  );
}

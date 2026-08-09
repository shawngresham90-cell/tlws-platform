'use client';

import { driverAssurances } from '@/lib/navigator/truck-profile-coverage';
import type { TruckProfile } from '@/lib/trip-planner/types';

/**
 * The truck the route is being planned for (truck-routing priority 11).
 *
 * US units, no engineering vocabulary, and the numbers shown plainly
 * rather than folded into a sentence — a driver checking a profile is
 * comparing values against a cab card, and a paragraph makes that harder
 * than a list.
 *
 * The disclosure below the numbers is the part that matters. It names
 * what the route request actually asked the provider to route around AND
 * what it did not. A profile screen that lists only the fields that work
 * reads as a guarantee of truck-legality, and this app cannot make that
 * guarantee: vehicle type is left to the provider's default, and per-axle
 * weight, trailer count and hazmat tunnel category are not modelled at
 * all. Saying so costs four words of screen and buys a driver who knows
 * which restrictions are still theirs to watch for.
 *
 * The values themselves are labelled as pilot defaults, because they are:
 * no saved per-driver profile exists yet, so every trip uses the same
 * numbers and the driver should know that before trusting the route.
 */
export function TruckProfilePanel({ truck }: { truck: TruckProfile }) {
  const assurances = driverAssurances();

  return (
    <section
      aria-labelledby="truck-profile-heading"
      className="rounded-card border border-line p-4"
    >
      <h3 id="truck-profile-heading" className="text-lg font-semibold text-ink">
        Truck used for this route
      </h3>
      <p className="text-base text-ink/60">
        Pilot defaults — not a saved profile. Every trip in this build uses these numbers.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-lg">
        <Row label="Height" value={`${truck.heightFt} ft`} />
        <Row label="Width" value={`${truck.widthFt} ft`} />
        <Row label="Length" value={`${truck.lengthFt} ft`} />
        <Row label="Gross weight" value={`${truck.grossWeightLbs.toLocaleString()} lbs`} />
        <Row label="Axles" value={String(truck.axles)} />
        <Row label="Hazmat" value={truck.hazmatClass ?? 'none'} />
      </dl>

      <p className="mt-3 text-base text-ink/80">
        <span className="font-semibold">Routed around:</span> {assurances.routedAround.join(', ')}.
      </p>
      <p className="mt-1 text-base text-ink/80">
        <span className="font-semibold">Not routed around:</span>{' '}
        {assurances.notRoutedAround.join(', ')}. Watch for these yourself.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink/70">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </>
  );
}

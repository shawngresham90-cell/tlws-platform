import { Section, Button } from '@/components/ui';

/**
 * The Academy conversion band — the three actions every page funnels toward,
 * in priority order: Apply, Fund the School, Contact. Reused verbatim at the
 * foot of each Academy page so the call to action never drifts.
 *
 * Destinations follow the platform's placeholder-link convention: `/academy/apply`
 * lights up with the application system (Milestone 8) and `/founders` with the
 * Founders Wall (Milestone 9). `/contact` is the always-available intake path.
 */
export function CtaBand({
  heading = 'Ready to get your CDL the right way?',
  intro = 'Drivers helping drivers — that’s the whole idea. Start your application, help fund a seat, or just ask a question.',
}: {
  heading?: string;
  intro?: string;
}) {
  return (
    <Section className="border-t border-line bg-asphalt-800">
      <div className="max-w-2xl">
        <h2 className="display-section">{heading}</h2>
        <p className="mt-4 text-muted">{intro}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button href="/academy/apply">Apply to the Academy</Button>
        <Button variant="secondary" href="/founders">
          Fund the School
        </Button>
        <Button variant="ghost" href="/contact">
          Contact Us
        </Button>
      </div>
    </Section>
  );
}

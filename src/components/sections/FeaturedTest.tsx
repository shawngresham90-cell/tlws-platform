import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/** Featured practice test — single focal CTA into the free test funnel. */
export function FeaturedTest() {
  return (
    <Section id="practice-test" className="border-b border-line">
      <SectionHeading eyebrow="Featured Practice Test" title="Pass the permit the first time" />
      <div className="rounded-card border border-line bg-asphalt-800 p-8 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl uppercase text-signal">
              General Knowledge — free Study Mode
            </h3>
            <p className="mt-3 text-muted">
              Every question is written against the current CDL manual and 49 CFR, with the citation
              attached. Miss one, see exactly why — the moment you answer. No account needed.
            </p>
          </div>
          <Button href="/practice-tests/general-knowledge">Start studying</Button>
        </div>
      </div>
    </Section>
  );
}

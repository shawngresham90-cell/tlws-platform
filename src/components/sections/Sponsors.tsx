import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/** Sponsors — business-facing CTA into the sponsor inquiry pipeline. */
export function Sponsors() {
  return (
    <Section id="sponsors" className="border-b border-line">
      <SectionHeading
        eyebrow="Sponsors"
        title="Partner with the school"
        intro="Trucking companies, suppliers, and local businesses can sponsor equipment, students, or the build itself — and reach a loyal driver audience while doing real good."
      />
      <div className="flex flex-wrap gap-4">
        <Button href="/sponsors">Become a sponsor</Button>
        <Button variant="ghost" href="/sponsors#inquire">
          Talk to Shawn
        </Button>
      </div>
    </Section>
  );
}

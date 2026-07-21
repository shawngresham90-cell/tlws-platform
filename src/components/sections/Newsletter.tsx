import { Section } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { NewsletterForm } from './NewsletterForm';

/**
 * Newsletter capture. The server shell owns layout + copy; the client island
 * (NewsletterForm) posts to the guarded lead pipeline at /api/lead.
 */
export function Newsletter() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  return (
    <Section id="newsletter" className="border-b border-line">
      <div className="rounded-card border border-signal/30 bg-asphalt-800 p-8 sm:p-10">
        <SectionHeading eyebrow="Newsletter" title="Get the driver's edge in your inbox" />
        <p className="-mt-6 mb-6 max-w-xl text-muted">
          Regulation updates, career tips, and new resources from Shawn — no spam, unsubscribe
          anytime.
        </p>
        <NewsletterForm siteKey={siteKey} />
      </div>
    </Section>
  );
}

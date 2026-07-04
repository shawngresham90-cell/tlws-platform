import { Section } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/**
 * Newsletter capture. Renders the markup + posts to /api/lead. The interactive
 * submit handler is a tiny client island added when forms land in a later
 * milestone; here it's the accessible shell so the layout and SEO are locked.
 */
export function Newsletter() {
  return (
    <Section id="newsletter" className="border-b border-line">
      <div className="rounded-card border border-signal/30 bg-asphalt-800 p-8 sm:p-10">
        <SectionHeading eyebrow="Free DOT Guide" title="Get the driver's edge in your inbox" />
        <p className="-mt-6 mb-6 max-w-xl text-muted">
          Regulation updates, career tips, and new resources — no spam, unsubscribe anytime. Drop
          your email and we&apos;ll send the free DOT guide to start.
        </p>
        <div className="flex max-w-md flex-col gap-3 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="you@email.com"
            className="flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
          />
          <button
            type="button"
            className="rounded-card bg-signal px-6 py-3 font-display text-lg uppercase text-asphalt transition-colors hover:bg-signal-600"
          >
            Send it
          </button>
        </div>
      </div>
    </Section>
  );
}

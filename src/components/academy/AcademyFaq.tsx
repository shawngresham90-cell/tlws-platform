import type { KcFaq } from '@/lib/kc/types';
import { JsonLd } from '@/lib/seo/schema';
import { faqPageSchema } from '@/lib/seo/academy-schema';

/**
 * Accessible FAQ block that emits FAQPage JSON-LD from the *same* array it
 * renders — so the structured data can never drift from what a visitor reads.
 * Native <details>: zero JS, keyboard-accessible, works with JS off.
 *
 * Set `schema={false}` when several FAQ blocks share one page and only one of
 * them should own the FAQPage markup (Google wants a single FAQPage per page).
 */
export function AcademyFaq({
  faqs,
  heading = 'Frequently asked questions',
  schema = true,
}: {
  faqs: KcFaq[];
  heading?: string;
  schema?: boolean;
}) {
  if (!faqs?.length) return null;
  // The FAQ page renders one block per topic group. A fixed id would duplicate
  // both the DOM id and the landmark's accessible name across every block, so
  // derive it from the heading.
  const headingId = `faq-${heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
  return (
    <section aria-labelledby={headingId} className="mt-4">
      {schema && <JsonLd schema={faqPageSchema(faqs)} />}
      <h2 id={headingId} className="display-section mb-6">
        {heading}
      </h2>
      <div className="divide-y divide-line rounded-card border border-line">
        {faqs.map((f, i) => (
          <details key={i} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                className="shrink-0 text-signal transition-transform group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

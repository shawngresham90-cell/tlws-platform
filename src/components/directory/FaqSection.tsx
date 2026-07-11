import type { Faq } from '@/lib/directory/faq';

/**
 * Server-rendered FAQ accordion (native <details>, zero JS). The visible
 * content is EXACTLY what faqSchema() emits as FAQPage JSON-LD — Google
 * requires the marked-up questions to be present on the page.
 */
export function FaqSection({ faqs, heading = 'Driver FAQ' }: { faqs: Faq[]; heading?: string }) {
  if (faqs.length === 0) return null;
  return (
    <section className="mt-12" aria-label={heading}>
      <h2 className="font-display text-2xl uppercase text-ink">{heading}</h2>
      <div className="mt-4 grid gap-3">
        {faqs.map((f) => (
          <details
            key={f.question}
            className="group rounded-card border border-line bg-asphalt-800 px-5 py-4"
          >
            <summary className="cursor-pointer list-none font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="mr-2 text-signal transition-transform group-open:rotate-90 inline-block">
                ›
              </span>
              {f.question}
            </summary>
            <p className="mt-3 text-sm text-muted">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

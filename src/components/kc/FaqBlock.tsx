import type { KcFaq } from '@/lib/kc/types';

/**
 * FAQ block. Uses native <details> — zero JS, accessible, and the visible
 * content matches the FAQPage schema so Google/AI see the same Q&A users do.
 */
export function FaqBlock({ faqs }: { faqs: KcFaq[] }) {
  if (!faqs?.length) return null;
  return (
    <section aria-labelledby="faq-heading" className="mt-12">
      <h2 id="faq-heading" className="display-section text-2xl mb-4">
        Frequently asked questions
      </h2>
      <div className="divide-y divide-line rounded-card border border-line">
        {faqs.map((f, i) => (
          <details key={i} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                className="ml-4 text-signal transition-transform group-open:rotate-45"
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

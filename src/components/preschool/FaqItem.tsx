'use client';

import { useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * One FAQ as a native <details> disclosure — keyboard-accessible for free,
 * scannable when closed (headline list), and instrumented: the first open
 * fires `preschool_faq_open` with the question text only.
 */
export function FaqItem({ question, answer }: { question: string; answer: string }) {
  const fired = useRef(false);
  return (
    <details
      className="group rounded-card border border-line bg-asphalt-800"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && !fired.current) {
          fired.current = true;
          trackEvent(PRESCHOOL_EVENTS.faqOpen, { question });
        }
      }}
    >
      <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="mr-2 inline-block text-signal transition-transform group-open:rotate-90">
          ›
        </span>
        {question}
      </summary>
      <p className="border-t border-line px-5 py-4 text-sm text-muted">{answer}</p>
    </details>
  );
}

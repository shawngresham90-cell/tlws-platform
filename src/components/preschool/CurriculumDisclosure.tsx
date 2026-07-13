'use client';

import { useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * Native <details> disclosure for curriculum groups — keyboard-accessible
 * with zero custom JS beyond the analytics ping. Emits
 * `preschool_curriculum_expand` (group label only) the first time a group is
 * opened.
 */
export function CurriculumDisclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  const fired = useRef(false);
  return (
    <details
      className="group rounded-card border border-line bg-asphalt-800"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && !fired.current) {
          fired.current = true;
          trackEvent(PRESCHOOL_EVENTS.curriculumExpand, { group: summary });
        }
      }}
    >
      <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:text-signal [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="mr-2 inline-block text-signal transition-transform group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      <div className="border-t border-line px-5 py-4 text-sm text-muted">{children}</div>
    </details>
  );
}

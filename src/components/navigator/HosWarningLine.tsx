'use client';

import type { HosWarning } from '@/lib/navigator/hos-strip';

/**
 * The strip's escalation line (milestone N6): the single binding clock
 * warning as TEXT in an assertive-when-critical live region. Severity is
 * carried in the words ("Warning:", "Urgent:") — never by color alone.
 * Voice for these crossings is N7 and deliberately absent.
 */
export function HosWarningLine({ warning }: { warning: HosWarning }) {
  if (warning.severity === 'none' || warning.text === null) {
    return (
      <p aria-live="polite" role="status" className="mt-2 text-xl text-ink/80">
        Clocks are comfortable.
      </p>
    );
  }
  const prefix =
    warning.severity === 'critical'
      ? 'Urgent: '
      : warning.severity === 'warning'
        ? 'Warning: '
        : '';
  return (
    /* Phase 2 rail treatment: the semantic edge beside the words that
       already carry the meaning ("Warning:", "Urgent:") — never instead
       of them. Red only for the critical clock; every lesser state is
       amber. The live-region behavior above is pinned and unchanged. */
    <p
      aria-live={warning.severity === 'critical' ? 'assertive' : 'polite'}
      role="status"
      className={`mt-2 rounded-cockpit border border-line border-l-4 ${
        warning.severity === 'critical' ? 'border-l-nav-danger' : 'border-l-nav-warn'
      } bg-nav-surface-2 px-3 py-1 text-xl font-semibold text-ink`}
    >
      {prefix}
      {warning.text}
    </p>
  );
}

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
    <p
      aria-live={warning.severity === 'critical' ? 'assertive' : 'polite'}
      role="status"
      className="mt-2 text-xl font-semibold text-ink"
    >
      {prefix}
      {warning.text}
    </p>
  );
}

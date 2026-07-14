import { FOUNDING_STUDENT_CAPACITY } from '@/lib/preschool/constants';

/**
 * Founding Student capacity meter — 20 total / filled / remaining, always fed
 * from real production wall data (getFoundingWall) by the page that renders
 * it. Pure presentational: this component can't invent numbers, and the math
 * arrives pre-clamped (spots remaining can never go below zero).
 */
export function SpotsMeter({
  filled,
  remaining,
  compact = false,
}: {
  filled: number;
  remaining: number;
  /** Single-line version for the homepage card. */
  compact?: boolean;
}) {
  const pct = Math.round((filled / FOUNDING_STUDENT_CAPACITY) * 100);
  const label =
    filled === 0
      ? `All ${FOUNDING_STUDENT_CAPACITY} Founding Student spots are open`
      : `${filled} of ${FOUNDING_STUDENT_CAPACITY} spots filled · ${remaining} remaining`;

  if (compact) {
    return (
      <p className="text-xs font-semibold uppercase tracking-wide text-signal">{label}</p>
    );
  }

  return (
    <div className="max-w-md">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={FOUNDING_STUDENT_CAPACITY}
        aria-valuenow={filled}
        aria-label={`Founding Student spots filled: ${filled} of ${FOUNDING_STUDENT_CAPACITY}`}
        className="h-2.5 overflow-hidden rounded-card border border-line bg-asphalt-700"
      >
        <div className="h-full bg-signal transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-signal">{label}</p>
    </div>
  );
}

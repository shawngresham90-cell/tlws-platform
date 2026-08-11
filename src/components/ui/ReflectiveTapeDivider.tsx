import { cn } from '@/lib/utils/cn';

/**
 * Reflective-tape section divider (Night Haul master blueprint §1.3) — a
 * single thin band of trailer conspicuity tape marking a major act break.
 *
 * White/reflective stripes, deliberately NOT the blueprint's yellow: the
 * house color doctrine (amber = money/action only, never decoration —
 * tailwind.config.ts §doctrine, SectionHeading's "never amber" rule)
 * outranks a decorative yellow band, and DOT tape reads white in headlights
 * anyway. If the owner ever wants the yellow variant, that's a one-line
 * change here — after the accent decision, not before.
 *
 * HARD CAP: two per page (blueprint rule). Purely decorative — aria-hidden,
 * no layout semantics, 6px tall per the blueprint.
 */
export function ReflectiveTapeDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-1.5 w-full opacity-50', className)}
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(242,240,235,0.5) 0 10px, rgba(242,240,235,0.06) 10px 20px)',
      }}
    />
  );
}

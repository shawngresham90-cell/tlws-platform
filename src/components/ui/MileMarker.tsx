import { cn } from '@/lib/utils/cn';

/**
 * Mile-marker stat post (Night Haul master blueprint §1.3) — a small green
 * roadside post for meaningful, REAL numbers: the 17-years / zero-violations
 * class of proof, never decorative filler. The house stat rule holds here
 * exactly as in ProofBar: a value renders real or the marker doesn't render
 * at all — this component never invents, rounds, or placeholders a number.
 *
 * Semantics survive without color: value and label are plain stacked text,
 * so the post reads identically to a screen reader ("17 — years on the
 * road") and on a monochrome display.
 */
export function MileMarker({
  value,
  label,
  className,
}: {
  /** The verified figure, e.g. "17", "0", "CDL-A". */
  value: string;
  /** What the figure measures, e.g. "years on the road". */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-ink/35 bg-guide px-3 py-3 text-center',
        className,
      )}
    >
      <span className="num-data font-display text-2xl uppercase leading-none text-ink sm:text-3xl">
        {value}
      </span>
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/85">
        {label}
      </span>
    </div>
  );
}

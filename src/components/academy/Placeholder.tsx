/**
 * Placeholder — an unmistakable inline marker for content that isn't final yet
 * (exact hours, prices, addresses, dates). Deliberately loud so nothing ships
 * to production pretending to be confirmed. Swap the text for real copy later.
 */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-card border border-dashed border-diesel bg-diesel/10 px-2 py-0.5 align-baseline text-sm font-semibold text-diesel-300">
      <span aria-hidden="true">✎</span>
      <span className="sr-only">Placeholder: </span>
      {children}
    </span>
  );
}

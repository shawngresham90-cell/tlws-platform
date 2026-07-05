export type Step = {
  title: string;
  body: React.ReactNode;
  meta?: React.ReactNode;
};

/**
 * Numbered vertical step list — curriculum phases, enrollment steps, the path
 * to a CLP. Ordered <ol> so the sequence is real to screen readers, not just
 * visual. `meta` holds an optional right-aligned tag (e.g. duration).
 */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li
          key={i}
          className="flex gap-4 rounded-card border border-line bg-asphalt-800 p-5 sm:gap-5 sm:p-6"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-signal font-display text-lg text-asphalt"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-xl uppercase text-ink">{s.title}</h3>
              {s.meta && (
                <span className="text-xs font-semibold uppercase tracking-wide text-signal">
                  {s.meta}
                </span>
              )}
            </div>
            <div className="mt-2 text-muted">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

import { PROGRAMS, type ProgramFacts } from '@/lib/academy/program';

/**
 * The two CDL programs side by side. Every value comes from
 * lib/academy/program — the component holds no facts of its own, so a price or
 * a start date cannot drift between this card and the prose around it.
 *
 * The weekday card carries a visible "Starts January 2027" marker because the
 * programme is NOT open yet, and a two-column layout otherwise reads as two
 * equally-available choices. That marker is the difference between describing
 * a roadmap and implying you can enrol on Monday.
 */
function ProgramCard({ program }: { program: ProgramFacts }) {
  return (
    <div className="placard flex flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl uppercase text-ink">{program.name}</h3>
        {!program.open && (
          <span className="rounded-card border border-line bg-asphalt-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Starts {program.startIso === '2027-01' ? 'January 2027' : program.startsLabel}
          </span>
        )}
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {program.bullets.map((b) => (
          <li key={b} className="flex gap-2 text-sm text-muted">
            <span aria-hidden="true" className="text-signal">
              •
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgramComparison() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PROGRAMS.map((p) => (
        <ProgramCard key={p.key} program={p} />
      ))}
    </div>
  );
}

'use client';

import type { HosCompactCell, HosCompactView } from '@/lib/navigator/hos-compact';
import { cellStateWord } from '@/lib/navigator/hos-compact';
import { ELD_AUTHORITATIVE } from '@/lib/navigator/hos-clocks';

/**
 * The driving screen's compact HOS strip (pilot round 3).
 *
 * One row, four labelled clocks, sized to be read at a glance from a
 * dash mount and small enough that the full-screen map keeps the screen:
 * measured at 54 px tall in portrait against the 230 px card it replaces
 * while guidance is live.
 *
 * DESIGN RULES IT KEEPS (blueprint §5 / doc 06):
 *   - every number has a WORD beside it — `DRIVE`, `WINDOW`, `CYCLE`,
 *     `BREAK` — because an unexplained clock is not information;
 *   - severity is carried by a word (`OVER`, `URGENT`, `LOW`, `SOON`) and
 *     by the aria-hidden shape, never by color alone; the rail edge is
 *     reinforcement;
 *   - the LIMITING clock (the engine's own `limitedBy`) is marked with a
 *     caret and named in the accessible sentence, so "which clock is
 *     about to bite" survives a one-second glance;
 *   - values sit at the drive-mode floor (18 px minimum) and scale up on
 *     wider screens; labels stay at the 16 px floor;
 *   - no animation: nothing on this strip moves, blinks, or slides.
 *
 * Presentational only. It computes nothing — `hosCompactView` shapes the
 * engine's clocks and this renders them.
 */

/** The one-line disclaimer that must ride with any HOS display. */
export const HOS_PLANNING_AID = 'Planning aid only — not an ELD. Check your own logs.';

function Cell({ cell }: { cell: HosCompactCell }) {
  const word = cellStateWord(cell.state);
  // Shape, not color, marks severity — paired with the word above.
  const glyph =
    cell.state === 'over' || cell.state === 'urgent' ? '▲' : cell.state === 'low' ? '△' : null;
  const edge =
    cell.state === 'over' || cell.state === 'urgent'
      ? 'border-l-nav-danger'
      : cell.state === 'low' || cell.state === 'soon'
        ? 'border-l-nav-warn'
        : 'border-l-transparent';
  return (
    <div
      className={`min-w-0 border-l-4 ${edge} pl-1.5`}
      // The whole cell reads as one sentence rather than four
      // disconnected tokens ("DRIVE", "6:42", "LOW", "◂").
      aria-label={cell.spoken}
      role="group"
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-1 text-[length:var(--size-label)] leading-none text-ink/70"
      >
        <span className="truncate font-semibold tracking-[0.08em]">{cell.label}</span>
        {cell.limiting ? (
          /* The limiting clock, marked where the eye already is. */
          <span className="shrink-0 font-bold text-ink" title="Limiting clock">
            ◂
          </span>
        ) : null}
      </div>
      <div aria-hidden="true" className="flex items-baseline gap-1">
        <span className="num-data font-data text-[length:clamp(18px,5vw,var(--size-trip))] font-bold leading-tight text-ink">
          {cell.text ?? '—'}
        </span>
        {word ? (
          <span className="truncate text-[length:var(--size-label)] font-bold leading-none text-ink">
            {glyph ? <span aria-hidden="true">{glyph} </span> : null}
            {word}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HosCompactStrip({
  view,
  /** Tap target: opens the detailed HOS view where the lock permits it. */
  onOpen,
  /** Locked (moving): the strip stays READABLE, the tap simply is not offered. */
  interactive = true,
}: {
  view: HosCompactView;
  onOpen?: () => void;
  interactive?: boolean;
}) {
  const body = (
    <>
      <div className="grid grid-cols-4 items-stretch gap-2">
        {view.cells.map((cell) => (
          <Cell key={cell.key} cell={cell} />
        ))}
      </div>
      {/* The disclaimer is part of the display, not a footnote elsewhere:
          wherever the clocks are shown, this sentence is shown with them.

          BOTH sentences share ONE line, deliberately. The pre-trip setup
          milestone requires 'ELD is authoritative.' beside the driving
          clocks — the numbers here are the driver's own now, not the
          app's — and it first shipped as a second paragraph stacked
          under this box. That cost a line of height the cockpit does not
          have: on an 844x390 landscape phone it pushed Overview, Voice
          and Stop off the bottom of the screen, which the full-map bench
          caught. Inside the box, on this line, it is just as beside the
          clocks and costs nothing. */}
      <p className="mt-0.5 truncate text-[length:var(--size-label)] leading-none text-ink/60">
        {HOS_PLANNING_AID} {ELD_AUTHORITATIVE}
      </p>
    </>
  );

  // The vertical padding yields on a short landscape phone — the same
  // step the maneuver card and the truck chip already take there, and the
  // one that keeps the bottom controls inside a 390 px-tall viewport.
  const shell =
    'w-full rounded-cockpit border border-line bg-asphalt/90 px-2 py-1.5 text-left ' +
    '[@media(max-height:480px)]:py-0.5';

  if (!interactive || onOpen === undefined) {
    return (
      <section aria-label="Hours of service — compact" className={shell}>
        {body}
      </section>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      // 64 px: the Navigator's glove floor, not the 44 px WCAG minimum.
      className={`${shell} min-h-16`}
      aria-label="Hours of service — compact. Open the detailed clocks."
    >
      {body}
    </button>
  );
}

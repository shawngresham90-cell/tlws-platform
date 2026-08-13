'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClockState } from '@/lib/trip-planner/types';
import { formatHM, HOS_TICK_MS, hosStripView, tickClocks } from '@/lib/navigator/hos-strip';
import { hosCompactViewFrom } from '@/lib/navigator/hos-compact';
import { createHosAnnouncer, type VoiceGuidance } from '@/lib/navigator/voice-guidance';
import { HosWarningLine } from './HosWarningLine';
import {
  CLOCKS_NOT_SET,
  CLOCKS_UNSET_WARNING,
  CYCLE_LABEL,
  ELD_AUTHORITATIVE,
} from '@/lib/navigator/hos-clocks';
import { HOS_PLANNING_AID, HosCompactStrip } from './HosCompactStrip';

/**
 * The permanent HOS strip (milestone N6): the driver's own clocks against
 * the drive, updated on the doc 05 §9 sixty-second cadence. Reuses the
 * trip-planner hos-engine unchanged.
 *
 * Clocks only COUNT DOWN while `drivingActive` is true (a real navigation
 * state) — on the Phase 2A preview, with no route loaded, the strip shows
 * the clocks honestly and does not burn them: pretending a parked preview
 * is drive time would make every number on the strip a lie. With no trip
 * loaded the source is a fresh driver at full clocks, and the strip says
 * so in text.
 *
 * ONE COMPONENT, TWO PRESENTATIONS (pilot round 3 — compact HOS). While
 * guidance is live this renders the compact four-clock strip; parked it
 * renders the full card. Deliberately NOT two components: the clock state,
 * the 60-second advance and the voice announcer all live here, so a single
 * mounted instance means the numbers on the cockpit strip and the numbers
 * on the parked card are the same numbers, the clocks never restart when
 * the presentation changes, and the HOS voice warnings keep firing from
 * the one place they always have.
 */
export function HosStrip({
  initialClocks,
  enteredClocks,
  restoredClocks,
  drivingActive,
  sourceLabel,
  voice,
  compact = false,
  detailSlot,
  onClocksChange,
}: {
  /** Injected clock state (tests only). */
  initialClocks?: ClockState;
  /**
   * The clocks the DRIVER entered, converted to engine state — or null
   * when they have entered none.
   *
   * NULL IS THE DEFAULT AND IT IS THE POINT. This component used to seed
   * itself with `freshClockState(Date.now())`: eleven hours, a full
   * window, seventy hours of cycle, for every driver, every session. A
   * driver six hours into their day was shown a full clock. Now nothing
   * is shown until someone says what is actually left.
   */
  enteredClocks?: ClockState | null;
  /**
   * Clocks recovered from a restored trip, applied ONCE when they
   * arrive. A prop rather than `initialClocks` because the snapshot is
   * read in an effect after mount: this keeps the read off the render
   * path (no storage during render, no server/client divergence) while
   * still ending the reload with the driver's real remaining time
   * instead of a fresh eleven hours.
   */
  restoredClocks?: ClockState | null;
  /** True only while guidance is genuinely under way (navigating states). */
  drivingActive: boolean;
  /** Honest provenance line, e.g. "No trip loaded — full clocks shown". */
  sourceLabel: string;
  /** N7 voice output for threshold crossings; the strip stays visual without it. */
  voice?: VoiceGuidance;
  /** Cockpit presentation: the compact four-clock strip. */
  compact?: boolean;
  /**
   * Wraps the expanded detail in the caller's safety gate. The driving
   * screen passes a LockGate, so opening the detail obeys the SAME
   * stationary-only policy every other deep surface does — this component
   * never inspects motion itself (doc 06 §1).
   */
  detailSlot?: (detail: ReactNode) => ReactNode;
  /**
   * Reports the clock state whenever it changes, so the owner can persist
   * it with the trip snapshot. Without this a reload mid-shift would put
   * the trip back with FULL clocks — a silent reset, and the most
   * dangerous kind of wrong number on this screen.
   */
  onClocksChange?: (clocks: ClockState) => void;
}) {
  const [clocks, setClocks] = useState<ClockState | null>(
    // Seeded from the props so a STATIC render (and the server's first
    // paint) shows the same thing an effect would settle on. The driving
    // screen passes null on the first render — storage is read in an
    // effect, never during render — so server and client still agree.
    () => initialClocks ?? enteredClocks ?? null,
  );

  /*
   * Two sources can seed the clocks, and the more recent one wins.
   *
   *   entered  — what the driver typed on the parked screen.
   *   restored — what a trip snapshot carried back after a reload; this
   *              is the entered state already burned down by driving, so
   *              it supersedes the entry at mount.
   *
   * Both arrive in effects (storage is read after mount, never during
   * render), and the restore effect is declared second so it wins the
   * mount race. A later EDIT still wins, because the driver acting now
   * outranks a snapshot from before.
   */
  const lastEnteredRef = useRef<ClockState | null | undefined>(enteredClocks);
  useEffect(() => {
    if (enteredClocks === undefined || enteredClocks === lastEnteredRef.current) return;
    lastEnteredRef.current = enteredClocks;
    setClocks(enteredClocks);
  }, [enteredClocks]);
  const activeRef = useRef(drivingActive);
  activeRef.current = drivingActive;
  const announcerRef = useRef(createHosAnnouncer());
  const [expanded, setExpanded] = useState(false);

  // 60 s cadence (doc 05 §9). The interval always runs so a drive that
  // starts mid-minute is picked up at the next tick; the advance itself
  // only happens while driving is genuinely active. Cleared on unmount.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!activeRef.current) return;
      // Nothing entered means nothing to burn. Driving does not conjure a
      // clock into existence.
      setClocks((current) =>
        current === null ? null : tickClocks(current, HOS_TICK_MS / 60_000, 'driving'),
      );
    }, HOS_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // A restored trip's clocks replace the fresh state exactly once.
  const appliedRestoreRef = useRef(false);
  useEffect(() => {
    if (appliedRestoreRef.current || restoredClocks === undefined || restoredClocks === null) {
      return;
    }
    appliedRestoreRef.current = true;
    setClocks(restoredClocks);
  }, [restoredClocks]);

  // Report every clock change to the owner (persistence). An effect, not
  // a call inside the tick, so a restored state reports too.
  const reportRef = useRef(onClocksChange);
  reportRef.current = onClocksChange;
  useEffect(() => {
    if (clocks !== null) reportRef.current?.(clocks);
  }, [clocks]);

  const view = clocks === null ? null : hosStripView(clocks);

  // Threshold crossings speak (doc 05 §9). collect() re-offers the current
  // (clock, severity) every tick; the guidance module's announce-once ids
  // make anything but a genuine escalation a silent drop.
  //
  // UNCONDITIONAL HOOK, guarded inside: with no clocks entered there is
  // nothing to warn about, and the effect must still be called in the
  // same order on every render.
  useEffect(() => {
    if (!voice || view === null) return;
    for (const req of announcerRef.current.collect(view.warning, view.remaining)) {
      voice.request(req);
    }
  });

  /*
   * NOTHING ENTERED: say so, and say what it costs. A blank is honest;
   * a fresh eleven hours is a specific false claim about a driver's
   * legal standing, and it is the defect this whole milestone exists to
   * remove. No warning is spoken either — there is nothing to warn about.
   */
  if (view === null) {
    const unsetCard = (
      <section
        aria-label="Hours of service — not set"
        className="rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-nav-surface p-4"
      >
        <p className="num-data text-xl font-bold text-ink">{CLOCKS_NOT_SET}</p>
        <p className="mt-1 text-base text-muted">{CLOCKS_UNSET_WARNING}</p>
        <p className="mt-1 text-base text-muted">{ELD_AUTHORITATIVE}</p>
      </section>
    );
    if (!compact) return unsetCard;
    return (
      <div>
        <div className="rounded-cockpit border border-line bg-nav-surface px-3 py-2">
          <p className="num-data text-lg font-bold text-ink">{CLOCKS_NOT_SET}</p>
          <p className="text-base text-muted">{ELD_AUTHORITATIVE}</p>
        </div>
      </div>
    );
  }

  /*
   * The bar wears the semantic state color the warning line already states
   * in words (never color alone): green while the clocks are comfortable,
   * amber once a clock is getting tight, red when a stop is imminent.
   * Sodium amber — the site's money accent — left this surface with the
   * cockpit restyle: on the driving screen amber may only ever mean
   * "warning".
   */
  const barColor =
    view.warning.severity === 'critical'
      ? 'bg-nav-danger'
      : view.warning.severity === 'none'
        ? 'bg-nav-good'
        : 'bg-nav-warn';

  const detail = (
    <section
      aria-label="Hours of service"
      className="rounded-cockpit border border-line bg-nav-surface p-4"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xl text-ink/90">
        <dt>Drive time left</dt>
        <dd className="num-data font-semibold text-ink">{view.driveText}</dd>
        <dt>On-duty window left</dt>
        <dd className="num-data font-semibold text-ink">{view.windowText}</dd>
        <dt>Cycle remaining</dt>
        <dd className="num-data font-semibold text-ink">{formatHM(view.remaining.cycleMin)}</dd>
        <dt>Until 30-minute break</dt>
        <dd className="num-data font-semibold text-ink">
          {formatHM(view.remaining.untilBreakMin)}
        </dd>
      </dl>
      {/* Text-labeled remaining bars — the numbers above carry the meaning;
          the bars are reinforcement, never the only signal. */}
      <div aria-hidden="true" className="mt-2 h-2 w-full rounded-cockpit bg-line">
        <div
          className={`h-2 rounded-cockpit ${barColor}`}
          style={{ width: `${Math.round(view.driveFraction * 100)}%` }}
        />
      </div>
      <HosWarningLine warning={view.warning} />
      {/* The cycle's caveat travels with the number: the balance is what
          the driver entered, and the recap is not derivable from it. */}
      <p className="mt-2 text-base text-muted">{CYCLE_LABEL}</p>
      <p className="mt-1 text-base text-muted">{sourceLabel}</p>
      <p className="mt-1 text-base text-muted">{HOS_PLANNING_AID}</p>
      <p className="mt-1 text-base text-muted">{ELD_AUTHORITATIVE}</p>
    </section>
  );

  if (compact) {
    // The cockpit: the compact strip, plus the SAME detail card on demand
    // — wrapped by the caller's safety gate, so a moving driver reads the
    // clocks but does not open a panel over the map.
    const expandedDetail = expanded ? (
      <div className="mt-2 space-y-2">
        {detail}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="min-h-16 w-full rounded-cockpit border border-line bg-nav-surface-2 px-3 text-lg font-semibold text-ink"
        >
          Close clocks
        </button>
      </div>
    ) : null;
    return (
      <div>
        <HosCompactStrip
          view={hosCompactViewFrom(view.remaining)}
          onOpen={() => setExpanded(true)}
          interactive={detailSlot !== undefined}
        />
        {/* The ELD authority sits beside the DRIVING clocks too — inside
            the strip's own disclaimer line, where it costs no height.
            See the note in HosCompactStrip: as a stacked paragraph here
            it pushed the bottom controls off a short landscape phone. */}
        {/* The warning line rides along in its own live region exactly as
            it always has — the compact cells are aria-hidden decoration
            of numbers this sentence already states. */}
        <div className="sr-only">
          <HosWarningLine warning={view.warning} />
        </div>
        {detailSlot ? detailSlot(expandedDetail) : expandedDetail}
      </div>
    );
  }

  return detail;
}

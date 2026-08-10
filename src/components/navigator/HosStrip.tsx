'use client';

import { useEffect, useRef, useState } from 'react';
import { freshClockState } from '@/lib/trip-planner/hos-engine';
import type { ClockState } from '@/lib/trip-planner/types';
import { HOS_TICK_MS, hosStripView, tickClocks } from '@/lib/navigator/hos-strip';
import { createHosAnnouncer, type VoiceGuidance } from '@/lib/navigator/voice-guidance';
import { HosWarningLine } from './HosWarningLine';

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
 */
export function HosStrip({
  initialClocks,
  drivingActive,
  sourceLabel,
  voice,
}: {
  /** Injected clock state (tests / a future N8 session); fresh when absent. */
  initialClocks?: ClockState;
  /** True only while guidance is genuinely under way (navigating states). */
  drivingActive: boolean;
  /** Honest provenance line, e.g. "No trip loaded — full clocks shown". */
  sourceLabel: string;
  /** N7 voice output for threshold crossings; the strip stays visual without it. */
  voice?: VoiceGuidance;
}) {
  const [clocks, setClocks] = useState<ClockState>(
    () => initialClocks ?? freshClockState(Date.now()),
  );
  const activeRef = useRef(drivingActive);
  activeRef.current = drivingActive;
  const announcerRef = useRef(createHosAnnouncer());

  // 60 s cadence (doc 05 §9). The interval always runs so a drive that
  // starts mid-minute is picked up at the next tick; the advance itself
  // only happens while driving is genuinely active. Cleared on unmount.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!activeRef.current) return;
      setClocks((current) => tickClocks(current, HOS_TICK_MS / 60_000, 'driving'));
    }, HOS_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const view = hosStripView(clocks);

  // Threshold crossings speak (doc 05 §9). collect() re-offers the current
  // (clock, severity) every tick; the guidance module's announce-once ids
  // make anything but a genuine escalation a silent drop.
  useEffect(() => {
    if (!voice) return;
    for (const req of announcerRef.current.collect(view.warning, view.remaining)) {
      voice.request(req);
    }
  });

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

  return (
    <section
      aria-label="Hours of service"
      className="rounded-cockpit border border-line bg-nav-surface p-4"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xl text-ink/90">
        <dt>Drive time left</dt>
        <dd className="num-data font-semibold text-ink">{view.driveText}</dd>
        <dt>On-duty window left</dt>
        <dd className="num-data font-semibold text-ink">{view.windowText}</dd>
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
      <p className="mt-2 text-base text-muted">{sourceLabel}</p>
    </section>
  );
}

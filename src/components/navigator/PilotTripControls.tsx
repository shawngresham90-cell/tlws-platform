'use client';

import { useMemo, useState } from 'react';
import type { NavigationLifecycle } from '@/lib/navigator/navigation-lifecycle';
import type { PilotLog } from '@/lib/navigator/pilot-mode';
import type { DestinationFacility } from '@/lib/navigator/truck-entrance';
import type { PositionFix } from '@/lib/navigator/types';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import type { BuildId } from '@/lib/navigator/build-id';
import {
  MAX_NOTE_CHARS,
  PROBLEM_CATEGORIES,
  buildProblemReport,
  type ProblemReport,
} from '@/lib/navigator/problem-report';
import { DestinationSearch } from './DestinationSearch';
import { PilotOnboarding } from './PilotOnboarding';

/**
 * Pilot Mode trip controls (milestone P1) — the destination-entry and
 * trip-control surface that renders INSIDE the stationary-only
 * 'edit-destination' LockGate slot on the driving screen. Renders only
 * when Pilot Mode is active (flag on AND non-production host), so
 * production builds keep the N5 placeholder text.
 *
 * Pilot round 1: destination entry is now real SEARCH — address,
 * business, truck stop, warehouse, or city — and the driver never sees a
 * coordinate. Raw latitude/longitude entry survives only as a collapsed
 * developer affordance for bench testing a specific point.
 */

const FACILITIES: readonly DestinationFacility[] = [
  'warehouse',
  'distribution-center',
  'truck-terminal',
  'industrial-park',
  'customer-yard',
  'truck-stop',
  'rest-area',
  'unknown',
];

const inputClass =
  'min-h-16 w-full rounded-card border border-line bg-transparent px-4 text-xl text-ink';
const buttonClass =
  'min-h-16 w-full rounded-card border border-line px-4 text-xl font-semibold text-ink';

export function PilotTripControls({
  lifecycle,
  fix,
  debugLog,
  buildReport = null,
  build = null,
  onChanged,
}: {
  lifecycle: NavigationLifecycle;
  /** Current gated GPS fix — the trip origin. Null disables planning. */
  fix: PositionFix | null;
  /** Present only when Pilot Mode debug logging is on. */
  debugLog: PilotLog | null;
  /**
   * Assembles the road-test report from live session state. Supplied by
   * the driving screen, which is the only place that can see all of it.
   * Null hides the affordance entirely.
   */
  buildReport?: ((input: { note: string; problem: ProblemReport | null }) => string) | null;
  /** The running build, shown so a driver can quote it. */
  build?: BuildId | null;
  onChanged: () => void;
}) {
  const [reportNote, setReportNote] = useState('');
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportText, setReportText] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [facility, setFacility] = useState<DestinationFacility>('warehouse');
  const [picked, setPicked] = useState<DestinationCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const state = lifecycle.state();
  const summary = lifecycle.summary();

  // A stable object for the search: this component re-renders on every GPS
  // tick, and a fresh literal here made the search effect restart (and
  // re-issue a request) once per second. Identity changes only when the
  // truck actually moves ~110 m.
  const lat = fix?.lat ?? null;
  const lng = fix?.lng ?? null;
  const searchOrigin = useMemo(
    () => (lat === null || lng === null ? null : { lat, lng }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat === null ? null : lat.toFixed(3), lng === null ? null : lng.toFixed(3)],
  );

  async function planRoute() {
    if (busy) return;
    if (fix === null) {
      setNote('Waiting for a GPS fix — the trip origin is your current position.');
      return;
    }
    // A searched place wins; the developer coordinate box is the fallback.
    const usingSearch = picked !== null;
    const lat = usingSearch ? picked.position.lat : Number(destLat);
    const lng = usingSearch ? picked.position.lng : Number(destLng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      setNote('Search for a destination and choose it from the list.');
      return;
    }
    const chosenFacility = usingSearch ? picked.facility : facility;
    const now = Date.now();
    setBusy(true);
    setNote(null);
    const outcome = await lifecycle.plan(
      {
        origin: { lat: fix.lat, lng: fix.lng },
        destination: { lat, lng },
        truck: DEFAULT_TRUCK_PROFILE,
        departAtMs: now,
      },
      // A searched place still carries no VERIFIED truck entrance — the
      // provider's pin is the front door, not the gate — so provenance
      // stays 'unknown' and the arrival engine keeps completing such trips
      // as destination-unverified. Only the facility class improves.
      { position: { lat, lng }, facility: chosenFacility, positionSource: 'unknown' },
      now,
    );
    setBusy(false);
    if (!outcome.ok) setNote(`Route refused: ${outcome.reason}`);
    onChanged();
  }

  function act(fn: () => unknown) {
    fn();
    setNote(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold text-ink">
        Pilot trip controls <span className="font-normal text-ink/60">(preview builds only)</span>
      </p>

      <PilotOnboarding />

      {/* The build a driver is running, in one line they can read aloud on
          the phone or quote in a message. Every generated report carries
          the same identifier, so a screenshot and a report always agree. */}
      {build ? (
        <p className="text-base text-ink/60">
          Build: <span className="font-mono text-ink/80">{build.label}</span>
        </p>
      ) : null}

      {state === 'idle' ? (
        <div className="space-y-3">
          <DestinationSearch
            origin={searchOrigin}
            disabled={busy}
            onPick={(place) => {
              setPicked(place);
              setNote(null);
            }}
            onClear={() => setPicked(null)}
          />

          {picked !== null ? (
            <p className="text-xl text-ink">
              Destination: <span className="font-semibold">{picked.title}</span>
              {picked.address ? <span className="text-ink/70"> — {picked.address}</span> : null}
            </p>
          ) : null}

          {/* Developer-only coordinate entry: collapsed, never part of the
              driver flow, kept for bench-testing an exact point. */}
          <details className="text-base text-ink/60">
            <summary className="min-h-16 cursor-pointer text-lg text-ink/70">
              Developer: enter coordinates instead
            </summary>
            <div className="mt-2 space-y-3">
              <label className="block text-lg text-ink/80">
                Destination latitude
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={destLat}
                  onChange={(e) => {
                    setDestLat(e.target.value);
                    setPicked(null);
                  }}
                  aria-label="Destination latitude"
                />
              </label>
              <label className="block text-lg text-ink/80">
                Destination longitude
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={destLng}
                  onChange={(e) => {
                    setDestLng(e.target.value);
                    setPicked(null);
                  }}
                  aria-label="Destination longitude"
                />
              </label>
              <label className="block text-lg text-ink/80">
                Facility type
                <select
                  className={inputClass}
                  value={facility}
                  onChange={(e) => setFacility(e.target.value as DestinationFacility)}
                  aria-label="Destination facility type"
                >
                  {FACILITIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <p className="text-base text-ink/60">
            Truck: pilot default — {DEFAULT_TRUCK_PROFILE.lengthFt} ft,{' '}
            {DEFAULT_TRUCK_PROFILE.heightFt} ft tall,{' '}
            {DEFAULT_TRUCK_PROFILE.grossWeightLbs.toLocaleString()} lbs,{' '}
            {DEFAULT_TRUCK_PROFILE.axles} axles.
          </p>
          <button type="button" className={buttonClass} onClick={() => void planRoute()}>
            {busy ? 'Requesting route…' : 'Plan validated truck route'}
          </button>
        </div>
      ) : null}

      {state === 'planning' ? (
        <p className="text-xl text-ink/80">Requesting a validated truck route…</p>
      ) : null}

      {state === 'route-ready' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">
            Route ready: {lifecycle.view().totalMi?.toFixed(1) ?? '—'} mi. Navigation has not
            started.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.startNavigation(Date.now()))}
          >
            Start navigation
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.discardRoute(Date.now()))}
          >
            Discard route
          </button>
        </div>
      ) : null}

      {state === 'navigating' ||
      state === 'off-route' ||
      state === 'rerouting' ||
      state === 'final-approach' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">Trip active — {state.replace(/-/g, ' ')}.</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.cancel(Date.now()))}
          >
            Cancel trip
          </button>
        </div>
      ) : null}

      {state === 'arrived' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">
            Trip ended: {summary?.endReason ?? 'arrived'} ({summary?.entranceKind ?? 'unknown'}),{' '}
            {summary?.plannedMiles.toFixed(1) ?? '—'} planned miles.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.complete(Date.now()))}
          >
            Complete trip
          </button>
        </div>
      ) : null}

      {state === 'completed' ? (
        <div className="space-y-3">
          <p className="text-xl text-ink">
            Trip completed{summary ? ` (${summary.endReason})` : ''}. Engines released.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => act(() => lifecycle.reset(Date.now()))}
          >
            New trip
          </button>
        </div>
      ) : null}

      {note ? (
        <p role="status" className="text-lg text-ink/80">
          {note}
        </p>
      ) : null}

      {/*
        Road-test report. It lives inside this component, which the
        driving screen already renders inside the stationary-only
        'edit-destination' gate — so it inherits that rail rather than
        inventing a second one. Writing a note at speed is exactly what
        doc 06 locks.

        The report is always SHOWN as well as copied: the clipboard API
        is unavailable on insecure origins and refused by some mobile
        browsers outside a trusted gesture, and a button that silently
        does nothing is worse than no button. Showing it also means the
        driver can read what they are about to send before they send it.
      */}
      {buildReport ? (
        <details className="text-base text-ink/70">
          <summary className="min-h-16 cursor-pointer text-lg text-ink/80">
            Report a navigation problem
          </summary>

          {/* The category is a tap and the note is optional, in that order.
              A triager reads the category first, and a driver at the end of
              a shift will pick from a list long after they have stopped
              being willing to type. */}
          <fieldset className="mt-2">
            <legend className="text-lg text-ink/80">What kind of problem was it?</legend>
            <div className="mt-1 space-y-1">
              {PROBLEM_CATEGORIES.map((c) => (
                <label key={c.id} className="flex min-h-16 items-center gap-3 text-lg text-ink">
                  <input
                    type="radio"
                    name="problem-category"
                    value={c.id}
                    checked={reportCategory === c.id}
                    onChange={() => {
                      setReportCategory(c.id);
                      setCopyState(null);
                    }}
                    className="size-6 shrink-0"
                  />
                  <span>
                    {c.label}
                    <span className="block text-base text-ink/60">{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-3 block text-lg text-ink/80" htmlFor="road-test-note">
            Anything to add? (optional, {MAX_NOTE_CHARS} characters)
          </label>
          <textarea
            id="road-test-note"
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            maxLength={MAX_NOTE_CHARS}
            rows={3}
            className="mt-1 w-full rounded-card border border-line bg-transparent p-3 text-lg text-ink"
          />
          <button
            type="button"
            className={`${buttonClass} mt-2`}
            onClick={() => {
              const built = buildProblemReport({
                categoryId: reportCategory,
                note: reportNote,
              });
              if (!built.ok) {
                setCopyState(built.reason);
                return;
              }
              const text = buildReport({ note: '', problem: built.report });
              setReportText(text);
              const clip =
                typeof navigator !== 'undefined' && navigator.clipboard
                  ? navigator.clipboard
                  : null;
              if (clip === null) {
                setCopyState('Clipboard unavailable — select the text below and copy it.');
                return;
              }
              clip.writeText(text).then(
                () => setCopyState('Copied.'),
                () => setCopyState('Copy refused — select the text below and copy it.'),
              );
            }}
          >
            Copy problem report
          </button>
          {copyState ? (
            <p role="status" className="mt-2 text-lg text-ink/80">
              {copyState}
            </p>
          ) : null}
          {reportText ? (
            <textarea
              readOnly
              aria-label="Problem report"
              value={reportText}
              rows={12}
              className="mt-2 w-full rounded-card border border-line bg-transparent p-3 font-mono text-sm text-ink"
            />
          ) : null}
        </details>
      ) : null}

      {debugLog ? (
        <details className="text-base text-ink/60">
          <summary className="min-h-16 cursor-pointer text-lg text-ink/80">
            Pilot debug log ({debugLog.entries().length}
            {debugLog.dropped() > 0 ? `, ${debugLog.dropped()} dropped` : ''})
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {debugLog
              .entries()
              .slice(-30)
              .map((e, i) => (
                <li key={`${e.tMs}-${i}`}>
                  {new Date(e.tMs).toISOString().slice(11, 19)} {e.event}
                  {e.detail ? ` — ${e.detail}` : ''}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

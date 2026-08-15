'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlannerAnchor } from '@/lib/trip-planner/directory-loader';
import type { PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import { PlanResults } from './PlanResults';
import {
  PLAN_MY_DAY_DEFAULT_BUFFER_MIN,
  SAFETY_BUFFER_PRESETS,
  SAFETY_BUFFER_EXPLANATION,
  isSafetyBufferPreset,
  type SafetyBufferMin,
} from '@/lib/trip-planner/drive-window';
import { readRegionPrefs, writeRegionPrefs } from '@/components/navigator/region-storage';
import { readTruck } from '@/components/navigator/truck-storage';
import { readClocks } from '@/components/navigator/clocks-storage';
import { remainingToSimpleClocks } from '@/lib/trip-planner/clock-input';
import { countryFromStateCode } from '@/lib/trip-planner/route-region';

/**
 * Plan My Day — the Phase 1 input flow.
 *
 * ONE SOURCE FOR EVERY SAVED THING. Region and units, the confirmed truck
 * and the driver-entered clocks all come from the Navigator's existing
 * storage authorities, read here and never re-implemented. A second truck
 * model or a second clock store would drift, and the drift would be
 * invisible until a driver planned against numbers their Navigator did
 * not agree with.
 *
 * The buffer is the one preference this screen owns, because it is the
 * one the Navigator has no opinion about.
 */

const BUFFER_KEY = 'tlws-planner-buffer-v1';

/** 18px floor and 56px primary targets: read and tapped in a cab. */
const LABEL = 'block text-lg font-semibold text-ink';
const HELP = 'text-base leading-snug text-ink/70';
const FIELD =
  'mt-1 min-h-14 w-full rounded-cockpit border border-line bg-nav-surface px-3 text-lg text-ink';
const CARD = 'rounded-cockpit border border-line bg-nav-surface p-4';

function readBuffer(): SafetyBufferMin {
  if (typeof window === 'undefined') return PLAN_MY_DAY_DEFAULT_BUFFER_MIN;
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    const n = raw === null ? Number.NaN : Number(raw);
    // A corrupt buffer must fail on its own: it can never take the truck
    // or the clocks down with it, so the recommended default stands in.
    return isSafetyBufferPreset(n) ? n : PLAN_MY_DAY_DEFAULT_BUFFER_MIN;
  } catch {
    return PLAN_MY_DAY_DEFAULT_BUFFER_MIN;
  }
}

export function PlanMyDayApp({ anchors }: { anchors: PlannerAnchor[] }) {
  const [bufferMin, setBufferMin] = useState<SafetyBufferMin>(PLAN_MY_DAY_DEFAULT_BUFFER_MIN);
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [plan, setPlan] = useState<PlanMyDay | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [truckLabel, setTruckLabel] = useState('Not confirmed');
  const [clocksLabel, setClocksLabel] = useState('Clocks not set');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');

  /*
   * ONE REQUEST PER PLAN, whatever the thumb does. A driver tapping Plan
   * five times must spend one routing transaction, not five — the guard
   * is a ref rather than the `pending` state because state updates are
   * async and rapid taps land inside the same tick.
   */
  const inFlight = useRef(false);

  useEffect(() => {
    setBufferMin(readBuffer());
    const prefs = readRegionPrefs();
    setUnits(prefs.units);
    const truck = readTruck();
    setTruckLabel(
      truck === null
        ? 'Not confirmed'
        : truck.confirmation.confirmedFingerprint === null
          ? 'Saved, not confirmed'
          : 'Confirmed',
    );
    const clocks = readClocks();
    setClocksLabel(clocks.kind === 'set' ? 'Set' : 'Clocks not set');
  }, []);

  function chooseBuffer(next: SafetyBufferMin) {
    setBufferMin(next);
    try {
      window.localStorage.setItem(BUFFER_KEY, String(next));
    } catch {
      /* a device that cannot persist still plans; the choice just resets */
    }
  }

  async function planDay() {
    if (inFlight.current) return;
    const origin = anchors.find((a) => a.id === originId);
    const destination = anchors.find((a) => a.id === destId);
    if (!origin || !destination) {
      setStatus('Choose where you are starting and where you are going.');
      return;
    }
    inFlight.current = true;
    setPending(true);
    setStatus('Planning your day…');
    try {
      const clocks = readClocks();
      const res = await fetch('/api/trip-planner/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          /*
           * THE ANCHOR'S OWN STATE CODE, PASSED ON AS A CLAIM. It comes
           * off a directory record, so it is attested rather than
           * inferred — which matters most exactly where a latitude rule
           * fails, in the Great Lakes corridor where Windsor sits south
           * of Detroit. An unrecognised code claims nothing and the
           * server falls back to geography.
           */
          origin: {
            label: origin.label,
            position: { lat: origin.lat, lng: origin.lng },
            country: countryFromStateCode(origin.state),
          },
          destination: {
            label: destination.label,
            position: { lat: destination.lat, lng: destination.lng },
            country: countryFromStateCode(destination.state),
          },
          departAtMs: Date.now(),
          /*
           * THE BUFFER THE DRIVER TAPPED, NOT A SERVER DEFAULT. Without
           * this the chips would move a number nothing read, and the
           * results screen would print a buffer the driver never chose.
           */
          bufferMin,
          /*
           * THE CONVERSION IS THE AUTHORITY'S, NOT THIS SCREEN'S. The
           * Navigator stores REMAINING minutes (what an ELD shows); the
           * quote wire wants USED minutes. `remainingToSimpleClocks` owns
           * that translation, and it takes hours — so the stored minutes
           * are divided here and nowhere else. Unset clocks send `{}`,
           * which the schema's defaults read as "nothing entered", and
           * the plan then refuses an HOS-aware answer rather than
           * assuming a fresh shift.
           */
          clocks:
            clocks.kind === 'set'
              ? remainingToSimpleClocks(
                  {
                    drivingLeftH: clocks.entered.drivingMin / 60,
                    windowLeftH: clocks.entered.windowMin / 60,
                    untilBreakLeftH: clocks.entered.untilBreakMin / 60,
                    cycleLeftH: clocks.entered.cycleMin / 60,
                  },
                  clocks.entered.cycleRule,
                )
              : {},
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(json.error?.message ?? 'Could not plan this trip.');
        setPlan(null);
        return;
      }
      setPlan(json.plan ?? null);
      setStatus(null);
    } catch {
      setStatus('Could not reach the planner. Try again.');
      setPlan(null);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-4" data-plan-my-day="">
      {/* ---- 1. region and units ------------------------------------- */}
      <section className={CARD} aria-labelledby="units-heading">
        <h2 id="units-heading" className={LABEL}>
          Region and units
        </h2>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['imperial', 'Miles / lb'],
              ['metric', 'Kilometres / kg'],
            ] as const
          ).map(([u, text]) => (
            <button
              key={u}
              type="button"
              aria-pressed={units === u}
              onClick={() => {
                setUnits(u);
                const prefs = readRegionPrefs();
                writeRegionPrefs({ ...prefs, units: u });
              }}
              className={`min-h-14 flex-1 rounded-cockpit border px-3 text-lg font-semibold ${
                units === u ? 'border-nav-good bg-nav-good text-asphalt' : 'border-line text-ink'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </section>

      {/* ---- 2. the saved truck -------------------------------------- */}
      <section className={CARD} aria-labelledby="truck-heading">
        <h2 id="truck-heading" className={LABEL}>
          Your truck
        </h2>
        <p className={`mt-1 ${HELP}`} data-truck-state="">
          {truckLabel}. Plan My Day uses the same saved profile as the Navigator.
        </p>
        <a
          className="mt-2 inline-block min-h-12 text-lg underline decoration-line underline-offset-4"
          href="/drive"
        >
          Edit truck in Navigator
        </a>
      </section>

      {/* ---- 3 and 4. origin and destination ------------------------- */}
      <section className={CARD} aria-labelledby="route-heading">
        <h2 id="route-heading" className={LABEL}>
          Where you are, and where you are going
        </h2>
        <label className="mt-3 block">
          <span className={LABEL}>Starting from</span>
          <select
            className={FIELD}
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
            aria-label="Starting location"
          >
            <option value="">Choose a starting point</option>
            {anchors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className={LABEL}>Going to</span>
          <select
            className={FIELD}
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            aria-label="Destination"
          >
            <option value="">Choose a destination</option>
            {anchors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* ---- 5. clocks ----------------------------------------------- */}
      <section className={CARD} aria-labelledby="clocks-heading">
        <h2 id="clocks-heading" className={LABEL}>
          Your clocks
        </h2>
        <p className={`mt-1 ${HELP}`} data-clocks-state="">
          {clocksLabel}. Your ELD remains the authoritative record of your hours.
        </p>
        <a
          className="mt-2 inline-block min-h-12 text-lg underline decoration-line underline-offset-4"
          href="/drive"
        >
          Enter or edit clocks in Navigator
        </a>
      </section>

      {/* ---- 6. the safety buffer ------------------------------------ */}
      <section className={CARD} aria-labelledby="buffer-heading">
        <h2 id="buffer-heading" className={LABEL}>
          Safety buffer
        </h2>
        <p className={`mt-1 ${HELP}`}>{SAFETY_BUFFER_EXPLANATION}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAFETY_BUFFER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={bufferMin === preset}
              onClick={() => chooseBuffer(preset)}
              className={`min-h-14 min-w-[4.5rem] flex-1 rounded-cockpit border px-3 text-lg font-semibold ${
                bufferMin === preset
                  ? 'border-nav-good bg-nav-good text-asphalt'
                  : 'border-line text-ink'
              }`}
            >
              {preset} min{preset === PLAN_MY_DAY_DEFAULT_BUFFER_MIN ? ' ★' : ''}
            </button>
          ))}
        </div>
      </section>

      {/* ---- 7. plan -------------------------------------------------- */}
      <button
        type="button"
        onClick={planDay}
        disabled={pending}
        aria-busy={pending}
        className="min-h-[3.5rem] w-full rounded-cockpit bg-nav-good px-4 text-xl font-bold text-asphalt disabled:opacity-60"
        data-plan-button=""
      >
        {pending ? 'Planning…' : 'Plan My Day'}
      </button>
      {status === null ? null : (
        <p role="status" className="text-lg text-ink" data-plan-status="">
          {status}
        </p>
      )}

      {plan === null ? null : <PlanResults plan={plan} />}

      <p className="pt-2">
        <a
          className="inline-block min-h-12 text-lg underline decoration-line underline-offset-4"
          href="/trip-planner/classic"
          data-classic-link=""
        >
          Open Classic Cost Planner
        </a>
      </p>
    </div>
  );
}

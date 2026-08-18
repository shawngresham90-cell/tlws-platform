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
import { countryFromStateCode, type CountryClaim } from '@/lib/trip-planner/route-region';
import { DestinationSearch } from '@/components/navigator/DestinationSearch';
import { TRIP_PLANNER_SEARCH_ENDPOINT } from '@/components/navigator/search-port';
import type { LatLng } from '@/lib/map/bounds';
import type { ParkingChoice } from '@/lib/trip-planner/plan-my-day';
import { PLANNED_STOP_SOURCE_NOTICE, plannedStopFromChoice } from '@/lib/trip-planner/planned-stop';
import { writePlannedStopRecord } from '@/components/navigator/planned-stop-storage';

/**
 * One end of the trip, however the driver arrived at it.
 *
 * A searched place and a directory pick are the same thing to the
 * planner — a label, a position, and a country CLAIM — so they are
 * modelled as one type rather than two branches threaded through the
 * request builder.
 */
type ChosenPlace = {
  label: string;
  position: LatLng;
  /** Attested, never inferred. Null means "say nothing" (see route-region). */
  country: CountryClaim;
  source: 'search' | 'directory';
};

/**
 * One end of the trip: search anywhere, or pick a directory location.
 *
 * WHY BOTH, RATHER THAN A REPLACEMENT. The directory list is the thing
 * TLWS actually knows about — verified truck stops with parking counts —
 * and drivers who want one should not have to type its name. But
 * restricting destinations to that list is what made the Canadian and
 * cross-border paths unreachable through the real screen, because the
 * directory holds US listings only. So the search is the primary input
 * and the directory is a shortcut beside it.
 *
 * THE SEARCH IS THE NAVIGATOR'S, not a second one. `DestinationSearch`
 * brings its own 350 ms debounce, its request coordinator (sequencing,
 * same-query caching, stale-response rejection), the `in=countryCode:`
 * region filter that handles accents, provinces and postal codes, and
 * the candidate model. Only the endpoint differs, because this screen is
 * free and its visitors hold no pilot cookie.
 */
function EndpointPicker({
  testId,
  heading,
  label,
  placeholder,
  ariaLabel,
  anchors,
  chosen,
  onChoose,
  metric,
}: {
  testId: string;
  heading: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  anchors: PlannerAnchor[];
  chosen: ChosenPlace | null;
  onChoose: (place: ChosenPlace | null) => void;
  metric: boolean;
}) {
  const [country, setCountry] = useState<'USA' | 'CAN'>('USA');
  const [showDirectory, setShowDirectory] = useState(false);

  return (
    <div className="mt-4 border-t border-line pt-4 first:mt-3 first:border-0 first:pt-0">
      <h3 className={LABEL}>{heading}</h3>

      {/*
        ONE COUNTRY PER SEARCH, CHOSEN PER END. "Petro" means different
        places on either side of the border, and a cross-border trip needs
        each end asked separately — which is exactly how a driver plans
        Detroit to Windsor.
      */}
      <div className="mt-2 flex gap-2" role="group" aria-label={`${heading}: search country`}>
        {(
          [
            ['USA', 'United States'],
            ['CAN', 'Canada'],
          ] as const
        ).map(([code, text]) => (
          <button
            key={code}
            type="button"
            aria-pressed={country === code}
            data-search-country={`${testId}:${code}`}
            onClick={() => {
              setCountry(code);
              // The old pick belonged to the other country's search.
              onChoose(null);
            }}
            className={`min-h-14 flex-1 rounded-cockpit border px-3 text-lg font-semibold ${
              country === code ? 'border-nav-good bg-nav-good text-asphalt' : 'border-line text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <DestinationSearch
          origin={null}
          country={country}
          metric={metric}
          endpoint={TRIP_PLANNER_SEARCH_ENDPOINT}
          label={label}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          unbiasedNote="Include the city, state or province — results are not sorted by distance."
          testId={testId}
          onPick={(c) =>
            onChoose({
              label: c.title,
              position: c.position,
              // The provider filtered to this country, so the claim is
              // attested by the request that found it.
              country: country === 'CAN' ? 'CA' : 'US',
              source: 'search',
            })
          }
          onClear={() => onChoose(null)}
        />
      </div>

      {/* ---- the directory, as a shortcut rather than a fence -------- */}
      <button
        type="button"
        className="mt-3 min-h-12 text-lg underline decoration-line underline-offset-4"
        aria-expanded={showDirectory}
        data-directory-toggle={testId}
        onClick={() => setShowDirectory((v) => !v)}
      >
        {showDirectory ? 'Hide' : 'Or pick a'} TLWS directory location
      </button>
      {showDirectory ? (
        <label className="mt-2 block">
          <span className="sr-only">{heading} — directory location</span>
          <select
            className={FIELD}
            aria-label={`${heading} — TLWS directory location`}
            data-directory-select={testId}
            value=""
            onChange={(e) => {
              const a = anchors.find((x) => x.id === e.target.value);
              if (a === undefined) return;
              onChoose({
                label: a.label,
                position: { lat: a.lat, lng: a.lng },
                country: countryFromStateCode(a.state),
                source: 'directory',
              });
            }}
          >
            <option value="">Choose a directory location</option>
            {anchors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className={`mt-2 ${HELP}`} data-chosen={testId}>
        {chosen === null ? 'Nothing chosen yet.' : `Chosen: ${chosen.label}`}
      </p>
    </div>
  );
}

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
  const [origin, setOrigin] = useState<ChosenPlace | null>(null);
  const [destination, setDestination] = useState<ChosenPlace | null>(null);
  const [plan, setPlan] = useState<PlanMyDay | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [truckLabel, setTruckLabel] = useState('Not confirmed');
  const [clocksLabel, setClocksLabel] = useState('Clocks not set');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  /**
   * The parking stop handed to the Navigator, if any. Held here rather than
   * read back from storage so the confirmation reflects THIS tap — a read
   * could return a record written by an earlier plan and tell the driver
   * something they did not just do.
   */
  const [sentStopId, setSentStopId] = useState<string | null>(null);

  /**
   * Take one parking choice to the Navigator.
   *
   * `Date.now()` is read HERE, at the moment of the tap, and stamped into the
   * record. That is what the Navigator later measures staleness against, so
   * it has to be the instant the driver chose — not the instant the plan was
   * computed, which may be minutes earlier while they read the options.
   */
  function chooseParking(choice: ParkingChoice): void {
    const stop = plannedStopFromChoice(choice, Date.now());
    if (stop === null) {
      // A candidate with no id or no usable coordinate. Nothing to route to,
      // so the honest response is to say so rather than to write a record the
      // Navigator would refuse on arrival.
      setStatus(
        'That parking record is missing its location, so it cannot be sent to the Navigator.',
      );
      return;
    }
    writePlannedStopRecord(stop);
    setSentStopId(stop.id);
  }

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
    if (origin === null || destination === null) {
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
           * EACH END CARRIES AN ATTESTED COUNTRY, NOT A GUESS.
           *
           * A searched place was found with `in=countryCode:USA|CAN`, so
           * the provider itself filtered to that country — the strongest
           * evidence available. A directory pick carries its listing's
           * own state code. Either way the claim is a fact about the
           * record, which is what makes Windsor–Detroit answerable: no
           * latitude rule separates them, so coordinates alone would
           * leave both ends unplaceable.
           */
          origin: {
            label: origin.label,
            position: origin.position,
            country: origin.country,
          },
          destination: {
            label: destination.label,
            position: destination.position,
            country: destination.country,
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
        <p className={`mt-1 ${HELP}`}>
          Search any address, business, truck stop or city — or pick one of our directory locations.
          Searching costs nothing; no route is planned until you tap Plan My Day.
        </p>

        <EndpointPicker
          testId="origin"
          heading="Starting from"
          label="Where are you starting?"
          placeholder="Address, business, truck stop, or city"
          ariaLabel="Search for a starting location by address, business, truck stop, or city"
          anchors={anchors}
          chosen={origin}
          onChoose={setOrigin}
          metric={units === 'metric'}
        />

        <EndpointPicker
          testId="destination"
          heading="Going to"
          label="Where are you going?"
          placeholder="Address, business, truck stop, or city"
          ariaLabel="Search for a destination by address, business, truck stop, or city"
          anchors={anchors}
          chosen={destination}
          onChoose={setDestination}
          metric={units === 'metric'}
        />
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
        disabled={pending || origin === null || destination === null}
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

      {plan === null ? null : (
        <>
          <PlanResults plan={plan} onChooseParking={chooseParking} chosenParkingId={sentStopId} />
          {sentStopId === null ? null : (
            <section
              className="mt-4 rounded-cockpit border border-signal bg-signal/10 p-4"
              data-planned-stop-sent=""
              aria-live="polite"
            >
              <p className="text-lg font-semibold text-ink">Planned stop saved for the Navigator</p>
              <p className="mt-1 text-base leading-snug text-ink/70">
                {PLANNED_STOP_SOURCE_NOTICE}
              </p>
              <a
                className="mt-3 inline-flex min-h-12 items-center rounded-cockpit border border-signal px-4 text-lg font-semibold text-ink"
                href="/drive"
              >
                Open the Navigator
              </a>
            </section>
          )}
        </>
      )}

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

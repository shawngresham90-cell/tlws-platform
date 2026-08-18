'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlannerAnchor } from '@/lib/trip-planner/directory-loader';
import type { PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import type { TripPlan } from '@/lib/trip-planner/trip-plan';
import { PlanResults } from './PlanResults';
import {
  PLAN_MY_DAY_DEFAULT_BUFFER_MIN,
  SAFETY_BUFFER_PRESETS,
  SAFETY_BUFFER_EXPLANATION,
  VIA_DWELL_PRESETS,
  isSafetyBufferPreset,
  type SafetyBufferMin,
} from '@/lib/trip-planner/drive-window';
import { HOS } from '@/lib/trip-planner/types';
import { readRegionPrefs, writeRegionPrefs } from '@/components/navigator/region-storage';
import { readTruck } from '@/components/navigator/truck-storage';
import { readClocks } from '@/components/navigator/clocks-storage';
import { remainingToSimpleClocks } from '@/lib/trip-planner/clock-input';
import { countryFromStateCode, type CountryClaim } from '@/lib/trip-planner/route-region';
import { DestinationSearch } from '@/components/navigator/DestinationSearch';
import { TRIP_PLANNER_SEARCH_ENDPOINT } from '@/components/navigator/search-port';
import type { LatLng } from '@/lib/map/bounds';
import type { ParkingChoice } from '@/lib/trip-planner/plan-my-day';
import {
  PLANNED_STOP_SOURCE_NOTICE,
  plannedStopFromChoice,
  sharedInputsFingerprint,
} from '@/lib/trip-planner/planned-stop';
import {
  clearPlannedStopRecord,
  writePlannedStopRecord,
} from '@/components/navigator/planned-stop-storage';
import {
  buildResumeRecord,
  readResumeVerdict,
  resumeClocksConfirmable,
  resumeMatchesDestination,
  RESUME_CLOCKS_NOTICE,
  RESUME_NO_ASSUMPTIONS_NOTICE,
  type TripResumeRecord,
} from '@/lib/trip-planner/trip-resume';
import {
  clearTripResumeRecord,
  readTripResumeRecord,
  writeTripResumeRecord,
} from '@/components/navigator/trip-resume-storage';
import { FieldTestPanel } from './FieldTestPanel';
import {
  closeFieldTestSession,
  dwellBucketOf,
  sanitizeScoreComponents,
  setPlanEvidence,
} from '@/lib/trip-planner/field-test';
import {
  readActiveFieldTestSession,
  readFieldTestArmed,
  writeActiveFieldTestSession,
} from '@/components/navigator/field-test-storage';
import { scoreCandidate } from '@/lib/trip-planner/directory-layer';
import { detourBucket } from '@/lib/trip-planner/tpc-analytics';

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
  /**
   * The one optional via stop (TP-2). A point the route is shaped
   * THROUGH — the provider times it as continuous driving — so choosing
   * one never adds rest time, and clearing it is always allowed.
   */
  const [via, setVia] = useState<ChosenPlace | null>(null);
  /**
   * Planned time at the via stop (TP-4), minutes. Zero — the default —
   * means the route just passes through; the planner never adds dwell
   * the driver did not enter.
   */
  const [viaDwellMin, setViaDwellMin] = useState(0);
  /**
   * The driver EXPLICITLY plans the dwell to count as their 30-minute
   * break. Defaults to No, always; duration alone never flips it, and
   * shortening the dwell below 30 minutes clears it (see the setter).
   */
  const [viaDwellCountsAsBreak, setViaDwellCountsAsBreak] = useState(false);

  /** Choose a via — clearing it also clears the dwell that belonged to it. */
  function chooseVia(next: ChosenPlace | null) {
    setVia(next);
    if (next === null) {
      setViaDwellMin(0);
      setViaDwellCountsAsBreak(false);
    }
  }

  /** Choose a dwell preset — a sub-30 dwell can never keep a break claim. */
  function chooseViaDwell(nextMin: number) {
    setViaDwellMin(nextMin);
    if (nextMin < HOS.MIN_BREAK_MIN) setViaDwellCountsAsBreak(false);
  }
  const [plan, setPlan] = useState<PlanMyDay | null>(null);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
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
   * The trip context available to CONTINUE after the driver rests at a
   * planned stop (TP-5). Read once on mount — a stale or malformed record
   * is dropped at the door, fail-soft. `resumeClocksOk` says only whether
   * the stored clocks were entered AFTER the stop was planned; even then,
   * nothing is planned until the driver's explicit tap.
   */
  const [resume, setResume] = useState<TripResumeRecord | null>(null);
  const [resumeClocksOk, setResumeClocksOk] = useState(false);

  /**
   * The clocks and truck this plan was built on, as one comparable string.
   * Read from the same storage the Navigator reads, so both sides compute it
   * from one source rather than from two copies that can drift.
   */
  function currentFingerprint(): string {
    const entry = readClocks();
    const truck = readTruck();
    return sharedInputsFingerprint({
      clocks: entry.kind === 'set' ? entry.entered : null,
      truck: truck === null ? null : truck.profile,
    });
  }

  /*
   * INVALIDATE THE MOMENT AN INPUT MOVES.
   *
   * A stop is an answer to one specific question: given THESE clocks, THIS
   * truck, and THIS origin and destination, where can I legally stop? Change
   * any term and the answer is stale — not in twelve hours, immediately. The
   * TTL is the backstop for the case where nothing observable changed and
   * time simply passed; this is the primary defence.
   *
   * Keyed on a signature of the inputs rather than on the values themselves,
   * so a re-render that produces an equal-but-not-identical object does not
   * throw away a stop the driver just chose. The plan is included: re-planning
   * replaces the answer, so the previous answer must go with it.
   */
  const planningSignature = [
    currentFingerprint(),
    origin === null
      ? 'origin:none'
      : `origin:${origin.position.lat.toFixed(4)},${origin.position.lng.toFixed(4)}`,
    destination === null
      ? 'dest:none'
      : `dest:${destination.position.lat.toFixed(4)},${destination.position.lng.toFixed(4)}`,
    /*
     * THE DWELL AND ITS BREAK CLAIM ARE PLANNING INPUTS (TP-4): a stop
     * chosen against a 0-minute pass-through was NOT qualified against a
     * 60-minute dock stop, so changing either invalidates it exactly as
     * moving the via does (scenarios D12/D13).
     */
    via === null
      ? 'via:none'
      : `via:${via.position.lat.toFixed(4)},${via.position.lng.toFixed(4)}:dwell:${viaDwellMin}:${
          viaDwellCountsAsBreak ? 'break' : 'no-break'
        }`,
    `buffer:${bufferMin}`,
    plan === null ? 'plan:none' : `plan:${plan.parking.map((c) => c.candidate.id).join(',')}`,
  ].join('|');
  const lastSignature = useRef<string | null>(null);
  useEffect(() => {
    // The first pass records the baseline; it must not clear a record the
    // driver may have written on a previous visit to this screen.
    if (lastSignature.current === null) {
      lastSignature.current = planningSignature;
      return;
    }
    if (lastSignature.current === planningSignature) return;
    lastSignature.current = planningSignature;
    clearPlannedStopRecord();
    setSentStopId(null);
  }, [planningSignature]);

  /**
   * Take one parking choice to the Navigator.
   *
   * `Date.now()` is read HERE, at the moment of the tap, and stamped into the
   * record. That is what the Navigator later measures staleness against, so
   * it has to be the instant the driver chose — not the instant the plan was
   * computed, which may be minutes earlier while they read the options.
   */
  function chooseParking(choice: ParkingChoice): void {
    const stop = plannedStopFromChoice(choice, Date.now(), currentFingerprint());
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

    /*
     * PRESERVE THE TRIP CONTEXT PAST THE STOP (TP-5). The handoff record
     * above dies with its 12-hour TTL and carries no destination; this one
     * carries exactly what continuing needs — the stop, the original
     * destination, and any via still ahead of the stop (decided here, once,
     * from the same plan the driver is looking at) — and nothing about the
     * clocks, limits or schedules that the rest will make false. One slot:
     * sending a stop for a different trip replaces the old context (R13).
     */
    const record = buildResumeRecord({
      stop,
      stopCountry: countryFromStateCode(choice.candidate.state),
      destination:
        destination === null
          ? { label: '', position: { lat: 0, lng: 0 }, country: null }
          : {
              label: destination.label,
              position: destination.position,
              country: destination.country,
            },
      via: via === null ? null : { label: via.label, position: via.position, country: via.country },
      viaDwellMin,
      viaDwellQualifiesForBreak: viaDwellMin >= HOS.MIN_BREAK_MIN && viaDwellCountsAsBreak,
      stopRouteMile: Number.isFinite(choice.candidate.routeMile)
        ? choice.candidate.routeMile
        : null,
      viaRouteMile:
        tripPlan !== null && tripPlan.status !== 'unavailable' && tripPlan.legs.length > 1
          ? tripPlan.legs[0].endMile
          : null,
      nowMs: Date.now(),
    });
    if (record === null) {
      // Nothing to continue (no destination, or the stop IS the
      // destination) — and any older trip's context must not linger.
      clearTripResumeRecord();
      setResume(null);
    } else {
      writeTripResumeRecord(record);
      setResume(record);
      setResumeClocksOk(false);
    }

    /*
     * ROAD-TEST EVIDENCE (TP-6), captured only when field-test mode was
     * armed from the pilot Navigator AND a session is live. Everything
     * here is a label, count or bucket read from outputs that already
     * exist — the ranking engine's own component breakdown, the binding
     * rule's NAME, the TPC analytics detour bucket — never a coordinate,
     * never a clock value. The privacy gate at the storage door would
     * refuse anything else anyway; this call simply has nothing hotter
     * to offer it.
     */
    if (readFieldTestArmed()) {
      const fieldSession = readActiveFieldTestSession(Date.now());
      if (fieldSession !== null) {
        const rank =
          plan === null ? 0 : plan.parking.findIndex((c) => c.candidate.id === choice.candidate.id);
        const score = scoreCandidate(choice.candidate, 'overnight');
        const withEvidence = setPlanEvidence(fieldSession, {
          limitedBy: plan?.window?.limitedBy ?? null,
          requiredBreakCount: plan?.window?.requiredBreakCount ?? null,
          chosenRank: rank >= 0 ? rank + 1 : 0,
          alternativesShown: plan?.parking.length ?? 0,
          scoreComponents: sanitizeScoreComponents(score.components),
          scoreTotal: score.total,
          overnightStatus: choice.candidate.overnightStatus ?? null,
          reservable: Boolean(choice.candidate.reservationUrl),
          detourBucket: detourBucket(choice.detourMinutes),
          source: choice.candidate.coordVerificationStatus ?? 'unverified',
          viaDwell: dwellBucketOf(via === null ? 0 : viaDwellMin),
          viaDwellQualifies:
            via !== null && viaDwellMin >= HOS.MIN_BREAK_MIN && viaDwellCountsAsBreak,
        });
        if (withEvidence !== null) writeActiveFieldTestSession(withEvidence, Date.now());
      }
    }
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

    /*
     * A TRIP WAITING TO CONTINUE (TP-5). Offered only while its own
     * 72-hour context freshness holds — a stale record is cleared, never
     * partially trusted. Whether the CLOCKS are fresh is a separate
     * question with a separate answer: they must have been entered after
     * the stop was planned, or the card demands an update first.
     */
    const verdict = readResumeVerdict(readTripResumeRecord(), Date.now());
    if (verdict.ok) {
      setResume(verdict.record);
      setResumeClocksOk(resumeClocksConfirmable(verdict.record, clocks));
    } else if (verdict.problem === 'stale') {
      clearTripResumeRecord();
    }
  }, []);

  function chooseBuffer(next: SafetyBufferMin) {
    setBufferMin(next);
    try {
      window.localStorage.setItem(BUFFER_KEY, String(next));
    } catch {
      /* a device that cannot persist still plans; the choice just resets */
    }
  }

  /** What one quote is planned from — state by default, or a resume's context. */
  type PlanInputs = {
    origin: ChosenPlace;
    destination: ChosenPlace;
    via: ChosenPlace | null;
    viaDwellMin: number;
    viaDwellCountsAsBreak: boolean;
  };

  async function planDay(override?: PlanInputs) {
    if (inFlight.current) return;
    const req: PlanInputs | null =
      override ??
      (origin !== null && destination !== null
        ? { origin, destination, via, viaDwellMin, viaDwellCountsAsBreak }
        : null);
    if (req === null) {
      setStatus('Choose where you are starting and where you are going.');
      return;
    }
    /*
     * PLANNING TOWARD A DIFFERENT DESTINATION IS A NEW TRIP (TP-5, R12).
     * The old trip's resume context must not survive it — otherwise a
     * driver who changed their mind would later be offered a continuation
     * of a trip they abandoned. Continuing the SAME trip (the resume flow
     * itself, or a re-plan to the same destination) keeps the record.
     */
    if (resume !== null && !resumeMatchesDestination(resume, req.destination.position)) {
      clearTripResumeRecord();
      setResume(null);
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
            label: req.origin.label,
            position: req.origin.position,
            country: req.origin.country,
          },
          destination: {
            label: req.destination.label,
            position: req.destination.position,
            country: req.destination.country,
          },
          via:
            req.via === null
              ? null
              : { label: req.via.label, position: req.via.position, country: req.via.country },
          /*
           * PLANNED TIME AT THE VIA (TP-4). Sent only as entered — zero
           * when no via or no dwell — and the break claim is sent only
           * when the dwell can honor it, mirroring the schema's own
           * cross-field rules rather than relying on them.
           */
          viaDwellMin: req.via === null ? 0 : req.viaDwellMin,
          viaDwellQualifiesForBreak:
            req.via !== null && req.viaDwellMin >= HOS.MIN_BREAK_MIN && req.viaDwellCountsAsBreak,
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
        setTripPlan(null);
        return;
      }
      setPlan(json.plan ?? null);
      setTripPlan(json.tripPlan ?? null);
      setStatus(null);
    } catch {
      setStatus('Could not reach the planner. Try again.');
      setPlan(null);
      setTripPlan(null);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  /**
   * Continue the trip from the planned stop (TP-5). Fires ONLY on the
   * driver's explicit tap, and only when the stored clocks were entered
   * after the stop was planned — the tap IS the confirmation that those
   * are their current clocks. The next segment is a brand-new quote: the
   * stop is the new origin exactly as stored (never re-geocoded, never
   * substituted with device location), the original destination and any
   * still-ahead via are retained, and nothing else survives the rest.
   */
  function continueTrip() {
    if (resume === null) return;
    if (!resumeClocksConfirmable(resume, readClocks())) {
      // The store moved backwards since mount (cleared, or another tab).
      setResumeClocksOk(false);
      return;
    }
    // The old handoff belongs to the finished segment — archive it before
    // the next segment exists, so the Navigator can never be routed to a
    // stop the driver already used.
    clearPlannedStopRecord();
    setSentStopId(null);
    const nextOrigin: ChosenPlace = {
      label: resume.plannedStop.label,
      position: resume.plannedStop.position,
      country: resume.plannedStop.country,
      source: 'directory',
    };
    const nextDestination: ChosenPlace = {
      label: resume.originalDestination.label,
      position: resume.originalDestination.position,
      country: resume.originalDestination.country,
      source: 'search',
    };
    const nextVia: ChosenPlace | null =
      resume.remainingVia === null
        ? null
        : {
            label: resume.remainingVia.label,
            position: resume.remainingVia.position,
            country: resume.remainingVia.country,
            source: 'search',
          };
    const nextDwellMin = resume.remainingVia?.dwellMin ?? 0;
    const nextCounts = resume.remainingVia?.dwellQualifiesForBreak ?? false;
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setVia(nextVia);
    setViaDwellMin(nextDwellMin);
    setViaDwellCountsAsBreak(nextCounts);
    // State updates land asynchronously; the quote is issued from the same
    // values explicitly, so it can never read a half-applied screen.
    void planDay({
      origin: nextOrigin,
      destination: nextDestination,
      via: nextVia,
      viaDwellMin: nextDwellMin,
      viaDwellCountsAsBreak: nextCounts,
    });
  }

  /** The driver explicitly ends the trip — its resume context goes with it. */
  function endTrip() {
    clearTripResumeRecord();
    setResume(null);
    // TP-6: explicitly discarding the trip also closes any live road-test
    // session (FT14). Closed, not deleted — the evidence stays reviewable.
    const fieldSession = readActiveFieldTestSession(Date.now());
    if (fieldSession !== null) {
      writeActiveFieldTestSession(closeFieldTestSession(fieldSession, 'cancelled'), Date.now());
    }
  }

  return (
    <div className="mt-6 space-y-4" data-plan-my-day="">
      {/* ---- 0. a trip waiting to continue (TP-5) --------------------- */}
      {/*
        Shown to a RETURNING driver (no plan on screen yet). The card never
        auto-resumes and never auto-enters clocks: continuing takes an
        explicit tap, and the tap is only offered once the clock store
        holds an entry made AFTER the stop was planned.
      */}
      {resume !== null && plan === null ? (
        <section className={CARD} aria-labelledby="resume-heading" data-trip-resume="">
          <h2 id="resume-heading" className="text-xl font-bold text-ink">
            Continue your trip
          </h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className={HELP}>From</dt>
            <dd className={`${LABEL}`} data-resume-from="">
              {resume.plannedStop.label}
            </dd>
            <dt className={HELP}>To</dt>
            <dd className={`${LABEL}`} data-resume-to="">
              {resume.originalDestination.label}
            </dd>
            {resume.remainingVia === null ? null : (
              <>
                <dt className={HELP}>Still ahead</dt>
                <dd className={`${LABEL}`} data-resume-via="">
                  {resume.remainingVia.label}
                  {resume.remainingVia.dwellMin > 0
                    ? ` — planned stop ${resume.remainingVia.dwellMin} min`
                    : ''}
                </dd>
              </>
            )}
          </dl>
          <p className={`mt-2 ${HELP}`} data-resume-clocks-notice="">
            {RESUME_CLOCKS_NOTICE}
          </p>
          <p className={`mt-1 ${HELP}`}>{RESUME_NO_ASSUMPTIONS_NOTICE}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resumeClocksOk ? (
              <button
                type="button"
                data-resume-continue=""
                onClick={continueTrip}
                className="min-h-14 flex-1 rounded-cockpit bg-nav-good px-4 text-lg font-bold text-asphalt"
              >
                Continue with my updated clocks
              </button>
            ) : (
              <a
                href="/drive"
                data-resume-update-clocks=""
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-cockpit border border-signal bg-signal/10 px-4 text-lg font-semibold text-ink"
              >
                Update Clocks &amp; Continue
              </a>
            )}
            <button
              type="button"
              data-resume-end-trip=""
              onClick={endTrip}
              className="min-h-14 rounded-cockpit border border-line px-4 text-lg text-ink"
            >
              End Trip
            </button>
          </div>
        </section>
      ) : null}

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

        <EndpointPicker
          testId="via"
          heading="Optional stop along the way"
          label="Route through a stop (optional)"
          placeholder="Address, business, truck stop, or city"
          ariaLabel="Search for an optional stop the route should pass through"
          anchors={anchors}
          chosen={via}
          onChoose={chooseVia}
          metric={units === 'metric'}
        />
        {via === null ? (
          <p className={`mt-1 ${HELP}`}>
            The route passes through this stop without resting there — your clocks keep running.
          </p>
        ) : (
          <>
            <button
              type="button"
              data-remove-via=""
              onClick={() => chooseVia(null)}
              className="mt-2 min-h-12 rounded-cockpit border border-line px-3 text-lg text-ink"
            >
              Remove the optional stop
            </button>

            {/* ---- planned time at this stop (TP-4) ------------------- */}
            <div className="mt-4">
              <h4 className={LABEL}>Planned time at this stop</h4>
              <p className={`mt-1 ${HELP}`}>
                0 means the route just passes through. Any time you plan here runs your 14-hour
                window down while the truck is stopped — it never adds driving time back.
              </p>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="group"
                aria-label="Planned time at this stop"
              >
                {VIA_DWELL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={viaDwellMin === preset}
                    data-via-dwell-preset={preset}
                    onClick={() => chooseViaDwell(preset)}
                    className={`min-h-14 min-w-[4.5rem] flex-1 rounded-cockpit border px-3 text-lg font-semibold ${
                      viaDwellMin === preset
                        ? 'border-nav-good bg-nav-good text-asphalt'
                        : 'border-line text-ink'
                    }`}
                  >
                    {preset} min
                  </button>
                ))}
              </div>
            </div>

            {/* ---- the break question, only when 30+ minutes ----------- */}
            {viaDwellMin >= HOS.MIN_BREAK_MIN ? (
              <div className="mt-4" data-via-break-question="">
                <h4 className={LABEL}>Will this stop count as your 30-minute break?</h4>
                <p className={`mt-1 ${HELP}`}>
                  Only choose Yes if your ELD duty status will satisfy the break requirement. This
                  planner cannot determine that for you.
                </p>
                <div
                  className="mt-2 flex gap-2"
                  role="group"
                  aria-label="Will this stop count as your 30-minute break?"
                >
                  {(
                    [
                      [false, 'No'],
                      [true, 'Yes'],
                    ] as const
                  ).map(([value, text]) => (
                    <button
                      key={text}
                      type="button"
                      aria-pressed={viaDwellCountsAsBreak === value}
                      data-via-dwell-break={text}
                      onClick={() => setViaDwellCountsAsBreak(value)}
                      className={`min-h-14 flex-1 rounded-cockpit border px-3 text-lg font-semibold ${
                        viaDwellCountsAsBreak === value
                          ? 'border-nav-good bg-nav-good text-asphalt'
                          : 'border-line text-ink'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
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
        onClick={() => planDay()}
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
          <PlanResults
            plan={plan}
            tripPlan={tripPlan}
            onChooseParking={chooseParking}
            chosenParkingId={sentStopId}
          />
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

      {/*
        TP-6: the road-test evidence panel — LAST on the page, after the
        whole planning workflow, so it can never sit between a driver and
        a plan. Renders nothing unless armed from the pilot Navigator.
      */}
      <FieldTestPanel />

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

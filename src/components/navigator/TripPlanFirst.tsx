'use client';

import { useEffect, useState } from 'react';
import {
  PLANNED_STOP_INPUTS_CHANGED_NOTICE,
  PLANNED_STOP_SOURCE_NOTICE,
  PLANNED_STOP_STALE_NOTICE,
  plannedStopToDestination,
  readPlannedStop,
  sharedInputsFingerprint,
  shouldAskTripPlan,
} from '@/lib/trip-planner/planned-stop';
import { readClocks } from './clocks-storage';
import { readTruck } from './truck-storage';
import type { PlannedStop } from '@/lib/trip-planner/planned-stop';
import { clearPlannedStopRecord, readPlannedStopRecord } from './planned-stop-storage';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';

/**
 * The one question asked before a driver starts driving: plan the stops, or
 * just go?
 *
 * ---------------------------------------------------------------------------
 * PLANNING IS OFFERED, NEVER REQUIRED
 *
 * This is a prompt, not a gate. `Just Drive` dismisses it and the parked
 * screen behaves exactly as it always has. Nothing below it is disabled while
 * it is open.
 *
 * ASKED ONCE PER TRIP, NOT ONCE PER DEVICE. The answer is stored against the
 * trip it was given for. It survives a reload of the SAME trip — tapping Just
 * Drive and then refreshing must not re-ask — and it returns when the
 * destination changes, when the trip ends, or when a new one begins. A
 * device-wide dismissal would let this morning's answer decide tonight's run,
 * which is a decision the driver never made.
 *
 * The balance being struck: asking every single time is how a safety prompt
 * becomes something people learn to tap through without reading; never asking
 * again is how it silently stops existing. Per trip is the honest middle.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PLANNED STOP LIVES IN THE SAME COMPONENT
 *
 * Arriving with a plan and being asked whether to make one are the same moment
 * in the driver's day, and they are mutually exclusive. Splitting them across
 * two components would mean two things competing for the top of the parked
 * screen with a rule somewhere else deciding which wins. Here the rule is
 * simply which branch renders.
 *
 * ---------------------------------------------------------------------------
 * A STALE PLAN IS REFUSED OUT LOUD
 *
 * `readPlannedStop` decides; this component only renders the verdict. A plan
 * older than its TTL is not silently dropped — the driver is told why and
 * invited to plan again, because the alternative is a stop quietly vanishing
 * between two screens with no explanation, which reads as a bug and teaches
 * distrust of the whole feature.
 */

/*
 * v2: the answer is now attached to a TRIP rather than to the device. A v1
 * record (a bare device-wide `answered: true`) fails the version check and is
 * ignored, so an old dismissal cannot silently answer for a new trip — which
 * is precisely the behaviour v2 exists to end.
 */
const ASKED_KEY = 'tlws-navigator-trip-plan-asked-v2';
const ASKED_VERSION = 2;

type Asked = { answeredForTrip: string };

function shapeAsked(payload: Record<string, unknown>): Asked | null {
  return typeof payload.answeredForTrip === 'string' && payload.answeredForTrip !== ''
    ? { answeredForTrip: payload.answeredForTrip }
    : null;
}

export function readTripPlanAnswered(): string | null {
  const r = readVersioned<Asked>(ASKED_KEY, ASKED_VERSION, shapeAsked);
  return r.ok ? r.value.answeredForTrip : null;
}

export function writeTripPlanAnswered(tripKey: string): void {
  writeVersioned(ASKED_KEY, ASKED_VERSION, { answeredForTrip: tripKey });
}

export function clearTripPlanAnswered(): void {
  clearVersioned(ASKED_KEY);
}

/**
 * The clocks and truck as they are RIGHT NOW, reduced to the same string the
 * planner stamped into the record. Read here rather than threaded down as
 * props: both live in storage this component can already reach, and a prop
 * chain through the driving screen would be four more places for the two to
 * drift apart.
 */
function currentInputsFingerprint(): string {
  const entry = readClocks();
  const truck = readTruck();
  return sharedInputsFingerprint({
    clocks: entry.kind === 'set' ? entry.entered : null,
    truck: truck === null ? null : truck.profile,
  });
}

const CARD = 'rounded-cockpit border border-line bg-nav-surface p-4';
const BTN =
  'min-h-12 flex-1 rounded-cockpit border border-signal px-4 text-lg font-semibold text-ink';

export function TripPlanFirst({
  onUsePlannedStop,
  tripKey,
}: {
  /** Seed the destination with a stop the Trip Planner already qualified. */
  onUsePlannedStop: (place: DestinationCandidate) => void;
  /**
   * Which trip this is. Derived from the chosen destination, so it moves
   * exactly when the prompt must return: the destination changes, the trip
   * ends, or a new one begins.
   */
  tripKey: string;
}) {
  /**
   * Null until the effect has read storage. Rendering the prompt during that
   * gap would flash a question at a driver who already answered it, and
   * rendering nothing costs one frame nobody can perceive.
   */
  const [ready, setReady] = useState(false);
  const [asked, setAsked] = useState(true);
  const [stop, setStop] = useState<PlannedStop | null>(null);
  /** Why a record was refused, when it was — each gets its own sentence. */
  const [refused, setRefused] = useState<'stale' | 'inputs-changed' | null>(null);

  useEffect(() => {
    const record = readPlannedStopRecord();
    const verdict = readPlannedStop(record, Date.now(), currentInputsFingerprint());
    if (verdict.ok) {
      setStop(verdict.stop);
    } else if (
      record !== null &&
      (verdict.problem === 'stale' || verdict.problem === 'inputs-changed')
    ) {
      // Tell the driver which of the two happened, then drop it so the same
      // dead plan is not re-offered on the next visit.
      setRefused(verdict.problem);
      clearPlannedStopRecord();
    } else if (record !== null) {
      // Malformed beyond use. Nothing the driver can act on, so it goes
      // quietly rather than as an error they cannot fix.
      clearPlannedStopRecord();
    }

    const decision = shouldAskTripPlan(readTripPlanAnswered(), tripKey);
    if (decision.adoptKey !== null) writeTripPlanAnswered(decision.adoptKey);
    setAsked(!decision.ask);
    setReady(true);
    // Re-runs when the trip changes: a new destination is a new trip, and the
    // prompt has to come back for it.
  }, [tripKey]);

  if (!ready) return null;

  /* ---- a live plan is waiting ------------------------------------- */
  if (stop !== null) {
    return (
      <section className={CARD} aria-labelledby="planned-stop-heading" data-planned-stop="">
        <h2 id="planned-stop-heading" className="text-xl font-bold text-ink">
          Your planned stop
        </h2>
        <p className="mt-1 text-xl font-semibold text-ink" data-planned-stop-name="">
          {stop.name}
        </p>
        <p className="mt-1 text-base leading-snug text-ink/70">{PLANNED_STOP_SOURCE_NOTICE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN}
            data-use-planned-stop=""
            onClick={() => {
              onUsePlannedStop(plannedStopToDestination(stop));
              // It has done its job. Keeping it would re-offer a stop the
              // driver is already routing to.
              clearPlannedStopRecord();
              setStop(null);
            }}
          >
            Use this stop
          </button>
          <button
            type="button"
            className={BTN}
            data-discard-planned-stop=""
            onClick={() => {
              clearPlannedStopRecord();
              setStop(null);
            }}
          >
            Not this one
          </button>
        </div>
      </section>
    );
  }

  /* ---- a plan that no longer matches the world it was made in ------- */
  if (refused !== null) {
    return (
      <section
        className={CARD}
        aria-labelledby="stale-plan-heading"
        data-planned-stop-stale={refused}
      >
        <h2 id="stale-plan-heading" className="text-xl font-bold text-ink">
          {refused === 'inputs-changed' ? 'That plan no longer matches' : 'That plan has aged out'}
        </h2>
        <p className="mt-1 text-base leading-snug text-ink/70">
          {refused === 'inputs-changed'
            ? PLANNED_STOP_INPUTS_CHANGED_NOTICE
            : PLANNED_STOP_STALE_NOTICE}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={`${BTN} inline-flex items-center justify-center`} href="/trip-planner">
            Plan My Stops
          </a>
          <button type="button" className={BTN} onClick={() => setRefused(null)}>
            Just Drive
          </button>
        </div>
      </section>
    );
  }

  /* ---- the question, asked once ------------------------------------ */
  if (asked) return null;

  return (
    <section className={CARD} aria-labelledby="trip-plan-first-heading" data-trip-plan-first="">
      <h2 id="trip-plan-first-heading" className="text-xl font-bold text-ink">
        Plan your stops before you drive?
      </h2>
      <p className="mt-1 text-base leading-snug text-ink/70">
        Plan My Stops works out where your hours run out and which truck parking you can still
        reach. You can skip it and set a destination as usual.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {/*
          A plain anchor, not next/link. Every Navigator link to another
          surface is one already: the driving screen renders inside an offline
          harness that has no client runtime, and next/link needs one.
        */}
        <a
          className={`${BTN} inline-flex items-center justify-center`}
          href="/trip-planner"
          data-plan-my-stops=""
          onClick={() => writeTripPlanAnswered(tripKey)}
        >
          Plan My Stops
        </a>
        <button
          type="button"
          className={BTN}
          data-just-drive=""
          onClick={() => {
            // Answered FOR THIS TRIP. It survives a reload of the same trip
            // and returns the moment the destination changes or the trip ends.
            writeTripPlanAnswered(tripKey);
            setAsked(true);
          }}
        >
          Just Drive
        </button>
      </div>
    </section>
  );
}

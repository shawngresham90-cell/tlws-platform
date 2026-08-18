'use client';

import { useEffect, useState } from 'react';
import {
  PLANNED_STOP_SOURCE_NOTICE,
  PLANNED_STOP_STALE_NOTICE,
  plannedStopToDestination,
  readPlannedStop,
} from '@/lib/trip-planner/planned-stop';
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
 * This is a prompt, not a gate. `Just Drive` dismisses it permanently on this
 * device and the parked screen behaves exactly as it always has. Nothing below
 * it is disabled while it is open, and it never reappears once answered —
 * a driver who has said "just drive" once has answered the question, and
 * asking again every trip is how a safety feature becomes something people
 * learn to tap through without reading.
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

const ASKED_KEY = 'tlws-navigator-trip-plan-asked-v1';
const ASKED_VERSION = 1;

type Asked = { answered: boolean };

function shapeAsked(payload: Record<string, unknown>): Asked | null {
  return payload.answered === true ? { answered: true } : null;
}

export function readTripPlanAsked(): boolean {
  return readVersioned<Asked>(ASKED_KEY, ASKED_VERSION, shapeAsked).ok;
}

export function writeTripPlanAsked(): void {
  writeVersioned(ASKED_KEY, ASKED_VERSION, { answered: true });
}

export function clearTripPlanAsked(): void {
  clearVersioned(ASKED_KEY);
}

const CARD = 'rounded-cockpit border border-line bg-nav-surface p-4';
const BTN =
  'min-h-12 flex-1 rounded-cockpit border border-signal px-4 text-lg font-semibold text-ink';

export function TripPlanFirst({
  onUsePlannedStop,
}: {
  /** Seed the destination with a stop the Trip Planner already qualified. */
  onUsePlannedStop: (place: DestinationCandidate) => void;
}) {
  /**
   * Null until the effect has read storage. Rendering the prompt during that
   * gap would flash a question at a driver who already answered it, and
   * rendering nothing costs one frame nobody can perceive.
   */
  const [ready, setReady] = useState(false);
  const [asked, setAsked] = useState(true);
  const [stop, setStop] = useState<PlannedStop | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const record = readPlannedStopRecord();
    const verdict = readPlannedStop(record, Date.now());
    if (verdict.ok) {
      setStop(verdict.stop);
    } else if (record !== null && verdict.problem === 'stale') {
      // Tell the driver, then drop it so the same dead plan is not re-offered
      // on the next visit.
      setStale(true);
      clearPlannedStopRecord();
    } else if (record !== null) {
      // Malformed beyond use. Nothing the driver can act on, so it goes
      // quietly rather than as an error they cannot fix.
      clearPlannedStopRecord();
    }
    setAsked(readTripPlanAsked());
    setReady(true);
  }, []);

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

  /* ---- a plan that outlived its clocks ----------------------------- */
  if (stale) {
    return (
      <section className={CARD} aria-labelledby="stale-plan-heading" data-planned-stop-stale="">
        <h2 id="stale-plan-heading" className="text-xl font-bold text-ink">
          That plan has aged out
        </h2>
        <p className="mt-1 text-base leading-snug text-ink/70">{PLANNED_STOP_STALE_NOTICE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={`${BTN} inline-flex items-center justify-center`} href="/trip-planner">
            Plan My Stops
          </a>
          <button type="button" className={BTN} onClick={() => setStale(false)}>
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
        Trip plan first?
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
          onClick={() => writeTripPlanAsked()}
        >
          Plan My Stops
        </a>
        <button
          type="button"
          className={BTN}
          data-just-drive=""
          onClick={() => {
            writeTripPlanAsked();
            setAsked(true);
          }}
        >
          Just Drive
        </button>
      </div>
    </section>
  );
}

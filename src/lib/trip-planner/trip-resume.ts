import type { LatLng } from '@/lib/map/bounds';
import type { ClockEntryState } from '@/lib/navigator/hos-clocks';
import { HOS } from './types';
import type { PlannedStop } from './planned-stop';

/**
 * Resume-from-planned-stop (TP-5) — the rules half.
 *
 * Pure. No storage, no React, no clock — every timestamp arrives as an
 * argument. The storage half is `components/navigator/trip-resume-storage.ts`
 * and it contains no rules.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS RECORD IS, AND POINTEDLY IS NOT
 *
 * When a driver sends a parking stop to the Navigator, the plan's TRIP
 * CONTEXT — where they were ultimately going, and any stop-along-the-way
 * they had not yet passed — lives only in component state, and dies with
 * the tab. The resume record preserves exactly that context so the driver
 * can come back after their rest, enter their current clocks, and plan
 * the next legal segment from the stop toward the same destination.
 *
 * IT CARRIES NO HOS CONCLUSIONS. No legal limit, no remaining window or
 * cycle, no break schedule, no arrival margin, no parking cutoff, no
 * `limitedBy` — every one of those was true only for the clocks the
 * driver had BEFORE the stop, and the planner cannot know what happened
 * during it: not whether they took 10 hours, not whether they split a
 * berth, not whether a restart completed. So the record stores places and
 * a timestamp, and the next segment is computed from scratch: new origin,
 * retained destination, and clocks the driver enters fresh. Resuming can
 * therefore never resurrect stale arithmetic, because there is none to
 * resurrect.
 *
 * ---------------------------------------------------------------------------
 * WHY ITS FRESHNESS IS SEPARATE FROM THE PLANNED-STOP TTL
 *
 * The 12-hour planned-stop TTL (TP-1) protects a NAVIGATION HANDOFF whose
 * numbers — "arrive by 9:40 with 1h 20m in hand" — decay with the clocks
 * that produced them. The resume record protects TRIP CONTEXT — "I was
 * going to Macon, through Atlanta" — which decays with dispatch reality,
 * not with clocks. Seventy-two hours covers a weekend or a 34-hour
 * restart taken at the stop while staying far inside the Saved Trips
 * store's 90-day ceiling; past it the record fails CLOSED and no
 * continuation is offered. Within it, nothing is assumed: the driver
 * still enters fresh clocks before any plan exists.
 */

/** How long trip context may wait at a stop before a resume isn't offered. */
export const TRIP_RESUME_TTL_MS = 72 * 60 * 60 * 1000;

/** The resume card's one demand, shown verbatim. */
export const RESUME_CLOCKS_NOTICE =
  'Update your current clocks before continuing the HOS-aware plan.';

/** Why the demand exists — the planner does not know what the stop was. */
export const RESUME_NO_ASSUMPTIONS_NOTICE =
  'The planner never assumes what happened while you were stopped — no 10-hour reset, no ' +
  'restart, no duty status. Your entered clocks are the only thing the next plan is built from.';

/**
 * One end of the resumed trip. Deliberately NOT the Saved Trips
 * `PlaceRef`: that shape has no country claim, and the quote schema's
 * endpoints carry one — dropping it here would silently degrade region
 * resolution (weather, cross-border refusals) on exactly the second
 * segment of a long trip, where it matters most.
 */
export type ResumePlace = {
  label: string;
  position: LatLng;
  /** Attested at original entry, carried through. Null means "not stated". */
  country: 'US' | 'CA' | null;
};

export type TripResumeRecord = {
  /** When the parking stop was sent — the moment this context was true. */
  createdAtMs: number;
  /** The stop the driver chose. Its stored position IS the next origin. */
  plannedStop: ResumePlace & { id: string };
  /** Where the trip was always going. */
  originalDestination: ResumePlace;
  /**
   * The one optional via, kept ONLY when it still lay ahead of the chosen
   * stop when the record was written — a passed via is never stored, so a
   * resumed request can never route back through it or re-charge its
   * dwell. Null when there was no via or it was already behind the stop.
   */
  remainingVia:
    | (ResumePlace & {
        /** The driver's planned dwell there, carried forward unchanged. */
        dwellMin: number;
        /** Their explicit break claim for that dwell — never inferred. */
        dwellQualifiesForBreak: boolean;
      })
    | null;
};

/* ------------------------------------------------------------- identity */

/**
 * Same place, by the planner's own convention: coordinates rounded to
 * 1e-4 degrees (~11 m) — the same rounding the planning signature uses,
 * so "the destination changed" means the same thing in both places.
 */
export function samePlace(a: LatLng, b: LatLng): boolean {
  return a.lat.toFixed(4) === b.lat.toFixed(4) && a.lng.toFixed(4) === b.lng.toFixed(4);
}

/* ------------------------------------------------------------- creation */

/**
 * Build the record at the moment a parking stop is sent to the Navigator.
 *
 * Returns null when there is no trip to resume: no destination, or the
 * chosen stop IS the destination (a trip already at its end needs
 * continuing exactly nowhere).
 *
 * THE VIA DECISION HAPPENS HERE, ONCE, from the same plan the driver is
 * looking at: the via survives only when the chosen stop's route mile is
 * strictly before the via's (`stopRouteMile < viaRouteMile`). A stop at
 * or past the via means the via has been (or will have been) passed by
 * the time the driver rests, so the resumed request must not contain it
 * — and its dwell must not be re-charged (scenario R7). Callers without
 * usable mile data pass nulls and the via is DROPPED, because keeping a
 * via we cannot place is how a resumed route doubles back.
 */
export function buildResumeRecord(input: {
  stop: PlannedStop;
  /** The stop's country claim, when the directory attested one. */
  stopCountry: 'US' | 'CA' | null;
  destination: ResumePlace;
  via: ResumePlace | null;
  viaDwellMin: number;
  viaDwellQualifiesForBreak: boolean;
  /** Route miles from the plan the stop was chosen from. */
  stopRouteMile: number | null;
  viaRouteMile: number | null;
  nowMs: number;
}): TripResumeRecord | null {
  const { stop, destination } = input;
  if (destination.label.trim() === '') return null;
  if (samePlace(stop.position, destination.position)) return null;

  const viaAhead =
    input.via !== null &&
    input.stopRouteMile !== null &&
    input.viaRouteMile !== null &&
    Number.isFinite(input.stopRouteMile) &&
    Number.isFinite(input.viaRouteMile) &&
    input.stopRouteMile < input.viaRouteMile;

  return {
    createdAtMs: input.nowMs,
    plannedStop: {
      id: stop.id,
      label: stop.name,
      position: { lat: stop.position.lat, lng: stop.position.lng },
      country: input.stopCountry,
    },
    originalDestination: destination,
    remainingVia:
      viaAhead && input.via !== null
        ? {
            ...input.via,
            dwellMin: input.viaDwellMin,
            // The same rule the engine's normalization gate applies: a
            // claim a sub-30 dwell cannot honor is not carried forward.
            dwellQualifiesForBreak:
              input.viaDwellQualifiesForBreak && input.viaDwellMin >= HOS.MIN_BREAK_MIN,
          }
        : null,
  };
}

/* ------------------------------------------------------------ freshness */

/**
 * Expired, exclusive at the boundary — and a record dated in the FUTURE
 * is stale too, because "the device clock is lying" is not a state in
 * which to offer trip continuation.
 */
export function resumeRecordIsStale(record: TripResumeRecord, nowMs: number): boolean {
  const age = nowMs - record.createdAtMs;
  if (age < 0) return true;
  return age > TRIP_RESUME_TTL_MS;
}

export type ResumeVerdict =
  | { ok: true; record: TripResumeRecord }
  | { ok: false; problem: 'stale' | 'none' };

/** Decide whether a stored record may be offered right now. */
export function readResumeVerdict(record: TripResumeRecord | null, nowMs: number): ResumeVerdict {
  if (record === null) return { ok: false, problem: 'none' };
  if (resumeRecordIsStale(record, nowMs)) return { ok: false, problem: 'stale' };
  return { ok: true, record };
}

/* ------------------------------------------------------ the clock gate */

/**
 * May the driver's stored clocks be offered for CONFIRMATION on the
 * resume card?
 *
 * True only when the clock record was entered strictly AFTER the resume
 * record was created — clocks from before the stop describe a legal
 * standing the rest has made false, and are never presented as a basis
 * for the next segment. Even a true answer is only an OFFER: the quote is
 * issued exclusively by the driver's explicit confirmation tap, so no
 * resumed plan can ever be computed from silently-reused clocks
 * (scenario R4).
 */
export function resumeClocksConfirmable(
  record: TripResumeRecord,
  clocks: ClockEntryState,
): boolean {
  return clocks.kind === 'set' && clocks.enteredAtMs > record.createdAtMs;
}

/* --------------------------------------------------------- invalidation */

/**
 * Does a navigation segment ending at `endedAt` end the whole TRIP?
 *
 * Only arrival at (or an explicit stop while heading to) the ORIGINAL
 * DESTINATION completes the trip and clears the resume context. Ending a
 * segment at the parking stop is the exact moment the resume record
 * exists FOR — clearing it there would delete the trip at the instant it
 * becomes resumable.
 */
export function resumeEndsAtDestination(record: TripResumeRecord, endedAt: LatLng | null): boolean {
  if (endedAt === null) return false;
  return samePlace(endedAt, record.originalDestination.position);
}

/**
 * Is a newly-planned trip THE SAME trip this record belongs to? Planning
 * toward any other destination is a new trip, and the resume context of
 * the old one must not survive it (scenarios R12/R13).
 */
export function resumeMatchesDestination(
  record: TripResumeRecord,
  destination: LatLng | null,
): boolean {
  if (destination === null) return false;
  return samePlace(destination, record.originalDestination.position);
}

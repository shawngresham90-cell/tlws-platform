import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';
import {
  fieldTestRecordProblems,
  fieldTestSessionIsStale,
  NOTE_MAX_CHARS,
  SESSIONS_MAX,
  type FieldObservation,
  type FieldTestSession,
  type PlanEvidence,
} from '@/lib/trip-planner/field-test';

/**
 * Where road-test evidence lives (TP-6). Plumbing only — every rule
 * (enums, scrub gate, caps, expiry, offsets) is in
 * `lib/trip-planner/field-test.ts`; this file stores and returns records
 * and decides nothing.
 *
 * TWO RECORDS, ONE DISCIPLINE:
 *
 *   THE ARM FLAG. Field-test mode is OFF unless this record exists and
 *   says on. It is written only from the pilot-gated Navigator surface —
 *   the public planner renders nothing without it and offers no way to
 *   set it (FT1).
 *
 *   THE SESSIONS. At most one live session plus a short history, capped
 *   and age-expired on every read. EVERY write is refused whole if the
 *   scrub gate finds anything coordinate-, clock-, or identity-shaped in
 *   it (FT15) — the privacy rail runs at the door, not in the caller.
 *
 * Device-local on purpose, like every other planner record: road-test
 * evidence is about one truck on one corridor, and it leaves the device
 * only as the scrubbed plain-text summary the tester copies deliberately.
 */

export const FIELD_TEST_ARM_KEY = 'tlws-field-test-arm-v1';
export const FIELD_TEST_SESSIONS_KEY = 'tlws-field-test-sessions-v1';
export const FIELD_TEST_VERSION = 1;

/* -------------------------------------------------------------- arm flag */

export function readFieldTestArmed(): boolean {
  const stored = readVersioned<boolean>(FIELD_TEST_ARM_KEY, FIELD_TEST_VERSION, (payload) =>
    payload.armed === true ? true : null,
  );
  return stored.ok ? stored.value : false;
}

export function writeFieldTestArmed(armed: boolean): void {
  if (!armed) {
    clearVersioned(FIELD_TEST_ARM_KEY);
    return;
  }
  writeVersioned(FIELD_TEST_ARM_KEY, FIELD_TEST_VERSION, { armed: true });
}

/* -------------------------------------------------------------- sessions */

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function shapeObservation(v: unknown): FieldObservation | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const atOffsetMin = num(o.atOffsetMin);
  const kind = o.kind;
  const value = typeof o.value === 'string' ? o.value.slice(0, NOTE_MAX_CHARS) : '';
  if (atOffsetMin === null || atOffsetMin < 0 || value === '') return null;
  if (
    kind !== 'parking-outcome' &&
    kind !== 'buffer-outcome' &&
    kind !== 'eta-variance' &&
    kind !== 'handoff' &&
    kind !== 'resume' &&
    kind !== 'note'
  ) {
    return null;
  }
  return { atOffsetMin, kind, value };
}

function shapeEvidence(v: unknown): PlanEvidence | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const chosenRank = num(o.chosenRank);
  const alternativesShown = num(o.alternativesShown);
  if (chosenRank === null || alternativesShown === null) return null;
  const componentsRaw = o.scoreComponents;
  let scoreComponents: Record<string, number> | null = null;
  if (typeof componentsRaw === 'object' && componentsRaw !== null) {
    scoreComponents = {};
    for (const [k, val] of Object.entries(componentsRaw as Record<string, unknown>)) {
      const n = num(val);
      if (n !== null) scoreComponents[k] = n;
    }
  }
  return {
    limitedBy:
      o.limitedBy === '11-hour' ||
      o.limitedBy === '14-hour' ||
      o.limitedBy === '30-minute-break' ||
      o.limitedBy === 'cycle'
        ? o.limitedBy
        : null,
    requiredBreakCount: num(o.requiredBreakCount),
    chosenRank,
    alternativesShown,
    scoreComponents,
    scoreTotal: num(o.scoreTotal),
    overnightStatus: typeof o.overnightStatus === 'string' ? o.overnightStatus : null,
    reservable: o.reservable === true,
    detourBucket: typeof o.detourBucket === 'string' ? o.detourBucket : 'unknown',
    source: typeof o.source === 'string' ? o.source : 'unknown',
    viaDwell:
      o.viaDwell === 'none' ||
      o.viaDwell === '<30m' ||
      o.viaDwell === '30-60m' ||
      o.viaDwell === '>60m'
        ? o.viaDwell
        : 'none',
    viaDwellQualifies: o.viaDwellQualifies === true,
  };
}

function shapeSession(v: unknown): FieldTestSession | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const startedAtMs = num(o.startedAtMs);
  if (startedAtMs === null || startedAtMs <= 0) return null;
  const closed =
    o.closed === 'completed' || o.closed === 'cancelled' || o.closed === 'ended' ? o.closed : null;
  const observations = Array.isArray(o.observations)
    ? o.observations.map(shapeObservation).filter((x): x is FieldObservation => x !== null)
    : [];
  return {
    startedAtMs,
    planEvidence: shapeEvidence(o.planEvidence),
    observations,
    closed,
  };
}

function shapeSessions(payload: Record<string, unknown>): FieldTestSession[] | null {
  if (!Array.isArray(payload.sessions)) return null;
  return payload.sessions.map(shapeSession).filter((s): s is FieldTestSession => s !== null);
}

/**
 * Read every stored session, expiring old evidence on the way — a
 * malformed store reads as empty, never as a crash (FT8).
 */
export function readFieldTestSessions(nowMs: number): FieldTestSession[] {
  const stored = readVersioned<FieldTestSession[]>(
    FIELD_TEST_SESSIONS_KEY,
    FIELD_TEST_VERSION,
    shapeSessions,
  );
  if (!stored.ok) return [];
  return stored.value.filter((s) => !fieldTestSessionIsStale(s, nowMs)).slice(-SESSIONS_MAX);
}

/**
 * Persist the session list — REFUSED WHOLE if the scrub gate finds any
 * forbidden shape anywhere in it (FT15). Returns whether the write was
 * accepted, so a caller can tell the tester their note was rejected
 * rather than silently dropping it.
 */
export function writeFieldTestSessions(sessions: FieldTestSession[], nowMs: number): boolean {
  const bounded = sessions.filter((s) => !fieldTestSessionIsStale(s, nowMs)).slice(-SESSIONS_MAX);
  if (fieldTestRecordProblems(bounded).length > 0) return false;
  writeVersioned(FIELD_TEST_SESSIONS_KEY, FIELD_TEST_VERSION, { sessions: bounded });
  return true;
}

/** The live session, if one exists. */
export function readActiveFieldTestSession(nowMs: number): FieldTestSession | null {
  return readFieldTestSessions(nowMs).find((s) => s.closed === null) ?? null;
}

/** Replace the live session in place (or append it). */
export function writeActiveFieldTestSession(session: FieldTestSession, nowMs: number): boolean {
  const rest = readFieldTestSessions(nowMs).filter((s) => s.closed !== null);
  return writeFieldTestSessions([...rest, session], nowMs);
}

/** The obvious delete-everything mechanism: flag and evidence, both gone. */
export function clearAllFieldTestData(): void {
  clearVersioned(FIELD_TEST_ARM_KEY);
  clearVersioned(FIELD_TEST_SESSIONS_KEY);
}

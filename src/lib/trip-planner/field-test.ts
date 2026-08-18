import { scrub } from '@/lib/navigator/road-test-report';
import type { BindingRule } from './drive-window';

/**
 * I-75 road-test field instrumentation (TP-6) — the rules half.
 *
 * Pure. No storage, no React, no clock — every timestamp arrives as an
 * argument. The storage half is `components/navigator/field-test-storage.ts`
 * and it contains no rules.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR, AND POINTEDLY IS NOT
 *
 * TP-1 through TP-5 closed the planning loop against fixtures. This module
 * exists so ONE road tester, in a real truck on I-75, can record whether
 * the planner's predictions matched the road — was the chosen parking
 * usable, did the 60-minute buffer feel right, how far off was the ETA,
 * did the handoff and the resume work — and carry that evidence home for
 * review. It gathers evidence for LATER owner decisions; it never changes
 * production behavior, never touches directory data, and never turns the
 * planner into an ELD or a tracker.
 *
 * ---------------------------------------------------------------------------
 * PRIVACY IS STRUCTURAL, NOT PROMISED
 *
 * Three rails, every one enforced in code rather than convention:
 *
 *   ENUMS, NOT MEASUREMENTS. Every outcome is a fixed category — parking
 *   usable/full/closed, buffer early/right/late, ETA variance in coarse
 *   buckets. A raw minute count, coordinate or clock value has no field
 *   to live in.
 *
 *   THE WRITE-TIME SCRUB GATE. `fieldTestRecordProblems` runs before any
 *   record is persisted and REFUSES anything shaped like a coordinate, a
 *   raw HOS clock, an email, or a phone number — including smuggled into
 *   a free-text note. Notes additionally pass through the Navigator
 *   road-test report's own `scrub` (coordinate + secret redaction), the
 *   same rail that already guards every report leaving a device.
 *
 *   COARSE TIME ONLY. Session start is rounded to the minute; every
 *   observation carries an OFFSET from session start, never a wall-clock
 *   time — the evidence should not double as a movement record.
 *
 * The mode is DISABLED BY DEFAULT and armed only from the pilot-gated
 * Navigator surface — the public planner has no way to switch it on.
 */

/* ------------------------------------------------------------- the enums */

/** What the road tester actually found at the chosen parking stop. */
export const PARKING_OUTCOMES = [
  'available',
  'full',
  'closed',
  'trucks-prohibited',
  'access-difficult',
  'not-found',
  'info-inaccurate',
  'not-tested',
] as const;
export type ParkingOutcome = (typeof PARKING_OUTCOMES)[number];

/** How the 60-minute buffer felt against the real evening. */
export const BUFFER_OUTCOMES = ['too-early', 'about-right', 'too-late'] as const;
export type BufferOutcome = (typeof BUFFER_OUTCOMES)[number];

/** Coarse ETA variance — never a raw minute count. */
export const ETA_VARIANCE_BUCKETS = ['<10m', '10-20m', '20-40m', '>40m'] as const;
export type EtaVarianceBucket = (typeof ETA_VARIANCE_BUCKETS)[number];

/** Did a step work, as the driver judged it. */
export const STEP_OUTCOMES = ['yes', 'no'] as const;
export type StepOutcome = (typeof STEP_OUTCOMES)[number];

/** Planned via dwell, bucketed — the plan input, never a clock. */
export const DWELL_BUCKETS = ['none', '<30m', '30-60m', '>60m'] as const;
export type DwellBucket = (typeof DWELL_BUCKETS)[number];

export function dwellBucketOf(dwellMin: number): DwellBucket {
  if (!Number.isFinite(dwellMin) || dwellMin <= 0) return 'none';
  if (dwellMin < 30) return '<30m';
  if (dwellMin <= 60) return '30-60m';
  return '>60m';
}

/** Notes are short observations, not journals. */
export const NOTE_MAX_CHARS = 280;
export const NOTES_MAX = 20;

/** One active session plus a short history; older evidence expires. */
export const SESSIONS_MAX = 5;
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------- the records */

/**
 * Why the planner chose what it chose, captured from EXISTING outputs at
 * the moment the tester sends a stop to the Navigator. Labels, counts and
 * buckets only — enough to later ask "should this have ranked first?"
 * without recording where anyone was or how many hours they had.
 */
export type PlanEvidence = {
  /** Which rule bounded the day — the label, never the minutes. */
  limitedBy: BindingRule | null;
  /** How many 30-minute breaks the plan charged. */
  requiredBreakCount: number | null;
  /** The chosen stop's position in the ranked list (1 = top). */
  chosenRank: number;
  /** How many qualified choices the screen offered. */
  alternativesShown: number;
  /** The ranking engine's own component breakdown for the chosen stop. */
  scoreComponents: Record<string, number> | null;
  scoreTotal: number | null;
  overnightStatus: string | null;
  reservable: boolean;
  /** Detour, in the TPC analytics module's own coarse buckets. */
  detourBucket: string;
  /** Record provenance label (coordVerificationStatus). */
  source: string;
  viaDwell: DwellBucket;
  viaDwellQualifies: boolean;
};

export type FieldObservation = {
  /** Minutes since session start — an offset, never a wall clock. */
  atOffsetMin: number;
  kind: 'parking-outcome' | 'buffer-outcome' | 'eta-variance' | 'handoff' | 'resume' | 'note';
  /** An enum value for the first five kinds; scrubbed short text for notes. */
  value: string;
};

export type FieldTestSession = {
  /** Rounded to the MINUTE — coarse on purpose. */
  startedAtMs: number;
  planEvidence: PlanEvidence | null;
  observations: FieldObservation[];
  /** Null while live; set when the trip ends or the tester closes it. */
  closed: 'completed' | 'cancelled' | 'ended' | null;
};

/* ------------------------------------------------------------ lifecycle */

export function startFieldTestSession(nowMs: number): FieldTestSession {
  return {
    startedAtMs: Math.floor(nowMs / 60_000) * 60_000,
    planEvidence: null,
    observations: [],
    closed: null,
  };
}

/** Offset in whole minutes from the session's start. Never negative. */
function offsetMin(session: FieldTestSession, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - session.startedAtMs) / 60_000));
}

const ENUM_FOR: Record<Exclude<FieldObservation['kind'], 'note'>, readonly string[]> = {
  'parking-outcome': PARKING_OUTCOMES,
  'buffer-outcome': BUFFER_OUTCOMES,
  'eta-variance': ETA_VARIANCE_BUCKETS,
  handoff: STEP_OUTCOMES,
  resume: STEP_OUTCOMES,
};

/**
 * Record one categorical outcome. An unknown value is REFUSED, never
 * coerced — a road test that stored "45 minutes late" as an ETA bucket
 * would be exactly the raw measurement this module exists to not hold.
 * Re-recording a kind replaces the earlier answer (the tester's latest
 * judgement wins); the observation list stays bounded by construction.
 */
export function recordFieldOutcome(
  session: FieldTestSession,
  kind: Exclude<FieldObservation['kind'], 'note'>,
  value: string,
  nowMs: number,
): FieldTestSession | null {
  if (session.closed !== null) return null;
  if (!ENUM_FOR[kind].includes(value)) return null;
  return {
    ...session,
    observations: [
      ...session.observations.filter((o) => o.kind !== kind),
      { atOffsetMin: offsetMin(session, nowMs), kind, value },
    ],
  };
}

/**
 * Add a short free-text observation. Scrubbed through the SAME rail the
 * Navigator's road-test report uses (coordinates and secret-shaped runs
 * redacted), truncated, and capped in count — oldest notes survive,
 * because the first observations of a failure are usually the honest ones.
 */
export function addFieldNote(
  session: FieldTestSession,
  text: string,
  nowMs: number,
): FieldTestSession | null {
  if (session.closed !== null) return null;
  const cleaned = scrub(text).trim().slice(0, NOTE_MAX_CHARS);
  if (cleaned === '') return null;
  const notes = session.observations.filter((o) => o.kind === 'note');
  if (notes.length >= NOTES_MAX) return null;
  return {
    ...session,
    observations: [
      ...session.observations,
      { atOffsetMin: offsetMin(session, nowMs), kind: 'note', value: cleaned },
    ],
  };
}

/**
 * Attach the plan's own evidence to the live session — captured once,
 * when the tester sends a stop to the Navigator. Re-sending replaces it:
 * the evidence describes the stop the tester is actually heading to.
 */
export function setPlanEvidence(
  session: FieldTestSession,
  evidence: PlanEvidence,
): FieldTestSession | null {
  if (session.closed !== null) return null;
  return { ...session, planEvidence: evidence };
}

export function closeFieldTestSession(
  session: FieldTestSession,
  reason: 'completed' | 'cancelled' | 'ended',
): FieldTestSession {
  return session.closed !== null ? session : { ...session, closed: reason };
}

/** Expired evidence is dropped, never partially trusted. */
export function fieldTestSessionIsStale(session: FieldTestSession, nowMs: number): boolean {
  const age = nowMs - session.startedAtMs;
  if (age < 0) return true;
  return age > SESSION_EXPIRY_MS;
}

/* ----------------------------------------------- the write-time scrub gate */

/*
 * FORBIDDEN SHAPES. A record about to be persisted is checked against
 * these; ANY hit refuses the whole write. Broad on purpose — refusing an
 * over-cautious false positive costs one observation, admitting a false
 * negative stores exactly what this milestone promised never to store.
 */
const FORBIDDEN_KEY_RE =
  /\b(lat|lng|latitude|longitude|position|coordinates?|geometry|drivingMin|windowMin|untilBreakMin|cycleMin|drivingUsedMin|windowElapsedMin|cycleUsedMin|email|phone|address)\b/i;
/** Coordinate-pair-, email- and phone-shaped VALUES, wherever they hide. */
const FORBIDDEN_VALUE_RES: readonly RegExp[] = [
  /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/, // decimal coordinate pair
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email
  /\+?\d[\d\s().-]{9,}\d/, // phone-shaped digit run
];

/**
 * Ranking component keys, renamed where they would collide with the
 * privacy gate's forbidden names. The score component the directory
 * layer calls `coordinates` is a VERIFICATION score, not a coordinate —
 * but the gate refuses by shape, deliberately, so the evidence stores it
 * under a name that cannot be mistaken for one. Any other colliding key
 * a future scorer introduces is DROPPED rather than admitted: losing one
 * score component is cheaper than weakening the gate.
 */
export function sanitizeScoreComponents(
  components: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(components)) {
    const key = k === 'coordinates' ? 'coordVerified' : k;
    if (FORBIDDEN_KEY_RE.test(key)) continue;
    out[key] = v;
  }
  return out;
}

/**
 * Every reason this record may not be stored. Empty means storable. The
 * storage layer calls this before EVERY write, so a future caller cannot
 * add a forbidden field faster than this gate refuses it (FT15).
 */
export function fieldTestRecordProblems(record: unknown): string[] {
  const problems: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      for (const re of FORBIDDEN_VALUE_RES) {
        if (re.test(value)) {
          problems.push(`${path}: value matches a forbidden pattern (${re.source.slice(0, 24)}…)`);
          return;
        }
      }
      return;
    }
    if (typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_RE.test(key)) {
        problems.push(`${path}.${key}: forbidden field name`);
        continue;
      }
      walk(v, `${path}.${key}`);
    }
  };
  walk(record, 'record');
  return problems;
}

/* ------------------------------------------------------------- the report */

/**
 * The copyable evidence summary, assembled with the same conventions as
 * the Navigator's road-test report — offsets not wall clocks, and one
 * final pass through `scrub` on the way out.
 */
export function buildFieldTestSummary(session: FieldTestSession): string {
  const out: string[] = [];
  out.push('TLWS TRIP PLANNER — I-75 FIELD TEST EVIDENCE');
  out.push(`Started: ${new Date(session.startedAtMs).toISOString().slice(0, 16)}Z`);
  out.push(`Status: ${session.closed === null ? 'in progress' : `closed (${session.closed})`}`);
  out.push('');
  out.push('PLAN EVIDENCE (captured when the stop was sent)');
  const e = session.planEvidence;
  if (e === null) {
    out.push('  none captured');
  } else {
    out.push(`  limiting clock: ${e.limitedBy ?? 'unknown'}`);
    out.push(`  breaks charged: ${e.requiredBreakCount ?? 'unknown'}`);
    out.push(`  chosen rank: #${e.chosenRank} of ${e.alternativesShown}`);
    out.push(`  score: ${e.scoreTotal ?? 'unknown'}`);
    if (e.scoreComponents !== null) {
      for (const [k, v] of Object.entries(e.scoreComponents)) out.push(`    ${k}: ${v}`);
    }
    out.push(`  overnight status: ${e.overnightStatus ?? 'unknown'}`);
    out.push(`  reservable: ${e.reservable ? 'yes' : 'no'}`);
    out.push(`  detour: ${e.detourBucket}`);
    out.push(`  record source: ${e.source}`);
    out.push(`  via dwell: ${e.viaDwell}${e.viaDwellQualifies ? ' (marked as break)' : ''}`);
  }
  out.push('');
  out.push(`OBSERVATIONS (${session.observations.length}; times are offsets from start)`);
  if (session.observations.length === 0) {
    out.push('  none yet');
  } else {
    for (const o of session.observations) {
      out.push(`  +${String(o.atOffsetMin).padStart(4, ' ')}m  ${o.kind}: ${o.value}`);
    }
  }
  out.push('');
  return scrub(out.join('\n'));
}

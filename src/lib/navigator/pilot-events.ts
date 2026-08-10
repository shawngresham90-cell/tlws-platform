/**
 * Pilot event schema — what a Navigator session would emit if anyone were
 * listening, and the exact reason nobody is yet.
 *
 * WHAT THIS IS FOR
 *
 * Today the pilot's only evidence is a driver's memory, a plain-text
 * report they chose to send, and a diagnostic snapshot of one instant.
 * The question none of those answer is the sequence one: did the reroute
 * request go out before or after the position degraded? How many searches
 * failed before the driver gave up? Was voice ever unlocked at all? Those
 * are ordering questions, and only a stream answers them.
 *
 * WHY IT IS NOT WIRED TO ANYTHING
 *
 * Persisting a stream needs a store, a retention period, and a decision
 * about what a driver has consented to — three things that are the
 * owner's to decide and none of which are implied by "we should have
 * better logs". So this ships as a SCHEMA, a PORT, and an in-memory
 * implementation, and it stops there. No database, no vendor, no secret,
 * no environment variable, no network call. Wiring it is a separate,
 * deliberate decision documented in the observability memo.
 *
 * PRIVACY IS THE SHAPE, NOT A FILTER
 *
 * The design inverts the usual direction of trust, the same way the
 * diagnostic snapshot does. Instead of collecting what happened and
 * redacting what looks dangerous, an event is an ALLOWLIST: a name, a
 * relative time, a build, three health categories, one enum reason and
 * one bounded count. There is no field for a coordinate, no field for a
 * road name, no field for provider text, and no field for a driver's
 * name. The factory's input type is deliberately narrow, so a future
 * caller cannot pass a provider response "in case it helps" — there is
 * nowhere to put one.
 *
 * Three specific choices are load-bearing:
 *
 *   RELATIVE TIME ONLY. `tSec` is seconds since the session began. An
 *   event stream carrying wall-clock timestamps would publish where a
 *   driver was at 3 a.m. even with no coordinate in it, because a route
 *   and a clock are a location. The road-test report made the same
 *   choice; this matches it rather than inventing a second posture.
 *
 *   NO FREE TEXT, ANYWHERE. Every reason comes from a fixed vocabulary
 *   per event, and an unrecognised one becomes 'other' rather than being
 *   passed through. A free-text field is where a road name, an address,
 *   or a provider error containing a URL eventually ends up.
 *
 *   EVENTS WITH NO VOCABULARY CARRY NO REASON. Not 'other' — null. If a
 *   reason was never designed for an event, supplying one is a caller
 *   error, and the strict answer is to drop it.
 *
 * Pure: every value arrives as an argument, including time. No clock, no
 * I/O, no browser globals, no persistence.
 */

import { shortCommit } from './build-id';

/* ------------------------------------------------------------- vocabulary */

export const PILOT_EVENT_NAMES = Object.freeze([
  'navigator-session-start',
  'pilot-authorized',
  'voice-enabled',
  'voice-unavailable',
  'destination-search-request',
  'destination-search-success',
  'destination-search-failure',
  'route-request',
  'route-ready',
  'route-rejected',
  'navigation-start',
  'off-route-confirmed',
  'reroute-request',
  'reroute-rejected',
  'reroute-ready',
  'reroute-failed',
  'gps-degraded',
  'gps-recovered',
  'provider-unavailable',
  'network-offline',
  'network-recovered',
  'arrival',
  'problem-report-created',
  'feedback-completed',
  'session-expired',
  'fatal-error',
] as const);

export type PilotEventName = (typeof PILOT_EVENT_NAMES)[number];

const NAME_SET: ReadonlySet<string> = new Set(PILOT_EVENT_NAMES);

/**
 * Coarse categories, borrowed verbatim from the diagnostic snapshot rather
 * than redefined here. Two modules describing GPS health with different
 * words would produce a stream and a snapshot that cannot be read side by
 * side, which is the only reason to have either.
 */
export type GpsHealthCategory = 'good' | 'degraded' | 'lost' | 'unavailable' | 'denied';
export type NetworkCategory = 'online' | 'offline' | 'unknown';
export type LifecycleCategory =
  | 'idle'
  | 'planning'
  | 'route-ready'
  | 'navigating'
  | 'off-route'
  | 'rerouting'
  | 'arrived'
  | 'ended'
  | 'unknown';

const GPS: ReadonlySet<string> = new Set(['good', 'degraded', 'lost', 'unavailable', 'denied']);
const NET: ReadonlySet<string> = new Set(['online', 'offline', 'unknown']);
const LIFECYCLE: ReadonlySet<string> = new Set([
  'idle',
  'planning',
  'route-ready',
  'navigating',
  'off-route',
  'rerouting',
  'arrived',
  'ended',
  'unknown',
]);

/**
 * The reason vocabulary, per event. An event absent from this map carries
 * NO reason at all — see the module note.
 *
 * These deliberately mirror enums that already exist in the codebase (the
 * reroute refusals, the provider outcome buckets, the validation
 * verdicts) so a stream reason and a snapshot reason are the same word.
 */
export const EVENT_REASONS: ReadonlyMap<PilotEventName, ReadonlySet<string>> = new Map([
  [
    'destination-search-failure',
    new Set([
      'no-results',
      'bad-input',
      'rate-limited',
      'not-configured',
      'provider-error',
      'provider-timeout',
      'other',
    ]),
  ],
  [
    'route-rejected',
    new Set([
      'no-maneuvers',
      'wrong-destination',
      'implausible-speed',
      'malformed',
      'violation-notice',
      'other',
    ]),
  ],
  [
    'reroute-rejected',
    new Set([
      'unsafe-reversal',
      'rejected-route',
      'duplicate',
      'cooldown',
      'hourly-budget',
      'session-budget',
      'degraded-position',
      'not-confirmed',
      'no-session',
      'other',
    ]),
  ],
  ['reroute-failed', new Set(['provider-failure', 'network', 'stale-dropped', 'other'])],
  [
    'provider-unavailable',
    new Set(['no-key', 'over-cap', 'provider-error', 'malformed-response', 'timeout', 'other']),
  ],
  ['voice-unavailable', new Set(['unsupported', 'not-unlocked', 'muted', 'other'])],
  ['gps-degraded', new Set(['accuracy', 'stale', 'lost', 'denied', 'unavailable', 'other'])],
  ['session-expired', new Set(['token-expired', 'unauthorized', 'other'])],
  [
    'fatal-error',
    new Set(['render', 'lifecycle', 'gps-adapter', 'speech-engine', 'route-parse', 'unknown']),
  ],
]);

/**
 * Counts are bounded. An unbounded counter is a precision leak: "search
 * attempt 1,472" says more about a session than the schema intends to,
 * and no pilot question needs a number that large. Anything past the
 * ceiling saturates.
 */
export const MAX_COUNT = 999;

/* ------------------------------------------------------------------ event */

export type PilotEvent = Readonly<{
  /** Schema version, so an old capture is still readable later. */
  v: 1;
  name: PilotEventName;
  /** Whole seconds since the session began. NEVER wall-clock. */
  tSec: number;
  /** Seven hex characters, or 'unknown'. Never anything else. */
  build: string;
  lifecycle: LifecycleCategory;
  gps: GpsHealthCategory;
  network: NetworkCategory;
  /** From this event's vocabulary, or null when it has none. */
  reason: string | null;
  /** Bounded, or null. */
  count: number | null;
}>;

export type PilotEventInput = {
  name: string;
  /** Seconds since session start. Negative and non-finite floor to 0. */
  tSec: number;
  /** A commit ref. Whitelisted to seven hex characters or 'unknown'. */
  build?: string | null;
  lifecycle?: string | null;
  gps?: string | null;
  network?: string | null;
  reason?: string | null;
  count?: number | null;
};

function boundedCount(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.min(MAX_COUNT, Math.max(0, Math.floor(raw)));
}

function seconds(raw: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function fromSet<T extends string>(
  raw: string | null | undefined,
  allowed: ReadonlySet<string>,
  fallback: T,
): T {
  if (typeof raw !== 'string') return fallback;
  return allowed.has(raw) ? (raw as T) : fallback;
}

/**
 * Build an event, or null when the name is not one this schema knows.
 *
 * Returning null rather than coercing to a catch-all is deliberate: an
 * unrecognised event name means a caller and this schema disagree about
 * what happened, and inventing an 'unknown-event' row would bury that
 * disagreement inside data that looks fine.
 */
export function pilotEvent(input: PilotEventInput): PilotEvent | null {
  if (typeof input?.name !== 'string' || !NAME_SET.has(input.name)) return null;
  const name = input.name as PilotEventName;

  const vocabulary = EVENT_REASONS.get(name);
  const reason =
    vocabulary === undefined
      ? null
      : typeof input.reason === 'string' && vocabulary.has(input.reason)
        ? input.reason
        : input.reason === null || input.reason === undefined
          ? null
          : 'other';

  return Object.freeze({
    v: 1 as const,
    name,
    tSec: seconds(input.tSec),
    build: shortCommit(input.build),
    lifecycle: fromSet<LifecycleCategory>(input.lifecycle, LIFECYCLE, 'unknown'),
    gps: fromSet<GpsHealthCategory>(input.gps, GPS, 'unavailable'),
    network: fromSet<NetworkCategory>(input.network, NET, 'unknown'),
    reason,
    count: boundedCount(input.count),
  });
}

/* ---------------------------------------------------------- privacy gate */

/**
 * Shapes that must never appear in an event, checked on the way OUT as
 * well as being structurally impossible on the way in.
 *
 * The schema already makes these unreachable — there is no field a
 * coordinate could occupy. This is the belt to that braces: a future
 * field added without thinking gets caught by a test rather than by a
 * driver reading their own latitude out of a pasted report.
 */
const FORBIDDEN: readonly { what: string; re: RegExp }[] = Object.freeze([
  { what: 'a coordinate', re: /-?\d{1,3}\.\d{4,}/ },
  { what: 'a secret-shaped value', re: /\b[A-Za-z0-9_-]{32,}\b/ },
  {
    what: 'a credential keyword',
    re: /\b(?:api[-_]?key|apikey|password|passwd|secret|token|bearer|authorization|cookie)\b/i,
  },
  { what: 'a url', re: /https?:\/\// },
  { what: 'an email address', re: /[\w.+-]+@[\w-]+\.[\w.]+/ },
]);

export type PrivacyVerdict = Readonly<{ safe: boolean; problems: readonly string[] }>;

/** Does this event carry anything it must not? */
export function checkEventPrivacy(event: PilotEvent): PrivacyVerdict {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(event)) {
    if (typeof value !== 'string') continue;
    for (const { what, re } of FORBIDDEN) {
      if (re.test(value)) problems.push(`${key} contains ${what}`);
    }
  }
  return Object.freeze({ safe: problems.length === 0, problems: Object.freeze(problems) });
}

/* -------------------------------------------------------------- the port */

/**
 * Where events go. An interface, not an implementation, because choosing
 * a destination is the owner's decision and not this module's.
 *
 * A sink may never throw: an observability failure must not become a
 * navigation failure. The in-memory implementation below cannot fail; any
 * future one must swallow its own errors rather than propagate them.
 */
export type PilotEventSink = {
  record(event: PilotEvent): void;
  /** Oldest first. Bounded — the oldest fall off. */
  entries(): readonly PilotEvent[];
  /** How many were discarded to keep the bound. */
  dropped(): number;
};

export const DEFAULT_SINK_MAX = 500;

/**
 * The only implementation in this repository: a bounded ring buffer that
 * lives and dies with the page. It persists nothing, transmits nothing,
 * and reaches no store. It exists so the schema can be exercised and so a
 * session summary can be produced without any owner decision being made
 * first.
 */
export function createMemoryEventSink(maxEntries: number = DEFAULT_SINK_MAX): PilotEventSink {
  const max = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : DEFAULT_SINK_MAX;
  const buffer: PilotEvent[] = [];
  let droppedCount = 0;

  return {
    record(event: PilotEvent): void {
      // A malformed or unsafe event is dropped rather than stored. The
      // count still moves, so a silent drop is visible as a number.
      if (event === null || typeof event !== 'object' || !NAME_SET.has(event.name)) {
        droppedCount += 1;
        return;
      }
      if (!checkEventPrivacy(event).safe) {
        droppedCount += 1;
        return;
      }
      buffer.push(event);
      while (buffer.length > max) {
        buffer.shift();
        droppedCount += 1;
      }
    },
    entries: () => buffer.slice(),
    dropped: () => droppedCount,
  };
}

/* ----------------------------------------------------------- the summary */

export type EventSummary = Readonly<{
  total: number;
  dropped: number;
  /** Event name → how many, ordered by the schema's own name order. */
  counts: Readonly<Record<string, number>>;
  /** Reasons seen, per event, so a pattern is visible without the stream. */
  reasons: Readonly<Record<string, readonly string[]>>;
  /** Seconds from the first event to the last. */
  spanSec: number;
}>;

/**
 * A session reduced to counts — the shape that is useful in a problem
 * report today, with no store behind it. "Four reroute requests, three
 * rejected for unsafe-reversal" is a diagnosis; a stream of 400 rows is
 * a research project.
 */
export function summarizeEvents(sink: PilotEventSink): EventSummary {
  const events = sink.entries();
  const counts: Record<string, number> = {};
  const reasons: Record<string, string[]> = {};
  for (const e of events) {
    counts[e.name] = (counts[e.name] ?? 0) + 1;
    if (e.reason !== null) {
      const list = (reasons[e.name] ??= []);
      if (!list.includes(e.reason)) list.push(e.reason);
    }
  }
  const first = events.length === 0 ? 0 : events[0].tSec;
  const last = events.length === 0 ? 0 : events[events.length - 1].tSec;
  return Object.freeze({
    total: events.length,
    dropped: sink.dropped(),
    counts: Object.freeze(counts),
    reasons: Object.freeze(reasons),
    spanSec: Math.max(0, last - first),
  });
}

/**
 * The summary as report lines, in the same style the road-test report
 * uses, so it can be appended without inventing a second format. Returned
 * as lines rather than a block so the report keeps sole ownership of
 * joining and scrubbing.
 */
export function eventSummaryLines(summary: EventSummary): string[] {
  const out = ['SESSION EVENTS', `  events: ${summary.total} over ${summary.spanSec}s`];
  if (summary.dropped > 0) out.push(`  dropped: ${summary.dropped}`);
  for (const name of PILOT_EVENT_NAMES) {
    const n = summary.counts[name];
    if (n === undefined) continue;
    const why = summary.reasons[name];
    out.push(`  ${name}: ${n}${why === undefined ? '' : ` (${why.join(', ')})`}`);
  }
  return out;
}

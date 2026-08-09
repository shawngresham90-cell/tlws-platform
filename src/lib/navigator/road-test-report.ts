/**
 * Road-test report (Block 2, priorities N and O).
 *
 * After a road test the useful question is "what did the app actually do
 * between mile 12 and mile 14", and the honest answer has to come out of
 * the session that ran — not out of a memory of it, hours later, at a
 * truck stop. This assembles one plain-text report the driver can copy in
 * a single tap and paste into an issue or an email.
 *
 * PRIVACY IS THE POINT OF THIS FILE, not a footnote. A report is the one
 * artifact designed to leave the device, so every rail is applied HERE,
 * on the way out, rather than trusted to have been applied upstream:
 *
 *   - Coordinates are redacted from every line, including the driver's
 *     own note and the user-agent string (AD-7: position is never
 *     persisted or transmitted).
 *   - Anything shaped like a secret — a key, token, password or bearer
 *     value — is redacted, whatever produced it.
 *   - Entry times are OFFSETS from the first entry, never wall clock, so
 *     a pasted report does not also publish where a driver was at 3 a.m.
 *   - The module is given no route geometry, no provider payloads, and
 *     no credentials to begin with; it cannot emit what it never sees.
 *
 * Pure: every input, including the time the report was generated, is an
 * argument. No clock, no browser globals, no I/O.
 */

import { redactCoordinates, type PilotLogEntry, type PilotMode } from './pilot-mode';
import { buildIdLines, type BuildId } from './build-id';
import { problemReportLines, type ProblemReport } from './problem-report';
import type { TripSummary } from './arrival-controller';
import type { VoiceSnapshot } from './voice-guidance';
import type { WakeSnapshot } from './screen-wake';

/**
 * Secret-shaped text. Deliberately broad: a report is pasted into places
 * this code cannot see, so a false positive costs a line of a debug log
 * and a false negative costs a key.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:api[-_]?key|apikey|password|passwd|secret|token|bearer|authorization)\b\s*[:=]?\s*\S+/gi,
  // Long opaque runs: HERE keys, JWTs, session values.
  /\b[A-Za-z0-9_-]{32,}\b/g,
];

/** Every rail, in one place. Everything emitted goes through this. */
export function scrub(text: string): string {
  let out = redactCoordinates(text);
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out;
}

export type RoadTestInput = {
  /** When the report was made. Supplied — this module reads no clock. */
  generatedMs: number;
  /**
   * Which build this happened on. Required, not optional: a report that
   * cannot name its build is a story, and an optional field is one
   * forgetful call site away from producing one.
   */
  build: BuildId;
  pilot: PilotMode;
  lifecycleState: string;
  /** Trip summary when one completed; null while a trip is live. */
  trip: TripSummary | null;
  log: readonly PilotLogEntry[];
  /** Entries the ring buffer dropped — stated, never silently omitted. */
  logDropped: number;
  gps: {
    health: string;
    accuracyM: number | null;
    speedMph: number | null;
    /** Fixes accepted this session, when the caller counts them. */
    fixes?: number | null;
  };
  voice: VoiceSnapshot | null;
  wake: WakeSnapshot | null;
  device: {
    userAgent: string | null;
    viewport: { width: number; height: number } | null;
    online: boolean | null;
  };
  /** Whatever the driver typed. Scrubbed like everything else. */
  note?: string | null;
  /** Set when the driver reported a specific problem rather than a note. */
  problem?: ProblemReport | null;
};

function offset(tMs: number, baseMs: number): string {
  const total = Math.max(0, Math.round((tMs - baseMs) / 100) / 10);
  const mins = Math.floor(total / 60);
  const secs = (total - mins * 60).toFixed(1).padStart(4, '0');
  return `+${String(mins).padStart(2, '0')}:${secs}`;
}

function num(v: number | null | undefined, digits = 1): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'unknown';
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

export function buildRoadTestReport(input: RoadTestInput): string {
  const out: string[] = [];
  out.push('TRUCKING LIFE NAVIGATOR — ROAD TEST REPORT');
  out.push('');
  // ISO to the minute: enough to line a report up against a log book,
  // without publishing a second-accurate movement record.
  out.push(line('Generated', new Date(input.generatedMs).toISOString().slice(0, 16) + 'Z'));
  out.push(line('Pilot mode', input.pilot.active ? 'active' : `inactive (${input.pilot.reason})`));
  out.push(line('Lifecycle state', input.lifecycleState));
  out.push('');

  // Directly under the header, before anything else: the first question
  // asked of any report is "which build?", and it should not need scrolling.
  out.push('BUILD');
  for (const l of buildIdLines(input.build)) out.push(l);
  out.push('');

  if (input.problem != null) {
    for (const l of problemReportLines(input.problem)) out.push(l);
    out.push('');
  }

  out.push('TRIP');
  if (input.trip === null) {
    out.push('  no completed trip in this session');
  } else {
    const t = input.trip;
    out.push(`  ${line('ended', t.endReason)}`);
    out.push(`  ${line('entrance', t.entranceKind)}`);
    out.push(`  ${line('planned miles', num(t.plannedMiles))}`);
    out.push(`  ${line('final route mile', num(t.finalRouteMile))}`);
    out.push(`  ${line('position updates', String(t.observations))}`);
    const durationMs = t.startedMs === null ? null : t.endedMs - t.startedMs;
    out.push(`  ${line('duration (min)', num(durationMs === null ? null : durationMs / 60_000))}`);
  }
  out.push('');

  out.push('DEVICE');
  out.push(`  ${line('user agent', input.device.userAgent ?? 'unknown')}`);
  out.push(
    `  ${line(
      'viewport',
      input.device.viewport === null
        ? 'unknown'
        : `${input.device.viewport.width}x${input.device.viewport.height}`,
    )}`,
  );
  out.push(
    `  ${line('network', input.device.online === null ? 'unknown' : input.device.online ? 'online' : 'OFFLINE')}`,
  );
  out.push('');

  out.push('GPS');
  out.push(`  ${line('health', input.gps.health)}`);
  out.push(`  ${line('accuracy (m)', num(input.gps.accuracyM))}`);
  out.push(`  ${line('speed (mph)', num(input.gps.speedMph))}`);
  if (input.gps.fixes !== undefined && input.gps.fixes !== null) {
    out.push(`  ${line('accepted fixes', String(input.gps.fixes))}`);
  }
  out.push('');

  out.push('VOICE');
  if (input.voice === null) {
    out.push('  not initialised');
  } else {
    const v = input.voice;
    out.push(`  ${line('supported', v.supported ? 'yes' : 'NO')}`);
    out.push(`  ${line('muted', v.muted ? 'yes' : 'no')}`);
    out.push(`  ${line('announcements spoken', String(v.announcedCount))}`);
    out.push(`  ${line('queued now', String(v.queuedIds.length))}`);
  }
  out.push('');

  out.push('SCREEN WAKE');
  if (input.wake === null) {
    out.push('  not initialised');
  } else {
    const w = input.wake;
    out.push(`  ${line('supported', w.supported ? 'yes' : 'NO')}`);
    out.push(`  ${line('held now', w.held ? 'yes' : 'no')}`);
    out.push(`  ${line('locks requested', String(w.requests))}`);
    if (w.lastRefusal !== null) out.push(`  ${line('last refusal', w.lastRefusal)}`);
  }
  out.push('');

  const note = (input.note ?? '').trim();
  if (note !== '') {
    out.push("DRIVER'S NOTE");
    for (const l of note.split('\n')) out.push(`  ${l}`);
    out.push('');
  }

  out.push(
    `EVENT LOG (${input.log.length} entries${input.logDropped > 0 ? `, ${input.logDropped} older entries dropped` : ''})`,
  );
  if (input.log.length === 0) {
    out.push('  empty');
  } else {
    const base = input.log[0].tMs;
    // Times are offsets from the first entry on purpose: a report that
    // travels should not also carry the driver's schedule.
    out.push('  (times are offsets from the first entry)');
    for (const e of input.log) {
      out.push(`  ${offset(e.tMs, base)}  ${e.event}${e.detail === null ? '' : ` — ${e.detail}`}`);
    }
  }
  out.push('');

  return scrub(out.join('\n'));
}

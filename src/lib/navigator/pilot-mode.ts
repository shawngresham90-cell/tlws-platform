/**
 * Pilot Mode configuration (milestone P1 — Navigator Integration & Pilot
 * Readiness). The Navigator's pilot phase runs ONLY behind the existing
 * feature flag AND only away from production hosts — two independent
 * rails, both required:
 *
 *   1. NEXT_PUBLIC_NAVIGATOR_ENABLED must be exactly 'true' (unset in
 *      production, so merged code stays inert — the same flag the /drive
 *      page and the route endpoint already honor).
 *   2. The resolved hostname must NOT be a production host. Even if the
 *      flag were ever set in production by mistake, Pilot Mode refuses to
 *      activate there — preview deployments and local development only.
 *
 * Default-deny throughout: an unknown or unresolved hostname (e.g. the
 * server-render pass, where no location exists) is treated as NOT pilot.
 *
 * The pilot debug log is a bounded ring buffer for road-test debugging.
 * Privacy (AD-7): position must never be persisted or logged — as a hard
 * rail, every detail string is coordinate-redacted before it is stored,
 * so a raw latitude/longitude can never survive into the log.
 *
 * Pure: hostname, flag value, and every timestamp arrive as arguments.
 * No clock, no browser globals, no I/O.
 */

export type PilotModeReason = 'flag-off' | 'unknown-host' | 'production-host' | 'pilot';

export type PilotMode = Readonly<{
  /** True only when BOTH rails pass: flag on AND non-production host. */
  active: boolean;
  /** Debug logging rides with pilot activation — never in production. */
  debugLogging: boolean;
  reason: PilotModeReason;
}>;

/** Hosts where Pilot Mode must NEVER activate, flag or no flag. Any
 *  subdomain of the production domain counts as production. */
export const PRODUCTION_HOST_SUFFIX = 'truckinglifewithshawn.com';

const INACTIVE = (reason: PilotModeReason): PilotMode =>
  Object.freeze({ active: false, debugLogging: false, reason });

export function resolvePilotMode(input: {
  /** The literal value of NEXT_PUBLIC_NAVIGATOR_ENABLED, passed in. */
  flagValue: string | null | undefined;
  /** window.location.hostname, or null when there is no window (SSR). */
  hostname: string | null;
}): PilotMode {
  if (input.flagValue !== 'true') return INACTIVE('flag-off');
  const raw = (input.hostname ?? '').trim().toLowerCase();
  const host = raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw;
  if (host === '') return INACTIVE('unknown-host');
  if (host === PRODUCTION_HOST_SUFFIX || host.endsWith(`.${PRODUCTION_HOST_SUFFIX}`)) {
    return INACTIVE('production-host');
  }
  return Object.freeze({ active: true, debugLogging: true, reason: 'pilot' as const });
}

/* ------------------------------------------------------------ pilot log */

export type PilotLogEntry = Readonly<{
  tMs: number;
  event: string;
  detail: string | null;
}>;

export type PilotLog = {
  record(tMs: number, event: string, detail?: string): void;
  /** Oldest first; bounded — the oldest entries fall off. */
  entries(): readonly PilotLogEntry[];
  /** How many entries have been discarded to keep the bound. */
  dropped(): number;
};

export const PILOT_LOG_MAX_ENTRIES = 500;

/** Redact anything shaped like a coordinate (a signed number with 4+
 *  decimal places). Route miles and speeds round shorter; only raw
 *  positions carry that precision, and they must never reach a log. */
export function redactCoordinates(detail: string): string {
  return detail.replace(/-?\d{1,3}\.\d{4,}/g, '[coord]');
}

export function createPilotLog(maxEntries: number = PILOT_LOG_MAX_ENTRIES): PilotLog {
  const max = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : PILOT_LOG_MAX_ENTRIES;
  const buffer: PilotLogEntry[] = [];
  let droppedCount = 0;

  return {
    record(tMs: number, event: string, detail?: string): void {
      buffer.push(
        Object.freeze({
          tMs,
          event: redactCoordinates(event),
          detail: detail === undefined ? null : redactCoordinates(detail),
        }),
      );
      while (buffer.length > max) {
        buffer.shift();
        droppedCount += 1;
      }
    },
    entries: () => buffer.slice(),
    dropped: () => droppedCount,
  };
}

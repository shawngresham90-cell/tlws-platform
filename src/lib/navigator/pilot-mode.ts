/**
 * Pilot Mode configuration (milestone P1 — Navigator Integration & Pilot
 * Readiness). Two independent rails, both required:
 *
 *   1. NEXT_PUBLIC_NAVIGATOR_ENABLED must be exactly 'true' — the same
 *      flag the /drive page and the route endpoint already honor.
 *   2. The request must carry a VALID PILOT AUTHORIZATION, verified
 *      server-side against NAVIGATOR_PREVIEW_PASSWORD and handed down as
 *      a boolean by the page that already enforced it.
 *
 * THE SECOND RAIL USED TO BE A HOSTNAME CHECK, and that was the defect.
 * Pilot Mode refused to activate on the production domain, so a driver
 * who had entered the correct pilot password on the live site reached the
 * driving screen and was shown the N5 placeholder — "Destination entry
 * unlocks here when routing ships" — with no destination search, no route
 * planning, and no way to tell that they had in fact been let in.
 *
 * A hostname is a PROXY for authorization, and a bad one in both
 * directions: it cannot tell an authorized production pilot from an
 * unauthorized one, and it grants preview visitors pilot status on the
 * strength of a domain name. Replacing it with the real authorization
 * fact makes the rail stricter, not looser — every surface now requires
 * the password rather than only the production ones.
 *
 * Default-deny throughout: authorization is a boolean that must be
 * explicitly `true`. The server-render pass, where nothing is known yet,
 * resolves to NOT pilot.
 *
 * The hostname is still an argument, but it now governs only DEBUG
 * LOGGING: the pilot ring buffer stays a non-production affordance, and
 * an unknown host is treated as production for that purpose.
 *
 * The pilot debug log is a bounded ring buffer for road-test debugging.
 * Privacy (AD-7): position must never be persisted or logged — as a hard
 * rail, every detail string is coordinate-redacted before it is stored,
 * so a raw latitude/longitude can never survive into the log.
 *
 * Pure: hostname, flag value, authorization and every timestamp arrive as
 * arguments. No clock, no browser globals, no I/O, and no secret — this
 * module never sees the password, only the server's verdict on it.
 */

export type PilotModeReason = 'flag-off' | 'unauthorized' | 'pilot';

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

/**
 * True for the production domain and any of its subdomains. Kept only to
 * decide whether the debug ring buffer runs; it no longer gates access.
 * Default-deny: an unknown host counts as production.
 */
export function isProductionHost(hostname: string | null | undefined): boolean {
  const raw = (hostname ?? '').trim().toLowerCase();
  const host = raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw;
  if (host === '') return true;
  return host === PRODUCTION_HOST_SUFFIX || host.endsWith(`.${PRODUCTION_HOST_SUFFIX}`);
}

export function resolvePilotMode(input: {
  /** The literal value of NEXT_PUBLIC_NAVIGATOR_ENABLED, passed in. */
  flagValue: string | null | undefined;
  /**
   * Whether the server verified a valid, unexpired pilot session for this
   * request. Must be exactly `true`; anything else is unauthorized. This
   * module never sees the password — only the verdict.
   */
  authorized?: boolean | null;
  /** window.location.hostname, or null when there is no window (SSR). */
  hostname?: string | null;
}): PilotMode {
  if (input.flagValue !== 'true') return INACTIVE('flag-off');
  if (input.authorized !== true) return INACTIVE('unauthorized');
  return Object.freeze({
    active: true,
    // Debug logging stays a non-production affordance; an authorized
    // production pilot gets the real Navigator, not the ring buffer.
    debugLogging: !isProductionHost(input.hostname ?? null),
    reason: 'pilot' as const,
  });
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

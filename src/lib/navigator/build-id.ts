/**
 * Pilot build identification (pilot-ops priority 2).
 *
 * Every issue a driver reports has to name the exact build it happened on,
 * or the report is a story rather than evidence. This turns whatever the
 * build environment happened to inject into ONE short, safe identifier.
 *
 * The design rule here is that nothing arrives verbatim. Every field is
 * re-derived through a whitelist:
 *
 *   - the commit is accepted only if it LOOKS like a git object id
 *     (hex, 7..40 chars) and is then truncated to seven characters;
 *   - the channel is mapped through a fixed set of known deploy contexts;
 *   - the version is charset-restricted and length-capped;
 *   - the build time must match a UTC ISO shape, and is re-emitted to
 *     the minute from the matched groups rather than reformatted.
 *
 * That inversion is the whole point. A build variable is set by a system
 * this code does not control, and the identifier it produces is shown on
 * screen and pasted into reports. If a variable were ever mis-set to
 * something sensitive, a pass-through would publish it; a whitelist emits
 * `unknown` instead. The safe answer is the default, not the fallback.
 *
 * Pure: every input is an argument. No `process.env` read here, no clock,
 * no browser globals. The call site injects the values.
 */

/** The pilot's own version, independent of the npm package version. */
export const PILOT_VERSION = '2.0';

export type BuildChannel = 'production' | 'preview' | 'branch' | 'local' | 'unknown';

export type BuildIdInput = {
  /** Netlify COMMIT_REF, or any full/short git SHA. */
  commitRef?: string | null;
  /** ISO timestamp stamped when the bundle was built. */
  builtAtIso?: string | null;
  /** Netlify CONTEXT: production | deploy-preview | branch-deploy | dev. */
  context?: string | null;
  /** Overrides PILOT_VERSION when a caller tracks its own. */
  pilotVersion?: string | null;
};

export type BuildId = Readonly<{
  /** Seven hex characters, or 'unknown'. Never anything else. */
  shortSha: string;
  pilotVersion: string;
  /** ISO to the minute (e.g. 2026-08-09T14:30Z), or null. */
  builtAt: string | null;
  channel: BuildChannel;
  /** One line, safe to render and safe to paste into a report. */
  label: string;
}>;

export const UNKNOWN_SHA = 'unknown';

/** Git object ids are hex. Anything else is not a commit and is discarded. */
const SHA_SHAPE = /^[0-9a-f]{7,40}$/i;

/** Versions are digits, dots and dashes. No spaces, no punctuation runs. */
const VERSION_SHAPE = /^[0-9A-Za-z][0-9A-Za-z.\-]{0,15}$/;

const CHANNELS: ReadonlyMap<string, BuildChannel> = new Map([
  ['production', 'production'],
  ['deploy-preview', 'preview'],
  ['branch-deploy', 'branch'],
  ['dev', 'local'],
  ['development', 'local'],
]);

export function shortCommit(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return UNKNOWN_SHA;
  const trimmed = raw.trim();
  if (!SHA_SHAPE.test(trimmed)) return UNKNOWN_SHA;
  return trimmed.slice(0, 7).toLowerCase();
}

export function buildChannel(raw: string | null | undefined): BuildChannel {
  if (typeof raw !== 'string') return 'unknown';
  return CHANNELS.get(raw.trim().toLowerCase()) ?? 'unknown';
}

/**
 * UTC ISO 8601, to the minute. Two deliberate choices.
 *
 * Minute precision: a build time exists to line a report up against a
 * deploy, and seconds add nothing a driver or a triager reads.
 *
 * No `Date`: the navigator core is clock-free by rule, and the ban is
 * enforced on the source rather than on intent — a `Date` here would be
 * parsing an argument, but the next one might not be. Matching the shape
 * is also strictly more predictable, because `Date.parse` of an
 * offset-bearing string would silently shift the value before truncation.
 * A non-UTC stamp is refused rather than mangled; the build pipeline
 * emits `toISOString()`, which is always UTC.
 */
const UTC_ISO_SHAPE =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?Z$/;

export function buildTime(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const m = UTC_ISO_SHAPE.exec(trimmed);
  if (m === null) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}Z`;
}

function version(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return PILOT_VERSION;
  const trimmed = raw.trim();
  return VERSION_SHAPE.test(trimmed) ? trimmed : PILOT_VERSION;
}

export function resolveBuildId(input: BuildIdInput = {}): BuildId {
  const shortSha = shortCommit(input.commitRef);
  const pilotVersion = version(input.pilotVersion);
  const builtAt = buildTime(input.builtAtIso);
  const channel = buildChannel(input.context);

  const parts = [`pilot ${pilotVersion}`, shortSha];
  if (channel !== 'unknown') parts.push(channel);
  if (builtAt !== null) parts.push(builtAt);

  return Object.freeze({
    shortSha,
    pilotVersion,
    builtAt,
    channel,
    label: parts.join(' · '),
  });
}

/**
 * The identifier as report lines. Kept here so the report module and the
 * on-screen strip can never drift into naming the same build differently.
 */
export function buildIdLines(id: BuildId): string[] {
  return [
    `  build: ${id.shortSha}`,
    `  pilot version: ${id.pilotVersion}`,
    `  channel: ${id.channel}`,
    `  built: ${id.builtAt ?? 'unknown'}`,
  ];
}

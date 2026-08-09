/**
 * Structured diagnostic snapshot (pilot-ops priority 1).
 *
 * The road-test report is prose: a driver reads it before sending it, and
 * that is the right shape for a human. It is the wrong shape for the
 * question a triager actually asks, which is "what state was the app in
 * at the moment this went wrong?" — a question with fields, not
 * paragraphs.
 *
 * So this is the same session, captured as data. It reuses the report's
 * privacy posture rather than inventing a second one, and inverts the
 * usual direction of trust: instead of collecting everything and
 * redacting what looks dangerous, the snapshot is an ALLOWLIST of
 * categories. Every field below is either an enum, a bounded number, or a
 * short identifier. Nothing here is free-form provider text, nothing is a
 * coordinate, and nothing is a payload.
 *
 * That distinction is the whole design. A redaction pass can only remove
 * what it recognises; an allowlist cannot emit what it was never given.
 * The builder's input type is deliberately narrow, so a future caller
 * cannot hand it a provider response "just in case it helps" — there is
 * nowhere to put one.
 *
 * WHAT IS DELIBERATELY ABSENT, and why:
 *
 *   - coordinates, and any GPS history. Position is the single most
 *     sensitive thing this app touches. Health is a CATEGORY; the
 *     snapshot never says where the truck is or was.
 *   - API keys, the pilot password, cookies, session tokens. None of
 *     these have a field, and a test asserts the module never names them.
 *   - full provider payloads. The provider result is a category
 *     ('ok' | 'refused' | 'network' | 'provider-error'), never a body.
 *   - road names and instruction text. A maneuver is identified by id
 *     and type, which is what a triager needs to find it in a route.
 *
 * Pure: every value arrives as an argument, including the clock.
 */

export type GpsHealthCategory = 'good' | 'degraded' | 'lost' | 'unavailable' | 'denied';
export type ProviderResultCategory = 'none' | 'ok' | 'refused' | 'network' | 'provider-error';
export type RerouteStateCategory = 'idle' | 'considering' | 'requested' | 'applied' | 'refused';
export type VoiceStateCategory = 'muted' | 'idle' | 'speaking' | 'unsupported';
export type FollowStateCategory = 'following' | 'browsing' | 'overview' | 'unknown';
export type NetworkCategory = 'online' | 'offline' | 'unknown';
export type ValidationCategory = 'not-run' | 'accepted' | 'rejected';

/**
 * A truck profile reduced to the numbers, with no identity attached.
 * Dimensions are not personal data; they are also the first thing a
 * triager needs when a route looks wrong for a truck.
 */
export type TruckSummary = Readonly<{
  heightFt: number;
  widthFt: number;
  lengthFt: number;
  grossWeightLbs: number;
  axles: number;
  hazmat: boolean;
}>;

export type DiagnosticSnapshot = Readonly<{
  /** Schema version, so an old snapshot is still readable later. */
  v: 1;
  /** Opaque build label. Supplied by the caller; never derived here. */
  build: string;
  /** Capture time, ISO to the minute. */
  atIso: string;
  /** Whole minutes since the trip began, or null outside a trip. */
  tripMinutes: number | null;
  navigation: string;
  routeLoaded: boolean;
  routeMiles: number | null;
  remainingMiles: number | null;
  validation: ValidationCategory;
  reroute: RerouteStateCategory;
  rerouteReason: string | null;
  rerouteAttempts: number;
  gps: GpsHealthCategory;
  /** Rounded hard — accuracy is a quality signal, not a measurement. */
  gpsAccuracyM: number | null;
  speedMph: number | null;
  maneuverId: string | null;
  maneuverType: string | null;
  voice: VoiceStateCategory;
  follow: FollowStateCategory;
  provider: ProviderResultCategory;
  hosWarning: boolean;
  network: NetworkCategory;
  truck: TruckSummary | null;
}>;

/** Minute precision, no Date — the navigator core stays clock-free. */
const UTC_ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

function minuteIso(iso: string): string {
  const m = UTC_ISO.exec(iso);
  return m === null ? 'unknown' : `${m[1]}Z`;
}

/** Bounded, rounded number or null. Keeps a stray Infinity out. */
function num(value: number | null | undefined, digits: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Short, safe identifier. Maneuver ids come from the provider, so they
 * are treated as untrusted: charset-restricted and length-capped, which
 * also stops one from smuggling a newline into a text rendering.
 */
const ID_SHAPE = /^[A-Za-z0-9_.:-]{1,40}$/;
function id(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return ID_SHAPE.test(trimmed) ? trimmed : null;
}

export type SnapshotInput = {
  build: string;
  atIso: string;
  tripStartedMs: number | null;
  nowMs: number;
  navigation: string;
  routeLoaded: boolean;
  routeMiles?: number | null;
  remainingMiles?: number | null;
  validation?: ValidationCategory;
  reroute?: RerouteStateCategory;
  rerouteReason?: string | null;
  rerouteAttempts?: number;
  gps: GpsHealthCategory;
  gpsAccuracyM?: number | null;
  speedMph?: number | null;
  maneuverId?: string | null;
  maneuverType?: string | null;
  voice?: VoiceStateCategory;
  follow?: FollowStateCategory;
  provider?: ProviderResultCategory;
  hosWarning?: boolean;
  network?: NetworkCategory;
  truck?: TruckSummary | null;
};

export function buildDiagnosticSnapshot(input: SnapshotInput): DiagnosticSnapshot {
  const tripMinutes =
    input.tripStartedMs === null || !Number.isFinite(input.tripStartedMs)
      ? null
      : Math.max(0, Math.floor((input.nowMs - input.tripStartedMs) / 60_000));

  return Object.freeze({
    v: 1 as const,
    build: input.build,
    atIso: minuteIso(input.atIso),
    tripMinutes,
    navigation: input.navigation,
    routeLoaded: input.routeLoaded === true,
    routeMiles: num(input.routeMiles, 1),
    remainingMiles: num(input.remainingMiles, 1),
    validation: input.validation ?? 'not-run',
    reroute: input.reroute ?? 'idle',
    rerouteReason: id(input.rerouteReason),
    rerouteAttempts: Math.max(0, Math.trunc(input.rerouteAttempts ?? 0)),
    gps: input.gps,
    // Whole metres. Sub-metre accuracy is noise to a triager and starts
    // to look like a measurement of a place rather than of a signal.
    gpsAccuracyM: num(input.gpsAccuracyM, 0),
    speedMph: num(input.speedMph, 0),
    maneuverId: id(input.maneuverId),
    maneuverType: id(input.maneuverType),
    voice: input.voice ?? 'idle',
    follow: input.follow ?? 'unknown',
    provider: input.provider ?? 'none',
    hosWarning: input.hosWarning === true,
    network: input.network ?? 'unknown',
    truck: input.truck ?? null,
  });
}

/**
 * JSON for a triager to paste into an issue. Stable key order via the
 * literal below rather than object iteration order, so two snapshots
 * diff cleanly.
 */
export function snapshotJson(s: DiagnosticSnapshot): string {
  return JSON.stringify(s, null, 2);
}

/** Compact lines, for the plain-text report a driver can read. */
export function snapshotLines(s: DiagnosticSnapshot): string[] {
  const out = [
    'DIAGNOSTIC SNAPSHOT',
    `  build: ${s.build}`,
    `  at: ${s.atIso}`,
    `  trip minutes: ${s.tripMinutes ?? '—'}`,
    `  navigation: ${s.navigation}`,
    `  route: ${s.routeLoaded ? 'loaded' : 'none'} (${s.routeMiles ?? '—'} mi, ${s.remainingMiles ?? '—'} remaining)`,
    `  validation: ${s.validation}`,
    `  reroute: ${s.reroute}${s.rerouteReason === null ? '' : ` (${s.rerouteReason})`} after ${s.rerouteAttempts}`,
    `  gps: ${s.gps} ±${s.gpsAccuracyM ?? '—'} m at ${s.speedMph ?? '—'} mph`,
    `  maneuver: ${s.maneuverType ?? '—'} ${s.maneuverId ?? ''}`.trimEnd(),
    `  voice: ${s.voice} · follow: ${s.follow}`,
    `  provider: ${s.provider} · network: ${s.network}`,
    `  HOS warning: ${s.hosWarning ? 'yes' : 'no'}`,
  ];
  if (s.truck !== null) {
    out.push(
      `  truck: ${s.truck.heightFt}h ${s.truck.widthFt}w ${s.truck.lengthFt}l ft, ${s.truck.grossWeightLbs} lbs, ${s.truck.axles} axles, hazmat ${s.truck.hazmat ? 'yes' : 'no'}`,
    );
  }
  return out;
}

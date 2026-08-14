/**
 * The traffic contract: what the Trip Planner is allowed to SAY about
 * congestion, decided from what the provider actually returned.
 *
 * Pure. No clock, no I/O, no React. Seconds in, a verdict out.
 *
 * WHY THIS EXISTS AS ITS OWN AUTHORITY. "Traffic-aware" is a claim about
 * a legal-adjacent planning number — a driver reads an ETA and decides
 * where they will be when their clock runs out. The difference between
 * "we asked for traffic" and "the provider applied traffic" is the
 * difference between a plan and a guess, and only the second one may be
 * labelled live. Two facts decide it, and they live here rather than in
 * a component:
 *
 *   1. The REQUEST carried a real departure timestamp. `buildHereRouteUrl`
 *      always sends `departureTime=<ISO>`; HERE v8 treats a request with
 *      no departure time, or the literal `any`, as free-flow and excludes
 *      current and predicted traffic entirely. So a plan built from `any`
 *      would be a free-flow estimate wearing a live label.
 *   2. The RESPONSE carried `baseDuration` next to `duration`. HERE
 *      returns the free-flow baseline only when it applied traffic, so
 *      its presence is the provider's own confirmation — not our
 *      inference from having asked nicely.
 *
 * Fact 1 alone is necessary but NOT sufficient, and that asymmetry is the
 * whole point of the module: a request can be perfect and the response
 * still arrive without the evidence, and in that case the driver is told
 * the estimate is not live rather than being shown a confident delay.
 */

/** The literal HERE rejects for an immediate plan — free-flow only. */
export const DEPARTURE_TIME_ANY = 'any';

/** What the screen may claim about the duration it is showing. */
export type TrafficConfidence =
  /** Provider applied traffic and proved it: `baseDuration` was returned. */
  | 'live'
  /** Asked correctly, but the provider returned no free-flow baseline. */
  | 'unconfirmed'
  /** The request itself could not have carried traffic. Never label live. */
  | 'not-requested';

export type TrafficVerdict = {
  confidence: TrafficConfidence;
  /** Traffic-aware seconds — always the number the plan is built from. */
  seconds: number;
  /** Free-flow seconds, or null when the provider did not supply them. */
  baseSeconds: number | null;
  /** seconds − baseSeconds, floored at 0; null when unknowable. */
  delaySeconds: number | null;
  /**
   * The exact sentence a driver reads. A constant per state, because
   * three surfaces must agree on it and "roughly on time" must not drift
   * into "no delays".
   */
  label: string;
};

/* The driver-facing sentences, verbatim. */
export const TRAFFIC_UNAVAILABLE = 'Live traffic unavailable — estimate is not traffic-adjusted.';
export const TRAFFIC_UNCONFIRMED = 'Live traffic unavailable — showing the provider travel time.';
export const TRAFFIC_NO_DELAY = 'Live traffic — no significant delay.';

/**
 * Delay below this is not reported as a number. A provider baseline and a
 * traffic-aware duration differ by rounding on a clear road, and "1 minute
 * of traffic" reads as precision the number does not have.
 */
export const DELAY_REPORTING_FLOOR_S = 120;

/** "12 min" / "1 hr 05 min" — minutes, never seconds, for a driver. */
function delayText(delaySeconds: number): string {
  const totalMin = Math.round(delaySeconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} hr ${String(m).padStart(2, '0')} min`;
}

/**
 * Decide the verdict.
 *
 * `departureTimeParam` is the literal value the request sent — passed in
 * rather than re-derived, so the check is against the wire and not
 * against an assumption about what the builder does.
 */
export function trafficVerdict(input: {
  seconds: number;
  baseSeconds: number | null;
  departureTimeParam: string | null;
}): TrafficVerdict {
  const { seconds, baseSeconds, departureTimeParam } = input;

  // A request with no departure time, or the literal `any`, cannot have
  // carried traffic whatever came back. Checked FIRST so a stray
  // baseDuration on a free-flow response can never be read as live.
  const requestedTraffic =
    typeof departureTimeParam === 'string' &&
    departureTimeParam.length > 0 &&
    departureTimeParam.toLowerCase() !== DEPARTURE_TIME_ANY;

  if (!requestedTraffic) {
    return {
      confidence: 'not-requested',
      seconds,
      baseSeconds: null,
      delaySeconds: null,
      label: TRAFFIC_UNAVAILABLE,
    };
  }

  if (baseSeconds === null || !Number.isFinite(baseSeconds)) {
    return {
      confidence: 'unconfirmed',
      seconds,
      baseSeconds: null,
      delaySeconds: null,
      label: TRAFFIC_UNCONFIRMED,
    };
  }

  const delaySeconds = Math.max(0, seconds - baseSeconds);
  return {
    confidence: 'live',
    seconds,
    baseSeconds,
    delaySeconds,
    label:
      delaySeconds < DELAY_REPORTING_FLOOR_S
        ? TRAFFIC_NO_DELAY
        : `Live traffic — about ${delayText(delaySeconds)} slower than a clear road.`,
  };
}

/**
 * May this duration be presented as traffic-adjusted?
 *
 * The one question every surface should ask instead of reading
 * `confidence` and re-deriving the policy. Only a proven-live response
 * earns the label.
 */
export function mayClaimLiveTraffic(v: TrafficVerdict): boolean {
  return v.confidence === 'live';
}

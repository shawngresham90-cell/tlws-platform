import type { WeatherAlert } from './providers';
import type { RouteTiming } from './route-time-axis';
import type { RouteRegion } from './route-region';

/**
 * Does this alert reach the truck — at the mile it covers, and at the TIME
 * the truck is actually there?
 *
 * Pure. No clock, no I/O, no fetch. Times come in as arguments.
 *
 * WHY TIMING DECIDES THIS. An alert is a claim about a place during a
 * period. Matching only on place turns a warning that expires at noon into
 * a warning for a truck arriving at eight in the evening — and a driver who
 * is shown two alerts that had already lapsed learns to scroll past the
 * third one, which is the one that mattered. So the match is
 * place AND time, and the time has to be right.
 *
 * The existing NWS adapter time-aligns forecasts with a flat
 * AVG_PROGRESS_MPH of 50. That is the same assumed-speed mistake the clock
 * pin and parking eligibility were just moved off: it puts the truck at a
 * segment earlier or later than it will be, and by hours on a long day.
 * This module takes the provider's timing instead, and when there is none
 * it REFUSES rather than falling back — a weather section that silently
 * degrades to guesswork is worse than one that says it cannot say.
 *
 * REGION IS A HARD GATE. NWS covers the United States. A Canadian segment
 * is never matched against a US alert, whatever its coordinates look like,
 * because "no alerts" and "we do not cover this" are different sentences
 * and only one of them is true there.
 */

/** Which authority a set of alerts came from. */
export type AlertSource = 'nws-us' | 'eccc-ca';

export const CANADA_WEATHER_UNAVAILABLE =
  'Canadian route weather alerts are not available in this pilot. Check Environment Canada before you drive.';

/**
 * A crossing is NOT a Canadian route, and saying so would hide the half
 * of the weather that does exist. It is its own answer.
 */
export const CROSS_BORDER_WEATHER_PARTIAL =
  'This route crosses the border. Alerts are only available for the United States portion, so the Canadian stretch is not covered here — check Environment Canada before you drive.';

/**
 * Neither end could be placed in a country. Along the Great Lakes no
 * latitude rule separates Windsor from Detroit, and a feed that covers
 * one but not the other cannot be trusted to speak for a route we cannot
 * locate.
 */
export const ROUTE_COUNTRY_UNDETERMINED =
  'Route weather is not shown because this route could not be placed in a single country with confidence.';

/** Hazards that change how a truck is driven, not how a picnic goes. */
export const TRUCKING_HAZARDS = [
  'winter storm',
  'blizzard',
  'ice',
  'freezing rain',
  'high wind',
  'wind',
  'flood',
  'severe thunderstorm',
  'tornado',
  'dense fog',
  'extreme cold',
  'extreme heat',
] as const;

export type WeatherMatch = {
  alert: WeatherAlert;
  /** When the truck reaches the START of the affected stretch, in ms. */
  reachesAtMs: number;
  /** Worst-case arrival at the same point — the late end of the window. */
  reachesByMs: number;
  /** True when the provider's timing here was coarse. */
  coarse: boolean;
};

export type WeatherRelevance =
  | { ok: true; matches: WeatherMatch[]; region: RouteRegion }
  | {
      ok: false;
      reason: 'timing-unavailable' | 'region-unsupported' | 'cross-border' | 'country-unknown';
      notice: string;
    };

/** Is this headline about something that changes truck operation? */
export function isTruckingHazard(headline: string): boolean {
  const h = headline.toLowerCase();
  return TRUCKING_HAZARDS.some((k) => h.includes(k));
}

/**
 * Match alerts to the drive.
 *
 * `departAtMs` anchors the timeline; every other time is derived from the
 * provider's travel times, never from an assumed speed.
 */
export function relevantWeather(input: {
  alerts: readonly WeatherAlert[];
  timing: RouteTiming;
  departAtMs: number;
  region: RouteRegion;
  source: AlertSource;
}): WeatherRelevance {
  const { alerts, timing, departAtMs, region, source } = input;

  /*
   * REGION FIRST, and before anything else is computed. A US feed has
   * nothing to say about a Canadian road, and saying "no alerts" would be
   * indistinguishable from "clear skies" to the driver reading it.
   *
   * The gate is `fullyUS`, not "is it Canadian". Those differ on exactly
   * the routes that matter: a Detroit-to-Windsor run is not a Canadian
   * route and not a US one, and each of the three refusals below names
   * the situation the driver is actually in rather than flattening all
   * of them into "Canada".
   */
  if (source !== 'nws-us') {
    // A non-NWS feed is not wired in yet; when one is, this gate is where
    // its own coverage question gets asked.
    return { ok: false, reason: 'region-unsupported', notice: CANADA_WEATHER_UNAVAILABLE };
  }
  if (!region.fullyUS) {
    if (region.crossBorder) {
      return { ok: false, reason: 'cross-border', notice: CROSS_BORDER_WEATHER_PARTIAL };
    }
    if (region.origin === 'CA' && region.destination === 'CA') {
      return { ok: false, reason: 'region-unsupported', notice: CANADA_WEATHER_UNAVAILABLE };
    }
    if (region.touchesCanada) {
      // One end provably Canadian, the other unplaceable: still not a
      // route NWS can be said to cover.
      return { ok: false, reason: 'region-unsupported', notice: CANADA_WEATHER_UNAVAILABLE };
    }
    return { ok: false, reason: 'country-unknown', notice: ROUTE_COUNTRY_UNDETERMINED };
  }

  if (timing.kind !== 'provider') {
    return {
      ok: false,
      reason: 'timing-unavailable',
      notice:
        'Route weather could not be timed — the route provider did not return usable travel times.',
    };
  }

  const matches: WeatherMatch[] = [];
  for (const alert of alerts) {
    if (!isTruckingHazard(alert.headline)) continue;

    const window = timing.minutesToMile(alert.fromMile);
    if (window === null) continue; // the alert covers road this route does not

    const reachesAtMs = departAtMs + window.earliestMin * 60_000;
    const reachesByMs = departAtMs + window.latestMin * 60_000;

    /*
     * EXPIRY IS COMPARED AGAINST ARRIVAL, NOT AGAINST NOW. An alert that
     * lapses before the truck can possibly get there is not a warning, it
     * is history. The EARLIEST arrival is used for this test so a wide
     * provider window cannot discard an alert the truck might still meet.
     */
    if (alert.expiresMs !== null && alert.expiresMs <= reachesAtMs) continue;

    matches.push({
      alert,
      reachesAtMs,
      reachesByMs,
      coarse: window.precision === 'coarse',
    });
  }

  matches.sort((a, b) => a.reachesAtMs - b.reachesAtMs);
  return { ok: true, matches, region };
}

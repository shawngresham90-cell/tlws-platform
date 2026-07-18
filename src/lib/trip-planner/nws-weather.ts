import type { RoutePoint } from './directory-layer';
import type { WeatherAlert, WeatherBand, WeatherPort, WeatherSeverity } from './providers';

/**
 * NWS (api.weather.gov) weather adapter (Phase 4). FREE federal service —
 * no key, no billing. All I/O goes through an injected fetch so tests run
 * offline, and every failure path is FAIL-SOFT: a route plan proceeds
 * without weather rather than failing because weather was unavailable.
 * Server-side only — no secret exists at all, and nothing here ships to the
 * client bundle (the API returns processed bands/alerts only).
 */

export type NwsFetch = (
  url: string,
  headers: Record<string, string>,
) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

const NWS_BASE = 'https://api.weather.gov';
/** Overall progress speed (drive + stops) used to time-align forecasts. */
const AVG_PROGRESS_MPH = 50;
/** NWS requires an identifying User-Agent; contact form per their policy. */
const NWS_HEADERS = {
  'User-Agent': 'truckinglifewithshawn.com trip-planner (contact: site owner)',
  Accept: 'application/geo+json',
};

/** Keyword → severity classification for forecast text (pure, testable). */
export function classifyForecastSeverity(text: string): WeatherSeverity {
  const t = text.toLowerCase();
  if (/(blizzard|ice storm|freezing rain|tornado|hurricane|severe thunderstorm)/.test(t)) {
    return 'warning';
  }
  if (/(snow|sleet|ice|thunderstorm|dense fog|high wind|wind gust|flood)/.test(t)) return 'watch';
  if (/(rain|showers|fog|breezy|windy)/.test(t)) return 'advisory';
  return 'none';
}

/** Map an NWS alert severity string to the planner scale (pure). */
export function classifyAlertSeverity(nwsSeverity: string): WeatherSeverity {
  switch (nwsSeverity.toLowerCase()) {
    case 'extreme':
    case 'severe':
      return 'warning';
    case 'moderate':
      return 'watch';
    case 'minor':
      return 'advisory';
    default:
      return 'none';
  }
}

type PointsResponse = { properties?: { forecast?: string } };
type ForecastResponse = {
  properties?: {
    periods?: { startTime?: string; endTime?: string; shortForecast?: string }[];
  };
};
type AlertsResponse = {
  features?: {
    properties?: { headline?: string; severity?: string; expires?: string };
  }[];
};

/** Subsample route points so a long route makes a bounded number of calls. */
export function sampleForWeather(routePoints: RoutePoint[], maxSamples = 4): RoutePoint[] {
  if (routePoints.length <= maxSamples) return routePoints;
  const step = (routePoints.length - 1) / (maxSamples - 1);
  return Array.from({ length: maxSamples }, (_, i) => routePoints[Math.round(i * step)]);
}

/**
 * Live NWS adapter behind the WeatherPort seam. Each sampled point costs at
 * most 3 requests (points → forecast, alerts). Any per-point failure just
 * skips that point.
 */
export function createNwsWeatherPort(fetchFn: NwsFetch): WeatherPort {
  const get = async (url: string): Promise<unknown | null> => {
    try {
      const res = await fetchFn(url, NWS_HEADERS);
      if (res.status !== 200) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  return {
    name: 'nws',
    alongRoute: async (routePoints, departAtMs) => {
      const samples = sampleForWeather(routePoints);
      const totalMiles = routePoints[routePoints.length - 1]?.routeMile ?? 0;
      const halfSpan = samples.length > 1 ? totalMiles / (samples.length - 1) / 2 : totalMiles / 2;

      // All samples run concurrently — 4 sequential samples at 2–3 calls each
      // could otherwise outlast a serverless function budget.
      const perSample = await Promise.all(
        samples.map(async (sample) => {
          const bands: WeatherBand[] = [];
          const alerts: WeatherAlert[] = [];
          const { lat, lng } = sample.position;
          const fromMile = Math.max(0, sample.routeMile - halfSpan);
          const toMile = Math.min(totalMiles, sample.routeMile + halfSpan);
          // Time-align to the estimated arrival at this sample, not departure:
          // weather 300 miles out matters ~6 hours from now, not right now.
          const etaMs = departAtMs + (sample.routeMile / AVG_PROGRESS_MPH) * 3_600_000;

          const points = (await get(
            `${NWS_BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
          )) as PointsResponse | null;
          const forecastUrl = points?.properties?.forecast;
          // The forecast URL comes from a remote response — only follow it
          // back into api.weather.gov, never anywhere else.
          if (forecastUrl && forecastUrl.startsWith(`${NWS_BASE}/`)) {
            const forecast = (await get(forecastUrl)) as ForecastResponse | null;
            const periods = forecast?.properties?.periods ?? [];
            for (const p of periods.slice(0, 14)) {
              const startMs = p.startTime ? Date.parse(p.startTime) : NaN;
              const endMs = p.endTime ? Date.parse(p.endTime) : NaN;
              if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
              if (endMs < etaMs) continue;
              bands.push({
                fromMile,
                toMile,
                fromMs: startMs,
                toMs: endMs,
                summary: p.shortForecast ?? '',
                severity: classifyForecastSeverity(p.shortForecast ?? ''),
              });
              break;
            }
          }

          const alertsRes = (await get(
            `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
          )) as AlertsResponse | null;
          for (const f of alertsRes?.features ?? []) {
            const headline = f.properties?.headline ?? '';
            if (!headline) continue;
            const expires = f.properties?.expires ? Date.parse(f.properties.expires) : NaN;
            alerts.push({
              headline,
              severity: classifyAlertSeverity(f.properties?.severity ?? ''),
              fromMile,
              toMile,
              expiresMs: Number.isFinite(expires) ? expires : null,
            });
          }
          return { bands, alerts };
        }),
      );
      const bands = perSample.flatMap((s) => s.bands);
      const alerts = perSample.flatMap((s) => s.alerts);

      // Dedupe alerts repeated across adjacent samples.
      const seen = new Set<string>();
      const deduped = alerts.filter((a) => {
        if (seen.has(a.headline)) return false;
        seen.add(a.headline);
        return true;
      });
      return { bands, alerts: deduped };
    },
  };
}

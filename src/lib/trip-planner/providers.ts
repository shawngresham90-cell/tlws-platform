import type { LatLng } from '@/lib/map/bounds';
import type { Route, TruckProfile } from './types';

/**
 * Provider adapter interfaces (Phase 3). INTERFACES AND NULL IMPLEMENTATIONS
 * ONLY — no adapter in this file performs network I/O, and no live adapter
 * exists yet. Each port mirrors the shape of its intended provider so a
 * Phase 4+ implementation is a drop-in:
 *
 *   RoutingPort      → HERE Routing API v8 (truck profile)
 *   GeocodingPort    → US Census geocoder (already implemented in
 *                      src/lib/directory/census-geocoder.ts behind
 *                      ExternalGeocoderAdapter; re-exported here)
 *   WeatherPort      → NWS api.weather.gov (free, US)
 *   FuelPricePort    → EIA open data (weekly regional diesel averages)
 *
 * Every port method is async and returns null/empty on "cannot answer" —
 * the planner degrades gracefully instead of failing the whole plan.
 */

export type { ExternalGeocoderAdapter as GeocodingPort } from '@/lib/directory/geocode-pipeline';

/* ----------------------------------------------------------------- routing */

export type RoutingRequest = {
  origin: LatLng;
  destination: LatLng;
  waypoints: LatLng[];
  truck: TruckProfile;
  departAtMs: number;
};

export type RoutingResult = {
  route: Route;
  /** Sampled polyline points with cumulative route-miles (directory layer input). */
  routePoints: { position: LatLng; routeMile: number }[];
  /** Toll total in cents when the provider returns tolls; null = unknown. */
  tollCents: number | null;
  /** Provider attribution for display. */
  provider: string;
};

export type RoutingPort = {
  name: string;
  /** Truck-legal route between points, or null when unroutable/unavailable. */
  route(req: RoutingRequest): Promise<RoutingResult | null>;
};

/** Null routing adapter: proves the engine runs with no provider wired in. */
export const nullRoutingPort: RoutingPort = {
  name: 'null',
  route: async () => null,
};

/* ----------------------------------------------------------------- weather */

export type WeatherSeverity = 'none' | 'advisory' | 'watch' | 'warning';

export type WeatherBand = {
  /** Route-mile range the band covers. */
  fromMile: number;
  toMile: number;
  /** Epoch ms window the forecast applies to. */
  fromMs: number;
  toMs: number;
  summary: string;
  severity: WeatherSeverity;
};

export type WeatherAlert = {
  headline: string;
  severity: WeatherSeverity;
  /** Route-mile range affected. */
  fromMile: number;
  toMile: number;
  expiresMs: number | null;
};

export type WeatherPort = {
  name: string;
  /**
   * Time-aligned forecast bands + active alerts along sampled route points.
   * Empty arrays = no data (planner proceeds without weather stops).
   */
  alongRoute(
    routePoints: { position: LatLng; routeMile: number }[],
    departAtMs: number,
  ): Promise<{ bands: WeatherBand[]; alerts: WeatherAlert[] }>;
};

/** Null weather adapter — the Phase 3 default. */
export const nullWeatherPort: WeatherPort = {
  name: 'null',
  alongRoute: async () => ({ bands: [], alerts: [] }),
};

/* -------------------------------------------------------------- fuel price */

export type FuelPricePort = {
  name: string;
  /**
   * Regional diesel price in cents/gallon for a state (or null when
   * unknown). Phase 4 wires EIA PADD-region weekly averages here.
   */
  dieselCentsPerGallon(state: string): Promise<number | null>;
};

/** Null fuel-price adapter: cost engine reports fuel as unknown. */
export const nullFuelPricePort: FuelPricePort = {
  name: 'null',
  dieselCentsPerGallon: async () => null,
};

/* ---------------------------------------------------------------- registry */

export type ProviderRegistry = {
  routing: RoutingPort;
  weather: WeatherPort;
  fuelPrice: FuelPricePort;
};

/** The offline default registry — every port is the null adapter. */
export const offlineProviders: ProviderRegistry = {
  routing: nullRoutingPort,
  weather: nullWeatherPort,
  fuelPrice: nullFuelPricePort,
};

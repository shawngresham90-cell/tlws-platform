import type { LatLng } from '@/lib/map/bounds';
import type { Route, TruckProfile } from './types';

/**
 * Provider adapter interfaces. INTERFACES AND NULL IMPLEMENTATIONS ONLY —
 * no adapter in this file performs network I/O. The live adapters exist
 * elsewhere and are wired in at the API-route layer:
 *
 *   RoutingPort      → HERE Routing API v8, live in ./here-routing.ts
 *                      (wired in api/trip-planner/quote/route.ts)
 *   GeocodingPort    → US Census geocoder (src/lib/directory/census-geocoder.ts
 *                      behind ExternalGeocoderAdapter; re-exported here) —
 *                      distinct from the HERE free-text GeocodePort in
 *                      ./here-geocode.ts used by the places route
 *   WeatherPort      → NWS api.weather.gov, live in ./nws-weather.ts
 *   FuelPricePort    → EIA weekly diesel, live in ./eia-fuel.ts
 *
 * Every port method is async and returns null/empty on "cannot answer" —
 * the planner degrades gracefully instead of failing the whole plan.
 */

export type { ExternalGeocoderAdapter as GeocodingPort } from '@/lib/directory/geocode-pipeline';

/* ----------------------------------------------------------------- routing */

/** Road features a route can be asked to avoid (provider-neutral names). */
export type RouteAvoidance = 'tollRoad' | 'ferry' | 'tunnel' | 'dirtRoad' | 'uTurns';

export type RoutingRequest = {
  origin: LatLng;
  destination: LatLng;
  waypoints: LatLng[];
  truck: TruckProfile;
  departAtMs: number;
  /** Optional feature avoidances; unknown values must be dropped by adapters. */
  avoid?: RouteAvoidance[];
};

/** One structured turn instruction (Navigator N8a; providers may omit). */
export type RouteManeuver = {
  action: string;
  instruction: string;
  direction: string | null;
  severity: string | null;
  /** Index into the parsed route geometry where the maneuver occurs. */
  offset: number;
  lengthM: number | null;
  durationS: number | null;
};

/** Provider notice attached to a route (e.g. a violated truck restriction). */
export type RouteNotice = {
  code: string;
  title: string;
  /** Provider severity, passed through (e.g. 'critical' | 'info'). */
  severity: string;
};

export type RoutingResult = {
  route: Route;
  /** Sampled polyline points with cumulative route-miles (directory layer input). */
  routePoints: { position: LatLng; routeMile: number }[];
  /** Toll total in cents when the provider returns tolls; null = unknown. */
  tollCents: number | null;
  /** Provider attribution for display. */
  provider: string;
  /** Turn-by-turn instruction texts when the provider returns them. */
  instructions?: string[];
  /**
   * N8a additions, all OPTIONAL and additive: existing consumers
   * (composeQuote) ignore them; the Navigator route API requires them.
   */
  maneuvers?: RouteManeuver[];
  notices?: RouteNotice[];
  /** Provider summary exactly as parsed (pre-rounding). */
  /**
   * `seconds` is traffic-aware whenever the request carried a real
   * departure time. `baseSeconds` is the provider's free-flow baseline —
   * present only when it actually applied traffic, which is what makes it
   * evidence rather than an assumption.
   */
  summary?: { meters: number; seconds: number; baseSeconds?: number | null };
  /** Total decoded geometry points behind `routePoints` (which are sampled). */
  geometryPointCount?: number;
  /**
   * FULL decoded geometry (N8b). Present ONLY when the adapter was
   * created with `retainGeometry: true` — the planner's instances never
   * set it, so planner cache memory is unchanged.
   */
  geometry?: LatLng[];
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

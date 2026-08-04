/**
 * Navigator ports (Phase 1). Dependency-injection seams that keep
 * `src/lib/navigator/` pure (AD-2): the core never touches the browser —
 * adapters in the component layer implement these interfaces and hand the
 * core plain data. Mirrors the RoutingPort discipline in
 * `src/lib/trip-planner/providers.ts`.
 */

import type { GeoErrorKind, RawGeoFix } from './types';

/** Options passed through to the underlying position watch. */
export type GeoWatchOptions = {
  enableHighAccuracy: boolean;
  /** Accept cached platform fixes up to this old, ms. */
  maximumAgeMs: number;
  /** Platform timeout per fix attempt, ms. */
  timeoutMs: number;
};

/**
 * A continuous position source. `watch` starts delivery and returns a
 * cancel function; after cancel returns, no further callbacks may fire.
 * The browser adapter (component layer) wraps `navigator.geolocation`;
 * tests inject synthetic streams.
 */
export interface GeolocationPort {
  watch(
    onFix: (fix: RawGeoFix) => void,
    onError: (kind: GeoErrorKind) => void,
    options: GeoWatchOptions,
  ): () => void;
}

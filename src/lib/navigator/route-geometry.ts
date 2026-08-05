/**
 * Full-resolution route geometry (milestone N8b) — normalization,
 * validation, and integrity for the complete provider polyline that a
 * navigation session runs on. N8a validated the ROUTE (summary,
 * destination, maneuvers, notices); this module validates the GEOMETRY
 * itself, point by point, before a session may exist.
 *
 * Pure: positions in, points + problems out. No I/O, no clock.
 */

import { haversineMiles } from '@/lib/map/geo';
import type { LatLng } from '@/lib/map/bounds';

export type GeometryPoint = {
  position: LatLng;
  /** Cumulative miles from the route start, scaled to the provider total. */
  routeMile: number;
};

/**
 * Hard memory bound. Real HERE polylines run well under this even
 * coast-to-coast (tens of thousands of points); anything beyond is a
 * malformed or hostile payload, rejected rather than truncated —
 * truncating GEOMETRY would silently amputate the route.
 */
export const MAX_GEOMETRY_POINTS = 120_000;
export const MIN_GEOMETRY_POINTS = 2;

/**
 * The route must physically begin/end where the driver asked. Same
 * tolerance family as N8a's destination check: beyond 2 mi it is simply
 * not a route between these points.
 */
export const ENDPOINT_MATCH_MI = 2.0;

/**
 * A polyline whose points are mostly identical is corrupt (a decoder or
 * provider fault), even though each individual duplicate is droppable.
 */
export const MAX_DUPLICATE_FRACTION = 0.5;

export type GeometryProblem = { code: string; message: string };

export type NormalizedGeometry = {
  points: GeometryPoint[];
  /** Consecutive duplicates dropped during normalization. */
  duplicatesDropped: number;
  /**
   * Original-index → normalized-index map. Dropping duplicates SHIFTS
   * indices, and provider maneuver offsets index the ORIGINAL decoded
   * array — consuming them against the normalized points without this
   * map would land maneuvers on the wrong coordinates. A dropped
   * duplicate maps to the kept point it duplicated.
   */
  indexMap: number[];
  problems: GeometryProblem[];
};

function bad(code: string, message: string): GeometryProblem {
  return { code, message };
}

function finitePoint(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * Normalize raw decoded positions into cumulative-mile geometry points.
 *
 * - every coordinate must be finite and in range (NaN anywhere rejects)
 * - consecutive duplicates are dropped (and counted); a duplicate share
 *   above MAX_DUPLICATE_FRACTION rejects the geometry as corrupt
 * - cumulative mileage is computed by haversine and scaled so the final
 *   point lands exactly on the provider's summary total (the same
 *   discipline as the planner's toRoutePoints), which keeps route-mile
 *   agreement with maneuver offsets and the tracker exact
 * - monotonicity holds by construction and is verified anyway
 *
 * Problems non-empty ⇒ points must not be used.
 */
export function normalizeGeometry(
  positions: readonly LatLng[],
  totalMiles: number,
): NormalizedGeometry {
  const problems: GeometryProblem[] = [];
  if (!Array.isArray(positions) || positions.length < MIN_GEOMETRY_POINTS) {
    return {
      points: [],
      duplicatesDropped: 0,
      indexMap: [],
      problems: [bad('missing-geometry', 'The route has no usable geometry.')],
    };
  }
  if (positions.length > MAX_GEOMETRY_POINTS) {
    return {
      points: [],
      duplicatesDropped: 0,
      indexMap: [],
      problems: [
        bad(
          'geometry-too-large',
          `${positions.length} points exceeds the ${MAX_GEOMETRY_POINTS}-point bound.`,
        ),
      ],
    };
  }
  if (!Number.isFinite(totalMiles) || totalMiles <= 0) {
    return {
      points: [],
      duplicatesDropped: 0,
      indexMap: [],
      problems: [bad('invalid-total', 'Route total distance is missing or non-positive.')],
    };
  }

  const kept: LatLng[] = [];
  const indexMap: number[] = new Array(positions.length);
  let duplicatesDropped = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!finitePoint(p)) {
      return {
        points: [],
        duplicatesDropped,
        indexMap: [],
        problems: [bad('invalid-coordinate', 'The geometry contains a non-finite coordinate.')],
      };
    }
    const prev = kept[kept.length - 1];
    if (prev && prev.lat === p.lat && prev.lng === p.lng) {
      duplicatesDropped++;
      indexMap[i] = kept.length - 1;
      continue;
    }
    indexMap[i] = kept.length;
    kept.push({ lat: p.lat, lng: p.lng });
  }

  if (duplicatesDropped / positions.length > MAX_DUPLICATE_FRACTION) {
    return {
      points: [],
      duplicatesDropped,
      indexMap: [],
      problems: [
        bad(
          'duplicate-corruption',
          `${duplicatesDropped} of ${positions.length} points are duplicates — the geometry is corrupt.`,
        ),
      ],
    };
  }
  if (kept.length < MIN_GEOMETRY_POINTS) {
    return {
      points: [],
      duplicatesDropped,
      indexMap: [],
      problems: [
        bad('degenerate-geometry', 'After normalization the route has fewer than 2 points.'),
      ],
    };
  }

  const cumulative: number[] = [0];
  for (let i = 1; i < kept.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMiles(kept[i - 1], kept[i]));
  }
  const geomMiles = cumulative[cumulative.length - 1];
  if (geomMiles <= 0) {
    return {
      points: [],
      duplicatesDropped,
      indexMap: [],
      problems: [bad('zero-length-geometry', 'The geometry has zero physical length.')],
    };
  }
  const scale = totalMiles / geomMiles;

  const points: GeometryPoint[] = new Array(kept.length);
  let lastMile = -1;
  for (let i = 0; i < kept.length; i++) {
    const routeMile = Number((cumulative[i] * scale).toFixed(4));
    if (routeMile < lastMile) {
      // Unreachable by construction; kept as an explicit integrity check.
      return {
        points: [],
        duplicatesDropped,
        indexMap: [],
        problems: [bad('non-monotonic-mileage', 'Cumulative mileage decreased along the route.')],
      };
    }
    lastMile = routeMile;
    points[i] = { position: kept[i], routeMile };
  }
  // Land the final point exactly on the provider total.
  points[points.length - 1] = {
    position: points[points.length - 1].position,
    routeMile: Number(totalMiles.toFixed(4)),
  };

  return { points, duplicatesDropped, indexMap, problems };
}

/**
 * Endpoint agreement: the normalized geometry must begin near the
 * requested origin and end near the requested destination.
 */
export function validateGeometryEndpoints(
  points: readonly GeometryPoint[],
  origin: LatLng,
  destination: LatLng,
): GeometryProblem[] {
  if (points.length < MIN_GEOMETRY_POINTS) {
    return [bad('missing-geometry', 'The route has no usable geometry.')];
  }
  const problems: GeometryProblem[] = [];
  const startGap = haversineMiles(points[0].position, origin);
  if (startGap > ENDPOINT_MATCH_MI) {
    problems.push(
      bad(
        'origin-mismatch',
        `The route begins ${startGap.toFixed(1)} mi from the requested origin.`,
      ),
    );
  }
  const endGap = haversineMiles(points[points.length - 1].position, destination);
  if (endGap > ENDPOINT_MATCH_MI) {
    problems.push(
      bad(
        'destination-mismatch',
        `The route ends ${endGap.toFixed(1)} mi from the requested destination.`,
      ),
    );
  }
  return problems;
}

/**
 * Cheap integrity fingerprint (FNV-1a over quantized coordinates and the
 * point count). Not cryptographic — it exists so later milestones can
 * verify a session's geometry is the one that was validated, and so
 * tests can prove a handoff did not alter a single point.
 */
export function geometryFingerprint(points: readonly GeometryPoint[]): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    // Quantize to ~1e-5 degrees (≈1 m) so serialization round-trips agree.
    const q = Math.round(n * 100_000);
    h ^= q & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (q >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (q >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (q >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  for (const p of points) {
    mix(p.position.lat);
    mix(p.position.lng);
  }
  mix(points.length);
  return (h >>> 0).toString(16).padStart(8, '0');
}

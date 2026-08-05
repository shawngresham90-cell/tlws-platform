/**
 * Truck entrance intelligence (milestone N8f) — decides what the route's
 * end point actually IS before arrival may complete. The founding rule:
 * a destination centroid is NEVER assumed truck-accessible, and an
 * entrance is NEVER fabricated. When no verified truck entrance exists,
 * navigation continues safely and the destination is exposed as
 * UNVERIFIED — the driver is told the truth about where the route ends.
 *
 * Entrance data arrives from the caller (directory rows today, richer
 * sources later); this module only classifies honestly. Pure.
 */

import { haversineMiles } from './geo';
import type { LatLng } from '@/lib/map/bounds';

export type EntranceKind =
  | 'verified-truck-entrance'
  | 'probable-entrance'
  | 'unverified-entrance'
  | 'building-centroid';

export type DestinationFacility =
  | 'warehouse'
  | 'distribution-center'
  | 'truck-terminal'
  | 'industrial-park'
  | 'customer-yard'
  | 'truck-stop'
  | 'rest-area'
  | 'unknown';

export type DestinationEntrance = {
  position: LatLng;
  /** 'verified' = confirmed truck entrance; 'reported' = unconfirmed report. */
  kind: 'verified' | 'reported';
  label?: string;
};

export type DestinationInfo = {
  /** The point routing was asked to reach. */
  position: LatLng;
  facility: DestinationFacility;
  /** Where `position` came from — honesty about its own provenance. */
  positionSource: 'entrance' | 'geocode' | 'centroid' | 'unknown';
  /** Known entrances for the facility, when the caller has any. */
  entrances?: readonly DestinationEntrance[];
};

export type EntranceEvaluation = {
  kind: EntranceKind;
  /** The point arrival is judged against. NEVER invented: a known
   *  entrance when one exists, otherwise the route end itself. */
  target: LatLng;
  /** True only for a VERIFIED truck entrance. */
  verified: boolean;
  /** How far the chosen target sits from the route's end, meters. */
  targetToRouteEndM: number;
  /** Total entrances known for the facility (multi-entrance sites). */
  entranceCount: number;
  /** Plain-language caveats for the driver-facing layer. */
  notes: string[];
};

/** Arrival radius by facility class, meters — a truck stop's lot is not a
 *  dock gate. All values conservative; road testing will calibrate. */
export const FACILITY_ARRIVAL_RADIUS_M: Record<DestinationFacility, number> = {
  warehouse: 150,
  'distribution-center': 150,
  'truck-terminal': 200,
  'industrial-park': 200,
  'customer-yard': 150,
  'truck-stop': 250,
  'rest-area': 250,
  unknown: 150,
};

function finite(p: LatLng | undefined | null): p is LatLng {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

const M_PER_MILE = 1609.344;

/**
 * Classify the destination and choose the arrival target.
 *
 * - verified entrance(s) known → nearest verified entrance to the route
 *   end; kind `verified-truck-entrance`.
 * - only reported entrance(s) → nearest reported; `probable-entrance`.
 * - no entrances: the routed position itself is the target, classified by
 *   its provenance — 'entrance' → probable, 'geocode' → unverified,
 *   'centroid'/'unknown' → building-centroid. Nothing is invented.
 * - malformed destination data → building-centroid on the route end,
 *   with an explicit note. Never a throw.
 */
export function evaluateEntrance(dest: DestinationInfo, routeEnd: LatLng): EntranceEvaluation {
  const notes: string[] = [];

  if (!finite(routeEnd)) {
    return {
      kind: 'building-centroid',
      target: { lat: 0, lng: 0 },
      verified: false,
      targetToRouteEndM: Number.POSITIVE_INFINITY,
      entranceCount: 0,
      notes: ['route end is not a real coordinate — destination unverifiable'],
    };
  }

  const entrances = (dest.entrances ?? []).filter((e) => finite(e.position));
  if ((dest.entrances?.length ?? 0) > entrances.length) {
    notes.push('some entrance records were malformed and ignored');
  }

  const nearest = (list: readonly DestinationEntrance[]): DestinationEntrance | null => {
    let best: DestinationEntrance | null = null;
    let bestMi = Number.POSITIVE_INFINITY;
    for (const e of list) {
      const mi = haversineMiles(e.position, routeEnd);
      if (mi < bestMi) {
        bestMi = mi;
        best = e;
      }
    }
    return best;
  };

  const verified = entrances.filter((e) => e.kind === 'verified');
  if (verified.length > 0) {
    const pick = nearest(verified)!;
    if (verified.length > 1)
      notes.push(`${verified.length} verified entrances — nearest to the route end chosen`);
    return {
      kind: 'verified-truck-entrance',
      target: { ...pick.position },
      verified: true,
      targetToRouteEndM: haversineMiles(pick.position, routeEnd) * M_PER_MILE,
      entranceCount: entrances.length,
      notes,
    };
  }

  const reported = entrances.filter((e) => e.kind === 'reported');
  if (reported.length > 0) {
    const pick = nearest(reported)!;
    notes.push('entrance reported but not verified');
    return {
      kind: 'probable-entrance',
      target: { ...pick.position },
      verified: false,
      targetToRouteEndM: haversineMiles(pick.position, routeEnd) * M_PER_MILE,
      entranceCount: entrances.length,
      notes,
    };
  }

  // No entrance data at all: judge the routed position's own provenance.
  const anchor = finite(dest.position) ? dest.position : routeEnd;
  if (!finite(dest.position)) notes.push('destination position malformed — using the route end');
  const distM = haversineMiles(anchor, routeEnd) * M_PER_MILE;

  if (dest.positionSource === 'entrance') {
    notes.push('routed point is a caller-declared entrance, unverified');
    return {
      kind: 'probable-entrance',
      target: { ...anchor },
      verified: false,
      targetToRouteEndM: distM,
      entranceCount: 0,
      notes,
    };
  }
  if (dest.positionSource === 'geocode') {
    notes.push('routed point is a geocode — truck access unverified');
    return {
      kind: 'unverified-entrance',
      target: { ...anchor },
      verified: false,
      targetToRouteEndM: distM,
      entranceCount: 0,
      notes,
    };
  }
  notes.push('routed point is a building centroid or of unknown origin — truck access unverified');
  return {
    kind: 'building-centroid',
    target: { ...anchor },
    verified: false,
    targetToRouteEndM: distM,
    entranceCount: 0,
    notes,
  };
}

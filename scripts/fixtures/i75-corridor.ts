import type { LatLng } from '@/lib/map/bounds';
import type { HereManeuver } from '@/lib/trip-planner/here-routing';
import type { RouteSection, RoutingResult } from '@/lib/trip-planner/providers';
import type { DirectoryListing, RoutePoint } from '@/lib/trip-planner/directory-layer';
import { toStopCandidates } from '@/lib/trip-planner/directory-layer';
import type { StopCandidate } from '@/lib/trip-planner/types';
import { buildRoute } from '@/lib/trip-planner/types';
import { haversineMiles } from '@/lib/map/geo';

/**
 * I-75 corridor fixture: Dalton → Atlanta → Macon (TP-2).
 *
 * DETERMINISTIC, EXPORTED, TEST-ONLY. Production code never imports this
 * module; it exists so every TP-2 scenario runs against the same corridor
 * with hand-checkable numbers.
 *
 * PROVENANCE. Every listing coordinate below is transcribed from
 * `data/geocoding/i75-ga-tn-geocoding-batch-001.csv`, HIGH-confidence
 * rows with action `ready` only (each cites its row). Parking-space
 * counts and overnight statuses are FIXTURE VALUES chosen to exercise the
 * engine — representative, never claims about the real businesses, which
 * is why every fixture listing carries a "(fixture)" suffix in its name.
 * Trip endpoints (Dalton origin, Atlanta via, Macon destination) are
 * approximate city points playing the role of driver-entered inputs.
 *
 * THE MILE==MINUTE TRICK. The fixture "provider" drives every segment at
 * exactly 60 mph, so N route-miles take N minutes and every clock
 * scenario can be reasoned about by eye. Speeds here are FIXTURE DATA
 * standing in for provider output — the engine never assumes one.
 *
 * Maneuvers are emitted every ≤5 fixture-miles (300 s), well inside the
 * 600 s coarse threshold, so provider windows stay TIGHT and assertions
 * about exact cutoffs hold. Section boundaries fall exactly at the
 * Atlanta via, matching how HERE splits a `via=` route.
 */

const METERS_PER_MILE = 1609.344;
const FIXTURE_MPH = 60;

/** Trip endpoints — driver inputs, not directory claims. */
export const DALTON_ORIGIN = {
  label: 'Dalton, GA',
  position: { lat: 34.7698, lng: -84.9702 },
} as const;
export const ATLANTA_VIA = {
  label: 'Atlanta, GA',
  position: { lat: 33.749, lng: -84.388 },
} as const;
export const MACON_DESTINATION = {
  label: 'Macon, GA',
  position: { lat: 32.8407, lng: -83.6324 },
} as const;

/**
 * The corridor's shape, Dalton to Macon. Listing rows are the polyline's
 * own waypoints (so their off-route distance is ~0); unnamed points only
 * shape the line through metro Atlanta the way I-75 actually bends.
 */
const CORRIDOR_WAYPOINTS: { position: LatLng; atlantaBoundary?: boolean }[] = [
  { position: DALTON_ORIGIN.position },
  { position: { lat: 34.687265, lng: -85.000154 } }, // ONE9 #319 row
  { position: { lat: 34.655613, lng: -84.981043 } }, // Pilot #421 row
  { position: { lat: 34.576835, lng: -84.946624 } }, // Flying J #632 Resaca row
  { position: { lat: 34.558868, lng: -84.935939 } }, // Pilot #4558 Calhoun row
  { position: { lat: 34.443856, lng: -84.915181 } }, // Love's #735 Calhoun row
  { position: { lat: 34.272701, lng: -84.807736 } }, // Pilot #67 / exit 296 row
  { position: { lat: 34.118857, lng: -84.743165 } }, // Love's #359 Emerson row
  { position: { lat: 33.965, lng: -84.677 } }, // shaping: Acworth
  { position: { lat: 33.905, lng: -84.519 } }, // shaping: Marietta
  { position: ATLANTA_VIA.position, atlantaBoundary: true },
  { position: { lat: 33.544, lng: -84.234 } }, // shaping: Stockbridge
  { position: { lat: 33.447, lng: -84.146 } }, // shaping: McDonough
  { position: { lat: 33.206, lng: -84.058 } }, // Jackson exit 201 cluster rows
  { position: { lat: 33.06914, lng: -83.97361 } }, // GA DPS weigh station row
  { position: { lat: 32.955, lng: -83.795 } }, // shaping: Bolingbroke
  { position: MACON_DESTINATION.position },
];

/**
 * Directory listings along the corridor. Coordinates: CSV rows as cited.
 * Space counts / overnight statuses / amenities: fixture values.
 */
export function corridorListings(): DirectoryListing[] {
  const listing = (
    id: string,
    name: string,
    lat: number,
    lng: number,
    over: Partial<DirectoryListing> = {},
  ): DirectoryListing => ({
    id,
    name,
    categorySlug: 'truck-stops',
    lat,
    lng,
    city: null,
    state: 'GA',
    interstate: 'I-75',
    exitNumber: null,
    parkingSpaces: 80,
    overnightParking: true,
    overnightStatus: 'confirmed',
    freeParking: true,
    paidParking: null,
    reservationUrl: null,
    amenities: ['showers', 'restrooms'],
    fuelBrands: [],
    coordVerificationStatus: 'manually-verified',
    ...over,
  });

  return [
    // Dalton area (exits 326/328)
    listing('fx-one9-319', 'ONE9 Dalton (fixture)', 34.687265, -85.000154, {
      parkingSpaces: 90,
    }),
    listing('fx-pilot-421', 'Pilot Dalton (fixture)', 34.655613, -84.981043, {
      parkingSpaces: 70,
    }),
    // Resaca / Calhoun
    listing('fx-flyingj-632', 'Flying J Resaca (fixture)', 34.576835, -84.946624, {
      parkingSpaces: 100,
      reservationUrl: 'https://example.test/reserve/fx-flyingj-632',
    }),
    listing('fx-pilot-4558', 'Pilot Calhoun (fixture)', 34.558868, -84.935939, {
      parkingSpaces: 60,
    }),
    listing('fx-loves-735', "Love's Calhoun (fixture)", 34.443856, -84.915181, {
      parkingSpaces: 80,
    }),
    // Cartersville, exit 296 — two distinct lots either side of the exit
    listing('fx-pilot-67', 'Pilot Cartersville (fixture)', 34.272701, -84.807736, {
      parkingSpaces: 85,
      reservationUrl: 'https://example.test/reserve/fx-pilot-67',
    }),
    listing('fx-ta-146', 'TA Cartersville (fixture)', 34.273972, -84.807762, {
      parkingSpaces: 120,
    }),
    // Emerson
    listing('fx-loves-359', "Love's Emerson (fixture)", 34.118857, -84.743165, {
      parkingSpaces: 70,
    }),
    // South of Atlanta: Jackson, exit 201
    listing('fx-loves-307', "Love's Jackson (fixture)", 33.208091, -84.05852, {
      parkingSpaces: 90,
    }),
    listing('fx-ta-268', 'TA Atlanta South (fixture)', 33.205898, -84.058286, {
      parkingSpaces: 150,
      reservationUrl: 'https://example.test/reserve/fx-ta-268',
    }),
    // Forsyth: weigh station — real I-75 infrastructure, NEVER parking.
    // Category and zero spaces both keep it out of every parking answer.
    listing('fx-weigh-12', 'GA Weigh Station Forsyth (fixture)', 33.06914, -83.97361, {
      categorySlug: 'weigh-stations',
      parkingSpaces: null,
      overnightParking: false,
      overnightStatus: 'unknown',
      freeParking: null,
      amenities: [],
    }),
    // Macon, exit 153 — sits ~10 miles off this fixture's downtown-Macon
    // endpoint, so projection drops it: proof the fixture never force-fits
    // a listing onto the corridor.
    listing('fx-loves-698', "Love's Macon (fixture)", 32.717528, -83.733418, {
      parkingSpaces: 100,
    }),
  ];
}

export type CorridorRoute = {
  positions: LatLng[];
  maneuvers: HereManeuver[];
  totalSeconds: number;
  totalMeters: number;
  totalMiles: number;
  sections: RouteSection[];
  routePoints: RoutePoint[];
  /** Route-mile of the Atlanta via boundary (leg 1's end). */
  atlantaMile: number;
};

/**
 * The fixture "provider" route. `via: true` splits it into two sections
 * at Atlanta exactly as HERE splits a `via=` request; `via: false` is the
 * same road as one section.
 */
export function corridorRoute(opts: { via?: boolean } = {}): CorridorRoute {
  const via = opts.via ?? false;

  // Walk the corridor, subdividing every waypoint gap into ≤5-mile pieces
  // so each maneuver stays a tight (≤300 s) provider action.
  const positions: LatLng[] = [CORRIDOR_WAYPOINTS[0].position];
  const maneuvers: HereManeuver[] = [];
  let cumulativeMeters = 0;
  let cumulativeSeconds = 0;
  let atlantaPositionIndex = -1;
  let atlantaManeuverEnd = -1;
  let atlantaMeters = 0;
  let atlantaSeconds = 0;

  for (let w = 1; w < CORRIDOR_WAYPOINTS.length; w++) {
    const from = CORRIDOR_WAYPOINTS[w - 1].position;
    const to = CORRIDOR_WAYPOINTS[w].position;
    const gapMiles = haversineMiles(from, to);
    const pieces = Math.max(1, Math.ceil(gapMiles / 5));
    for (let p = 1; p <= pieces; p++) {
      const t = p / pieces;
      const point = {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      };
      const pieceMiles = gapMiles / pieces;
      const pieceMeters = pieceMiles * METERS_PER_MILE;
      const pieceSeconds = (pieceMiles / FIXTURE_MPH) * 3600;
      maneuvers.push({
        action: 'continue',
        instruction: `Continue on I-75 (fixture segment ${maneuvers.length + 1})`,
        direction: null,
        severity: null,
        offset: positions.length - 1,
        lengthM: pieceMeters,
        durationS: pieceSeconds,
      });
      positions.push(point);
      cumulativeMeters += pieceMeters;
      cumulativeSeconds += pieceSeconds;
    }
    if (CORRIDOR_WAYPOINTS[w].atlantaBoundary) {
      atlantaPositionIndex = positions.length - 1;
      atlantaManeuverEnd = maneuvers.length;
      atlantaMeters = cumulativeMeters;
      atlantaSeconds = cumulativeSeconds;
    }
  }
  maneuvers.push({
    action: 'arrive',
    instruction: 'Arrive at your destination (fixture)',
    direction: null,
    severity: null,
    offset: positions.length - 1,
    lengthM: 0,
    durationS: 0,
  });

  const totalMeters = cumulativeMeters;
  const totalSeconds = cumulativeSeconds;
  const totalMiles = Number((totalMeters / METERS_PER_MILE).toFixed(1));

  const sections: RouteSection[] = via
    ? [
        {
          endMeters: atlantaMeters,
          endSeconds: atlantaSeconds,
          endPositionIndex: atlantaPositionIndex,
          maneuverStart: 0,
          maneuverEnd: atlantaManeuverEnd,
        },
        {
          endMeters: totalMeters,
          endSeconds: totalSeconds,
          endPositionIndex: positions.length - 1,
          maneuverStart: atlantaManeuverEnd,
          maneuverEnd: maneuvers.length,
        },
      ]
    : [
        {
          endMeters: totalMeters,
          endSeconds: totalSeconds,
          endPositionIndex: positions.length - 1,
          maneuverStart: 0,
          maneuverEnd: maneuvers.length,
        },
      ];

  // Sampled route points with cumulative miles, directory-layer input.
  let mile = 0;
  const routePoints: RoutePoint[] = [{ position: positions[0], routeMile: 0 }];
  for (let i = 1; i < positions.length; i++) {
    mile += haversineMiles(positions[i - 1], positions[i]);
    routePoints.push({ position: positions[i], routeMile: Number(mile.toFixed(1)) });
  }

  return {
    positions,
    maneuvers,
    totalSeconds,
    totalMeters,
    totalMiles,
    sections,
    routePoints,
    atlantaMile: Number((atlantaMeters / METERS_PER_MILE).toFixed(1)),
  };
}

/** Corridor listings projected onto the route — the planner's candidates. */
export function corridorCandidates(
  route: CorridorRoute,
  listings: DirectoryListing[] = corridorListings(),
): StopCandidate[] {
  return toStopCandidates(listings, route.routePoints, 5);
}

/**
 * The fixture as a RoutingResult, for driving composeQuote end-to-end
 * offline exactly as the live HERE port would.
 */
export function corridorRoutingResult(route: CorridorRoute): RoutingResult {
  const hours = route.totalSeconds / 3600;
  return {
    route: buildRoute([
      {
        seq: 0,
        from: { label: DALTON_ORIGIN.label, position: DALTON_ORIGIN.position },
        to: { label: MACON_DESTINATION.label, position: MACON_DESTINATION.position },
        distanceMiles: route.totalMiles,
        avgSpeedMph: route.totalMiles / hours,
      },
    ]),
    routePoints: route.routePoints,
    tollCents: null,
    provider: 'I-75 corridor fixture (deterministic)',
    instructions: route.maneuvers.map((m) => m.instruction),
    maneuvers: route.maneuvers,
    notices: [],
    summary: {
      meters: route.totalMeters,
      seconds: route.totalSeconds,
      baseSeconds: route.totalSeconds - 600,
      sections: route.sections,
    },
    geometryPointCount: route.positions.length,
    geometry: route.positions,
  };
}

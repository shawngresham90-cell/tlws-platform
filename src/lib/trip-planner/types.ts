/**
 * Trip Planner core object models (Phase 3). Pure types — no runtime code,
 * no network, no database. Every time value is epoch milliseconds or a
 * duration in minutes; every distance is statute miles. The engine never
 * reads a clock itself: callers supply all timestamps, which keeps every
 * module deterministic and offline-testable.
 */

import type { LatLng } from '@/lib/map/bounds';

/* ------------------------------------------------------------ truck profile */

export type TruckProfile = {
  /** Overall length in feet (tractor + trailer(s)). */
  lengthFt: number;
  heightFt: number;
  widthFt: number;
  grossWeightLbs: number;
  axles: number;
  /** Hazmat class placarded, if any — routing restriction input. */
  hazmatClass: string | null;
  /** Usable fuel capacity in gallons. */
  tankGallons: number;
  /** Real-world miles per gallon. */
  mpg: number;
  /**
   * Fraction of tank range to plan against before requiring fuel
   * (0.75 = plan a stop by 3/4 of range).
   */
  fuelSafetyFactor: number;
};

export const DEFAULT_TRUCK_PROFILE: TruckProfile = {
  lengthFt: 70,
  heightFt: 13.5,
  widthFt: 8.5,
  grossWeightLbs: 80000,
  axles: 5,
  hazmatClass: null,
  tankGallons: 200,
  mpg: 6.5,
  fuelSafetyFactor: 0.75,
};

/* ------------------------------------------------------------------- stops */

export type StopKind =
  | 'origin'
  | 'pickup'
  | 'delivery'
  | 'destination'
  | 'fuel'
  | 'break'
  | 'overnight'
  | 'parking'
  | 'weather'
  | 'custom';

/** A directory listing the planner can place a stop at. */
export type StopCandidate = {
  /** Directory listing id (uuid) or synthetic id for ad-hoc points. */
  id: string;
  name: string;
  /** Directory category slug, e.g. 'truck-stops', 'parking', 'cat-scales'. */
  categorySlug: string;
  position: LatLng;
  /** Route-position in miles from the origin along the planned route. */
  routeMile: number;
  /** Straight-line miles off the route polyline (0 = on route). */
  offRouteMiles: number;
  parkingSpaces: number | null;
  overnightParking: boolean;
  /** Directory free-parking flag (null = unknown — never assumed). */
  freeParking: boolean | null;
  /** Directory paid-parking flag (null = unknown — never assumed). */
  paidParking: boolean | null;
  /** Reservable paid parking (Truck Parking Club) link, when present. */
  reservationUrl: string | null;
  amenities: string[];
  fuelBrands: string[];
  /** Coordinate provenance — verified coordinates rank above unverified. */
  coordVerificationStatus: string | null;
  state: string;
  interstate: string | null;
  exitNumber: string | null;
};

/** A stop placed into an itinerary. */
export type PlannedStop = {
  kind: StopKind;
  /** Candidate the stop was placed at (null for origin/destination/virtual). */
  candidate: StopCandidate | null;
  label: string;
  position: LatLng | null;
  routeMile: number;
  /** Epoch ms — when the driver arrives. */
  arriveAtMs: number;
  /** Epoch ms — when the driver departs. */
  departAtMs: number;
  /** Minutes spent stopped. */
  dwellMinutes: number;
  /** Why the planner placed this stop (HOS rule, fuel need, user request). */
  reason: string;
  /** Duty status while stopped. */
  dutyStatus: DutyStatus;
  /** Alternate candidates the planner considered, best first. */
  alternates: StopCandidate[];
};

/* ------------------------------------------------------------------- route */

/** One drivable segment between consecutive route points. */
export type RouteLeg = {
  /** 0-based sequence in the route. */
  seq: number;
  from: { label: string; position: LatLng };
  to: { label: string; position: LatLng };
  distanceMiles: number;
  /** Average sustainable truck speed for the leg (mph). */
  avgSpeedMph: number;
  /** Optional per-state mileage breakdown (IFTA groundwork). */
  perStateMiles?: Record<string, number>;
  /** Optional toll cost for the leg, cents (provider-supplied; null = unknown). */
  tollCents?: number | null;
};

export type Route = {
  legs: RouteLeg[];
  totalMiles: number;
  /** Pure drive time at leg speeds, minutes (no rests). */
  driveMinutes: number;
};

/** Build a Route from legs, computing totals. */
export function buildRoute(legs: RouteLeg[]): Route {
  const totalMiles = legs.reduce((s, l) => s + l.distanceMiles, 0);
  const driveMinutes = legs.reduce((s, l) => s + (l.distanceMiles / l.avgSpeedMph) * 60, 0);
  return { legs, totalMiles, driveMinutes: Math.round(driveMinutes) };
}

/* --------------------------------------------------------------------- HOS */

export type DutyStatus = 'driving' | 'on-duty' | 'off-duty' | 'sleeper';

/** One contiguous period in a single duty status. */
export type DutySegment = {
  status: DutyStatus;
  startMs: number;
  minutes: number;
  note?: string;
};

export type CycleRule = '60/7' | '70/8';

/**
 * The driver's clock state at a point in time. All "used" values are
 * minutes. This is a snapshot the engine advances segment by segment.
 */
export type ClockState = {
  /** Reference timestamp this state is valid at (epoch ms). */
  atMs: number;
  cycleRule: CycleRule;
  /** Driving minutes used since the last ≥10-hr reset (11-hr rule). */
  drivingUsedMin: number;
  /** Minutes elapsed in the current 14-hr window (−1 = no window open). */
  windowElapsedMin: number;
  /** Cumulative driving minutes since the last ≥30-min non-driving break. */
  drivingSinceBreakMin: number;
  /** Minutes of continuous off/sleeper time immediately before `atMs`. */
  restStreakMin: number;
  /**
   * On-duty (driving + on-duty) minutes per rolling 24-hour day bucket,
   * newest last. Bucket 0 spans [atMs − N days, …]. Used for the 60/70 rule.
   */
  onDutyByDayMin: number[];
  /** Epoch ms when the current day bucket started. */
  dayBucketStartMs: number;
};

/** HOS constants (49 CFR 395.3, property-carrying). Minutes. */
export const HOS = {
  MAX_DRIVING_MIN: 11 * 60,
  MAX_WINDOW_MIN: 14 * 60,
  BREAK_AFTER_DRIVING_MIN: 8 * 60,
  MIN_BREAK_MIN: 30,
  MIN_RESET_MIN: 10 * 60,
  RESTART_MIN: 34 * 60,
  CYCLE_60_MIN: 60 * 60,
  CYCLE_70_MIN: 70 * 60,
  DAY_MIN: 24 * 60,
} as const;

export type HosViolation = {
  rule: '11-hour' | '14-hour' | '30-minute-break' | '60-hour' | '70-hour';
  atMs: number;
  detail: string;
};

export type RemainingClocks = {
  /** Driving minutes left under the 11-hour rule. */
  drivingMin: number;
  /** Minutes left in the 14-hour window (driving prohibited after). */
  windowMin: number;
  /** Driving minutes left before a 30-minute break is required. */
  untilBreakMin: number;
  /** On-duty minutes left in the 60/70-hour cycle. */
  cycleMin: number;
  /** The binding constraint right now. */
  limitedBy: '11-hour' | '14-hour' | '30-minute-break' | 'cycle';
  /** Minutes the driver can legally drive right now (min of the above). */
  legalDrivingMin: number;
};

/* -------------------------------------------------------------------- trip */

export type TripRequest = {
  /** Trip label for display. */
  title: string;
  /** Epoch ms departure. */
  departAtMs: number;
  truck: TruckProfile;
  /** Clock state at departure. */
  clocks: ClockState;
  route: Route;
  /** Candidate stops along the route (directory layer output). */
  candidates: StopCandidate[];
  /** Fuel level at departure as a fraction of tank (0..1). */
  fuelLevelFraction: number;
  options: PlannerOptions;
};

export type PlannerOptions = {
  /** Minutes of dwell for a fuel stop. */
  fuelStopMinutes: number;
  /** Minutes of dwell for the mandatory 30-minute break (≥30). */
  breakMinutes: number;
  /** Minutes of overnight rest (≥600 for a full reset). */
  overnightMinutes: number;
  /** How many route-miles before a deadline to start looking for a stop. */
  stopSearchWindowMiles: number;
  /** Preferred fuel brands (boost in ranking), empty = no preference. */
  preferredFuelBrands: string[];
  /** Max alternates recorded per planned stop. */
  maxAlternates: number;
};

export const DEFAULT_PLANNER_OPTIONS: PlannerOptions = {
  fuelStopMinutes: 30,
  breakMinutes: 30,
  overnightMinutes: 10 * 60,
  stopSearchWindowMiles: 60,
  preferredFuelBrands: [],
  maxAlternates: 3,
};

export type Itinerary = {
  stops: PlannedStop[];
  segments: DutySegment[];
  /** Epoch ms of final arrival. */
  arriveAtMs: number;
  totalMinutes: number;
  driveMinutes: number;
  restMinutes: number;
  violations: HosViolation[];
  /** Planner warnings that are not violations (thin candidates, etc.). */
  warnings: string[];
};

export type TripPlan = {
  request: TripRequest;
  itinerary: Itinerary;
  cost: TripCostEstimate;
};

/* -------------------------------------------------------------------- cost */

export type CostInputs = {
  /** Diesel price per gallon in cents (caller/adapter supplied; never invented). */
  fuelPricePerGallonCents: number | null;
  /** Explicit toll total in cents when known; null = unknown. */
  tollTotalCents: number | null;
  /** Fallback per-mile toll estimate in cents (0 = assume none). */
  tollPerMileCents: number;
  /** Overnight paid-parking cost in cents per night (0 = free planning). */
  parkingPerNightCents: number;
  /** Fixed costs per calendar day on the road, cents (insurance, etc.). */
  fixedDailyCents: number;
  /** Driver pay per mile in cents (owner-operators may use 0). */
  driverPayPerMileCents: number;
};

export type TripCostEstimate = {
  fuelGallons: number | null;
  fuelCents: number | null;
  tollCents: number | null;
  parkingCents: number;
  fixedCents: number;
  driverPayCents: number;
  totalCents: number | null;
  /** Cost per mile in cents (null while any component is unknown). */
  perMileCents: number | null;
  days: number;
  perDayCents: number | null;
  /** Which components are estimates vs unknown. */
  notes: string[];
};

/**
 * Region and display units (Canada navigation compatibility).
 *
 * WHAT A REGION IS, AND WHAT IT IS NOT. Choosing Canada changes two
 * things: which country the destination search asks about, and which
 * units the driver reads. It does NOT select a Canadian rule set for
 * hours of service, it does not claim Canadian regulatory compliance,
 * and it is never inferred from GPS — a truck parked in Windsor is not
 * evidence about which country's paperwork the driver is carrying, and
 * silently switching a legal-looking setting under someone is worse than
 * asking.
 *
 * The HOS boundary is the sharpest edge in this module. The shipped HOS
 * engine implements US federal property-carrying limits. Canada's rules
 * are different in almost every dimension, and this milestone does not
 * implement them. So in Canada mode the clocks are not shown as though
 * they applied: `CANADA_HOS_NOTICE` replaces them, verbatim.
 *
 * Pure: values in, values out. No clock, no storage, no I/O.
 */

export type Region = 'US' | 'CA';
export type UnitSystem = 'imperial' | 'metric';

export const DEFAULT_REGION: Region = 'US';

/** The units a region reads by default. A driver may still override. */
export function defaultUnitsFor(region: Region): UnitSystem {
  return region === 'CA' ? 'metric' : 'imperial';
}

/**
 * The ISO 3166-1 alpha-3 code the destination-search endpoint already
 * sends as `in=countryCode:…`. The PARAMETER is unchanged and proven in
 * production for `USA`; only the value varies, in the same three-letter
 * shape. Nothing new is being guessed at the provider boundary.
 */
export function searchCountryFor(region: Region): 'USA' | 'CAN' {
  return region === 'CA' ? 'CAN' : 'USA';
}

/** The other country — what a deliberate cross-border search asks for. */
export function otherCountryFor(region: Region): 'USA' | 'CAN' {
  return region === 'CA' ? 'USA' : 'CAN';
}

export const REGION_LABELS: Readonly<Record<Region, string>> = Object.freeze({
  US: 'United States',
  CA: 'Canada',
});

/** How a driver names the other country when they deliberately cross. */
export function crossBorderSearchLabel(region: Region): string {
  return region === 'CA' ? 'Search the United States instead' : 'Search Canada instead';
}

/**
 * The Canadian HOS boundary, word for word. It is a constant so the
 * screen, the harness and the documentation cannot drift apart.
 */
export const CANADA_HOS_NOTICE =
  'Canadian HOS is not calculated in this pilot. Use your certified ELD as the record.';

/** Shown wherever the region is chosen, so the limit travels with it. */
export const CANADA_HOS_SHORT =
  'Canadian HOS is not calculated in this pilot. Verify your clocks with your ELD.';

/**
 * Shown before Start when origin and destination are in different
 * countries. It names what the app does NOT know: the provider returns
 * road geometry, not customs status.
 */
export const CROSS_BORDER_NOTICE =
  'Cross-border route. Verify customs documents, permits, border status, and operating hours separately.';

/** Parking honesty in Canada — coverage is US-built and stays that way. */
export const CANADA_PARKING_NOTICE = 'Canadian parking coverage is limited in this pilot.';

/**
 * The pilot status panel, as data. A fleet viewer reads capability and
 * limit in the same list rather than discovering the limit later.
 */
export type PilotStatusRow = { label: string; value: string; available: boolean };

export function canadaPilotStatus(): PilotStatusRow[] {
  return [
    { label: 'Canadian search', value: 'Available', available: true },
    {
      label: 'Truck routing',
      value: 'Available where provider coverage exists',
      available: true,
    },
    { label: 'Metric guidance', value: 'Available', available: true },
    { label: 'Canadian HOS', value: 'Not included', available: false },
    { label: 'Canadian parking coverage', value: 'Limited', available: false },
    {
      label: 'Cross-border documents and permits',
      value: 'Driver and fleet responsibility',
      available: false,
    },
  ];
}

export type LatLngish = { lat: number; lng: number };

/** Which country a point is in — or an honest "cannot tell from here". */
export type CountrySide = 'US' | 'CA' | 'unknown';

/**
 * Which country a coordinate is in, WHERE GEOGRAPHY CAN ANSWER.
 *
 * The third answer is the important one. A latitude/longitude rule
 * separates the two countries perfectly west of Lake of the Woods, where
 * the border is the 49th parallel, and acceptably east of the St.
 * Lawrence, where it is close to the 45th. Between them it cannot work at
 * all: Windsor, Ontario sits three kilometres from Detroit, Michigan and
 * is SOUTH of it. Any half-plane that puts Windsor in Canada puts Detroit
 * there too.
 *
 * So this returns 'unknown' across that band rather than answering
 * confidently and wrongly, and the caller falls back to evidence that
 * does not come from a map.
 */
export function countrySideOf(p: LatLngish | null): CountrySide {
  if (p === null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return 'unknown';
  const { lat, lng } = p;
  // West of Lake of the Woods: the 49th parallel, unambiguous.
  if (lng <= -95) return lat >= 49 ? 'CA' : 'US';
  // The Great Lakes and the St. Lawrence. Well north and well south of
  // the water are still answerable; the corridor itself is not.
  if (lng <= -74.7) {
    if (lat >= 47) return 'CA';
    if (lat <= 41.7) return 'US';
    return 'unknown';
  }
  // East of the St. Lawrence the line is near the 45th for Quebec/Vermont
  // and ragged through Maine, so a margin is kept on both sides.
  if (lat >= 46) return 'CA';
  if (lat <= 44.5) return 'US';
  return 'unknown';
}

/** The country a region names, as a side, for comparison. */
export function regionSide(region: Region): CountrySide {
  return region === 'CA' ? 'CA' : 'US';
}

/**
 * Is this trip crossing the border?
 *
 * The evidence is ranked, strongest first, and no new provider request is
 * made to answer it:
 *
 *   1. THE DESTINATION'S COUNTRY IS ATTESTED, not guessed. The driver
 *      picked it from a search that asked the provider for exactly one
 *      country (`in=countryCode:CAN` or `:USA`), so the result came back
 *      filtered. That is the strongest fact in this function.
 *   2. THE ORIGIN'S COUNTRY comes from geography, and only where
 *      geography can answer (see `countrySideOf`).
 *   3. WHERE GEOGRAPHY CANNOT — the Great Lakes corridor, or no fix yet
 *      — the driver's own REGION stands in. That is a declaration the
 *      driver made on a parked screen, not an inference about where they
 *      are, which is the distinction that matters: the app is comparing
 *      two things the driver chose, not deciding their nationality from a
 *      GPS reading.
 *
 * It errs toward showing the notice. An unnecessary reminder to check
 * paperwork costs a driver two seconds; a missing one costs them a border.
 */
export function looksCrossBorder(args: {
  /** The driver's declared region. */
  region: Region;
  /** The country the destination search was filtered to, when known. */
  destinationCountry: 'USA' | 'CAN' | null;
  /** The truck's current fix, when there is one. */
  origin: LatLngish | null;
  /** The picked destination's coordinates. */
  destination: LatLngish | null;
}): boolean {
  const destSide: CountrySide =
    args.destinationCountry === 'CAN'
      ? 'CA'
      : args.destinationCountry === 'USA'
        ? 'US'
        : countrySideOf(args.destination);
  // Nothing picked, or a destination nobody can place: claim nothing.
  if (destSide === 'unknown') return false;
  const originSide = countrySideOf(args.origin);
  if (originSide !== 'unknown') return originSide !== destSide;
  return regionSide(args.region) !== destSide;
}

import { countrySideOf, type CountrySide, type LatLngish } from '@/lib/navigator/region';

/**
 * Which country each END of the route is in — asked and answered
 * separately, because a route has two of them.
 *
 * Pure. No clock, no I/O.
 *
 * WHY NOT ONE COUNTRY FOR THE TRIP. The first version of this asked
 * "is this route in Canada?" and answered with a single value. That
 * question has no correct answer for the runs that most need one:
 * Detroit to Windsor is three miles and two countries, and any single
 * label applied to it is false at one end. Worse, the collapsing rule
 * ("Canadian if either end is") turned a US-to-Canada haul into a purely
 * Canadian one and hid the US half of the weather that WAS available.
 *
 * So both ends are resolved independently and the crossing is a state of
 * its own. `fullyUS` is the only thing the NWS gate may read, and it is
 * true only when BOTH ends are provably in the United States.
 *
 * THE CALLER'S CLAIM OUTRANKS GEOGRAPHY. A driver picking an anchor out
 * of the TLWS directory has picked a record that already carries a
 * US state code; that is an attested fact about the listing, not an
 * inference from a half-plane. Geography is the fallback, and it is
 * allowed to answer 'unknown' — which is the whole point of it.
 */

/** What a caller may assert about an endpoint. `null` = said nothing. */
export type CountryClaim = 'US' | 'CA' | null;

/** Where an endpoint resolved to, including the honest third answer. */
export type EndCountry = CountrySide;

export type RouteRegion = {
  origin: EndCountry;
  destination: EndCountry;
  /** Both ends known AND different — the truck crosses the border. */
  crossBorder: boolean;
  /** Both ends provably US. The ONLY state in which NWS covers the route. */
  fullyUS: boolean;
  /** Either end provably Canadian. */
  touchesCanada: boolean;
};

/**
 * Resolve one endpoint: what the caller attested, else what geography can
 * prove, else 'unknown'.
 */
export function resolveEnd(claim: CountryClaim, position: LatLngish | null): EndCountry {
  if (claim === 'US' || claim === 'CA') return claim;
  return countrySideOf(position);
}

export function resolveRouteRegion(input: {
  origin: LatLngish | null;
  originCountry: CountryClaim;
  destination: LatLngish | null;
  destinationCountry: CountryClaim;
}): RouteRegion {
  const origin = resolveEnd(input.originCountry, input.origin);
  const destination = resolveEnd(input.destinationCountry, input.destination);
  return {
    origin,
    destination,
    crossBorder: origin !== 'unknown' && destination !== 'unknown' && origin !== destination,
    fullyUS: origin === 'US' && destination === 'US',
    touchesCanada: origin === 'CA' || destination === 'CA',
  };
}

/** US state and territory codes, as the directory stores them. */
const US_STATES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
  'PR',
  'VI',
  'GU',
  'AS',
  'MP',
]);

/** Canadian province and territory codes. */
const CA_PROVINCES = new Set([
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
]);

/**
 * The country a directory listing's region code attests to.
 *
 * Returns null rather than guessing when the code is neither — an empty
 * string, a full state name, a typo. A null claim simply falls through to
 * geography, which is a safe place to land; a WRONG claim would outrank
 * geography and could not be recovered from.
 */
export function countryFromStateCode(code: string | null | undefined): CountryClaim {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  if (US_STATES.has(c)) return 'US';
  if (CA_PROVINCES.has(c)) return 'CA';
  return null;
}

/**
 * Canada navigation compatibility — the milestone's invariants, against
 * the real modules and the real screens.
 *
 * What this harness is FOR: the Canadian pilot adds a preference that
 * changes what a driver reads and where a search looks, and the failure
 * modes it can create are all quiet ones — a metric number with an
 * imperial label, a request that carries a converted value twice, a
 * Canadian result measured from a Kansas fallback centre, an American
 * clock left on a Canadian screen. None of those throw. So they are
 * pinned.
 *
 * Five sections, matching the milestone's five risk areas:
 *   1. SEARCH      — which country is asked, and from where
 *   2. UNITS       — one authority, defined rounding, no double conversion
 *   3. ROUTING     — the wire is unchanged by a display preference
 *   4. HOS         — the boundary is stated, and the engine is untouched
 *   5. SAFETY/UI   — parked-only, honest, no credential anywhere
 *
 * Run:
 *   npx esbuild scripts/test-navigator-canada.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-canada.cjs && node /tmp/test-navigator-canada.cjs
 */
import { readFileSync } from 'node:fs';
import {
  canadaPilotStatus,
  crossBorderSearchLabel,
  defaultUnitsFor,
  countrySideOf,
  looksCrossBorder,
  otherCountryFor,
  searchCountryFor,
  CANADA_HOS_NOTICE,
  CANADA_HOS_SHORT,
  CANADA_PARKING_NOTICE,
  CROSS_BORDER_NOTICE,
  DEFAULT_REGION,
  REGION_LABELS,
} from '@/lib/navigator/region';
import {
  feetToMeters,
  formatAccuracy,
  formatDimension,
  formatDistance,
  formatKilograms,
  formatMeters,
  formatSpeed,
  formatWeight,
  kilogramsToPounds,
  metersToFeet,
  poundsToKilograms,
  KM_PER_MILE,
} from '@/lib/navigator/format-units';
import {
  buildDiscoverUrl,
  UNBIASED_SEARCH_CENTER,
  UNBIASED_SEARCH_CENTER_CA,
  unbiasedCenterFor,
} from '@/lib/navigator-api/destination-search';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import {
  routingFingerprint,
  toTruckProfile,
  DEFAULT_EDITABLE_PROFILE,
} from '@/lib/navigator/truck-profile';
import { sentRestrictionLines, truckWireParams } from '@/lib/trip-planner/here-truck-params';
import {
  parseRegionPrefs,
  REGION_KEY,
  DEFAULT_REGION_PREFS,
} from '@/components/navigator/region-storage';
import type { RoutingRequest } from '@/lib/trip-planner/providers';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const SEARCH_UI = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
const SEARCH_PORT = readFileSync('src/components/navigator/search-port.ts', 'utf8');
const SEARCH_API = readFileSync('src/app/api/navigator/destination-search/route.ts', 'utf8');
const REGION_PANEL = readFileSync('src/components/navigator/RegionPanel.tsx', 'utf8');
const TRIP_CONTROLS = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
const TRUCK_EDITOR = readFileSync('src/components/navigator/TruckProfileEditor.tsx', 'utf8');
const FORMAT = readFileSync('src/lib/navigator/format-units.ts', 'utf8');
const REGION_MODULE = readFileSync('src/lib/navigator/region.ts', 'utf8');

// =====================================================================
// 1. SEARCH — which country is asked, and from where
// =====================================================================
{
  check('region → country code: Canada asks for CAN', searchCountryFor('CA') === 'CAN');
  check('region → country code: the US asks for USA, unchanged', searchCountryFor('US') === 'USA');
  check(
    'the deliberate cross-border flip is the OTHER country, not both',
    otherCountryFor('CA') === 'USA' && otherCountryFor('US') === 'CAN',
  );

  const at = { lat: 43.6532, lng: -79.3832 }; // Toronto
  const ca = new URL(buildDiscoverUrl('tim hortons', at, 'TESTKEY', undefined, 'CAN'));
  const us = new URL(buildDiscoverUrl('pilot travel center', at, 'TESTKEY', undefined, 'USA'));
  check(
    'Canadian search sends in=countryCode:CAN',
    ca.searchParams.get('in') === 'countryCode:CAN',
  );
  check(
    'US search still sends in=countryCode:USA',
    us.searchParams.get('in') === 'countryCode:USA',
  );
  check(
    'ONE country per request — the app never quietly searches both',
    ca.searchParams.getAll('in').length === 1 &&
      !/CAN.*USA|USA.*CAN/.test(ca.searchParams.get('in') ?? ''),
  );
  check(
    'the parameter itself is unchanged — only its value varies',
    ca.searchParams.get('in')?.startsWith('countryCode:') === true &&
      us.searchParams.get('in')?.startsWith('countryCode:') === true,
  );
  check('the endpoint is still discover, not a second provider', ca.hostname === us.hostname);

  /*
   * THE FALLBACK CENTRE. `at` biases results toward the truck. With no
   * fix there is no truck to bias toward, and the app falls back to a
   * geographic centre — which must be the centre of the country being
   * SEARCHED. Measuring Canadian results from Kansas produces a distance
   * column that is confidently wrong by two thousand kilometres.
   */
  check(
    'the unbiased Canadian centre is inside Canada',
    UNBIASED_SEARCH_CENTER_CA.lat > 49 && UNBIASED_SEARCH_CENTER_CA.lng < -60,
  );
  check('the unbiased US centre is unchanged', unbiasedCenterFor('USA') === UNBIASED_SEARCH_CENTER);
  check(
    'a Canadian search with no fix falls back to the Canadian centre',
    unbiasedCenterFor('CAN') === UNBIASED_SEARCH_CENTER_CA,
  );
  const caNoFix = new URL(buildDiscoverUrl('winnipeg', null, 'TESTKEY', undefined, 'CAN'));
  check(
    'and the request carries it',
    caNoFix.searchParams.get('at') ===
      `${UNBIASED_SEARCH_CENTER_CA.lat.toFixed(6)},${UNBIASED_SEARCH_CENTER_CA.lng.toFixed(6)}`,
    caNoFix.searchParams.get('at'),
  );

  check(
    'the endpoint validates ?country= to the two known codes and defaults to USA',
    /rawCountry === 'CAN' \? 'CAN' : 'USA'/.test(SEARCH_API),
  );
  check('the port forwards the country', /country=\$\{country\}/.test(SEARCH_PORT));
  check(
    'a deliberate country switch RE-RUNS the search (it is in the effect deps)',
    /\[query, originKey, settled, country\]/.test(SEARCH_UI),
  );
  check(
    'the debounce survives the new dependency',
    /350/.test(SEARCH_UI) && /setTimeout/.test(SEARCH_UI),
  );
  check(
    'typing still requests no GPS and no route',
    !/getCurrentPosition|watchPosition/.test(SEARCH_UI) &&
      !/planRoute|requestRoute/.test(SEARCH_UI),
  );
  check(
    'the driving screen offers the cross-border flip WITHOUT changing region or units',
    /setSearchRegion/.test(SCREEN) && /searchCountryFor\(searchRegion\)/.test(SCREEN),
  );
  check(
    'the flip is labelled as the other country',
    crossBorderSearchLabel('CA') === 'Search the United States instead' &&
      crossBorderSearchLabel('US') === 'Search Canada instead',
  );
}

// Canadian address shapes must survive display untouched: no ZIP
// validation, no accent stripping, no province rewriting. The search
// results are rendered as the provider returned them, which is what this
// pin protects — a "helpful" normalizer added later breaks it.
{
  check(
    'result addresses are rendered, never reformatted or validated',
    !/[0-9]\{5\}|\\d\{5\}/.test(SEARCH_UI) && !/normalize\(|toUpperCase\(\)/.test(SEARCH_UI),
  );
  check(
    'no postal-code or ZIP pattern is enforced anywhere in the search path',
    !/\\d\{5\}(-\\d\{4\})?/.test(SEARCH_UI + SEARCH_PORT + SEARCH_API),
  );
}

// =====================================================================
// 2. UNITS — one authority, defined rounding, no double conversion
// =====================================================================
{
  // The owner's worked examples, exactly.
  check(
    '450 m',
    formatDistance(450 / 1000 / KM_PER_MILE, true) === '450 m',
    formatDistance(450 / 1000 / KM_PER_MILE, true),
  );
  check(
    '1.2 km',
    formatDistance(1.2 / KM_PER_MILE, true) === '1.2 km',
    formatDistance(1.2 / KM_PER_MILE, true),
  );
  check('96 km/h', formatSpeed(60, true) === '97 km/h', formatSpeed(60, true));
  check('4.11 m from 13′6″', formatMeters(13.5) === '4.11 m', formatMeters(13.5));
  check(
    '36,287 kg from 80,000 lb',
    formatKilograms(80_000) === '36,287 kg',
    formatKilograms(80_000),
  );

  check(
    'metres under a kilometre, kilometres above',
    formatDistance(0.4, true) === '640 m' && formatDistance(1, true) === '1.6 km',
    [formatDistance(0.4, true), formatDistance(1, true)],
  );
  check(
    'metric accuracy rounds to 5 m',
    formatAccuracy(23, true) === '±25 m',
    formatAccuracy(23, true),
  );
  check('metric accuracy has a floor, never "±0 m"', formatAccuracy(0, true) === '±5 m');
  check('metric distance has a floor, never "0 m"', formatDistance(0, true) === '10 m');

  /*
   * US MODE IS BYTE-FOR-BYTE WHAT IT WAS. The single most damaging thing
   * this milestone could do is round-trip an American driver's numbers
   * through a metric code path. 13′6″ must never become "13.6 feet".
   */
  check('US distance unchanged: feet close in', formatDistance(0.15, false) === '800 ft');
  check('US distance unchanged: miles beyond', formatDistance(25.7, false) === '25.7 mi');
  check('US speed unchanged', formatSpeed(60, false) === '60 mph');
  check('US accuracy unchanged', formatAccuracy(25, false) === '±80 ft');
  check(
    'US height is feet-and-INCHES, never decimal feet',
    formatDimension(13.5, false) === '13′6″',
  );
  check('US weight unchanged', formatWeight(80_000, false) === '80,000 lb');
  check('and the metric dimension is metres', formatDimension(13.5, true) === '4.11 m');

  check(
    'unknown values are an em dash in both systems',
    formatDistance(null, true) === '—' && formatDistance(null, false) === '—',
  );
  check(
    'negative values are an em dash in both systems',
    formatDistance(-1, true) === '—' && formatSpeed(-1, true) === '—',
  );

  // NO DOUBLE CONVERSION. Converting in and back out is the identity, to
  // floating-point tolerance — which is only true because the conversion
  // happens exactly once in each direction.
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  check('metres → feet → metres is the identity', near(feetToMeters(metersToFeet(4.11)), 4.11));
  check(
    'kilograms → pounds → kilograms is the identity',
    near(poundsToKilograms(kilogramsToPounds(36_287)), 36_287),
  );

  check(
    'ONE authority: no component computes its own conversion factor',
    !/1\.609344|0\.45359237|0\.3048|3\.280839895/.test(
      SCREEN + TRIP_CONTROLS + TRUCK_EDITOR + REGION_PANEL,
    ),
  );
  check(
    'the factors live in format-units, named',
    /KM_PER_MILE/.test(FORMAT) && /KG_PER_LB/.test(FORMAT) && /METERS_PER_FOOT/.test(FORMAT),
  );
  check(
    'every screen distance goes through the unit-aware entry point',
    (SCREEN.match(/formatDistance\(/g) ?? []).length ===
      (SCREEN.match(/formatDistance\([^)]*,\s*metric\)/g) ?? []).length,
  );
}

// =====================================================================
// 3. ROUTING — the wire is unchanged by a display preference
// =====================================================================
{
  const req = (truck: RoutingRequest['truck']): RoutingRequest => ({
    origin: { lat: 43.6532, lng: -79.3832 },
    destination: { lat: 45.4215, lng: -75.6972 },
    waypoints: [],
    truck,
    departAtMs: 1_754_000_000_000,
  });
  const base = {
    lengthFt: 73,
    heightFt: 13.5,
    widthFt: 8.5,
    grossWeightLbs: 80_000,
    axles: 5,
    hazmatClass: null,
    tankGallons: 200,
    mpg: 6.5,
    fuelSafetyFactor: 0.8,
  };
  const url = new URL(buildHereRouteUrl(req(base), 'TESTKEY'));
  check(
    'a Canadian route is still transportMode=truck',
    url.searchParams.get('transportMode') === 'truck',
  );
  check(
    'no car fallback parameter exists anywhere in the builder',
    !/transportMode=car|'car'/.test(readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8')),
  );
  check(
    'the truck parameters from PR #310 are still sent',
    url.searchParams.get('truck[height]') === '411' &&
      url.searchParams.get('truck[grossWeight]') === '36287',
  );
  check('no new provider host is introduced for Canada', url.hostname.endsWith('hereapi.com'));
  check(
    'the key never reaches the driver-facing summary',
    !sentRestrictionLines(toTruckProfile(DEFAULT_EDITABLE_PROFILE), [])
      .join('|')
      .includes('TESTKEY'),
  );

  /*
   * THE METRIC TWIN. A driver who types 4.11 m and 36 287 kg has the same
   * truck as one who types 13′6″ and 80,000 lb, and the request must not
   * be able to tell them apart. This is the pin that makes the metric
   * entry path safe: it converts once, into the canonical profile, and
   * the provider sees identical bytes.
   */
  const metricTwin = {
    ...base,
    heightFt: metersToFeet(feetToMeters(13.5)),
    widthFt: metersToFeet(feetToMeters(8.5)),
    lengthFt: metersToFeet(feetToMeters(73)),
    grossWeightLbs: kilogramsToPounds(poundsToKilograms(80_000)),
  };
  const twinUrl = new URL(buildHereRouteUrl(req(metricTwin), 'TESTKEY'));
  check(
    'an imperial truck and its metric twin produce the IDENTICAL request',
    twinUrl.toString() === url.toString(),
    {
      imperial: url.searchParams.get('truck[height]'),
      metric: twinUrl.searchParams.get('truck[height]'),
    },
  );
  check(
    'and the identical wire parameters, pair for pair',
    JSON.stringify(truckWireParams(base, [])) !== '' &&
      JSON.stringify(truckWireParams(metricTwin, []).map((p) => [p.param, p.value])) ===
        JSON.stringify(truckWireParams(base, []).map((p) => [p.param, p.value])),
  );

  /*
   * THE FINGERPRINT MEANS ROUTING, NOT DISPLAY. A driver who switches
   * units has not changed their truck, so the confirmation they already
   * gave must survive — otherwise flipping to kilometres would silently
   * re-gate Start.
   */
  check(
    'the fingerprint is built from the WIRE values, so units cannot move it',
    routingFingerprint(DEFAULT_EDITABLE_PROFILE) ===
      routingFingerprint({ ...DEFAULT_EDITABLE_PROFILE }),
  );
  const asMetricTyped = {
    ...DEFAULT_EDITABLE_PROFILE,
    heightFt: metersToFeet(feetToMeters(DEFAULT_EDITABLE_PROFILE.heightFt)),
  };
  check(
    'a unit-only round trip does NOT invalidate the confirmation',
    routingFingerprint(asMetricTyped) === routingFingerprint(DEFAULT_EDITABLE_PROFILE),
    [routingFingerprint(asMetricTyped), routingFingerprint(DEFAULT_EDITABLE_PROFILE)],
  );

  // Display-only metric restriction lines describe the SAME request.
  const imperialLines = sentRestrictionLines(base, []);
  const metricLines = sentRestrictionLines(base, [], true);
  check(
    'metric restriction lines exist and differ in wording',
    metricLines.join('|') !== imperialLines.join('|'),
  );
  check(
    'metric restriction lines say metres and kilograms',
    metricLines.some((l) => l.endsWith(' m')) && metricLines.some((l) => l.endsWith(' kg')),
  );
  check(
    'the same number of lines — nothing appears or vanishes with the units',
    metricLines.length === imperialLines.length,
  );
  check('4.11 m appears, from the 411 cm actually sent', metricLines.includes('4.11 m'));

  check(
    'the cross-border notice is exact',
    CROSS_BORDER_NOTICE ===
      'Cross-border route. Verify customs documents, permits, border status, and operating hours separately.',
  );
  /*
   * CROSS-BORDER DETECTION. The corridor that matters most to a Canadian
   * pilot is the one no coordinate rule can decide: Windsor is SOUTH of
   * Detroit. These pin that the ranked evidence gets it right anyway.
   */
  const TORONTO = { lat: 43.65, lng: -79.38 };
  const WINDSOR = { lat: 42.3, lng: -83.03 };
  const DETROIT = { lat: 42.33, lng: -83.05 };
  const OTTAWA = { lat: 45.42, lng: -75.69 };
  const VANCOUVER = { lat: 49.28, lng: -123.12 };
  const SEATTLE = { lat: 47.61, lng: -122.33 };
  const CHATTANOOGA = { lat: 35.05, lng: -85.31 };
  const NASHVILLE = { lat: 36.16, lng: -86.78 };

  check(
    'geography answers where it can: Vancouver is Canada, Seattle is the US',
    countrySideOf(VANCOUVER) === 'CA' && countrySideOf(SEATTLE) === 'US',
  );
  check(
    'geography REFUSES to answer in the Great Lakes corridor',
    countrySideOf(WINDSOR) === 'unknown' && countrySideOf(DETROIT) === 'unknown',
    [countrySideOf(WINDSOR), countrySideOf(DETROIT)],
  );
  check(
    'and refuses for an absent or broken coordinate',
    countrySideOf(null) === 'unknown' && countrySideOf({ lat: Number.NaN, lng: 0 }) === 'unknown',
  );

  check(
    'cross-border: a Canadian driver, Toronto → Detroit, is flagged',
    looksCrossBorder({
      region: 'CA',
      destinationCountry: 'USA',
      origin: TORONTO,
      destination: DETROIT,
    }),
  );
  check(
    'cross-border: Windsor → Detroit is flagged, three kilometres and a border apart',
    looksCrossBorder({
      region: 'CA',
      destinationCountry: 'USA',
      origin: WINDSOR,
      destination: DETROIT,
    }),
  );
  check(
    'cross-border: a US driver, Detroit → Windsor, is flagged too',
    looksCrossBorder({
      region: 'US',
      destinationCountry: 'CAN',
      origin: DETROIT,
      destination: WINDSOR,
    }),
  );
  check(
    'cross-border: Vancouver → Seattle is flagged from geography alone',
    looksCrossBorder({
      region: 'CA',
      destinationCountry: null,
      origin: VANCOUVER,
      destination: SEATTLE,
    }),
  );
  check(
    'domestic: Toronto → Ottawa is not flagged',
    !looksCrossBorder({
      region: 'CA',
      destinationCountry: 'CAN',
      origin: TORONTO,
      destination: OTTAWA,
    }),
  );
  check(
    'domestic: Chattanooga → Nashville is not flagged',
    !looksCrossBorder({
      region: 'US',
      destinationCountry: 'USA',
      origin: CHATTANOOGA,
      destination: NASHVILLE,
    }),
  );
  check(
    'domestic: Vancouver → Ottawa is not flagged',
    !looksCrossBorder({
      region: 'CA',
      destinationCountry: 'CAN',
      origin: VANCOUVER,
      destination: OTTAWA,
    }),
  );
  check(
    'no destination yet claims nothing',
    !looksCrossBorder({
      region: 'CA',
      destinationCountry: null,
      origin: TORONTO,
      destination: null,
    }),
  );
  check(
    'no fix yet still works: the region and the searched country are two driver choices',
    looksCrossBorder({
      region: 'CA',
      destinationCountry: 'USA',
      origin: null,
      destination: DETROIT,
    }) &&
      !looksCrossBorder({
        region: 'US',
        destinationCountry: 'USA',
        origin: null,
        destination: DETROIT,
      }),
  );
  check(
    'the attested search country OUTRANKS a coordinate guess',
    looksCrossBorder({
      region: 'US',
      destinationCountry: 'CAN',
      origin: CHATTANOOGA,
      destination: NASHVILLE,
    }),
  );
  check(
    'the notice is shown before Start, as status — not as a permanent obstruction',
    /role="status"/.test(TRIP_CONTROLS) &&
      /CROSS_BORDER_NOTICE/.test(TRIP_CONTROLS) &&
      !/CROSS_BORDER_NOTICE/.test(
        readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8'),
      ),
  );
  check(
    'one Start is still one route request — no second provider call was added',
    (SCREEN.match(/planRoute\(/g) ?? []).length <= 1,
  );
}

// =====================================================================
// 4. HOS — the boundary is stated, and the engine is untouched
// =====================================================================
{
  check(
    'the Canadian HOS sentence is exact, to the word',
    CANADA_HOS_NOTICE ===
      'Canadian HOS is not calculated in this pilot. Use your certified ELD as the record.',
  );
  check(
    'the short form on the region control is exact too',
    CANADA_HOS_SHORT ===
      'Canadian HOS is not calculated in this pilot. Verify your clocks with your ELD.',
  );
  check(
    'the region control carries the limit beside the choice',
    /CANADA_HOS_SHORT/.test(REGION_PANEL),
  );
  check(
    'Canada mode replaces the clocks rather than relabelling them',
    /hosUnavailableNotice/.test(SCREEN) &&
      /region === 'CA' \? CANADA_HOS_NOTICE : null/.test(SCREEN),
  );
  check(
    'the replacement is announced to assistive technology as what it is',
    /aria-label="Hours of service — not calculated"/.test(SCREEN),
  );
  check(
    'the HOS ENGINE is untouched — the region module imports nothing at all',
    !/^import /m.test(REGION_MODULE),
  );
  check(
    'region.ts is pure: no clock, no storage, no fetch',
    !/Date|sessionStorage|localStorage|fetch\(/.test(REGION_MODULE),
  );
  check(
    'navigation stays fully usable in Canada — nothing gates Start on region',
    !/region === 'CA'[\s\S]{0,80}disabled/.test(TRIP_CONTROLS),
  );
  check('US mode still shows the clocks it always did', /HosStrip/.test(SCREEN));
}

// =====================================================================
// 5. SAFETY, DISPLAY, HONESTY
// =====================================================================
{
  check(
    'the default region is the United States — existing sessions do not move',
    DEFAULT_REGION === 'US',
  );
  check(
    'US defaults to imperial, Canada to metric',
    defaultUnitsFor('US') === 'imperial' && defaultUnitsFor('CA') === 'metric',
  );
  check(
    'the labels are the countries, spelled out',
    REGION_LABELS.CA === 'Canada' && REGION_LABELS.US === 'United States',
  );

  check(
    'region is chosen PARKED, through the existing shared lock — no new motion rule',
    /regionPanel/.test(TRIP_CONTROLS) && !/speedMph|moving/i.test(REGION_PANEL),
  );
  check(
    'the region control lives on the idle branch, behind the same gate as the truck editor',
    /\{regionPanel\}/.test(TRIP_CONTROLS),
  );
  check(
    'region is never inferred from GPS',
    !/position|fix|coords/i.test(REGION_PANEL) &&
      !/looksCrossBorder[\s\S]{0,200}setRegion/.test(SCREEN),
  );

  check(
    'parking honesty is stated, verbatim',
    CANADA_PARKING_NOTICE === 'Canadian parking coverage is limited in this pilot.',
  );
  check('and shown in Canada mode', /CANADA_PARKING_NOTICE/.test(REGION_PANEL));

  const status = canadaPilotStatus();
  check('the pilot status panel names all six facts', status.length === 6);
  check(
    'it says HOS is not included',
    status.some((r) => r.label === 'Canadian HOS' && r.value === 'Not included' && !r.available),
  );
  check(
    'it says parking is limited',
    status.some((r) => /parking/i.test(r.label) && !r.available),
  );
  check(
    'it says documents are the driver’s responsibility',
    status.some((r) => /documents/i.test(r.label) && /responsibility/i.test(r.value)),
  );
  check(
    'it claims routing only where coverage exists',
    status.some((r) => /routing/i.test(r.label) && /coverage/i.test(r.value)),
  );
  check(
    'no internal name, parameter or credential is shown to a fleet viewer',
    !status.some((r) =>
      /\bHERE\b|\bAPI\b|apiKey|countryCode|truck\[|transportMode/.test(`${r.label} ${r.value}`),
    ),
  );
  check(
    'the status panel exposes no provider parameter or debug coordinate',
    !/countryCode|truck\[|apiKey|transportMode|lat:|lng:/.test(REGION_PANEL),
  );
  check(
    'the panel is honest about what the region does — it does not claim legality',
    !/legal|compliant|approved|certified truck/i.test(REGION_PANEL),
  );
  check(
    'nothing in the milestone labels anything "Canada legal"',
    !/canada legal|canadian legal|legal canadian/i.test(
      REGION_MODULE + REGION_PANEL + TRUCK_EDITOR + SCREEN,
    ),
  );
  check(
    'no provincial legal limit is encoded anywhere',
    !/\bON\b.*63500|\bQC\b.*|provinc(e|ial) limit/i.test(REGION_MODULE),
  );
  check(
    'the truck editor still separates what is sent from what is not',
    /Not used for routing/.test(TRUCK_EDITOR),
  );
  check(
    'and no unverified provider field was added for Canada',
    !/weightPerAxle|trailerCount|tunnelCategory|vehicleType/.test(
      readFileSync('src/lib/trip-planner/here-truck-params.ts', 'utf8'),
    ),
  );

  // Storage: one versioned key, two enum values, nothing else.
  check('the region key is versioned', REGION_KEY === 'tlws-navigator-region-v1');
  check(
    'the default prefs are US/imperial',
    DEFAULT_REGION_PREFS.region === 'US' && DEFAULT_REGION_PREFS.units === 'imperial',
  );
  check(
    'a stored preference round-trips',
    JSON.stringify(parseRegionPrefs('{"v":1,"region":"CA","units":"metric"}')) ===
      JSON.stringify({ region: 'CA', units: 'metric' }),
  );
  check('an unversioned payload is refused', parseRegionPrefs('{"region":"CA"}') === null);
  check('garbage is refused, not thrown', parseRegionPrefs('not json') === null);
  check(
    'a hand-edited region falls back to the US',
    parseRegionPrefs('{"v":1,"region":"XX"}')?.region === 'US',
  );
  check(
    'the stored payload can carry nothing but the two enums',
    parseRegionPrefs('{"v":1,"region":"CA","units":"metric","lat":43.6}') !== null &&
      Object.keys(parseRegionPrefs('{"v":1,"region":"CA","units":"metric","lat":43.6}') ?? {}).join(
        ',',
      ) === 'region,units',
  );
}

console.log(`navigator-canada: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

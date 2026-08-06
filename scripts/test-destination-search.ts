/**
 * Pilot round 1 — destination search. The live road test entered raw
 * latitude/longitude; drivers must search for real places instead, and a
 * coordinate must never appear in the driver UI.
 *
 * Covers: the HERE discover URL, response parsing (including malformed and
 * hostile payloads), facility classification, and the endpoint's rails
 * (flag gate, config honesty, limiter, bounded input, no key leakage),
 * plus the screen wiring that proves coordinate entry is gone from the
 * driver flow.
 *
 * Run: npx esbuild scripts/test-destination-search.ts --bundle \
 *   --platform=node --format=cjs --alias:@=./src \
 *   --outfile=/tmp/test-destination-search.cjs && node /tmp/...
 */
import { readFileSync } from 'node:fs';
import {
  buildDiscoverUrl,
  parseDiscoverResponse,
  classifyFacility,
  MIN_SEARCH_LENGTH,
  MAX_SEARCH_RESULTS,
} from '@/lib/navigator-api/destination-search';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const AT = { lat: 34.9157, lng: -85.1095 };

// ------------------------------------------------------------ URL building
{
  const url = new URL(buildDiscoverUrl('pilot travel center', AT, 'TESTKEY'));
  check(
    'url: discover endpoint (POIs AND addresses, not geocode-only)',
    url.host.startsWith('discover.search'),
  );
  check('url: query forwarded verbatim', url.searchParams.get('q') === 'pilot travel center');
  check(
    'url: results biased to the truck position',
    url.searchParams.get('at') === '34.915700,-85.109500',
  );
  check('url: US-only', url.searchParams.get('in') === 'countryCode:USA');
  check('url: key present as a param', url.searchParams.get('apiKey') === 'TESTKEY');
  check(
    'url: limit clamped into range',
    new URL(buildDiscoverUrl('q', AT, 'k', 99)).searchParams.get('limit') === '20' &&
      new URL(buildDiscoverUrl('q', AT, 'k', 0)).searchParams.get('limit') === '1',
  );
}

// --------------------------------------------------------------- parsing
{
  const body = {
    items: [
      {
        id: 'here:pds:place:1',
        title: 'Pilot Travel Center',
        address: { label: '123 Alabama Hwy, Ringgold, GA 30736' },
        position: { lat: 34.92, lng: -85.11 },
        distance: 1609,
        categories: [{ id: '700-7600-0116' }],
      },
      {
        id: 'here:pds:place:2',
        title: 'Costco Distribution Center',
        address: { label: '500 Industrial Blvd, Dalton, GA' },
        position: { lat: 34.77, lng: -84.97 },
        distance: 16093,
        categories: [{ id: '800-8600-0197' }],
      },
      // Dropped: no usable coordinate — a destination the router cannot use.
      { id: 'x', title: 'Broken', position: { lat: 'nope', lng: -85 } },
      { id: 'y', title: 'Out of range', position: { lat: 991, lng: -85 } },
    ],
  };
  const places = parseDiscoverResponse(body);
  check('parse: only usable places survive', places.length === 2, places.length);
  check(
    'parse: title and address both retained',
    places[0].title === 'Pilot Travel Center' && places[0].address.includes('Ringgold'),
  );
  check(
    'parse: position preserved exactly',
    places[0].position.lat === 34.92 && places[0].position.lng === -85.11,
  );
  check(
    'parse: distance converted to miles',
    places[0].distanceMi === 1.0 && places[1].distanceMi === 10.0,
    [places[0].distanceMi, places[1].distanceMi],
  );
  check('parse: truck stop classified from HERE category', places[0].facility === 'truck-stop');
  check('parse: distribution center classified', places[1].facility === 'distribution-center');

  check(
    'parse: non-object input is empty, never a throw',
    parseDiscoverResponse(null).length === 0,
  );
  check('parse: missing items is empty', parseDiscoverResponse({}).length === 0);
  check('parse: string input is empty', parseDiscoverResponse('items').length === 0);
  const many = {
    items: Array.from({ length: 40 }, (_, i) => ({
      id: `p${i}`,
      title: `P${i}`,
      position: { lat: 35, lng: -85 },
    })),
  };
  check(
    `parse: capped at ${MAX_SEARCH_RESULTS} results`,
    parseDiscoverResponse(many).length === MAX_SEARCH_RESULTS,
  );
  const noTitle = {
    items: [{ id: 'a', address: { label: '1 Main St' }, position: { lat: 35, lng: -85 } }],
  };
  check(
    'parse: address stands in when a place has no name',
    parseDiscoverResponse(noTitle)[0].title === '1 Main St',
  );
}

// ------------------------------------------------------- classification
{
  check(
    'classify: category id wins over text',
    classifyFacility(['400-4300-0000'], 'Big Warehouse', '') === 'rest-area',
  );
  check(
    'classify: keyword fallback finds a truck stop',
    classifyFacility([], "Love's Travel Stop", '') === 'truck-stop',
  );
  check(
    'classify: keyword fallback finds a warehouse',
    classifyFacility([], 'Acme Warehouse', '') === 'warehouse',
  );
  check(
    'classify: keyword fallback finds a terminal',
    classifyFacility([], 'XPO Terminal', '') === 'truck-terminal',
  );
  check(
    'classify: unknown category and text stays unknown',
    classifyFacility(['999-9999-9999'], 'Joe Coffee', '12 Main St') === 'unknown',
  );
  check(
    'classify: unknown is the honest default (never guesses an entrance)',
    classifyFacility([], '', '') === 'unknown',
  );
}

// ------------------------------------------------------------- endpoint
{
  const src = readFileSync('src/app/api/navigator/destination-search/route.ts', 'utf8');
  check(
    'endpoint: flag-gated 404 while the Navigator is disabled',
    src.includes("NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'") && src.includes('404'),
  );
  check(
    'endpoint: missing key answers a distinct 503, not an empty list',
    src.includes('provider-not-configured') && src.includes('503'),
  );
  check(
    'endpoint: rate limited per IP',
    src.includes('searchLimiter.allow(clientKey(req))') && src.includes('429'),
  );
  check(
    'endpoint: query length bounded both ways',
    src.includes('MIN_SEARCH_LENGTH') && src.includes('MAX_SEARCH_LENGTH'),
  );
  check(
    'endpoint: origin coordinate validated before any provider call',
    src.includes('origin-required'),
  );
  check(
    'endpoint: limiter and validation precede the provider fetch',
    src.indexOf('searchLimiter.allow') < src.indexOf('await fetch(') &&
      src.indexOf('origin-required') < src.indexOf('await fetch('),
  );
  check('endpoint: provider timeout bounded', src.includes('AbortSignal.timeout('));
  check(
    'endpoint: never echoes the key or the upstream URL',
    !/\$\{[^}]*apiKey/.test(src) && !src.includes('buildDiscoverUrl(q, { lat, lng }, apiKey))}'),
  );
  check('endpoint: no console logging', !/console\./.test(src));
}

// -------------------------------------------------------- driver UI wiring
{
  const search = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
  check('ui: search debounces before spending a transaction', /DEBOUNCE_MS\s*=\s*\d+/.test(search));
  check(
    'ui: stale responses cannot overwrite newer results',
    search.includes('seqRef') && search.includes('mySeq !== seqRef.current'),
  );
  check(
    `ui: no request below ${MIN_SEARCH_LENGTH} characters`,
    search.includes('MIN_SEARCH_LENGTH'),
  );
  check(
    'ui: results show name and address — never a coordinate',
    search.includes('place.title') &&
      search.includes('place.address') &&
      !/place\.position\.(lat|lng)\s*\}/.test(search) &&
      !/toFixed\(\s*[4-6]\s*\)/.test(search),
  );
  check('ui: touch targets stay ≥64 px', (search.match(/min-h-16/g) ?? []).length >= 2);

  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  check('controls: destination search is mounted', controls.includes('<DestinationSearch'));
  check(
    'controls: a searched place supplies the plan coordinates',
    controls.includes('picked.position.lat') && controls.includes('picked.position.lng'),
  );
  check(
    'controls: the searched facility class reaches arrival handling',
    controls.includes('picked.facility') && controls.includes('facility: chosenFacility'),
  );
  check(
    'controls: coordinate entry survives only as a collapsed developer affordance',
    controls.includes('Developer: enter coordinates instead') &&
      controls.indexOf('<DestinationSearch') < controls.indexOf('Developer: enter coordinates'),
  );
  check(
    'controls: a searched place never claims a verified entrance',
    controls.includes("positionSource: 'unknown'"),
  );
  check(
    'controls: typing coordinates clears any searched place (one source of truth)',
    (controls.match(/setPicked\(null\)/g) ?? []).length >= 2,
  );
}

console.log(`destination-search: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

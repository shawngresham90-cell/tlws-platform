/**
 * Plan My Day's destination search — the same system, a different door.
 *
 * WHY A SECOND ROUTE EXISTS AT ALL. `/api/navigator/destination-search`
 * requires a signed pilot cookie: it fronts a pilot surface and spends
 * provider budget. Plan My Day is a free, public screen whose visitors
 * hold no such cookie, so every keystroke there would 401. The two honest
 * options were a second door or widening the pilot gate; widening it
 * would expose a pilot-budgeted endpoint to the open internet as a side
 * effect of a planner feature.
 *
 * THE RISK THAT CREATES is a second search implementation drifting away
 * from the first — a different parser, a different candidate model, a
 * different idea of what `in=countryCode:` means. These checks exist to
 * make that drift impossible to introduce quietly: the route is asserted
 * to import its behaviour from the shared module and to contain none of
 * its own.
 *
 * Run:
 *   npx esbuild scripts/test-trip-planner-search.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-trip-planner-search.cjs \
 *   && node /tmp/test-trip-planner-search.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildDiscoverUrl,
  parseDiscoverResponse,
  MIN_SEARCH_LENGTH,
  MAX_SEARCH_LENGTH,
  MAX_SEARCH_RESULTS,
} from '@/lib/navigator-api/destination-search';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const TP_ROUTE = read('src/app/api/trip-planner/destination-search/route.ts');
const NAV_ROUTE = read('src/app/api/navigator/destination-search/route.ts');
const PORT = read('src/components/navigator/search-port.ts');
const SEARCH_UI = read('src/components/navigator/DestinationSearch.tsx');
const PLANNER_UI = read('src/components/trip-planner/PlanMyDayApp.tsx');

/* ============ the door reuses the search, it does not rebuild it ==== */
{
  check(
    'the planner route imports the shared search module',
    /from '@\/lib\/navigator-api\/destination-search'/.test(TP_ROUTE),
  );
  for (const fn of [
    'buildDiscoverUrl',
    'parseDiscoverResponse',
    'stripDistances',
    'MIN_SEARCH_LENGTH',
    'MAX_SEARCH_LENGTH',
  ]) {
    check(`the planner route reuses ${fn}`, TP_ROUTE.includes(fn));
  }
  /*
   * NO SECOND IMPLEMENTATION. The provider host, the response shape and
   * the country parameter are the shared module's business. A route that
   * started building its own URL or reading its own fields would be a
   * second search system by definition.
   */
  check(
    'the planner route never builds a provider URL of its own',
    !/https?:\/\/[a-z.]*hereapi/i.test(TP_ROUTE),
    TP_ROUTE.match(/https?:\/\/\S+/g),
  );
  check(
    'the planner route never parses provider fields itself',
    !/\.items\b/.test(TP_ROUTE) && !/categories/.test(TP_ROUTE),
  );
  check(
    'the planner route validates ?country= to the two known codes, like the Navigator’s',
    /rawCountry === 'CAN' \? 'CAN' : 'USA'/.test(TP_ROUTE) &&
      /rawCountry === 'CAN' \? 'CAN' : 'USA'/.test(NAV_ROUTE),
  );
}

/* ============ what differs is ONLY the access rule ================== */
{
  check(
    'the Navigator’s door still requires pilot access',
    /requestHasPilotAccess/.test(NAV_ROUTE),
  );
  /*
   * The planner's door must NOT require it — that is the entire reason it
   * exists — and must not have quietly acquired the Navigator's flag gate
   * either, which would 404 the public planner whenever the pilot is off.
   */
  check(
    'the planner’s door does not require pilot access',
    !/requestHasPilotAccess/.test(TP_ROUTE),
  );
  check(
    'the planner’s door is not gated behind the Navigator flag',
    !/NEXT_PUBLIC_NAVIGATOR_ENABLED/.test(TP_ROUTE),
  );
  check(
    'both doors refuse honestly when the provider key is absent',
    /provider-not-configured/.test(TP_ROUTE) && /provider-not-configured/.test(NAV_ROUTE),
  );
  check(
    'both doors read the SAME provider key variable',
    /process\.env\.HERE_API_KEY/.test(TP_ROUTE) && /process\.env\.HERE_API_KEY/.test(NAV_ROUTE),
  );
  check('the planner’s door has its own rate limiter', /new RateLimiter/.test(TP_ROUTE));
  /*
   * The key is READ server-side and handed to the URL builder — that is
   * correct and expected. What must never happen is it leaving in the
   * response, or being exposed to the client bundle via a NEXT_PUBLIC_
   * name. So the assertion is about the RESPONSE payload, not about
   * whether the identifier appears in the file at all.
   */
  const responses = TP_ROUTE.match(/NextResponse\.json\(([^;]*)\)/g) ?? [];
  check(
    'the response carries places only — never the key or an upstream URL',
    responses.length > 0 && responses.every((r) => !/apiKey|HERE_API_KEY|hereapi|url/i.test(r)),
    responses,
  );
  check('the key is never exposed under a client-visible name', !/NEXT_PUBLIC_HERE/.test(TP_ROUTE));
  check(
    'a provider failure reports the status only, never the body or the URL',
    /provider-http:\$\{res\.status\}/.test(TP_ROUTE),
  );
}

/* ============ one search component, two endpoints =================== */
{
  check(
    'the port exposes both doors as constants',
    /NAVIGATOR_SEARCH_ENDPOINT/.test(PORT) && /TRIP_PLANNER_SEARCH_ENDPOINT/.test(PORT),
  );
  check(
    'the port takes the endpoint as a parameter',
    /endpoint: string = NAVIGATOR_SEARCH_ENDPOINT/.test(PORT),
  );
  check(
    'the Navigator keeps its own door by default',
    /NAVIGATOR_SEARCH_ENDPOINT = '\/api\/navigator\/destination-search'/.test(PORT),
  );
  check(
    'the planner points at the planner door',
    /TRIP_PLANNER_SEARCH_ENDPOINT = '\/api\/trip-planner\/destination-search'/.test(PORT),
  );
  check(
    'Plan My Day uses the Navigator’s search COMPONENT, not a copy',
    /from '@\/components\/navigator\/DestinationSearch'/.test(PLANNER_UI),
  );
  check(
    'Plan My Day passes the planner endpoint to it',
    /endpoint=\{TRIP_PLANNER_SEARCH_ENDPOINT\}/.test(PLANNER_UI),
  );
  check(
    'the shared component still debounces (350 ms) for both callers',
    /DEBOUNCE_MS = 350/.test(SEARCH_UI),
  );
  check(
    'the shared component still coordinates requests for both callers',
    /createSearchCoordinator/.test(SEARCH_UI),
  );
}

/* ============ typing must never buy a route ========================= */
{
  /*
   * THE PRODUCT RULE THIS FILE EXISTS FOR, alongside its browser proof.
   * A route is a paid truck-routing transaction; typeahead is not. The
   * search component must never reach the quote endpoint, and Plan My Day
   * must call it from the button handler only.
   */
  check(
    'the search component never touches the quote endpoint',
    !/trip-planner\/quote/.test(SEARCH_UI),
  );
  check(
    'the search component asks for no GPS and plans no route',
    !/getCurrentPosition|watchPosition/.test(SEARCH_UI) &&
      !/planRoute|requestRoute/.test(SEARCH_UI),
  );
  const quoteCalls = (PLANNER_UI.match(/\/api\/trip-planner\/quote/g) ?? []).length;
  check('Plan My Day names the quote endpoint exactly once', quoteCalls === 1, quoteCalls);
  check(
    'and only inside the Plan My Day handler, never in an effect',
    /async function planDay\(\)[\s\S]*?\/api\/trip-planner\/quote/.test(PLANNER_UI),
  );
  check(
    'the button is disabled until BOTH ends are chosen',
    /disabled=\{pending \|\| origin === null \|\| destination === null\}/.test(PLANNER_UI),
  );
}

/* ============ the region claim is attested, not inferred ============ */
{
  check(
    'a searched place claims the country its search was filtered to',
    /country === 'CAN' \? 'CA' : 'US'/.test(PLANNER_UI),
  );
  check(
    'a directory pick claims its listing’s own state code',
    /countryFromStateCode\(a\.state\)/.test(PLANNER_UI),
  );
  check(
    'switching the country drops the previous pick',
    /setCountry\(code\);[\s\S]{0,200}onChoose\(null\)/.test(PLANNER_UI),
  );
  check(
    'both ends can be searched in different countries',
    (PLANNER_UI.match(/<EndpointPicker/g) ?? []).length === 2,
  );
}

/* ============ the shared module's own contract still holds ========== */
{
  const us = new URL(buildDiscoverUrl('windsor', null, 'TESTKEY', undefined, 'USA'));
  const ca = new URL(buildDiscoverUrl('windsor', null, 'TESTKEY', undefined, 'CAN'));
  check('a US search asks HERE for the US only', us.searchParams.get('in') === 'countryCode:USA');
  check('a CA search asks HERE for Canada only', ca.searchParams.get('in') === 'countryCode:CAN');
  check(
    'the same query really does produce two different requests',
    us.toString() !== ca.toString(),
  );
  check('bounds are shared, not re-declared', MIN_SEARCH_LENGTH === 3 && MAX_SEARCH_LENGTH === 120);
  check('the result cap is the shared one', MAX_SEARCH_RESULTS === 8);

  /*
   * Accents, provinces and postal codes are HERE's to resolve — the app's
   * job is to pass the query through untouched rather than sanitize it
   * into something else. A stripped accent turns "Trois-Rivières" into a
   * different search.
   */
  for (const q of ['Trois-Rivières', 'Montréal, QC', 'K1A 0B1', "St. John's, NL"]) {
    const u = new URL(buildDiscoverUrl(q, null, 'TESTKEY', undefined, 'CAN'));
    check(`the query "${q}" reaches the provider unaltered`, u.searchParams.get('q') === q);
  }

  const parsed = parseDiscoverResponse({
    items: [
      {
        id: 'x',
        title: 'Petro-Canada',
        position: { lat: 43.65, lng: -79.38 },
        address: { label: '123 Rue Principale, Montréal, QC' },
        distance: 1609,
      },
    ],
  });
  check(
    'a Canadian place parses with its accented address intact',
    parsed[0]?.address.includes('Montréal'),
    parsed[0],
  );
  check('and never exposes a coordinate as text', typeof parsed[0]?.position.lat === 'number');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

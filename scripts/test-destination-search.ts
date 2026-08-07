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
import { createSearchCoordinator, SEARCH_CACHE_MAX } from '@/lib/navigator-api/search-coordination';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
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
    // Round 3 moved sequencing into the search coordinator, which is
    // exercised behaviourally further down (a slow answer is REJECTED).
    'ui: stale responses cannot overwrite newer results',
    search.includes('coord.accept(decision.seq') && search.includes('createSearchCoordinator'),
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

// ============ ROUND-2 REGRESSION: the search flashed and never settled ====
// Live report: the correct address was found and shown, then the result
// area kept flashing and re-requesting instead of locking in. Two
// independent causes, both pinned here.
{
  const search = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');

  // CAUSE 1 — the effect depended on the `origin` OBJECT, and the driving
  // screen re-renders every GPS tick (1 Hz) with a fresh literal, so the
  // debounce restarted and a request went out once per second.
  check(
    'flash-fix: the search effect depends on a coarse origin KEY, never the object',
    /}, \[query, originKey, settled\]\)/.test(search) && search.includes('originKey ='),
    search.match(/}, \[[^\]]*\]\);/g)?.slice(-1),
  );
  check(
    'flash-fix: the live origin is read from a ref at fire time (not a stale closure)',
    search.includes('originRef.current = origin') &&
      search.includes('const at = originRef.current'),
  );
  check(
    'flash-fix: the origin key is rounded, so GPS jitter cannot retrigger it',
    /origin\.lat\.toFixed\(3\)/.test(search) && /origin\.lng\.toFixed\(3\)/.test(search),
  );
  check(
    'flash-fix: the parent memoizes the origin object it passes down',
    controls.includes('const searchOrigin = useMemo(') &&
      controls.includes('origin={searchOrigin}'),
  );
  check(
    'flash-fix: the parent no longer builds a fresh origin literal inline',
    !/origin=\{fix === null \? null : \{ lat: fix\.lat, lng: fix\.lng \}\}/.test(controls),
  );

  // CAUSE 2 — selecting a result left the picked title in the query box
  // with nothing marking the search finished, so the effect immediately
  // searched again for it and repopulated the list under the driver.
  check(
    'settle-fix: selection marks the search SETTLED and the effect stops',
    search.includes('const [settled, setSettled]') && /if \(settled\) return;/.test(search),
  );
  check(
    'settle-fix: selection retires any in-flight response',
    /coordRef\.current\?\.cancel\(\);[\s\S]{0,120}setSettled\(true\)/.test(search),
  );
  check(
    'settle-fix: selection clears the results list and the searching flag',
    /setSettled\(true\);[\s\S]{0,200}setSearching\(false\);[\s\S]{0,200}setResults\(\[\]\)/.test(
      search,
    ),
  );
  check(
    'settle-fix: editing the query reopens the search AND drops the stale pick',
    search.includes('setSettled(false)') && search.includes('onClear()'),
  );
  check(
    'settle-fix: the parent clears its pick when the driver edits',
    controls.includes('onClear={() => setPicked(null)}'),
  );
  // The status line is what visibly flashed; it must be driven by state
  // that can now hold still.
  check(
    'settle-fix: "Searching…" is bound to the searching flag alone',
    search.includes("{searching ? 'Searching…' : (status ?? '')}"),
  );
}

// ===== ROUND-3 BEHAVIOURAL COVERAGE: bounded provider calls ==============
// The round-2 pins above are structural — they prove the CODE says the
// right thing. These run the real coordinator and assert the things that
// actually cost money and cause flashing: how many provider requests a
// typing session issues, and which answers are allowed to land.
{
  const place = (id: string): DestinationCandidate => ({
    id,
    title: id,
    address: '',
    position: { lat: 34.9, lng: -85.1 },
    facility: 'unknown',
    distanceMi: null,
  });

  // --- a query below the minimum never spends -----------------------------
  {
    const c = createSearchCoordinator();
    for (const q of ['', 'a', 'ab', '  ']) c.next(q);
    check('bounded: short queries issue ZERO provider calls', c.callCount() === 0, c.callCount());
  }

  // --- one request per distinct query -------------------------------------
  {
    const c = createSearchCoordinator();
    const d1 = c.next('442 Indian Lake Ct');
    check('bounded: a fresh query asks for one request', d1.kind === 'request');
    if (d1.kind === 'request') c.accept(d1.seq, [place('a')]);
    check('bounded: exactly one provider call so far', c.callCount() === 1);

    // The driver deletes and retypes the SAME address — the live pilot's
    // "rapid typing/deleting/retyping" case. It must cost nothing.
    const d2 = c.next('442 Indian Lake Ct');
    check('dedupe: retyping the same query is served from cache', d2.kind === 'cached');
    check('dedupe: …and issues NO second provider call', c.callCount() === 1, c.callCount());
    check(
      'dedupe: the cached answer is the same result the driver already saw',
      d2.kind === 'cached' && d2.places[0].id === 'a',
    );
    check(
      'dedupe: case and spacing differences still hit the cache',
      c.next('  442 INDIAN   LAKE ct  ').kind === 'cached' && c.callCount() === 1,
    );
  }

  // --- a realistic typing burst stays bounded ------------------------------
  {
    const c = createSearchCoordinator();
    // Every prefix the debounce might let through while typing an address.
    const typed = ['442', '442 ', '442 I', '442 In', '442 Ind', '442 Indian'];
    for (const q of typed) {
      const d = c.next(q);
      if (d.kind === 'request') c.accept(d.seq, [place(q)]);
    }
    // '442' and '442 ' normalise to the same query, so six keystrokes cost
    // five requests — one per DISTINCT query, which is the actual bound.
    const distinct = new Set(typed.map((q) => q.trim().toLowerCase())).size;
    check(
      'bounded: a typing burst costs one call per DISTINCT query, no more',
      c.callCount() === distinct,
      { calls: c.callCount(), distinct },
    );
    // Backspacing back through those prefixes costs nothing at all.
    const before = c.callCount();
    for (const q of [...typed].reverse()) c.next(q);
    check('bounded: backspacing through typed prefixes spends nothing', c.callCount() === before);
  }

  // --- stale responses can never win --------------------------------------
  {
    const c = createSearchCoordinator();
    const slow = c.next('pilot');
    const fast = c.next('pilot travel center');
    check('stale: two distinct queries produced two requests', c.callCount() === 2);
    const fastOk = fast.kind === 'request' && c.accept(fast.seq, [place('newest')]);
    check('stale: the NEWEST response is accepted', fastOk);
    const slowOk = slow.kind === 'request' && c.accept(slow.seq, [place('older')]);
    check('stale: the older, slower response is REJECTED', slowOk === false);
  }

  // --- selecting a destination stops the search ----------------------------
  {
    const c = createSearchCoordinator();
    const d = c.next('costco');
    check('settle: a search was in flight', d.kind === 'request');
    c.cancel(); // what selecting a result does
    const landed = d.kind === 'request' && c.accept(d.seq, [place('late')]);
    check('settle: a response landing after selection is dropped', landed === false);
    check(
      'settle: a settled box issues no further calls',
      c.next('costco distribution', { settled: true }).kind === 'idle' && c.callCount() === 1,
    );
  }

  // --- the driver is stationary; GPS still ticks ---------------------------
  {
    // The component keys its effect on a COARSE origin (see the structural
    // pin above), so ordinary GPS jitter never reaches the coordinator at
    // all. Even if it did, the query is unchanged and therefore cached.
    const c = createSearchCoordinator();
    const first = c.next('442 Indian Lake Ct');
    if (first.kind === 'request') c.accept(first.seq, [place('a')]);
    for (let tick = 0; tick < 60; tick++) c.next('442 Indian Lake Ct');
    check(
      'gps: 60 position updates with an unchanged query cost ZERO extra calls',
      c.callCount() === 1,
      c.callCount(),
    );
  }

  // --- the cache itself is bounded ----------------------------------------
  {
    const c = createSearchCoordinator();
    for (let i = 0; i < SEARCH_CACHE_MAX + 8; i++) {
      const d = c.next(`query number ${i}`);
      if (d.kind === 'request') c.accept(d.seq, [place(`p${i}`)]);
    }
    const calls = c.callCount();
    // The oldest entries were evicted, so re-asking for #0 spends again —
    // proving the cache cannot grow without bound.
    c.next('query number 0');
    check(
      'bounded: the answer cache evicts oldest and never grows unbounded',
      c.callCount() === calls + 1,
    );
    check(
      'bounded: a recent query is still cached after eviction',
      c.next(`query number ${SEARCH_CACHE_MAX + 7}`).kind === 'cached',
    );
  }

  // --- the component actually uses it -------------------------------------
  {
    const search = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
    check(
      'wiring: the search box owns one coordinator',
      search.includes('createSearchCoordinator()'),
    );
    check(
      'wiring: every provider call goes through a coordinator decision',
      search.includes("decision.kind === 'cached'") && search.includes("decision.kind === 'idle'"),
    );
    check(
      'wiring: responses are gated by accept(), so stale answers are dropped',
      search.includes('coord.accept(decision.seq'),
    );
    check(
      'wiring: selecting a destination cancels the in-flight request',
      search.includes('coordRef.current?.cancel()'),
    );
    check(
      'wiring: the loading flag is cleared exactly once per attempt',
      search.includes('.finally(() => setSearching(false))'),
    );
  }
}

console.log(`destination-search: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

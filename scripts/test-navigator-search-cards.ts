/**
 * Navigator Design Blueprint — Phase 4 invariants: Search + POI cards.
 *
 * The card's contract: every rendered line is a REAL candidate field the
 * provider returned (facility class, name, address, straight-line
 * distance said to be straight-line) — no amenity invented, no
 * truck-safety verdict, no inference from a business name, no coordinate
 * ever shown. The search flow around the cards is byte-for-byte the
 * proven one: same debounce, same coordinator, same first-party endpoint
 * with its rate limiter, same DestinationCandidate handed to the same
 * onPick → plan → briefing path.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-search-cards.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-search-cards.cjs \
 *   && node /tmp/test-search-cards.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { SearchResultCard } from '@/components/navigator/DestinationSearch';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SEARCH_SRC = readFileSync('src/components/navigator/DestinationSearch.tsx', 'utf8');
const PORT_SRC = readFileSync('src/components/navigator/search-port.ts', 'utf8');
const ENDPOINT_SRC = readFileSync('src/app/api/navigator/destination-search/route.ts', 'utf8');
const CONTROLS_SRC = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
const SCREEN_SRC = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');

const CANDIDATE: DestinationCandidate = {
  id: 'here:fixture-1',
  title: 'Pilot Travel Center',
  address: '3151 Battlefield Pkwy, Ringgold, GA 30736',
  position: { lat: 34.9, lng: -85.1 },
  facility: 'truck-stop',
  distanceMi: 12.4,
};

function renderCard(over: Partial<DestinationCandidate> = {}): string {
  return renderToStaticMarkup(
    createElement(SearchResultCard, {
      place: { ...CANDIDATE, ...over },
      onSelect: () => {},
    }),
  );
}

/* ==================== 1. the card shows real fields only ================= */
{
  const html = renderCard();
  check('card: facility class as the eyebrow', html.includes('Truck stop'));
  check('card: place name leads', html.includes('Pilot Travel Center'));
  check('card: postal address beneath', html.includes('3151 Battlefield Pkwy, Ringgold, GA 30736'));
  check(
    'card: distance is shown AND said to be straight-line',
    html.includes('12.4 mi') && html.includes('straight line'),
  );
  check('card: distance uses tabular numerals', /num-data/.test(html));
  check('card: the whole card is one ≥64px button', /<button[^>]*min-h-16/.test(html));
  check('card: cockpit surface, not a web search row', html.includes('bg-nav-surface'));
  check(
    'card: the select affordance is decorative only',
    /aria-hidden="true"[^>]*>\s*›/.test(html),
  );

  // Never rendered: the coordinate. It travels to the planner unseen.
  check('card: no coordinate ever renders', !/34\.9|-85\.1|\d+\.\d{3,}/.test(html));

  // A place named "Pilot" earns nothing from its name: no amenity, no
  // verdict, no rating — the app has no source for any of it.
  check(
    'card: no fabricated amenities or verdicts',
    !/parking|shower|fuel price|scale|weigh|hours|rating|review|truck.?friendly|truck approved|verified|safe for trucks|amenit/i.test(
      html,
    ),
  );
  check(
    'card: no TLWS yellow, no invented severity',
    !/nav-brand|#FFEB00|nav-warn|nav-danger/i.test(html),
  );
}

/* ==================== 2. absent fields collapse honestly ================= */
{
  const unknown = renderCard({ facility: 'unknown' });
  check('card: unknown facility renders no eyebrow', !unknown.includes('uppercase'));

  const noAddress = renderCard({ address: '' });
  check('card: empty address renders no address line', !noAddress.includes('Ringgold'));

  const noDistance = renderCard({ distanceMi: null });
  check(
    'card: null distance renders no distance line',
    !noDistance.includes('mi') || !noDistance.includes('straight line'),
  );

  const city = renderCard({ facility: 'unknown', address: '', distanceMi: null });
  check('card: a bare place is still a clean card', city.includes('Pilot Travel Center'));
}

/* ==================== 3. the flow around the cards is untouched ========== */
{
  const code = strip(SEARCH_SRC);
  check(
    'flow: the pinned loading/status line is verbatim',
    SEARCH_SRC.includes("{searching ? 'Searching…' : (status ?? '')}"),
  );
  check(
    'flow: the no-results state exists',
    code.includes('No places found. Try a different search.'),
  );
  check('flow: the failure state exists', code.includes('Search unavailable right now.'));
  check('flow: the GPS-wait state exists', code.includes('Waiting for a GPS fix'));
  check(
    'flow: selection still cancels, settles, and hands the SAME candidate on',
    /coordRef\.current\?\.cancel\(\);[\s\S]{0,300}setSettled\(true\);[\s\S]{0,300}onPick\(chosen\)/.test(
      code,
    ),
  );
  check(
    'flow: debounce and coordinator survive untouched',
    code.includes('DEBOUNCE_MS = 350') &&
      code.includes('createSearchCoordinator()') &&
      code.includes('coord.accept(decision.seq'),
  );
  check(
    'flow: the card renders candidate fields, not derived guesses',
    SEARCH_SRC.includes('place.title') &&
      SEARCH_SRC.includes('place.address') &&
      SEARCH_SRC.includes('place.distanceMi') &&
      SEARCH_SRC.includes('place.facility'),
  );
  check(
    'flow: touch floors hold (input + card)',
    (SEARCH_SRC.match(/min-h-16/g) ?? []).length >= 2,
  );
  check('flow: no fetch outside the port', !/fetch\s*\(/.test(code));
}

/* ==================== 4. provider, endpoint, and limits unchanged ======== */
{
  check(
    'endpoint: the port still talks only to the first-party search route',
    PORT_SRC.includes('/api/navigator/destination-search') &&
      !/hereapi|https?:\/\//.test(strip(PORT_SRC).replace(/\/api\/navigator[^'"`]*/g, '')),
  );
  check(
    'endpoint: no key or secret in the client path',
    !/apiKey|API_KEY|secret|token/i.test(PORT_SRC),
  );
  check(
    'endpoint: the search rate limiter still gates every request',
    ENDPOINT_SRC.includes('searchLimiter.allow(clientKey(req))') && ENDPOINT_SRC.includes('429'),
  );
  check(
    'endpoint: flag gate and provider-not-configured refusal intact',
    ENDPOINT_SRC.includes("NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true'") &&
      ENDPOINT_SRC.includes('provider-not-configured'),
  );
}

/* ==================== 5. selection feeds the same planning path ========== */
{
  check(
    'path: the trip controls still mount THIS search',
    CONTROLS_SRC.includes('<DestinationSearch') &&
      CONTROLS_SRC.includes('onClear={() => setPicked(null)}'),
  );
  check(
    'path: the picked candidate plans through the same fields',
    CONTROLS_SRC.includes('picked.position.lat') &&
      CONTROLS_SRC.includes('picked.position.lng') &&
      CONTROLS_SRC.includes('facility: chosenFacility'),
  );
  check(
    'path: the Phase 3 briefing receives the selected destination unchanged',
    CONTROLS_SRC.includes('destination={picked}'),
  );
  check(
    'path: the search still lives behind the stationary-only gate',
    /<LockGate[^>]*action="edit-destination"/.test(SCREEN_SRC),
  );
}

console.log(`navigator-search-cards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

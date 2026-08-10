/**
 * The provider-volume model, and the accessibility facts the audit rests
 * on.
 *
 * Two things are pinned, and they fail for opposite reasons.
 *
 * THE VOLUME MODEL fails when a CAP MOVES. Its whole value is that the
 * ceilings it quotes are the ceilings the code enforces — the reroute
 * budget, both endpoint limiters, the adapter's own guard. If any of
 * those changes and this does not, the model becomes a confident wrong
 * answer to "can we add another driver?", which is worse than no answer.
 * So each is re-read from its own source file and compared.
 *
 * THE ACCESSIBILITY FACTS fail when a SURFACE CHANGES. The audit is a
 * document; the structural claims inside it — that the map controls are
 * labelled, that mute exposes `aria-pressed`, that the name field
 * deliberately has no live region, that `RouteCheck` announces at
 * `route-ready` — are readable from source and are asserted here so the
 * document cannot quietly become fiction.
 *
 * One assertion is a NEGATIVE that matters: neither this file nor the
 * audit may claim the audio collision has been resolved. It has strong
 * structural evidence and no behavioural evidence, and the honest state
 * is "device test required".
 *
 * Run:
 *   npx esbuild scripts/test-navigator-provider-volume.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-provider-volume.cjs && node /tmp/test-navigator-provider-volume.cjs
 */
import { readFileSync } from 'node:fs';
import {
  ADAPTER_CALLS_PER_HOUR,
  DEFAULT_ASSUMPTIONS,
  DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH,
  MODELLED_WAVES,
  ROUTE_REQUESTS_PER_HOUR_PER_IP,
  SEARCHES_PER_MINUTE_PER_IP,
  driversWithinFreeTier,
  expectedMonthlyVolume,
  worstCaseMonthlyVolume,
} from '@/lib/navigator/provider-volume';
import { REROUTE_DEFAULTS } from '@/lib/navigator/reroute-controller';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 240)}`}`);
  }
}

const VOLUME_DOC = readFileSync('docs/operations/navigator-provider-volume.md', 'utf8');
const A11Y_DOC = readFileSync('docs/operations/navigator-accessibility-audit.md', 'utf8');
/**
 * Markdown wraps, and a blockquote wraps with a `>` on every line. Prose
 * assertions must be about what the document SAYS, not about where the
 * author pressed return or which lines happen to be quoted.
 */
const flat = (s: string) => s.replace(/^\s*>\s?/gm, '').replace(/\s+/g, ' ');
const VOLUME_FLAT = flat(VOLUME_DOC);
const A11Y_FLAT = flat(A11Y_DOC);
const read = (p: string) => readFileSync(p, 'utf8');

/* --------------------------------- 1. the caps are the code's caps */
{
  const ROUTE_API = read('src/app/api/navigator/route/route.ts');
  const SEARCH_API = read('src/app/api/navigator/destination-search/route.ts');
  const ADAPTER = read('src/lib/trip-planner/here-routing.ts');

  check(
    `caps: route endpoint still allows ${ROUTE_REQUESTS_PER_HOUR_PER_IP}/hour/IP`,
    new RegExp(
      `capacity:\\s*${ROUTE_REQUESTS_PER_HOUR_PER_IP},[\\s\\S]{0,80}refillPerSecond:\\s*${ROUTE_REQUESTS_PER_HOUR_PER_IP}\\s*/\\s*3600`,
    ).test(ROUTE_API),
  );
  check(
    `caps: search endpoint still allows ${SEARCHES_PER_MINUTE_PER_IP}/minute/IP`,
    new RegExp(
      `capacity:\\s*${SEARCHES_PER_MINUTE_PER_IP},[\\s\\S]{0,80}refillPerSecond:\\s*${SEARCHES_PER_MINUTE_PER_IP}\\s*/\\s*60`,
    ).test(SEARCH_API),
  );
  check(
    `caps: the adapter's guard is still ${ADAPTER_CALLS_PER_HOUR}/hour`,
    new RegExp(`default ${ADAPTER_CALLS_PER_HOUR}`).test(ADAPTER),
  );
  check(
    `caps: the adapter still documents ${DOCUMENTED_FREE_TRUCK_TRANSACTIONS_PER_MONTH} free truck transactions`,
    /5,000 free truck transactions\/month/.test(ADAPTER),
  );
  check(
    'caps: the reroute session budget is the model input',
    REROUTE_DEFAULTS.maxPerSession === 12,
  );
  check('caps: and the hourly one is unchanged', REROUTE_DEFAULTS.maxPerHour === 6);
}

/* ------------------------------------------------- 2. the arithmetic */
{
  const one = expectedMonthlyVolume(1);
  check('model: 44 trips per driver per month', one.tripsPerMonth === 44, one.tripsPerMonth);
  check('model: 264 search calls per driver', one.searchCalls === 264, one.searchCalls);
  check(
    'model: 118.8 truck transactions per driver',
    one.truckTransactions === 118.8,
    one.truckTransactions,
  );
  check(
    'model: truck transactions are plans plus reroutes and nothing else',
    Math.abs(one.routePlans + one.reroutes - one.truckTransactions) < 0.05,
    `${one.routePlans}+${one.reroutes} vs ${one.truckTransactions}`,
  );

  // Zero automatic retries is a PROPERTY OF THE CONTROLLER, not an
  // estimate — a failure starts the backoff ladder and waits for the next
  // confirmed off-route state. If that ever changes, the model is wrong.
  check('model: no automatic retries are modelled', one.automaticRetries === 0);
  const CONTROLLER = read('src/lib/navigator/reroute-controller.ts');
  check(
    'model: because the controller backs off rather than retrying',
    /failureBackoffMs/.test(CONTROLLER) && !/setTimeout|retry\(/.test(CONTROLLER),
  );

  const expected: Record<number, [number, boolean]> = {
    3: [356.4, true],
    10: [1188, true],
    50: [5940, false],
    100: [11880, false],
  };
  for (const drivers of MODELLED_WAVES) {
    const v = expectedMonthlyVolume(drivers);
    const [truck, within] = expected[drivers];
    check(
      `model: ${drivers} drivers → ${truck} truck transactions`,
      v.truckTransactions === truck,
      v.truckTransactions,
    );
    check(
      `model: ${drivers} drivers within the documented tier = ${within}`,
      v.withinDocumentedFreeTier === within,
    );
    check(
      `model: ${drivers} drivers scales linearly from one`,
      Math.abs(v.truckTransactions - drivers * 118.8) < 0.6,
      v.truckTransactions,
    );
  }

  const worstExpected: Record<number, number> = { 3: 1716, 10: 5720, 50: 28600, 100: 57200 };
  for (const drivers of MODELLED_WAVES) {
    const w = worstCaseMonthlyVolume(drivers);
    check(
      `worst case: ${drivers} drivers → ${worstExpected[drivers]}`,
      w.truckTransactions === worstExpected[drivers],
      w.truckTransactions,
    );
    check(
      `worst case: ${drivers} drivers is never below the expected case`,
      w.truckTransactions >= expectedMonthlyVolume(drivers).truckTransactions,
    );
  }
  check('worst case: 3 drivers still fit', worstCaseMonthlyVolume(3).withinDocumentedFreeTier);
  check('worst case: 10 drivers do not', !worstCaseMonthlyVolume(10).withinDocumentedFreeTier);

  const headroom = driversWithinFreeTier();
  check('headroom: 42 drivers under ordinary driving', headroom.expected === 42, headroom.expected);
  check(
    'headroom: 8 drivers if every budget is spent',
    headroom.worstCase === 8,
    headroom.worstCase,
  );
  check(
    'headroom: the worst case is always the smaller number',
    headroom.worstCase < headroom.expected,
  );

  // Totality: a caller may replace any assumption without breaking it.
  const zero = expectedMonthlyVolume(0);
  check(
    'model: zero drivers is zero calls, not a division error',
    zero.truckTransactions === 0 && Number.isFinite(zero.percentOfDocumentedFreeTier),
  );
  const noReroutes = expectedMonthlyVolume(10, { ...DEFAULT_ASSUMPTIONS, reroutesPerTrip: 0 });
  check(
    'model: the reroute assumption is the lever it is claimed to be',
    noReroutes.truckTransactions < expectedMonthlyVolume(10).truckTransactions * 0.5,
    noReroutes.truckTransactions,
  );
}

/* ------------------------------------- 3. the document says the same */
{
  check('doc: quotes no dollar amount', !/[$£€]\s?\d/.test(VOLUME_DOC));
  check('doc: says so explicitly', /No dollar amounts appear anywhere/.test(VOLUME_FLAT));
  for (const drivers of MODELLED_WAVES) {
    check(
      `doc: has a row for ${drivers} drivers`,
      new RegExp(`\\*\\*${drivers}\\*\\*`).test(VOLUME_DOC),
      drivers,
    );
  }
  check('doc: publishes the 42-driver headroom', /\*\*42\*\*/.test(VOLUME_DOC));
  check('doc: publishes the 8-driver worst-case headroom', /\*\*8\*\*/.test(VOLUME_DOC));
  check('doc: names Wave 1 as safe on volume', /does not gate Wave 1/.test(VOLUME_FLAT));
  check(
    'doc: is explicit that the assumptions are estimates',
    /These are estimates/.test(VOLUME_FLAT) && /Wave 1, which has not run/.test(VOLUME_FLAT),
  );
  check(
    'doc: admits the search-product quota is unknown',
    /a quota this repository does not record/.test(VOLUME_FLAT),
  );
  check('doc: warns that per-IP limits are not per-driver limits', /share an IP/.test(VOLUME_FLAT));
  check(
    'doc: warns that the cache does not help reroutes',
    /does \*\*not\*\* help rerouting/.test(VOLUME_FLAT),
  );
  check(
    'doc: quotes the real reroute budget',
    VOLUME_DOC.includes(
      `**${REROUTE_DEFAULTS.maxPerHour} per hour, ${REROUTE_DEFAULTS.maxPerSession} per session**`,
    ),
  );
}

/* ------------------------------- 4. the accessibility facts hold */
{
  const CONTROLS = read('src/components/navigator/PilotTripControls.tsx');
  const MAP = read('src/components/navigator/NavigationMap.tsx');
  const VOICE = read('src/components/navigator/VoiceControls.tsx');
  const NAME = read('src/components/navigator/DriverNameEntry.tsx');
  const SEARCH = read('src/components/navigator/DestinationSearch.tsx');
  const HOS = read('src/components/navigator/HosWarningLine.tsx');
  const ACCESS = read('src/app/(navigator)/navigator/access/page.tsx');

  // The open question's two halves, both structural.
  check(
    'a11y: RouteCheck really does announce — it carries role="status"',
    /function RouteCheck[\s\S]{0,600}role="status"/.test(CONTROLS),
  );
  check(
    'a11y: and it really is a route-ready surface',
    /Route plausibility, shown only at route-ready/.test(CONTROLS),
  );
  check(
    'a11y: it renders nothing when there is nothing to say',
    /if \(findings\.length === 0\) return null;/.test(CONTROLS),
  );

  check(
    'a11y: the map region is labelled',
    /role="region"[\s\S]{0,120}aria-label="Navigation map/.test(MAP),
  );
  for (const label of ['Recenter the map on your truck', 'Zoom in', 'Zoom out']) {
    check(`a11y: the "${label}" control is labelled`, MAP.includes(`aria-label="${label}"`), label);
  }

  check('a11y: mute exposes state rather than implying it', /aria-pressed=\{muted\}/.test(VOICE));
  check(
    'a11y: the name field uses describedby + invalid, not a live region',
    /aria-invalid=/.test(NAME) &&
      /aria-describedby=/.test(NAME) &&
      !/aria-live/.test(NAME.replace(/\/\*[\s\S]*?\*\//g, '')),
  );
  check('a11y: the search status line is polite', /aria-live="polite" role="status"/.test(SEARCH));
  check(
    'a11y: the results list says what it is',
    /aria-label="Destination search results"/.test(SEARCH),
  );
  check(
    'a11y: a CRITICAL hos warning escalates to assertive',
    /aria-live=\{warning\.severity === 'critical' \? 'assertive' : 'polite'\}/.test(HOS),
  );
  check('a11y: the password error is announced immediately', /role="alert"/.test(ACCESS));

  // The audit's own honesty. It may not claim the audio question is
  // settled, and it may not claim an untested row passed.
  check(
    'audit: records the open question',
    /One open question — device testing required/.test(A11Y_FLAT),
  );
  check(
    'audit: does not claim the collision was resolved',
    !/collision (?:is|was) (?:resolved|fixed|confirmed)/i.test(A11Y_FLAT),
  );
  check(
    'audit: says explicitly that no change is proposed',
    /No change is proposed by this audit/.test(A11Y_FLAT),
  );
  check(
    'audit: refuses to remove the announcement to fix an unconfirmed problem',
    /loss of safety-relevant information/.test(A11Y_FLAT),
  );
  check(
    'audit: notes that role="status" is an implicit polite region',
    /implicit `aria-live="polite"`/.test(A11Y_FLAT),
  );
  check(
    'audit: lists the device tests it cannot perform',
    /What must be tested on a device/.test(A11Y_FLAT) &&
      /An untested row is not a pass/.test(A11Y_FLAT),
  );
  check('audit: records the region counts it measured', /`DrivingScreen.tsx` \| 5/.test(A11Y_DOC));
}

console.log(`navigator-provider-volume: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

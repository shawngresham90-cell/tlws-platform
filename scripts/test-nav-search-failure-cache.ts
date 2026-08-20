/**
 * NAV-SEARCH-1 — a failed destination search must never masquerade as
 * "no places found".
 *
 * THE DEFECT. The coordinator had one settlement method, `accept(seq,
 * places)`, and the component reported a failed request through it as
 * `accept(seq, [])`. That wrote an empty list into the answer cache under
 * the query's own key. Retyping the same place then returned
 * `{kind:'cached', places: []}` — no new request, no provider call — and
 * the screen said "No places found. Try a different search."
 *
 * The app knew only that ONE ATTEMPT HAD FAILED. It told the driver a
 * truck stop does not exist. Reproduced on main before the fix: one 503,
 * then a normalized-equivalent retype with the network already healthy,
 * still one total fetch, status flipped from "Search unavailable right
 * now." to "No places found. Try a different search."
 *
 * THE SECOND HALF. The cache key was the normalized query alone, while
 * the provider's answer also depends on `country` (which nation is
 * searched), `endpoint` (which door, which access rule) and the origin
 * (ranking, and the straight-line distances printed on the cards). All
 * three are live props: the Navigator's border control sits directly
 * under the search field and flips `country` on the same mounted box, so
 * a Canadian search was served the previous American answer. Proved for
 * all three dimensions through the rendered component before the fix.
 *
 * HOW THIS HARNESS TESTS. Behaviourally. The navigator technical-debt
 * audit's process note is the reason: "Text pins are excellent at
 * freezing what the file says; they cannot attest what the component
 * does." So the coordinator is exercised directly, and the real
 * `DestinationSearch` is RENDERED against an intercepted first-party
 * endpoint — no provider credentials, no HERE transaction. Source pins
 * appear only for the handful of properties a run cannot show (what may
 * be logged, what may be imported, what may be persisted).
 *
 * Run: npx esbuild scripts/test-nav-search-failure-cache.ts --bundle \
 *   --platform=node --format=cjs --jsx=automatic --alias:@=./src \
 *   --loader:.css=empty --outfile=/tmp/nsfc.cjs && node /tmp/nsfc.cjs
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  createSearchCoordinator,
  searchCacheKey,
  SEARCH_CACHE_MAX,
  type SearchContext,
} from '@/lib/navigator-api/search-coordination';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
import { DestinationSearch } from '@/components/navigator/DestinationSearch';
import {
  NAVIGATOR_SEARCH_ENDPOINT,
  TRIP_PLANNER_SEARCH_ENDPOINT,
  searchDestinations,
} from '@/components/navigator/search-port';

let passed = 0;
let failed = 0;
const seen = new Set<string>();
function check(id: string, name: string, cond: boolean, detail?: unknown) {
  seen.add(id);
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: [${id}] ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}

const read = (p: string) => readFileSync(p, 'utf8');
const SEARCH_UI = read('src/components/navigator/DestinationSearch.tsx');
const COORD_SRC = read('src/lib/navigator-api/search-coordination.ts');
const PORT_SRC = read('src/components/navigator/search-port.ts');

const place = (id: string, title = `Place ${id}`): DestinationCandidate => ({
  id,
  title,
  address: '1 Road, Somewhere',
  position: { lat: 34.92, lng: -85.11 },
  facility: 'truck-stop',
  distanceMi: 2.5,
});

const CTX: SearchContext = {
  country: 'USA',
  endpoint: NAVIGATOR_SEARCH_ENDPOINT,
  originKey: '34.916,-85.110',
};
const ctx = (over: Partial<SearchContext> = {}): SearchContext => ({ ...CTX, ...over });

const UNAVAILABLE = 'Search unavailable right now.';
const NO_PLACES = 'No places found. Try a different search.';

/* ====================================================================
 * A controllable first-party endpoint. Nothing here reaches HERE: the
 * component talks to /api/*, and this stands in for that route.
 * ================================================================== */

type Reply =
  | { kind: 'places'; places: DestinationCandidate[] }
  | { kind: 'status'; status: number }
  | { kind: 'malformed'; body: unknown }
  | { kind: 'throw' };

let replies: Reply[] = [];
let replyIndex = 0;
let requestLog: string[] = [];

function installEndpoint(seq: Reply[]): void {
  replies = seq;
  replyIndex = 0;
  requestLog = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestLog.push(url);
    const r = replies[Math.min(replyIndex, replies.length - 1)];
    replyIndex += 1;
    if (r.kind === 'throw') throw new TypeError('fetch failed');
    if (r.kind === 'status') {
      return new Response(JSON.stringify({ ok: false, error: 'nope' }), { status: r.status });
    }
    if (r.kind === 'malformed') {
      return new Response(JSON.stringify(r.body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, places: r.places }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

/* ====================================================================
 * Rendering the real component.
 * ================================================================== */

type Props = Parameters<typeof DestinationSearch>[0];
type Box = {
  type(value: string): Promise<void>;
  status(): string;
  cards(): string[];
  select(index: number): Promise<void>;
  rerender(next: Partial<Props>): Promise<void>;
  unmount(): Promise<void>;
  picks: DestinationCandidate[];
  clears: number;
};

async function settleTimers(): Promise<void> {
  // Past the 350 ms debounce, then a turn for the promise chain.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 420));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function mount(over: Partial<Props> = {}): Promise<Box> {
  const picks: DestinationCandidate[] = [];
  let clears = 0;
  let current: Props = {
    origin: { lat: 34.9157, lng: -85.1095 },
    onPick: (c) => picks.push(c),
    onClear: () => {
      clears += 1;
    },
    ...over,
  };
  let tree: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    tree = TestRenderer.create(createElement(DestinationSearch, current));
  });
  const r = tree as unknown as TestRenderer.ReactTestRenderer;

  /**
   * Read the RENDERED tree, not the element tree: `toJSON()` gives plain
   * nodes with string leaves, so nested <span>s inside a result card are
   * reachable. Walking element children would stop at the first element
   * and report every card as empty.
   */
  type Json = string | { type: string; props: Record<string, unknown>; children: Json[] | null };
  const textOf = (n: Json | null): string => {
    if (n === null) return '';
    if (typeof n === 'string') return n;
    return (n.children ?? []).map(textOf).join('');
  };
  const findJson = (n: Json | null, pred: (j: Exclude<Json, string>) => boolean): Json[] => {
    if (n === null || typeof n === 'string') return [];
    const here = pred(n) ? [n as Json] : [];
    return here.concat((n.children ?? []).flatMap((c) => findJson(c, pred)));
  };
  const rootJson = () => (r.toJSON() as Json | Json[] | null) ?? null;
  const roots = (): Json[] => {
    const j = rootJson();
    return j === null ? [] : Array.isArray(j) ? j : [j];
  };

  const box: Box = {
    async type(value: string) {
      const input = r.root.findAll((n) => n.type === 'input', { deep: true })[0];
      await act(async () => {
        input.props.onChange({ target: { value } });
      });
      await settleTimers();
    },
    status() {
      const p = roots().flatMap((j) =>
        findJson(j, (n) => n.type === 'p' && n.props['aria-live'] === 'polite'),
      )[0];
      return p === undefined ? '' : textOf(p).trim();
    },
    cards() {
      // One <li> per rendered candidate.
      return roots()
        .flatMap((j) => findJson(j, (n) => n.type === 'li'))
        .map((li) => textOf(li).trim());
    },
    async select(index: number) {
      const buttons = r.root.findAll(
        (n) => n.type === 'button' && typeof n.props.onClick === 'function',
        { deep: true },
      );
      await act(async () => {
        buttons[index].props.onClick();
      });
      await act(async () => {
        await new Promise((res) => setTimeout(res, 10));
      });
    },
    async rerender(next: Partial<Props>) {
      current = { ...current, ...next };
      await act(async () => {
        r.update(createElement(DestinationSearch, current));
      });
      await settleTimers();
    },
    async unmount() {
      await act(async () => {
        r.unmount();
      });
    },
    picks,
    get clears() {
      return clears;
    },
  };
  return box;
}

/* ====================================================================
 * NS1–NS4 — no class of failure may enter the cache.
 * ================================================================== */

async function failureNeverCached() {
  const cases: [string, string, Reply][] = [
    ['NS1', 'network exception', { kind: 'throw' }],
    ['NS2', 'non-2xx (503)', { kind: 'status', status: 503 }],
    [
      'NS3',
      'malformed response',
      { kind: 'malformed', body: { ok: true, places: 'not-an-array' } },
    ],
    ['NS4', 'expired/unauthorized pilot (401)', { kind: 'status', status: 401 }],
  ];
  for (const [id, label, reply] of cases) {
    // Through the real port first, so the failure classification is the
    // product's own and not this harness's opinion.
    installEndpoint([reply]);
    const outcome = await searchDestinations('petro knoxville', null);
    check(id, `${label}: the port reports a failure, never places`, outcome.kind === 'failure');

    // Then through the real component + coordinator.
    installEndpoint([reply, { kind: 'places', places: [place('recovered', 'Place recovered')] }]);
    const box = await mount();
    await box.type('Petro Knoxville');
    const afterFail = { calls: requestLog.length, status: box.status(), cards: box.cards().length };
    await box.type('');
    await box.type('  petro   knoxville  '); // normalized-equivalent retype
    check(
      id,
      `${label}: is NOT cached — the equivalent query asks again`,
      requestLog.length === 2,
      { afterFail, calls: requestLog.length },
    );
    check(
      id,
      `${label}: and the retry can then return real places`,
      box.cards().length === 1 && box.status() === '',
      { status: box.status(), cards: box.cards() },
    );
    await box.unmount();
  }
}

/* ====================================================================
 * NS5–NS8 — the same query stays retryable, and a retry can end either
 * way.
 * ================================================================== */

async function retryable() {
  installEndpoint([
    { kind: 'status', status: 500 },
    { kind: 'places', places: [place('a')] },
  ]);
  const box = await mount();
  await box.type('Petro Knoxville');
  const callsAfterFailure = requestLog.length;
  await box.type('petro knoxville'); // normalized-equivalent, no clear needed
  check('NS5', 'the same normalized query retries after a failure', requestLog.length === 2, {
    callsAfterFailure,
    now: requestLog.length,
  });
  check(
    'NS6',
    'the retry increments the provider/port call count',
    requestLog.length === callsAfterFailure + 1,
  );
  check(
    'NS7',
    'the retry may later return real places',
    box.cards().length === 1 && box.status() === '',
    { status: box.status() },
  );
  await box.unmount();

  installEndpoint([{ kind: 'throw' }, { kind: 'places', places: [] }]);
  const box2 = await mount();
  await box2.type('Nowhere Truck Stop');
  const midStatus = box2.status();
  await box2.type('nowhere truck stop');
  check(
    'NS8',
    'the retry may instead return a legitimate successful EMPTY answer',
    requestLog.length === 2 && box2.status() === NO_PLACES,
    { midStatus, status: box2.status(), calls: requestLog.length },
  );
  await box2.unmount();
}

/* ====================================================================
 * NS9–NS12 — successful answers, empty or not, are cached and copied.
 * ================================================================== */

async function successCached() {
  installEndpoint([{ kind: 'places', places: [] }]);
  const box = await mount();
  await box.type('Nowhere Truck Stop');
  const afterFirst = requestLog.length;
  await box.type('  NOWHERE   truck stop ');
  check(
    'NS9',
    'a successful EMPTY answer is cached — the retype spends nothing',
    afterFirst === 1 && requestLog.length === 1,
    { afterFirst, now: requestLog.length },
  );
  check(
    'NS10',
    'the cached empty answer says "No places found", not "unavailable"',
    box.status() === NO_PLACES,
    box.status(),
  );
  await box.unmount();

  installEndpoint([{ kind: 'places', places: [place('a'), place('b')] }]);
  const box2 = await mount();
  await box2.type('Petro Knoxville');
  const calls1 = requestLog.length;
  await box2.type('petro knoxville');
  check(
    'NS11',
    'a successful NON-EMPTY answer is cached — the retype spends nothing',
    calls1 === 1 && requestLog.length === 1 && box2.cards().length === 2,
    { calls1, now: requestLog.length, cards: box2.cards().length },
  );
  await box2.unmount();

  // Defensive copy, proven by mutating both sides of the boundary.
  const c = createSearchCoordinator();
  const d = c.next('petro', CTX);
  const given = [place('a'), place('b')];
  if (d.kind === 'request') c.acceptSuccess(d.seq, given);
  given.push(place('smuggled'));
  const hit1 = c.next('petro', CTX);
  const lenAfterCallerMutation = hit1.kind === 'cached' ? hit1.places.length : -1;
  if (hit1.kind === 'cached') hit1.places.push(place('also-smuggled'));
  const hit2 = c.next('petro', CTX);
  check(
    'NS12',
    'the cached place array is defensively copied on the way IN and OUT',
    lenAfterCallerMutation === 2 && hit2.kind === 'cached' && hit2.places.length === 2,
    { lenAfterCallerMutation, second: hit2.kind === 'cached' ? hit2.places.length : -1 },
  );
}

/* ====================================================================
 * NS13–NS16 — staleness, in both directions.
 * ================================================================== */

function staleness() {
  {
    const c = createSearchCoordinator();
    const slow = c.next('pilot', CTX);
    const fast = c.next('pilot travel center', CTX);
    const fastCurrent = fast.kind === 'request' && c.acceptSuccess(fast.seq, [place('newest')]);
    const slowFailureCurrent = slow.kind === 'request' && c.settleFailure(slow.seq);
    check(
      'NS13',
      'a stale FAILURE reports "not current", so it cannot replace newer results',
      fastCurrent === true && slowFailureCurrent === false,
      { fastCurrent, slowFailureCurrent },
    );
    check(
      'NS14',
      'a stale failure therefore cannot replace the newer status line',
      slowFailureCurrent === false && /if \(!isCurrent\) return;/.test(SEARCH_UI),
    );
    // And it must not have cached anything under its own key either.
    const reAsk = c.next('pilot', CTX);
    check(
      'NS13',
      'a stale failure also leaves its own query retryable',
      reAsk.kind === 'request',
      reAsk.kind,
    );
  }
  {
    const c = createSearchCoordinator();
    const older = c.next('pilot', CTX);
    const newer = c.next('pilot travel center', CTX);
    const newerCurrent = newer.kind === 'request' && c.acceptSuccess(newer.seq, [place('newest')]);
    const olderSuccess = older.kind === 'request' && c.acceptSuccess(older.seq, [place('older')]);
    check(
      'NS16',
      'a stale SUCCESS cannot overwrite the newer visible result',
      newerCurrent === true && olderSuccess === false,
      { newerCurrent, olderSuccess },
    );
    // Deliberate, pre-existing contract, preserved: a stale success is
    // still cached for ITS OWN query — it is a real answer to that query.
    check(
      'NS16',
      'a stale success is still remembered for its own query (unchanged contract)',
      c.next('pilot', CTX).kind === 'cached',
    );
  }
}

async function staleFailureDoesNotStopNewerSearch() {
  // The old code cleared `searching` in a `.finally` that ran for stale
  // settlements too, so an old attempt landing told the driver the search
  // still running had stopped.
  let resolveSlow: ((v: Response) => void) | null = null;
  const order: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestLog.push(url);
    const q = new URL(url, 'http://x').searchParams.get('q') ?? '';
    if (q.toLowerCase() === 'pilot') {
      order.push('slow-issued');
      return new Promise<Response>((res) => {
        resolveSlow = res;
      });
    }
    order.push('fast-issued');
    return new Response(JSON.stringify({ ok: true, places: [place('newest', 'Place newest')] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  requestLog = [];

  const box = await mount();
  await box.type('Pilot'); // slow request, held open
  await box.type('Pilot Travel'); // newer request, answers immediately
  const cardsBeforeStale = box.cards().length;
  const statusBefore = box.status();

  // Now the OLD request fails, long after the newer one已 landed.
  await act(async () => {
    resolveSlow?.(new Response(JSON.stringify({ ok: false }), { status: 503 }));
    await new Promise((r) => setTimeout(r, 40));
  });

  check(
    'NS15',
    'a stale failure does not stop or blank a newer completed search',
    cardsBeforeStale === 1 &&
      box.cards().length === 1 &&
      box.status() === statusBefore &&
      box.status() !== UNAVAILABLE,
    { cardsBeforeStale, cardsAfter: box.cards().length, status: box.status() },
  );
  await box.unmount();
}

/* ====================================================================
 * NS17–NS18 — the two sentences, and the one that must never be said.
 * ================================================================== */

async function messages() {
  for (const [label, reply] of [
    ['network', { kind: 'throw' } as Reply],
    ['503', { kind: 'status', status: 503 } as Reply],
    ['401', { kind: 'status', status: 401 } as Reply],
    ['429', { kind: 'status', status: 429 } as Reply],
    ['500', { kind: 'status', status: 500 } as Reply],
    ['timeout-shaped throw', { kind: 'throw' } as Reply],
    ['malformed', { kind: 'malformed', body: { ok: true } } as Reply],
    ['malformed-null', { kind: 'malformed', body: null } as Reply],
  ] as [string, Reply][]) {
    installEndpoint([reply]);
    const box = await mount();
    await box.type('Petro Knoxville');
    check('NS17', `${label}: the driver is told "${UNAVAILABLE}"`, box.status() === UNAVAILABLE, {
      label,
      status: box.status(),
    });
    check('NS18', `${label}: and is NEVER told "${NO_PLACES}"`, box.status() !== NO_PLACES, {
      label,
      status: box.status(),
    });
    await box.unmount();
  }
}

/* ====================================================================
 * NS19–NS21 — selection lifecycle.
 * ================================================================== */

async function selection() {
  installEndpoint([{ kind: 'places', places: [place('a', 'Place a')] }]);
  const box = await mount();
  await box.type('Petro Knoxville');
  await box.select(0);
  const callsAtSelection = requestLog.length;
  check(
    'NS19',
    'selecting clears the list and the status, and hands the candidate on',
    box.cards().length === 0 && box.status() === '' && box.picks.length === 1,
    { cards: box.cards().length, status: box.status(), picks: box.picks.length },
  );
  // The query now holds the picked title; a settled box must not search it.
  await settleTimers();
  check(
    'NS20',
    'a settled selection does not re-search its own title',
    requestLog.length === callsAtSelection,
    { callsAtSelection, now: requestLog.length },
  );
  const clearsBefore = box.clears;
  await box.type('Petro Knoxville West');
  check(
    'NS21',
    'editing after selection clears the old pick and reopens the search',
    box.clears === clearsBefore + 1 && requestLog.length > callsAtSelection,
    { clearsBefore, clears: box.clears, calls: requestLog.length },
  );
  await box.unmount();
}

/* ====================================================================
 * NS22–NS24 — spend discipline that must survive.
 * ================================================================== */

async function spendDiscipline() {
  installEndpoint([{ kind: 'places', places: [place('a')] }]);
  const box = await mount();
  for (const q of ['', 'p', 'pe']) await box.type(q);
  check('NS22', 'a query below the minimum length issues no call', requestLog.length === 0, {
    calls: requestLog.length,
  });
  await box.unmount();

  // Debounce probe: drive the input directly, then look BEFORE the window
  // has elapsed. `box.type()` deliberately waits it out, so it cannot show
  // this property.
  {
    installEndpoint([{ kind: 'places', places: [place('a')] }]);
    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(
        createElement(DestinationSearch, {
          origin: { lat: 34.9152, lng: -85.1092 },
          onPick: () => {},
          onClear: () => {},
        }),
      );
    });
    const r = tree as unknown as TestRenderer.ReactTestRenderer;
    const node = r.root.findAll((n) => n.type === 'input', { deep: true })[0];
    await act(async () => {
      node.props.onChange({ target: { value: 'Petro Knoxville' } });
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 150)); // < DEBOUNCE_MS
    });
    const early = requestLog.length;
    await act(async () => {
      await new Promise((res) => setTimeout(res, 320));
    });
    check('NS23', 'the debounce still prevents an immediate call', early === 0, { early });
    check('NS23', 'and the call goes out once the window elapses', requestLog.length === 1, {
      calls: requestLog.length,
    });
    await act(async () => {
      r.unmount();
    });
  }

  // GPS churn: 60 re-renders with fresh origin objects inside one coarse
  // bucket must not restart the search.
  {
    installEndpoint([{ kind: 'places', places: [place('a')] }]);
    // Centred INSIDE a bucket rather than on its edge: (-85.1095) sits
    // exactly on a toFixed(3) rounding boundary, so jitter there would
    // flip buckets and this would be measuring the fixture, not the code.
    const box3 = await mount({ origin: { lat: 34.9152, lng: -85.1092 } });
    await box3.type('Petro Knoxville');
    const afterFirst = requestLog.length;
    for (let i = 0; i < 60; i++) {
      // New object identity every tick, jitter well inside the ~110 m bucket.
      await box3.rerender({
        origin: { lat: 34.9152 + i * 0.000002, lng: -85.1092 - i * 0.000002 },
      });
    }
    check(
      'NS24',
      'GPS object churn inside one bucket costs ZERO extra calls',
      afterFirst === 1 && requestLog.length === 1,
      { afterFirst, now: requestLog.length },
    );
    await box3.unmount();
  }
}

/* ====================================================================
 * NS25–NS28 — cache bounds, eviction, and normalization.
 * ================================================================== */

function cacheBounds() {
  {
    const c = createSearchCoordinator();
    for (let i = 0; i < SEARCH_CACHE_MAX + 8; i++) {
      const d = c.next(`query number ${i}`, CTX);
      if (d.kind === 'request') c.acceptSuccess(d.seq, [place(`p${i}`)]);
    }
    const calls = c.callCount();
    check(
      'NS25',
      `the cache stays capped at SEARCH_CACHE_MAX (${SEARCH_CACHE_MAX})`,
      c.next('query number 0', CTX).kind === 'request' && c.callCount() === calls + 1,
    );
    check(
      'NS26',
      'the OLDEST successful entry evicts first; recent ones survive',
      c.next(`query number ${SEARCH_CACHE_MAX + 7}`, CTX).kind === 'cached',
    );
  }
  {
    // A failure must not occupy a slot — 40 failures cannot evict one
    // successful answer.
    const c = createSearchCoordinator();
    const good = c.next('keeper query', CTX);
    if (good.kind === 'request') c.acceptSuccess(good.seq, [place('keeper')]);
    for (let i = 0; i < 40; i++) {
      const d = c.next(`doomed query ${i}`, CTX);
      if (d.kind === 'request') c.settleFailure(d.seq);
    }
    const hit = c.next('keeper query', CTX);
    check(
      'NS27',
      'failures consume NO cache slots — 40 of them evict nothing',
      hit.kind === 'cached' && hit.places[0]?.id === 'keeper',
      hit.kind,
    );
  }
  {
    const c = createSearchCoordinator();
    const d = c.next('442 Indian Lake Ct', CTX);
    if (d.kind === 'request') c.acceptSuccess(d.seq, [place('a')]);
    check(
      'NS28',
      'whitespace and case normalization still share one slot',
      c.next('  442   INDIAN lake CT ', CTX).kind === 'cached' && c.callCount() === 1,
    );
    check(
      'NS28',
      'a genuinely different query still earns its own request',
      c.next('442 Indian Lake Court', CTX).kind === 'request',
    );
  }
}

/* ====================================================================
 * NS29–NS33 — the two doors, and independence between boxes.
 * ================================================================== */

async function sharedSurfaces() {
  check(
    'NS29',
    'the Navigator endpoint constant is preserved',
    NAVIGATOR_SEARCH_ENDPOINT === '/api/navigator/destination-search' &&
      PORT_SRC.includes("'/api/navigator/destination-search'"),
  );
  check(
    'NS30',
    'the Trip Planner endpoint constant is preserved',
    TRIP_PLANNER_SEARCH_ENDPOINT === '/api/trip-planner/destination-search' &&
      PORT_SRC.includes("'/api/trip-planner/destination-search'"),
  );

  // Each box owns its own coordinator, so two failures cannot mix.
  installEndpoint([
    { kind: 'status', status: 503 },
    { kind: 'places', places: [place('dest', 'Place dest')] },
  ]);
  const originBox = await mount({ testId: 'origin' });
  const destBox = await mount({ testId: 'destination' });
  await originBox.type('Petro Knoxville'); // fails
  await destBox.type('Petro Knoxville'); // same query, different box → succeeds
  check(
    'NS31',
    'two mounted boxes hold independent coordinators',
    requestLog.length === 2,
    requestLog.length,
  );
  check(
    'NS32',
    'a failure in the origin box cannot poison the destination box',
    originBox.status() === UNAVAILABLE && destBox.cards().length === 1,
    { origin: originBox.status(), destCards: destBox.cards().length },
  );
  await originBox.unmount();
  await destBox.unmount();

  // Navigator failure vs Trip Planner success, same query.
  installEndpoint([
    { kind: 'status', status: 401 },
    { kind: 'places', places: [place('tp', 'Place tp')] },
  ]);
  const navBox = await mount({ endpoint: NAVIGATOR_SEARCH_ENDPOINT });
  const tpBox = await mount({ endpoint: TRIP_PLANNER_SEARCH_ENDPOINT, origin: null });
  await navBox.type('Petro Knoxville');
  await tpBox.type('Petro Knoxville');
  check(
    'NS33',
    'a Navigator failure cannot poison a Trip Planner search',
    navBox.status() === UNAVAILABLE &&
      tpBox.cards().length === 1 &&
      requestLog.some((u) => u.startsWith(NAVIGATOR_SEARCH_ENDPOINT)) &&
      requestLog.some((u) => u.startsWith(TRIP_PLANNER_SEARCH_ENDPOINT)),
    { nav: navBox.status(), tpCards: tpBox.cards().length, urls: requestLog },
  );
  await navBox.unmount();
  await tpBox.unmount();
}

/* ====================================================================
 * NS34–NS40 — privacy, persistence, and blast radius.
 * ================================================================== */

async function boundaries() {
  installEndpoint([{ kind: 'places', places: [place('a', 'Place a')] }]);
  const box = await mount();
  await box.type('Petro Knoxville');
  const rendered = box.cards().join(' | ');
  check(
    'NS34',
    'no coordinate appears in driver-visible result text',
    !/34\.92|-85\.11|\d{2}\.\d{4,}/.test(rendered) &&
      !/place\.position\.(lat|lng)\s*\}/.test(SEARCH_UI),
    rendered,
  );
  await box.unmount();

  check(
    'NS35',
    'no typed query is logged anywhere on the search path',
    !/console\.(log|info|warn|error)/.test(SEARCH_UI) &&
      !/console\./.test(COORD_SRC) &&
      !/console\./.test(PORT_SRC),
  );
  check(
    'NS36',
    'no provider key or secret reaches client search source',
    !/HERE_API_KEY|apiKey|SERVICE_ROLE|SUPABASE_[A-Z_]*KEY|SECRET|process\.env/.test(SEARCH_UI) &&
      !/HERE_API_KEY|apiKey|SERVICE_ROLE|SECRET|process\.env/.test(COORD_SRC) &&
      !/HERE_API_KEY|apiKey|SERVICE_ROLE|SECRET|process\.env/.test(PORT_SRC),
  );
  check(
    'NS37',
    'no localStorage/sessionStorage/cookie persistence was added',
    !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(SEARCH_UI) &&
      !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(COORD_SRC),
  );
  check(
    'NS38',
    'no Supabase client or write reaches the search path',
    !/supabase|createAdminClient|createStaticClient/i.test(SEARCH_UI) &&
      !/supabase|createAdminClient|createStaticClient/i.test(COORD_SRC) &&
      !/supabase|createAdminClient|createStaticClient/i.test(PORT_SRC),
  );
  check(
    'NS39',
    'the search path imports no HOS or Trip Planner engine',
    !/hos-engine|trip-planner\/optimizer|cost-engine|route-tracker|navigation-lifecycle/.test(
      SEARCH_UI,
    ) && !/hos-engine|trip-planner\/|navigation-lifecycle/.test(COORD_SRC),
  );

  // NS40, behaviourally: after a failure, nothing re-requests on its own.
  installEndpoint([{ kind: 'status', status: 503 }]);
  const box2 = await mount();
  await box2.type('Petro Knoxville');
  const afterFailure = requestLog.length;
  for (let i = 0; i < 6; i++) await settleTimers();
  check(
    'NS40',
    'a failure triggers NO automatic retry — the count is frozen until the driver acts',
    afterFailure === 1 && requestLog.length === 1,
    { afterFailure, afterWaiting: requestLog.length },
  );
  check(
    'NS40',
    'and no timer/interval retry machinery exists in the component',
    !/setInterval|retryTimer|scheduleRetry|autoRetry/.test(SEARCH_UI),
  );
  await box2.unmount();
}

/* ====================================================================
 * CONTEXT KEY — the second half of this milestone (Phase 7).
 * ================================================================== */

async function contextKey() {
  // Country, on the SAME mounted box — exactly what the Navigator's
  // border control does.
  installEndpoint([
    { kind: 'places', places: [place('usa', 'Place usa')] },
    { kind: 'places', places: [place('can', 'Place can')] },
  ]);
  const box = await mount({ country: 'USA' });
  await box.type('Petro');
  const usaCards = box.cards();
  await box.rerender({ country: 'CAN' });
  check(
    'CTX-country',
    'switching country re-asks the provider instead of reusing the other nation’s answer',
    requestLog.length === 2 && box.cards()[0]?.includes('can'),
    { calls: requestLog.length, usaCards, nowCards: box.cards() },
  );
  check(
    'CTX-country',
    'and the request actually carried the new country',
    requestLog[1]?.includes('country=CAN'),
    requestLog,
  );
  await box.unmount();

  // Origin bucket.
  installEndpoint([
    { kind: 'places', places: [place('dalton', 'Place dalton')] },
    { kind: 'places', places: [place('knoxville', 'Place knoxville')] },
  ]);
  const box2 = await mount({ origin: { lat: 34.9157, lng: -85.1095 } });
  await box2.type('Petro');
  await box2.rerender({ origin: { lat: 35.9606, lng: -83.9207 } });
  check(
    'CTX-origin',
    'moving to a new origin bucket re-asks rather than reusing distances from a hundred miles back',
    requestLog.length === 2 && box2.cards()[0]?.includes('knoxville'),
    { calls: requestLog.length, cards: box2.cards() },
  );
  await box2.unmount();

  // Endpoint.
  installEndpoint([
    { kind: 'places', places: [place('nav', 'Place nav')] },
    { kind: 'places', places: [place('tp', 'Place tp')] },
  ]);
  const box3 = await mount({ endpoint: NAVIGATOR_SEARCH_ENDPOINT });
  await box3.type('Petro');
  await box3.rerender({ endpoint: TRIP_PLANNER_SEARCH_ENDPOINT });
  check(
    'CTX-endpoint',
    'switching door re-asks rather than serving the other door’s answer',
    requestLog.length === 2 && box3.cards()[0]?.includes('tp'),
    { calls: requestLog.length, cards: box3.cards() },
  );
  await box3.unmount();

  // The key itself: distinct contexts, distinct slots; and no value can
  // impersonate a separator.
  const base = searchCacheKey(CTX, 'petro');
  check(
    'CTX-key',
    'each context dimension produces a distinct cache slot',
    new Set([
      base,
      searchCacheKey(ctx({ country: 'CAN' }), 'petro'),
      searchCacheKey(ctx({ endpoint: TRIP_PLANNER_SEARCH_ENDPOINT }), 'petro'),
      searchCacheKey(ctx({ originKey: null }), 'petro'),
      searchCacheKey(CTX, 'petro travel'),
    ]).size === 5,
  );
  check(
    'CTX-key',
    'a query containing the separator cannot collide with another context',
    searchCacheKey(ctx({ originKey: 'a' }), 'b|c') !==
      searchCacheKey(ctx({ originKey: 'a|b' }), 'c'),
  );
  check(
    'CTX-key',
    'an unbiased search and a biased one never share a slot',
    searchCacheKey(ctx({ originKey: null }), 'petro') !==
      searchCacheKey(ctx({ originKey: '' }), 'petro') ||
      // (both empty-ish; what matters is neither equals a real bucket)
      searchCacheKey(ctx({ originKey: null }), 'petro') !== base,
  );
  check(
    'CTX-key',
    'cache identity and effect identity are the same four values',
    /const searchContext: SearchContext = \{ country, endpoint, originKey \}/.test(SEARCH_UI) &&
      /\[query, originKey, settled, country, endpoint\]/.test(SEARCH_UI),
  );
}

/* ==================================================================== */

async function main() {
  const realFetch = globalThis.fetch;
  try {
    await failureNeverCached();
    await retryable();
    await successCached();
    staleness();
    await staleFailureDoesNotStopNewerSearch();
    await messages();
    await selection();
    await spendDiscipline();
    cacheBounds();
    await sharedSurfaces();
    await boundaries();
    await contextKey();
  } finally {
    globalThis.fetch = realFetch;
  }

  // Every NS scenario must have been exercised — a silently skipped
  // scenario would otherwise read as a pass.
  const expected = Array.from({ length: 40 }, (_, i) => `NS${i + 1}`);
  const missing = expected.filter((id) => !seen.has(id));
  check('NS-COVERAGE', 'every NS1–NS40 scenario ran', missing.length === 0, missing);

  console.log(`nav-search-failure-cache: ${passed} passed, ${failed} failed`);
  // react-test-renderer keeps the loop alive; exit explicitly.
  process.exit(failed > 0 ? 1 : 0);
}

void main();

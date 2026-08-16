/**
 * THE INVENTORY. Every Navigator endpoint that can cause a paid-provider
 * transaction, in one list, so that "did we protect all of them?" is a
 * question with a checkable answer rather than a memory.
 *
 * WHY A LIST AND NOT A CONVENTION. The alternative — "every route under
 * /api/navigator is metered" — is true today and silently false the first
 * time someone adds a free endpoint, at which point the rule stops being
 * read. A list is wrong loudly: the test walks the filesystem, finds every
 * route handler under the Navigator API tree, and fails if one is absent
 * from here. Adding an endpoint without classifying it does not compile past
 * the suite.
 *
 * WHAT "METERED" MEANS HERE. The endpoint can, on some path through it,
 * cause an outbound request to a provider that bills. It does not mean every
 * call bills — the routing endpoint has a response cache, and a cache hit
 * spends nothing. The guard is deliberately pessimistic about that: it
 * reserves before the call, and a cache hit that spends nothing has still
 * consumed a unit. See `usage-guard.ts` for why that direction is the safe
 * one.
 *
 * TWO PRODUCTS, NOT ONE. Routing and destination search bill against
 * DIFFERENT HERE products with different quotas — the cost audit records the
 * search quota as undocumented. `weight` is therefore a local unit of
 * account, not a HERE transaction count, and the two must not be conflated.
 * `usage-guard.ts` states the limits of that claim in full.
 *
 * Pure and runtime-agnostic: no env, no clock, no I/O. The Edge middleware,
 * Node route handlers and the offline harness all import it.
 */

/** Stable keys. Used in the database ledger, so renaming one is a migration. */
export const METERED_ENDPOINT_KEYS = ['navigator.route', 'navigator.destination-search'] as const;

export type MeteredEndpointKey = (typeof METERED_ENDPOINT_KEYS)[number];

export type MeteredEndpoint = Readonly<{
  key: MeteredEndpointKey;
  /** The request path, exactly as a caller would write it. */
  path: string;
  method: 'GET' | 'POST';
  /** The source file, so the inventory test can read the handler itself. */
  handler: string;
  /**
   * Which provider product the call bills against. Distinct strings because
   * they are distinct quotas — see the note above.
   */
  product: 'here-truck-routing' | 'here-discover-search';
  /**
   * Default local units reserved per request. Configurable per deploy via
   * `usage-guard.ts`; this is the fallback, not a HERE transaction count.
   */
  defaultWeight: number;
}>;

export const METERED_ENDPOINTS: Readonly<Record<MeteredEndpointKey, MeteredEndpoint>> = {
  'navigator.route': {
    key: 'navigator.route',
    path: '/api/navigator/route',
    method: 'POST',
    handler: 'src/app/api/navigator/route/route.ts',
    product: 'here-truck-routing',
    defaultWeight: 1,
  },
  'navigator.destination-search': {
    key: 'navigator.destination-search',
    path: '/api/navigator/destination-search',
    method: 'GET',
    handler: 'src/app/api/navigator/destination-search/route.ts',
    product: 'here-discover-search',
    defaultWeight: 1,
  },
};

export const METERED_ENDPOINT_LIST: readonly MeteredEndpoint[] = METERED_ENDPOINT_KEYS.map(
  (k) => METERED_ENDPOINTS[k],
);

/**
 * Navigator API routes that reach no provider and so are not metered.
 *
 * Empty today, and it is a real entry rather than an oversight: every route
 * handler under the Navigator API tree is currently metered. The constant
 * exists so that adding a free endpoint is a deliberate classification —
 * the inventory test requires each discovered handler to appear in exactly
 * one of the two lists.
 */
export const UNMETERED_NAVIGATOR_API_HANDLERS: readonly string[] = [];

/** Is this request path one of the metered endpoints? */
export function meteredEndpointForPath(pathname: string): MeteredEndpoint | null {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  return METERED_ENDPOINT_LIST.find((e) => e.path === clean) ?? null;
}

/**
 * Every metered Navigator endpoint, called for real, with no session.
 *
 * THE CLAIM THIS FILE EXISTS TO MAKE. The page gate is not evidence. The page
 * is not what spends money and an attacker does not use it — they POST to the
 * endpoint. A page-level test would have shown account mode working while both
 * metered handlers were, in fact, refusing every driver alive: neither passed
 * `signedIn` to the access policy, so the verdict compared `undefined === true`
 * and returned 'unauthorized' unconditionally. It failed closed, so it was
 * never a hole — but it was invisible from every test that existed.
 *
 * So the assertions below IMPORT THE REAL HANDLERS and call them, and for each
 * one prove four separate things about an anonymous account-mode request:
 *
 *   1. it is refused,
 *   2. no provider call occurred,
 *   3. no budget unit was consumed,
 *   4. no provider configuration or secret appears in the response.
 *
 * The inventory itself is walked off the filesystem, so an endpoint added
 * without being classified fails this suite rather than quietly shipping
 * unprotected.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-metered-endpoints.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --outfile=/tmp/test-navigator-metered-endpoints.cjs \
 *   && node /tmp/test-navigator-metered-endpoints.cjs
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Environment BEFORE the imports. The routing handler binds the provider key
 * into its adapter at module scope, so the value it sees is whatever is set
 * when the module first loads.
 */
process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';
process.env.HERE_API_KEY = 'test-provider-key-do-not-log-abc123';
process.env.NAVIGATOR_PREVIEW_PASSWORD = 'pilot-passcode-for-tests';
process.env.NAVIGATOR_ACCESS_MODE = 'account';

/** Every outbound request the handlers attempt. Must stay empty for anon. */
const providerCalls: string[] = [];
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : String(input?.url ?? input);
  providerCalls.push(url);
  // Answer plausibly so that a handler which DID reach here would proceed —
  // the assertion is that it never gets here, not that it crashes if it does.
  return new Response(JSON.stringify({ items: [], routes: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
void realFetch;

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST as routePost } from '@/app/api/navigator/route/route';
import { GET as searchGet } from '@/app/api/navigator/destination-search/route';
import {
  METERED_ENDPOINTS,
  METERED_ENDPOINT_KEYS,
  METERED_ENDPOINT_LIST,
  UNMETERED_NAVIGATOR_API_HANDLERS,
  meteredEndpointForPath,
} from '@/lib/navigator-api/metered-endpoints';
import { publicBudget } from '@/lib/navigator-api/public-budget';
import { navigatorApiAccessVerdict } from '@/lib/navigator-api/access-policy';
import { USAGE_LIMIT_USER_MESSAGE } from '@/lib/navigator-api/usage-guard';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => readFileSync(p, 'utf8');

/* ===================================================================== *
 * 1. THE INVENTORY IS COMPLETE
 * ===================================================================== */
{
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry === 'route.ts' || entry === 'route.tsx') found.push(p);
    }
  };
  walk('src/app/api/navigator');

  const classified = new Set<string>([
    ...METERED_ENDPOINT_LIST.map((e) => e.handler),
    ...UNMETERED_NAVIGATOR_API_HANDLERS,
  ]);
  const unclassified = found.filter((f) => !classified.has(f));
  check(
    '1a: every Navigator API route handler is classified metered or unmetered',
    unclassified.length === 0,
    unclassified,
  );
  check(
    '1b: the inventory names handlers that exist',
    METERED_ENDPOINT_LIST.every((e) => found.includes(e.handler)),
    METERED_ENDPOINT_LIST.map((e) => e.handler),
  );
  check('1c: two metered endpoints today', METERED_ENDPOINT_KEYS.length === 2);
  check(
    '1d: routing and search are recorded as DIFFERENT provider products',
    METERED_ENDPOINTS['navigator.route'].product !==
      METERED_ENDPOINTS['navigator.destination-search'].product,
  );
  check(
    '1e: paths resolve back to their endpoint',
    meteredEndpointForPath('/api/navigator/route')?.key === 'navigator.route' &&
      meteredEndpointForPath('/api/navigator/destination-search')?.key ===
        'navigator.destination-search',
  );
  check('1f: an unrelated path is not metered', meteredEndpointForPath('/api/health') === null);

  /*
   * Both handlers must go through the SHARED gate. Two hand-written copies is
   * how the missing `signedIn` flag came to exist in both at once.
   */
  for (const e of METERED_ENDPOINT_LIST) {
    const src = read(e.handler);
    check(`1g: ${e.key} delegates to the shared metered gate`, /await meteredGate\(\{/.test(src));
    check(
      `1h: ${e.key} returns the gate's refusal unchanged`,
      /if \(!gate\.ok\) return gate\.response;/.test(src),
    );
  }
}

/* ===================================================================== *
 * 2. THE PURE VERDICT — account mode needs a session, and only that
 * ===================================================================== */
{
  check(
    '2a: account mode with no session is unauthorized',
    navigatorApiAccessVerdict({ flagEnabled: true, mode: 'account', tokenValid: false }) ===
      'unauthorized',
  );
  check(
    '2b: a stale PILOT cookie does not open account mode',
    navigatorApiAccessVerdict({ flagEnabled: true, mode: 'account', tokenValid: true }) ===
      'unauthorized',
  );
  check(
    '2c: a verified session does open it',
    navigatorApiAccessVerdict({
      flagEnabled: true,
      mode: 'account',
      tokenValid: false,
      signedIn: true,
    }) === 'ok',
  );
  /*
   * The defect, pinned as a regression test. Omitting `signedIn` must never
   * be readable as "signed in" — and the shipped code omitted it in both
   * handlers, which is why this is asserted rather than assumed.
   */
  check(
    '2d: an OMITTED signedIn is refused, not treated as true',
    navigatorApiAccessVerdict({ flagEnabled: true, mode: 'account', tokenValid: true }) !== 'ok',
  );
}

/* ===================================================================== *
 * 3. THE REAL HANDLERS, ANONYMOUS, IN ACCOUNT MODE
 * ===================================================================== */

const ROUTE_BODY = JSON.stringify({
  origin: { lat: 35.05, lng: -85.31 },
  destination: { lat: 36.16, lng: -86.78 },
  departAtMs: 1_800_000_000_000,
  truck: {
    heightFt: 13.5,
    widthFt: 8.5,
    lengthFt: 70,
    grossWeightLbs: 78000,
    axles: 5,
    hazmatClass: null,
    avoid: [],
  },
});

function routeRequest(): NextRequest {
  return new NextRequest(
    new Request('https://example.test/api/navigator/route', {
      method: 'POST',
      body: ROUTE_BODY,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
function searchRequest(): NextRequest {
  return new NextRequest(
    new Request('https://example.test/api/navigator/destination-search?q=pilot+travel+center'),
  );
}

type Probe = {
  key: string;
  call: () => Promise<Response>;
};
const PROBES: Probe[] = [
  { key: 'navigator.route', call: () => routePost(routeRequest()) as unknown as Promise<Response> },
  {
    key: 'navigator.destination-search',
    call: () => searchGet(searchRequest()) as unknown as Promise<Response>,
  },
];

async function main(): Promise<void> {
  for (const probe of PROBES) {
    process.env.NAVIGATOR_ACCESS_MODE = 'account';
    providerCalls.length = 0;
    const budgetBefore = {
      route: publicBudget.remaining('route'),
      search: publicBudget.remaining('search'),
    };

    const res = await probe.call();
    const text = await res.text();

    check(
      `3a ${probe.key}: an anonymous account-mode request is refused`,
      res.status === 401,
      res.status,
    );
    check(
      `3b ${probe.key}: refused as "sign in", not as "guess the passcode"`,
      /account-sign-in-required/.test(text),
      text.slice(0, 160),
    );
    check(`3c ${probe.key}: NO provider call occurred`, providerCalls.length === 0, providerCalls);
    check(
      `3d ${probe.key}: NO budget unit was consumed`,
      publicBudget.remaining('route') === budgetBefore.route &&
        publicBudget.remaining('search') === budgetBefore.search,
    );

    /* -- 4. nothing about the infrastructure leaks ---------------------- */
    for (const [what, re] of [
      ['the provider key', /test-provider-key-do-not-log-abc123/],
      ['any provider host', /hereapi|here\.com/i],
      ['an upstream URL', /https?:\/\//],
      ['the pilot passcode', /pilot-passcode-for-tests/],
      ['the access-mode variable', /NAVIGATOR_ACCESS_MODE/],
      ['the key variable name', /HERE_API_KEY/],
      ['whether a key is configured', /provider-not-configured/],
      ['a Supabase reference', /supabase/i],
      ['a service role', /service_role|SERVICE_ROLE/],
      ['a stack trace', /\bat \w+ \(/],
    ] as const) {
      check(
        `3e ${probe.key}: the refusal does not expose ${what}`,
        !re.test(text),
        text.slice(0, 200),
      );
    }
  }

  /* =================================================================== *
   * 4. AUTHENTICATION PRECEDES THE CONFIGURATION PROBE
   * =================================================================== *
   * The route handler answers a DISTINCT 503 when the provider key is absent
   * — genuinely useful for an operator, and a true statement about the
   * infrastructure that an anonymous stranger may not have. With the key
   * removed, an anonymous caller must still get 401: the gate ran first.
   */
  {
    const savedKey = process.env.HERE_API_KEY;
    delete process.env.HERE_API_KEY;
    process.env.NAVIGATOR_ACCESS_MODE = 'account';
    providerCalls.length = 0;

    for (const probe of PROBES) {
      const res = await probe.call();
      const text = await res.text();
      check(
        `4a ${probe.key}: with NO provider key, an anonymous caller still gets 401`,
        res.status === 401,
        res.status,
      );
      check(
        `4b ${probe.key}: …and is not told the key is missing`,
        !/provider-not-configured/.test(text),
        text.slice(0, 160),
      );
    }
    check('4c: still no provider call', providerCalls.length === 0, providerCalls);
    process.env.HERE_API_KEY = savedKey;
  }

  /* =================================================================== *
   * 5. CLOSED MODE STILL 404s, AND THE FLAG STILL WINS
   * =================================================================== */
  {
    process.env.NAVIGATOR_ACCESS_MODE = 'closed';
    providerCalls.length = 0;
    for (const probe of PROBES) {
      const res = await probe.call();
      check(`5a ${probe.key}: closed mode answers 404, not 403`, res.status === 404, res.status);
    }
    check('5b: closed mode makes no provider call', providerCalls.length === 0);

    process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'false';
    process.env.NAVIGATOR_ACCESS_MODE = 'account';
    for (const probe of PROBES) {
      const res = await probe.call();
      const text = await res.text();
      check(
        `5c ${probe.key}: the flag being off answers 404 before any credential talk`,
        res.status === 404 && /not-enabled/.test(text),
        res.status,
      );
    }
    process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED = 'true';
  }

  /* =================================================================== *
   * 6. PILOT MODE IS UNCHANGED — the rollback target still works
   * =================================================================== *
   * Production runs `pilot`. An anonymous caller is refused with the SAME
   * wording as before this change, and the refusal is still a 401 rather than
   * anything new.
   */
  {
    process.env.NAVIGATOR_ACCESS_MODE = 'pilot';
    providerCalls.length = 0;
    for (const probe of PROBES) {
      const res = await probe.call();
      const text = await res.text();
      check(
        `6a ${probe.key}: pilot mode still refuses an anonymous caller with 401`,
        res.status === 401,
        res.status,
      );
      check(
        `6b ${probe.key}: …with the unchanged pilot wording`,
        /pilot-access-required/.test(text),
        text.slice(0, 160),
      );
    }
    check('6c: pilot refusals reach no provider either', providerCalls.length === 0);
  }

  /* =================================================================== *
   * 7. THE GUARD IS NOT REACHABLE BEFORE AUTHENTICATION
   * =================================================================== *
   * The refusal an anonymous caller receives must never be the usage-limit
   * one: that would mean the reservation ran for someone with no account, and
   * a reservation is the thing that costs money.
   */
  {
    process.env.NAVIGATOR_ACCESS_MODE = 'account';
    for (const probe of PROBES) {
      const res = await probe.call();
      const text = await res.text();
      check(
        `7a ${probe.key}: an anonymous caller never sees the usage-limit message`,
        !text.includes(USAGE_LIMIT_USER_MESSAGE),
      );
      check(
        `7b ${probe.key}: nor any usage- error code`,
        !/"code":"usage-/.test(text),
        text.slice(0, 160),
      );
      check(`7c ${probe.key}: the refusal is the auth one`, res.status === 401);
    }
  }

  /* =================================================================== *
   * 8. NO SERVICE-ROLE CREDENTIAL CAN REACH THE BROWSER
   * =================================================================== */
  {
    const CLIENT_FILES = [
      'src/components/navigator/sync-client.ts',
      'src/components/navigator/account-sync.ts',
      'src/components/navigator/sync-domain-storage.ts',
      'src/components/navigator/DrivingScreen.tsx',
    ];
    for (const f of CLIENT_FILES) {
      const src = read(f);
      check(
        `8a: ${f.split('/').pop()} never imports the service-role client`,
        !/supabase\/admin/.test(src) && !/SUPABASE_SERVICE_ROLE_KEY/.test(src),
      );
      check(`8b: ${f.split('/').pop()} never reads the provider key`, !/HERE_API_KEY/.test(src));
    }
    check(
      '8c: the service-role client is server-only by import',
      /^import 'server-only';/m.test(read('src/lib/supabase/admin.ts')),
    );
    check(
      '8d: the usage reservation is the only thing that uses it for the guard',
      /supabase\/admin/.test(read('src/lib/navigator-api/usage-reservation.ts')),
    );
    /*
     * The refusal a driver sees must carry no billing or infrastructure
     * detail — no threshold, no remaining balance, no provider name, no hint
     * that a database is involved, and no number at all. A remaining-budget
     * figure handed to a caller is a progress bar for exhausting it.
     *
     * The four CAUSES stay distinguishable for an operator, in the response's
     * machine-readable code. That is the split being asserted: prose says
     * nothing, the code says everything.
     */
    check(
      '8e: the driver-facing limit message contains no number',
      !/\d/.test(USAGE_LIMIT_USER_MESSAGE),
      USAGE_LIMIT_USER_MESSAGE,
    );
    for (const [what, re] of [
      ['a threshold or allowance', /threshold|allowance|quota|budget|limit of/i],
      ['a provider name', /HERE\b|hereapi|provider/i],
      ['any infrastructure', /supabase|database|postgres|serverless|netlify/i],
      ['a billing word', /bill|invoice|cost|charge|\$/i],
    ] as const) {
      check(`8f: the limit message does not mention ${what}`, !re.test(USAGE_LIMIT_USER_MESSAGE));
    }
    const gateSrc = read('src/lib/navigator-api/metered-gate.ts')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    check(
      '8g: every usage refusal returns that one constant, never a computed detail',
      (gateSrc.match(/USAGE_LIMIT_USER_MESSAGE/g) ?? []).length >= 1 &&
        !/globalUnits|userUnits|reservation\.units/.test(gateSrc),
    );
    check(
      '8h: but the CAUSE stays readable to an operator in the error code',
      /`usage-\$\{reservation\.reason\}`/.test(gateSrc),
    );
  }

  /* =================================================================== *
   * 9. CROSS-USER ISOLATION
   * =================================================================== *
   * Honest about its own limit: RLS enforcement needs a live database. What
   * IS provable offline is that no code path lets a caller NAME the user
   * whose data or allowance it touches — which is the property RLS is there
   * to back up, and the one a bug would break first.
   */
  {
    const syncClient = read('src/components/navigator/sync-client.ts');
    check(
      '9a: the sync client takes no user id parameter — ownership comes from the session',
      !/function (fetchCloudState|pushDomain)[^)]*userId/.test(syncClient),
    );
    check(
      '9b: it fills user_id from the verified user, not from a caller',
      /user_id: user\.id/.test(syncClient),
    );
    const gate = read('src/lib/navigator-api/metered-gate.ts');
    check(
      '9c: the gate attributes usage to the verified id only',
      /const userId = mode === 'account' \? await accountUserId\(\) : null/.test(gate),
    );
    const session = read('src/lib/navigator-api/account-session.ts');
    check(
      '9d: the id is read from getUser(), which verifies against the auth server',
      /user\.id/.test(session) && /getUser\(\)/.test(session),
    );
    const migration = read('supabase/migrations/050_navigator_accounts.sql');
    check(
      '9e: state RLS derives ownership from auth.uid(), never a client value',
      /navigator_state_select_own[\s\S]*?using \(user_id = auth\.uid\(\)\)/.test(migration),
    );
    check(
      '9f: and WITH CHECK stops a row being moved to another user on the way out',
      /with check \(user_id = auth\.uid\(\)\)/.test(migration),
    );
  }

  console.log(`navigator-metered-endpoints: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();

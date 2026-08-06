import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHereRoutingPort, type HereRouteOutcome } from '@/lib/trip-planner/here-routing';
import { RateLimiter } from '@/lib/trip-planner/rate-limit';
import { errorJson, guardedParseWithLimiter } from '@/lib/trip-planner/api-util';
import {
  navigatorRouteRequestSchema,
  toRoutingRequest,
  validateRouteRequest,
} from '@/lib/navigator-api/route-contract';
import { validateNavigatorTruckProfile } from '@/lib/navigator/truck-validation';
import { validateRoute } from '@/lib/navigator/route-validation';
import {
  geometryFingerprint,
  normalizeGeometry,
  validateGeometryEndpoints,
} from '@/lib/navigator/route-geometry';

/**
 * POST /api/navigator/route — NEW-1 from the architecture package
 * (docs/navigator/03-api-inventory.md), milestone N8a: the ONLY endpoint
 * that may hand a route to a navigation session, and every route it hands
 * out is VALIDATED first. No rerouting, no map matching, no off-route
 * logic — those are later milestones; this endpoint answers one request
 * for one validated truck route.
 *
 * Safety rails, in order:
 * 1. FLAG-GATED: while NEXT_PUBLIC_NAVIGATOR_ENABLED is unset this
 *    endpoint answers 404 — merged code spends nothing in production.
 * 2. Strict rate limit: 6/hour/IP (doc 03) vs the planner's 20/min —
 *    this endpoint spends metered HERE transactions.
 * 3. Truck-profile validation: an impossible profile is rejected with
 *    field-level reasons and NO provider request occurs.
 * 4. Cost controls inherited from the shared adapter: response cache,
 *    request coalescing, hourly spend cap, single retry policy.
 * 5. Route validation: geometry, summary, maneuvers, destination match,
 *    and provider restriction notices — a route that fails is never
 *    returned as usable.
 */

const navigatorLimiter = new RateLimiter({
  capacity: 6,
  refillPerSecond: 6 / 3600, // 6 requests/hour per IP, per instance (doc 03)
  nowMs: () => Date.now(),
});

// Module-level so the route cache and the free-tier call counter survive
// across requests within a warm serverless instance — the same discipline
// as the planner's quote endpoint, with a SEPARATE cache (different
// response needs) but the same hard spend cap.
//
// The adapter's fail-soft null hides WHY it failed; the outcome hook
// records the last bucketed cause (no-key / over-cap / provider-error /
// malformed-response — never a URL, never the key) so a pilot failure is
// diagnosable from the response instead of reading as a generic
// provider outage. Concurrent requests could interleave this value; it
// is diagnostic-only and the 6/hour limiter keeps concurrency near zero.
let lastRouteOutcome: HereRouteOutcome | null = null;
let lastProviderHttp: { status: number | null; note: string } | null = null;

const hereRouting = createHereRoutingPort(
  async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, json: () => res.json() };
  },
  process.env.HERE_API_KEY,
  {
    // N8b: this instance retains FULL geometry on results, so its cache
    // is kept deliberately small — 24 full routes, not the planner's 500
    // sampled ones. The planner's instances never set retainGeometry.
    retainGeometry: true,
    cacheMax: 24,
    onOutcome: (outcome) => {
      lastRouteOutcome = outcome;
    },
    onProviderHttpError: (status, note) => {
      lastProviderHttp = { status, note };
    },
  },
);

export async function POST(req: NextRequest) {
  // Rail 1 — production-inert until the Navigator itself is enabled.
  if (process.env.NEXT_PUBLIC_NAVIGATOR_ENABLED !== 'true') {
    return errorJson(404, 'not-enabled', 'Navigator is not enabled.');
  }

  // Rail 1b — configuration honesty: a deploy context without the HERE
  // key (e.g. an env var scoped to Production only, or to builds but not
  // functions) must say so DISTINCTLY, before any limiter token or
  // provider budget is touched. Without this check the request would
  // fall through to a generic 'no-provider-response', indistinguishable
  // from a real provider outage. No key material is ever echoed.
  if (!process.env.HERE_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        state: 'provider-failure',
        problems: [
          {
            code: 'provider-not-configured',
            message:
              'The routing provider key is not configured for this deploy context. ' +
              'Check HERE_API_KEY availability (context AND functions scope) in the deploy environment.',
          },
        ],
        warnings: [],
      },
      { status: 503 },
    );
  }

  // Rails 2 + schema — strict limiter, size caps, zod shape.
  const guarded = await guardedParseWithLimiter(navigatorLimiter, req, navigatorRouteRequestSchema);
  if ('response' in guarded) return guarded.response;
  const data = guarded.data;

  // Rail 3 — the truck must be possible BEFORE any transaction is spent.
  const truckIssues = validateNavigatorTruckProfile(data.truck);
  if (truckIssues.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: 'rejected',
        problems: truckIssues.map((i) => ({ code: `truck:${i.code}`, message: i.message })),
        warnings: [],
      },
      { status: 422 },
    );
  }
  const requestProblems = validateRouteRequest(data);
  if (requestProblems.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: 'rejected',
        problems: requestProblems.map((message) => ({ code: 'request-invalid', message })),
        warnings: [],
      },
      { status: 422 },
    );
  }

  // Rail 4 — one provider call through the shared, budgeted adapter.
  const result = await hereRouting.route(toRoutingRequest(data));

  // Rail 5 — validate before anything reaches a navigation session.
  const verdict = validateRoute(
    data.destination,
    result === null
      ? { kind: 'no-response' }
      : {
          kind: 'parsed',
          route: {
            summary: result.summary ?? { meters: 0, seconds: 0 },
            firstPosition: result.routePoints[0]?.position ?? { lat: NaN, lng: NaN },
            lastPosition: result.routePoints[result.routePoints.length - 1]?.position ?? {
              lat: NaN,
              lng: NaN,
            },
            geometryPointCount: result.geometryPointCount ?? 0,
            maneuvers: result.maneuvers ?? [],
            notices: result.notices ?? [],
          },
        },
  );

  if (verdict.state === 'provider-failure') {
    // Attach the adapter's bucketed cause AND the provider's real HTTP
    // status + sanitized error snippet so road testing can tell a key
    // rejection (401/403 — e.g. Routing not enabled for the HERE app)
    // from a 400 request problem from a timeout. Never a URL or key.
    const cause = result === null ? (lastRouteOutcome ?? 'unknown') : 'unknown';
    const http = result === null ? lastProviderHttp : null;
    return NextResponse.json(
      {
        ok: false,
        state: verdict.state,
        problems: [
          ...verdict.problems,
          { code: `provider-cause:${cause}`, message: 'Bucketed provider-failure cause.' },
          ...(http !== null
            ? [
                {
                  code: `provider-http:${http.status ?? 'network'}`,
                  message: http.note,
                },
              ]
            : []),
        ],
        warnings: verdict.warnings,
      },
      { status: 502 },
    );
  }
  if (verdict.state === 'rejected') {
    // Pilot diagnosability: on a destination mismatch, echo WHERE the
    // provider's route actually ends so a road tester can tell a legal
    // entrance snap from a wrong pin by putting the point on a map. The
    // coordinate rides in the CODE (clients join codes into the visible
    // failure reason); the pilot log redacts any 4+-decimal number, so
    // this never persists in a log. The threshold itself is untouched.
    const problems = [...verdict.problems];
    if (problems.some((p) => p.code === 'destination-mismatch')) {
      const end = result?.routePoints[result.routePoints.length - 1]?.position;
      if (end && Number.isFinite(end.lat) && Number.isFinite(end.lng)) {
        problems.push({
          code: `route-ends-at:${end.lat.toFixed(4)},${end.lng.toFixed(4)}`,
          message:
            'Where the provider route actually ends. Compare this point against the destination that was entered.',
        });
      }
    }
    return NextResponse.json(
      { ok: false, state: verdict.state, problems, warnings: verdict.warnings },
      { status: 422 },
    );
  }

  // Rail 6 (N8b) — the GEOMETRY itself must survive normalization and
  // endpoint agreement before it can ever seed a navigation session.
  const distanceMiles = result!.route.totalMiles;
  const normalized = normalizeGeometry(result!.geometry ?? [], distanceMiles);
  const geometryProblems = [
    ...normalized.problems,
    ...(normalized.problems.length === 0
      ? validateGeometryEndpoints(normalized.points, data.origin, data.destination)
      : []),
  ];
  if (geometryProblems.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: 'rejected',
        problems: geometryProblems.map((p) => ({ code: `geometry:${p.code}`, message: p.message })),
        warnings: verdict.warnings,
      },
      { status: 422 },
    );
  }

  // valid / valid-with-warning / requires-review all return the route —
  // but only the first two are ok:true; a requires-review route must
  // never auto-start a session.
  const ok = verdict.state === 'valid' || verdict.state === 'valid-with-warning';
  return NextResponse.json(
    {
      ok,
      state: verdict.state,
      problems: verdict.problems,
      warnings: verdict.warnings,
      route: {
        routeId: `nav-${geometryFingerprint(normalized.points)}-${data.departAtMs}`,
        distanceMiles,
        seconds: result!.summary?.seconds ?? null,
        provider: result!.provider,
        routePoints: result!.routePoints,
        // N8b: the COMPLETE geometry, 5-decimal rounded (~1 m) to bound
        // payload size; the session recomputes cumulative miles
        // deterministically from these pairs plus distanceMiles.
        geometry: normalized.points.map((p) => [
          Number(p.position.lat.toFixed(5)),
          Number(p.position.lng.toFixed(5)),
        ]),
        geometryFingerprint: geometryFingerprint(normalized.points),
        maneuvers: result!.maneuvers ?? [],
        instructions: result!.instructions ?? [],
        notices: result!.notices ?? [],
      },
    },
    { status: 200 },
  );
}

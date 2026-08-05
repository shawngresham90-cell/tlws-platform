/**
 * Client adapters for POST /api/navigator/route (milestone P1). The pure
 * lifecycle and reroute engines speak through injected ports; these two
 * factories are the ONLY place the Navigator client touches the network,
 * and both talk to the one flag-gated, rate-limited, validated endpoint
 * N8a/N8b built. While NEXT_PUBLIC_NAVIGATOR_ENABLED is unset the
 * endpoint answers 404, so these adapters cannot spend anything in
 * production.
 *
 * Both adapters translate failures into structured refusals — the engines
 * treat any failure as "keep the current route"; nothing here throws
 * into the caller.
 */

import type { LatLng } from '@/lib/map/bounds';
import type { PlanFetchResult, PlanPort, PlanRequest } from '@/lib/navigator/navigation-lifecycle';
import type {
  ReplacementFetchResult,
  ReplacementPort,
  ReplacementRequest,
} from '@/lib/navigator/reroute-controller';
import type { TruckProfile } from '@/lib/trip-planner/types';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';

export type RouteFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

const ENDPOINT = '/api/navigator/route';
const TIMEOUT_MS = 20_000;

type RawManeuver = {
  action?: unknown;
  instruction?: unknown;
  direction?: unknown;
  offset?: unknown;
};

type ParsedRoute = {
  routeId: string;
  positions: LatLng[];
  distanceMiles: number;
  durationSeconds: number;
  maneuvers: { action: string; instruction: string; direction: string | null; offset: number }[];
  validationState: string;
  warnings: string[];
};

type ParseOutcome = { kind: 'route'; route: ParsedRoute } | { kind: 'failure'; reason: string };

async function requestRoute(
  fetchFn: RouteFetchLike,
  body: {
    origin: LatLng;
    destination: LatLng;
    truck: TruckProfile;
    avoid?: readonly RouteAvoidance[];
    departAtMs: number;
  },
): Promise<ParseOutcome> {
  let status: number;
  let payload: unknown;
  try {
    const res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        origin: body.origin,
        destination: body.destination,
        truck: body.truck,
        ...(body.avoid && body.avoid.length > 0 ? { avoid: body.avoid } : {}),
        departAtMs: body.departAtMs,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    payload = await res.json();
  } catch {
    return { kind: 'failure', reason: 'network' };
  }

  const data = payload as {
    ok?: unknown;
    state?: unknown;
    problems?: { code?: unknown; message?: unknown }[];
    warnings?: unknown[];
    route?: {
      routeId?: unknown;
      distanceMiles?: unknown;
      seconds?: unknown;
      geometry?: unknown;
      maneuvers?: unknown;
    };
  } | null;

  if (data === null || typeof data !== 'object') {
    return { kind: 'failure', reason: `bad-response:${status}` };
  }
  if (data.ok !== true || status !== 200) {
    const codes = Array.isArray(data.problems)
      ? data.problems.map((p) => String(p?.code ?? 'unknown')).join(',')
      : '';
    const state = typeof data.state === 'string' ? data.state : `http-${status}`;
    return { kind: 'failure', reason: codes === '' ? state : `${state}:${codes}` };
  }

  const route = data.route;
  const geometry = route?.geometry;
  if (
    !route ||
    typeof route.routeId !== 'string' ||
    typeof route.distanceMiles !== 'number' ||
    !Array.isArray(geometry)
  ) {
    return { kind: 'failure', reason: 'malformed-route' };
  }
  const seconds = route.seconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return { kind: 'failure', reason: 'missing-duration' };
  }

  const positions: LatLng[] = [];
  for (const pair of geometry as unknown[]) {
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') {
      return { kind: 'failure', reason: 'malformed-geometry' };
    }
    positions.push({ lat: pair[0], lng: pair[1] });
  }

  const maneuvers: ParsedRoute['maneuvers'] = [];
  for (const raw of (Array.isArray(route.maneuvers) ? route.maneuvers : []) as RawManeuver[]) {
    if (typeof raw?.offset !== 'number' || !Number.isInteger(raw.offset)) continue;
    maneuvers.push({
      action: typeof raw.action === 'string' ? raw.action : 'continue',
      instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
      direction: typeof raw.direction === 'string' ? raw.direction : null,
      offset: raw.offset,
    });
  }

  return {
    kind: 'route',
    route: {
      routeId: route.routeId,
      positions,
      distanceMiles: route.distanceMiles,
      durationSeconds: seconds,
      maneuvers,
      validationState: typeof data.state === 'string' ? data.state : 'valid',
      warnings: Array.isArray(data.warnings) ? data.warnings.map((w) => String(w)) : [],
    },
  };
}

/** Plan port for the lifecycle: one validated truck route, or a refusal. */
export function createNavigatorPlanPort(
  fetchFn: RouteFetchLike = (url, init) => fetch(url, init),
): PlanPort {
  return async (req: PlanRequest): Promise<PlanFetchResult> => {
    const out = await requestRoute(fetchFn, req);
    if (out.kind === 'failure') return out;
    return { kind: 'route', ...out.route };
  };
}

/** Replacement port for the caged N8e rerouter — same endpoint, same
 *  validation; the controller re-validates the material again itself. */
export function createNavigatorReplacementPort(
  fetchFn: RouteFetchLike = (url, init) => fetch(url, init),
): ReplacementPort {
  return async (req: ReplacementRequest): Promise<ReplacementFetchResult> => {
    const out = await requestRoute(fetchFn, {
      origin: req.origin,
      destination: req.destination,
      truck: req.truck,
      avoid: req.avoid,
      departAtMs: req.departAtMs,
    });
    if (out.kind === 'failure') return out;
    const { routeId: _routeId, ...material } = out.route;
    return { kind: 'route', ...material };
  };
}

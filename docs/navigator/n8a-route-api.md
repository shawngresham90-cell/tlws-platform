# N8a — Route API & Truck Route Validation (implementation record)

Status: **implemented** on branch `claude/navigator-n8a-route-api` (draft PR, owner review required).
Design authority: the Navigator architecture package on branch
`claude/navigator-architecture` (`docs/navigator/00–10`), specifically
**NEW-1 in doc 03 (API inventory)** and the doc 05/06 safety rules.

> Note on the "Navigator Blueprint Extension" (Docs 11–15): those documents
> are not present in this repository on any branch as of this implementation.
> Nothing here modifies them; when they land, this record is the N8a
> implementation reference they can point to.

## What N8a is — and is not

N8a is the **route request and route validation layer only**: the guarantee
that every future navigation session starts from a **validated truck route**.

Explicitly NOT in this milestone: rerouting, map matching, off-route
detection, arrival logic, guidance timing, final approach (N8b–N8f).

## Components

| Layer | File | Role |
|---|---|---|
| Truck profile validation | `src/lib/navigator/truck-validation.ts` | Field-level plausibility: impossible height/width/length/weight/axles, trailer-combination cross-checks (per-axle capacity, combination/multi-trailer axle minimums), DOT hazmat class + division validity. Pure; under the purity gate. |
| Request contract | `src/lib/navigator-api/route-contract.ts` | zod schema (bounded lat/lng, ≤6 waypoints, whitelisted avoidances, integer departure), degenerate-trip checks, provider-neutral serialization to the shared `RoutingRequest`. Lives OUTSIDE the pure core because it imports zod (the gate whitelists only `@/lib/**`). |
| HERE serialization | `src/lib/trip-planner/here-routing.ts` (`buildHereRouteUrl`, unchanged) | Reused, not forked. A field-disappearance canary in `test-navigator-route-api` pins every truck restriction parameter (`truck[height/width/length/grossWeight/axleCount/shippedHazardousGoods]`) and the exact unit conversions. |
| Response parsing | `here-routing.ts` `parseHereResponse` (**additively extended**) | Now retains section `notices` (code/title/severity, capped at 50, malformed entries skipped). Everything else unchanged; malformed payloads still parse to `null`. |
| Route validation | `src/lib/navigator/route-validation.ts` | Pure verdict over the parsed route: geometry, summary/travel-time plausibility, destination match, maneuver integrity/order, provider restriction notices. |
| Endpoint | `src/app/api/navigator/route/route.ts` | `POST /api/navigator/route` (NEW-1). Flag-gated 404, 6/hour/IP limiter, truck validation before any spend, shared budgeted adapter, validation before response. |

## Route states

| State | Meaning | HTTP |
|---|---|---|
| `valid` | Safe to start a session | 200, `ok: true` |
| `valid-with-warning` | Safe; provider notices attached | 200, `ok: true` |
| `requires-review` | Structurally usable but suspicious (destination offset 0.5–2 mi, implausible average speed, no maneuvers); must not auto-start a session | 200, `ok: false`, route attached |
| `rejected` | Failed validation (impossible truck, malformed response, missing geometry, destination mismatch > 2 mi, invalid/mis-ordered maneuvers, **critical restriction notice**) | 422 |
| `provider-failure` | No usable provider response (down, over budget, no key) | 502 |

## Cost controls (all preserved, none loosened)

- **Flag gate**: the endpoint is a 404 until `NEXT_PUBLIC_NAVIGATOR_ENABLED`
  is set — merged code cannot spend a HERE transaction in production.
- **Rate limit**: separate `RateLimiter` instance at **6/hour/IP** (doc 03),
  vs the planner's shared 20/min — via the new `guardedParseWithLimiter`
  (the planner's `guardedParse` delegates to it, behavior unchanged).
- **Adapter rails reused**: response cache (TTL 6 h, keyed on endpoints +
  full truck restriction set + avoidances + departure bucket), in-flight
  request coalescing, per-instance hourly spend cap, single 5xx retry /
  never-4xx retry, absolute fail-soft (no URL or key ever escapes).
- **Pre-flight rejection**: an invalid truck profile or degenerate request
  never reaches the provider — proven by tests counting zero fetches.

## Observability added (additive)

`createHereRoutingPort` accepts an optional `onOutcome` observer
(`no-key | invalid-profile | over-cap | cache-hit | coalesced |
provider-error | malformed-response | ok`). Default is no observer —
byte-identical planner behavior.

## Trip Planner regression stance

All changes to shared files are additive: `ParsedHereRoute.notices` (new
field), `RoutingResult.maneuvers/notices/summary/geometryPointCount`
(optional), `guardedParseWithLimiter` (new export). `composeQuote` and all
planner endpoints are untouched; the full suite (including all four
here-routing harnesses) passes unchanged.

## Remaining before N8b

- Full-resolution geometry in the response (today: sampled `routePoints`;
  the decoded polyline is not returned yet) and the session handoff into
  `createNavigationController`.
- Client wiring (destination entry is still the locked placeholder on the
  driving screen).
- p95 latency measurement against the real provider (unmeasurable from CI).

## Rollback

Delete `src/lib/navigator/truck-validation.ts`,
`src/lib/navigator/route-validation.ts`, `src/lib/navigator-api/`,
`src/app/api/navigator/`, `scripts/test-navigator-route-api.ts`, this file,
and revert the additive hunks in `here-routing.ts` / `providers.ts` /
`api-util.ts`. Single squash-revert restores main exactly.

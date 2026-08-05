# TLWS Navigator — Architecture Package

**Status: DESIGN ONLY. No feature code exists. Nothing here has been implemented.**

This directory is the implementation blueprint for TLWS Navigator: a professional
truck-navigation experience built on the Trip Planner core that already ships in
this repository.

| # | Document | Covers |
|---|---|---|
| 00 | this file | Decisions, reuse summary, glossary |
| [01](./01-ux-screens.md) | UX & screens | Every screen, flows, error and permission states |
| [02](./02-component-inventory.md) | Component inventory | Every React component, props, state, data source |
| [03](./03-api-inventory.md) | API inventory | Existing endpoints, reuse verdict, new endpoints needed |
| [04](./04-state-management.md) | State management | Session, GPS, caches, HOS, UI, sync |
| [05](./05-navigation-engine.md) | Navigation engine | Loops, reroute algorithm, refresh cadences |
| [06](./06-safety.md) | Safety | Lockouts, override, emergency, every failure mode |
| [07](./07-offline.md) | Offline | What is cached, budgets, eviction, sync |
| [08](./08-performance.md) | Performance | Targets and budgets |
| [09](./09-testing.md) | Testing | Every suite, including merge-blocking safety tests |
| [10](./10-milestones.md) | Milestones | Smallest safe PRs, rollback, risk |

---

## The finding this package is built on

Every module in `src/lib/trip-planner/` is **pure, deterministic, and
dependency-injected**. `src/lib/trip-planner/types.ts:3` states the rule:

> "The engine never reads a clock itself: callers supply all timestamps, which
> keeps every module deterministic and offline-testable."

A navigation loop is a clock-driven re-evaluation of functions the planner
already calls. Because nothing reads `Date.now()` internally, **the entire
planning core can run client-side, offline, at 1 Hz, unchanged.**

Navigator does not need a new engine. It needs a *driver* for the engine that
already exists.

## What TLWS already has

Confirmed by inspection of `origin/main` at `46f2a40`:

| Capability | Location | State |
|---|---|---|
| HERE Routing API v8, truck profile | `src/lib/trip-planner/here-routing.ts` | Production |
| Provider interface (`RoutingPort`) | `src/lib/trip-planner/providers.ts` | Production |
| Truck dimensions + hazmat + avoidances | `here-routing.ts:88-112` | Production |
| Turn-by-turn instruction **text** | `here-routing.ts:229` | Production (text only) |
| Route geometry decode | `flexible-polyline.ts` | Production |
| Route projection / cumulative miles | `directory-layer.ts` `projectOntoRoute` | Production |
| HOS engine (11h/14h/30min/60-70/split sleeper) | `src/lib/hos/**`, `hos-engine.ts` | Production |
| Last Legal Stop, 4 named slots | `last-stop.ts` | Production |
| Parking directory + zero-space safety rule | `directory-layer.ts` | Production |
| Overnight status vocabulary | `src/lib/directory/overnight.ts` | Production |
| Weather along route (NWS) | `nws-weather.ts` | Production |
| Diesel pricing (EIA) | `eia-fuel.ts` | Production |
| Place search (directory + HERE geocode) | `place-search.ts`, `here-geocode.ts` | Production |
| Saved trips + truck presets, cloud-synced | `saved-trips-store.ts`, `cloud-sync.ts`, migration 044 | Production |
| End-user auth (Supabase, RLS by `auth.uid()`) | `cloud-api.ts`, `src/middleware.ts` | Production |
| Maps | Leaflet, `src/components/map/**` | Production |

## What TLWS does not have

| Gap | Evidence |
|---|---|
| Continuous position | `watchPosition` appears **nowhere**; only `getCurrentPosition` in 3 components |
| Turn-by-turn guidance UI | No navigation surface exists |
| Off-route detection | Route projection exists for planning only |
| Live rerouting | — |
| Voice in/out | No `speechSynthesis`, no `SpeechRecognition` |
| Motion detection | No `DeviceMotion` / `DeviceOrientation` |
| PWA / service worker / offline | No manifest, no service worker, no `caches` usage |
| Traffic | `departureTime` is sent, but no traffic layer |
| Background GPS | Not possible in the current web-only shell |

## Architecture decisions

**AD-1 — Navigator lives inside TLWS**, as `src/lib/navigator/` (pure core),
`src/components/navigator/` (UI), `src/app/(navigator)/` (routes).
*Rationale:* value comes from tight coupling to the directory, HOS engine and
planner. A separate repo would mean publishing three APIs, dual CI, and
splitting the merge-blocking safety gate from the code it guards.

**AD-2 — The Navigator core stays pure.** Nothing under `src/lib/navigator/`
may import React, `next/*`, or `fetch`. Enforced by a test harness
(`test-navigator-purity.ts`), matching the discipline `src/lib/trip-planner/`
already follows. This is what keeps AD-5 reversible and the offline test runner
usable.

**AD-3 — Nothing in the Trip Planner is replaced.** Dispositions are
reuse-unchanged, extend, or new-wrapper. See [03](./03-api-inventory.md) and the
module table below. The existing planner must keep working untouched.

**AD-4 — The safety lock ships before the driving screen.** Milestone N4
precedes N5. Retrofitting a lock produces per-component checks that rot.

**AD-5 — Web/PWA first, Capacitor second, never React Native.** React Native
would discard 165 components and the API layer for a benefit Navigator does not
need. See [01](./01-ux-screens.md) §Mobile and [10](./10-milestones.md) N13.

**AD-6 — Offline means offline *guidance*, not offline *routing*.** The HERE key
is server-side only (`here-routing.ts:14-18`) — a correct posture that must not
be relaxed. Therefore routes must be fully cached before departure, and
rerouting is inherently online-only. Product copy must say so.

**AD-7 — No position history is ever persisted.** Position lives in memory for
the session. Nothing is written to Supabase, localStorage, or logs. Analytics
stay bucketed, consistent with `tpc-analytics.ts`.

**AD-8 — Estimated routes may never drive turn-by-turn.** `route-estimate.ts`
(great-circle × 1.2 circuity) stays the planner's fail-soft fallback, but it has
no real road geometry. Navigator refuses to start guidance on an estimated
route.

## Module reuse summary

Full detail in [03](./03-api-inventory.md). Summary of all 24 Trip Planner
modules:

- **Reuse unchanged (14):** `here-geocode`, `flexible-polyline`, `route-estimate`,
  `directory-layer`, `hos-engine`, `hos-exceptions`, `last-stop`, `cost-engine`,
  `eia-fuel`, `place-search`, `cloud-api`, `rate-limit`, `tpc-analytics`,
  `hos/*`
- **Extend (8):** `types`, `providers`, `here-routing`, `directory-loader`,
  `nws-weather`, `saved-trips-store`, `cloud-sync`, `api-contracts`, `api-util`
- **New wrapper only (2):** `optimizer`, `compose-quote`
- **Replace (0)**

## Known documentation drift found during inspection

Not fixed by this package (design-only session), but recorded so they are not
mistaken for current fact:

1. `src/lib/trip-planner/providers.ts:9` — "no live adapter exists yet."
   Stale: `here-routing.ts` is a live adapter.
2. `src/lib/trip-planner/saved-trips-store.ts:5` — "tlws-platform has no end-user
   account system." Stale: migration 044 + `cloud-api.ts` implement one.

## Glossary

| Term | Meaning |
|---|---|
| **Route-mile** | Cumulative distance along the route polyline from origin. The universal position coordinate in this system |
| **Fix** | One GPS sample, after accuracy and staleness gating |
| **Maneuver** | One turn instruction with a route-mile offset |
| **Slot** | A Last Legal Stop named recommendation (`best-reservable`, `last-reservable`, `backup-reservable`, `last-free`) |
| **Lock state** | `stationary` / `moving` / `unknown`; `unknown` is treated as `moving` |
| **Session** | One origin→destination navigation run; destroyed on arrival |

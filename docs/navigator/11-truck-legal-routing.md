# 11 — Truck-Legal Routing (Blueprint Extension)

**Status: DESIGN ONLY. Extends the 00–10 architecture package. Nothing here is
implemented by this document.**

This addendum defines what "truck-legal route" means for TLWS Navigator, audits
the current HERE adapter and repository against that definition, and specifies
the profile, request, and legality requirements that must be met before public
launch. It does not replace any part of 00–10; where 03 (API inventory) or 05
(navigation engine) already covers a topic, this document only adds the
routing-legality dimension.

**Fact classes used throughout (per the quality rules of this extension):**

| Tag | Meaning |
|---|---|
| `[REPO]` | Verified by inspection of this repository (main @ `c128a88`, N6 merged) |
| `[HERE-DOC]` | Believed provider behavior from HERE Routing API v8 documentation — **must be re-verified against current HERE docs before implementation; not verified live in this session** |
| `[PROPOSED]` | Proposed architecture or target, not measured, not implemented |
| `[OWNER]` | Requires an owner decision |

---

## 1. Core product requirement, stated measurably

A driver can:

1. Enter a destination and see the geocode the app resolved, with a confidence
   label, before routing money is spent.
2. Enter or select a truck profile that passes validation
   (`validateTruckProfileForRouting`, `[REPO]` `here-routing.ts`) and confirm it
   on a pre-drive screen.
3. Receive a route computed by the provider **for that exact profile** — every
   safety-relevant profile field provably present in the outbound request
   (§5), never silently dropped, never served from a cache entry keyed on a
   materially different profile.
4. Follow turn-by-turn guidance whose maneuver placement error, at the
   announcement point, is bounded by the tracker's projection spacing
   (currently 0.1 mi densified, `[REPO]` `route-tracker.ts`).
5. Stay on roads the provider deems passable for the profile **where the
   provider evaluated the restriction** — and be told, explicitly, where it
   did not or could not (§4, notices).
6. Be warned — not silently routed — when legal-routing confidence is
   insufficient (§4 outcomes).
7. Be rerouted only after off-route confirmation per doc 13, preserving the
   full profile and avoidances.
8. Not be given a detour whose ratio to the plausible corridor exceeds the
   audit thresholds in doc 12 §2 without a stated reason.
9. Reach arrival without silent guidance loss: every failure renders a named
   `DrivingScreenStatus` (`[REPO]` `navigation-controller.ts`), never a
   frozen screen (doc 13 §6).

"Best route" and "safe route" are banned phrases in product copy and in code
comments unless bound to the measurable criteria above.

---

## 2. Formal definition of "truck-legal route"

A route is **truck-legal for profile P at departure time T** when every road
segment on it is passable and permitted for a vehicle matching P at T under
the restriction data available to the routing provider, **and** the provider
returned no violation notice for any section of the route.

Three honesty rules qualify that definition:

- **R1 — Legality is evaluated, not guaranteed.** The provider evaluates
  against its map data. Posted signs, temporary orders, and data latency mean
  the driver remains legally responsible. The app states this (doc 12 §5) and
  never claims "guaranteed legal."
- **R2 — Unknown ≠ legal.** A restriction category the provider does not
  model, or a profile attribute we do not send, is **unevaluated**. The route
  is then "truck-routed with unevaluated categories: X, Y" — never "legal."
- **R3 — A violated route is not a route.** If the provider returns a route
  carrying a restriction-violation notice (see §4), guidance must not start
  on it. This is an extension of AD-8 (estimated routes never drive
  guidance): a violated live route is treated with the same severity as an
  estimate.

---

## 3. Restriction-category capability matrix

Statuses: **IMPL** (supported and currently implemented) · **PROV** (provider-
supported, not implemented) · **PART** (partial) · **UNSUP** (provider cannot
model it) · **VERIFY** (unknown, requires verification against current HERE
docs) · **OWNER** (owner decision required).

Columns: *Sent* = does the current adapter transmit it (`[REPO]`
`buildHereRouteUrl`)? *Evidence* = does the provider return restriction
evidence we could inspect? *Missing-data behavior* = proposed app behavior when
the attribute is absent.

| Category | Status | Sent today | Provider param / evidence | Missing-data behavior `[PROPOSED]` |
|---|---|---|---|---|
| Vehicle height | **IMPL** | Yes — `truck[height]` cm | Evaluated in routing; violations via notices `[HERE-DOC]` | Block navigation: height is mandatory |
| Vehicle width | **IMPL** | Yes — `truck[width]` | same | Block |
| Vehicle length | **IMPL** | Yes — `truck[length]` | same | Block |
| Gross weight | **IMPL** | Yes — `truck[grossWeight]` kg | same | Block |
| Axle count | **IMPL** | Yes — `truck[axleCount]` | same | Block |
| Per-axle weight | **PROV/VERIFY** | **No** | `truck[weightPerAxle]` `[HERE-DOC]` | Warn: "axle-weight-posted bridges not evaluated" |
| Trailer count | **PROV/VERIFY** | **No** | `truck[trailerCount]` `[HERE-DOC]` | Warn; affects multi-trailer bans |
| Vehicle type (tractor vs straight) | **PROV/VERIFY** | **No** | `truck[type]` `[HERE-DOC]` | Default `tractor` with confirmation `[OWNER]` |
| Hazmat class | **IMPL (coarse)** | Yes — `shippedHazardousGoods`, US class digit → HERE goods, unknown → `other` (conservative) | Evaluated `[HERE-DOC]` | Already fail-closed to `other` `[REPO]` |
| Tunnel category (ADR B/C/D/E) | **PROV/VERIFY** | **No** | `truck[tunnelCategory]` `[HERE-DOC]` | Hazmat loads: warn that tunnel category is unevaluated; consider blocking hazmat guidance until sent `[OWNER]` |
| Truck-prohibited roads / commercial bans | **PART** | Implicit via `transportMode=truck` | Modeled in HERE truck routing; per-segment evidence requires spans `[HERE-DOC]` §4 | n/a — inherent |
| Local-delivery-only | **VERIFY** | No explicit param | Possibly modeled as access restriction `[HERE-DOC]` | Warn in urban final approach (doc 12 §3) |
| Bridge weight limits | **PART** | Gross weight yes; axle weight no | Notices/spans `[HERE-DOC]` | Warn re per-axle gap |
| Low-clearance structures | **IMPL** | Via height | Notices `[HERE-DOC]` | — |
| Tunnels (avoidance) | **IMPL** | `avoid[features]=tunnel` whitelist `[REPO]` | — | — |
| Seasonal roads | **VERIFY** | No | Time-aware restrictions with `departureTime` (sent `[REPO]`) `[HERE-DOC]` | Disclose data-latency limits (doc 12 §5) |
| Time-of-day / day-of-week restrictions | **PART/VERIFY** | `departureTime` sent `[REPO]` | Time-aware truck restrictions `[HERE-DOC]` | Warn when a long trip crosses restriction windows — the route was computed for T, not T+8h |
| Construction / temporary closures | **VERIFY** | No traffic layer (doc 00: N14 blocked) | HERE incidents/closures products `[HERE-DOC]` | Disclose; N14 dependency |
| Private roads | **VERIFY** | No | Access modeling varies `[HERE-DOC]` | Final-approach rules, doc 12 §3 |
| Unpaved roads | **IMPL** | `avoid[features]=dirtRoad` `[REPO]` | — | — |
| Ferries | **IMPL** | `avoid[features]=ferry` `[REPO]` | — | — |
| Toll roads | **IMPL** | `avoid[features]=tollRoad` `[REPO]` | Toll cost not requested (`tollCents: null` `[REPO]`) | Cost display is planner scope, not legality |
| U-turns | **IMPL** | `avoid[features]=uTurns` `[REPO]` | — | — |
| Border crossings | **VERIFY** | No | `avoid[features]` border value to verify `[HERE-DOC]` | Out of v1 scope `[OWNER]` |
| Sharp turns / geometry unsuitable | **UNSUP (direct)** | — | Truck routing biases against, no per-turn evidence `[HERE-DOC]` | Covered by road-test library (doc 14) |
| Steep grades / mountain | **VERIFY** | No | `return=elevation` exists; grade avoidance param to verify `[HERE-DOC]` | Route library mountain cases (doc 14) |
| Urban delivery restrictions | **VERIFY** | No | — | Final-approach warning tier |
| Destination approach / yard access | **UNSUP by provider** | — | Not a provider capability | Entire doc 12 §3 exists for this |

**Matrix rule:** every **VERIFY** row must be resolved against current HERE
documentation (with the doc URL recorded in this file) before the row's
category can be described to users as evaluated. Until then R2 applies.

---

## 4. The violation-notice gap — highest-severity finding

`[REPO]` `parseHereResponse` reads `routes[0].sections[].summary`, `polyline`,
and `actions`. It does **not** request or read `notices`, and it does **not**
request `spans`.

`[HERE-DOC]` HERE Routing v8 can return a route **with per-section notices**
when constraints could not be fully honored — including violation-class
notices (e.g., a restriction the route could not avoid). If that behavior is
confirmed, the current adapter would accept such a route, and Navigator would
guide a truck down it while presenting it as a truck-profile route.

**Required before N8 guidance-route work `[PROPOSED]`:**

1. Verify against current HERE docs: notice schema, severity values, and the
   exact conditions under which a violating route is returned versus no route.
2. Extend the request `return=` set to include notices/spans data sufficient
   to detect violations (`turnByTurnActions`, `spans` with truck attributes —
   exact values to verify `[HERE-DOC]`).
3. Extend `parseHereResponse` (additively, per N1 discipline) to surface a
   `notices` array on `ParsedHereRoute`.
4. Route-validation layer (doc 12 §4) **rejects** any route carrying a
   violation-class notice: outcome `no verified truck-legal route`, guidance
   never starts (R3).
5. A merge-blocking test: a fixture response containing a violation notice
   must be rejected; a build that starts guidance on it fails CI.

Until item 1 is verified, treat the risk as real and the gap as open.

---

## 5. Truck-profile requirements

### 5.1 Minimum profile before navigation `[PROPOSED]`

Mandatory (block without them): height, width, length, gross weight, axle
count. Already enforced pre-provider by `validateTruckProfileForRouting`
bounds (`[REPO]` `TRUCK_LIMITS`: height 8–15 ft, width 7–9 ft, length
20–120 ft, GVW 10,000–164,000 lb, axles 2–9).

Required additions for navigation (not the planner) `[PROPOSED]`:

| Field | Rationale | Default |
|---|---|---|
| Trailer count | Multi-trailer bans | 1, confirmed on screen |
| Vehicle type | Straight vs tractor restrictions | `tractor` `[OWNER]` |
| Per-axle weight | Axle-posted bridges | Derived GVW/axles with an "estimated" label, never presented as measured |
| Tunnel category | Hazmat tunnel law | Required when hazmat set; else n/a |
| Units preference | Entry errors | Imperial, sticky |
| Toll / ferry / unpaved prefs | Already supported via avoid whitelist `[REPO]` | Off |

### 5.2 Validation beyond range bounds `[PROPOSED]`

- **Cross-field plausibility:** GVW ≥ 10,000 lb with axles = 2 and length
  > 70 ft is implausible; flag for confirmation rather than hard-reject.
- **Unit and decimal traps:** 13.6 entered where 13′6″ intended (13.6 ft =
  13′7.2″ — accept but display both forms); 1,360 cm vs 13.6 ft; GVW entered
  in tons. The confirmation screen renders the profile in **both unit
  systems** and as plain English ("13 ft 6 in tall, 80,000 lb, 5 axles").
- **Existing conversions `[REPO]`:** ft→cm via 30.48, lb→kg via 0.45359237,
  both `Math.round`ed — rounding is ≤ 0.5 cm / 0.5 kg, acceptable; tests must
  pin the constants (doc 14 §3).

### 5.3 Profile lifecycle `[PROPOSED]`

- **Confirmation screen** shows the active profile immediately before "Start
  driving." One tap edits; starting freezes it.
- **Freeze:** after guidance starts the profile is immutable for the session.
  Changing equipment = end session → edit → new route. A reroute (doc 13 §5)
  reuses the frozen profile byte-for-byte.
- **Staleness:** a saved preset unused > 30 days `[OWNER threshold]` requires
  re-confirmation, not silent reuse.
- **Versioning:** presets already cloud-sync (`saved-trips-store`, migration
  044 `[REPO]`); add a `profileVersion` so a route can name the exact profile
  version it was computed for.
- **Capability mismatch:** if the entered profile includes a field the
  provider request cannot carry (e.g., per-axle weight before §3 rows are
  implemented), the pre-drive screen lists it under "not evaluated by
  routing" — R2 in the UI.

---

## 6. Route-request correctness

### 6.1 Current request, verbatim `[REPO]`

`transportMode=truck`, `origin`, `destination`, `via*`,
`return=polyline,summary,actions`, `departureTime` (ISO),
`truck[height|width|length|grossWeight|axleCount]`,
`truck[shippedHazardousGoods]` (when set), `avoid[features]` (whitelist:
`tollRoad, ferry, tunnel, dirtRoad, uTurns` — anything else is dropped by
`sanitizeAvoidances`), `apiKey`.

Controls already correct and to be preserved unchanged `[REPO]`:
server-side-only key with zero URL leakage on failure; fail-soft `null`;
100/hour per-instance cap; 6 h TTL / 500-entry cache; request coalescing;
single retry on 5xx only; impossible-profile pre-flight rejection.

### 6.2 Cache-key integrity `[REPO — verified sound, must stay tested]`

`routeCacheKey` includes endpoints (4-dp), waypoints, height×10, width×10,
length, GVW/100, axles, hazmat goods, sorted avoidances, and a 30-minute
departure bucket. **Invariant:** every field that reaches the provider request
appears in the cache key at equal-or-finer granularity. A merge-blocking test
enumerates `buildHereRouteUrl` parameters against `routeCacheKey` components
so a future field (trailer count, tunnel category) cannot be added to one and
not the other — that is exactly the "route reused for a materially different
truck" defect this extension exists to prevent.

### 6.3 Field-loss detection `[PROPOSED]`

- **Serialization tests (doc 14 §3):** for each profile field, a fixture
  asserts the exact provider parameter name and converted value in the built
  URL. A renamed HERE parameter or adapter regression fails the suite.
- **Contract canary:** an offline test compares the built URL's parameter set
  against a pinned manifest; any drift (param added/removed/renamed) fails
  until the manifest is deliberately updated with a doc citation.
- **Explicit rejection:** if a safety-critical field (height, weight, hazmat,
  tunnel category once added) cannot be expressed to the provider, the
  request must not be sent — return the `no verified truck-legal route`
  outcome, not a degraded route. Silent dropping is prohibited by test.

### 6.4 Navigation-grade request additions `[PROPOSED, all VERIFY against HERE docs]`

The planner's request is not sufficient for guidance. N8's `NEW-1` endpoint
(`/api/navigator/route`, doc 03) should request additionally: full-resolution
geometry retained (see doc 13 §1 — the 400-point/2-mile downsampling in
`toRoutePoints` is a planner display concern and must not feed the tracker),
richer maneuver data (`turnByTurnActions` — exit numbers, road names,
signposts), notices/spans (§4), and `alternatives` for doc 12 §1 route
selection. Each addition is a metered-cost and payload-size decision recorded
in doc 15 §2.

---

## 7. Gap analysis (roll-up)

| Item | State |
|---|---|
| Truck dims/GVW/axles/hazmat in request, validated, cache-keyed | **Implemented** `[REPO]` |
| Avoidance whitelist, spend caps, coalescing, fail-soft | **Implemented** `[REPO]` |
| Maneuver plumb-through with rebased offsets (N1) | **Implemented** `[REPO]` |
| Monotonic tracker, safety lock, visual guidance, HOS strip (N2–N6) | **Implemented** `[REPO]` |
| Voice guidance (N7) | **In progress** per current milestone position |
| Violation-notice detection | **Missing — highest severity** (§4) |
| Full-resolution guidance geometry | **Missing** (doc 13 §1) |
| Trailer count / vehicle type / per-axle / tunnel category | **Missing, provider-supported pending VERIFY** (§3) |
| Route validation layer + outcomes | **Missing** (doc 12 §4) |
| Final-approach design | **Missing** (doc 12 §3) |
| Heading-aware matching | **Missing — known limitation recorded in tracker header** `[REPO]` (doc 13 §3) |
| Off-route observe-only mode | **Missing** (doc 13 §4; recommended by doc 10 N8 notes) |
| Reroute execution | **Missing** (doc 13 §5) |
| Test-route library, road-test program, launch gates | **Missing** (doc 14) |
| Incident process, provider audit | **Missing** (doc 15) |
| Traffic/closures | **Blocked** (N14, provider decision `[OWNER]`) |
| Live HERE-doc verification of every `[HERE-DOC]` row | **Blocked in this session — requires network access to HERE docs** |

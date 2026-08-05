# 14 — Testing, Road Validation & Launch Gates (Blueprint Extension)

**Status: DESIGN ONLY.** Extends 08 (performance) and 09 (testing). Fact tags
per [11](./11-truck-legal-routing.md). Nothing in this document is a measured
result; every number is a proposed target until the Measurement column says
otherwise.

---

## 1. Performance budgets (routing-reliability additions to doc 08)

| Budget | Proposed target | Currently measured | Measurement path |
|---|---|---|---|
| Navigation route request (server) | ≤ 3 s p90 | **none** | Server timing on NEW-1 endpoint |
| Reroute detect→request | ≤ 3 s | none | Replay harness |
| Reroute request→swap | provider + 1 s | none | Device testing |
| Full-geometry memory (coast-to-coast) | ≤ 25 MB heap delta | none — **13 §1 requires this measured before adoption** | Long-run sim |
| 1 Hz loop step incl. matching on full geometry | ≤ 50 ms on doc 08 reference device | none | Device profiling |
| Crash-free session rate | ≥ 99.5 % of sessions ≥ 1 h | none — **requires production telemetry (location-free)** | Stage 5+ |
| Voice scheduling drift | announcement within ±1 s of threshold crossing | none | Sim + device |

Degradation order (safety-critical last): map imagery → panels
(parking/fuel/weather) → visual polish → HOS strip → **maneuver guidance and
safety lock degrade last** (extends doc 08 ladder `[REPO]`).

## 2. Canonical test-route library

Location `[PROPOSED]`: `data/navigator/test-routes/` — one JSON per route:
`{ id, profile, origin, destination, expectedCorridor[], forbiddenSegments[],
requiredBehavior, acceptDistanceMi: [min,max], acceptDurationMin: [min,max],
expectedManeuverSample[], rerouteBehavior, evidenceSource, reviewDate }`.
Evidence sources are public (posted-restriction databases, state DOT truck
maps, street-level imagery citations) — **never private driver traces without
consent** (doc 09 test-data policy `[REPO]`).

Required categories (each ≥ 1 route; regional bias toward the I-75 corridor
the directory already covers `[REPO]`):

interstate short (Dalton→Chattanooga) · interstate long (GA→TX) · rural
delivery · dense urban delivery (Atlanta) · mountain (Monteagle grade
I-24) · **low-clearance conflict** (route must not traverse a documented
< 13′6″ underpass; forbidden segment recorded with evidence) ·
weight-restricted bridge · hazmat tunnel restriction · truck-prohibited
parkway (e.g., a documented no-commercial parkway with evidence citation —
each entry verified at authoring time, reviewed by `reviewDate`) · toll vs
no-toll · ferry avoidance · frontage-road corridor · complex interchange +
cloverleaf (extends existing tracker fixtures `[REPO]`) · destination with
directory-verified truck entrance · destination on restricted local road ·
truck-stop pull-in (0-reroute assertion, doc 10 N8 `[REPO]`) · rest-area
pull-in · planned fuel stop · wrong turn + reroute · repeated wrong turns
(budget exercise) · network loss mid-route · tunnel GPS loss · stale GPS ·
provider no-result · malformed provider response (fixtures exist in parse
tests `[REPO]`, promoted here).

The offline audit script (12 §1.4) runs this library on an approved cadence
and diffs against acceptance ranges. Ranges are **calibrated from first
verified runs, then pinned** — not invented in this document.

## 3. Automated suites (additions to doc 09's inventory)

Merge-blocking additions (join the doc 09 §7 safety tier `[REPO]`):

1. **Request serialization** — every profile field asserted by exact provider
   parameter and converted value; parameter-manifest canary (11 §6.3).
2. **Cache-key/URL parity** — enumerated equivalence (11 §6.2); a field in
   the URL absent from the key fails.
3. **Violation-notice rejection** — violation fixture → validator reject →
   guidance start attempt fails the test (11 §4).
4. **Estimated-route firewall** — `route-estimate` output into the session
   constructor is a type/runtime failure (AD-8 structural test).
5. **Stale-reroute rejection** — old-token response after newer request is
   discarded (13 §5).
6. **Truck-stop pull-in = 0 reroutes** — replay class (13 §4).
7. **Announce-once** — property test over generated jitter streams: no
   (maneuver, tier) speaks twice; none speaks after passage (13 §2).
8. **Leak counters** — long-run sim ends with exactly 0 live watchers,
   timers, speech callbacks; memory bounded (13 §6).
9. **Confidence-forbidden-actions** — no reroute evidence, completion, or
   arrival from `degraded`/`lost` (13 §3.2).
10. **Profile-echo mismatch reject** (12 §4.1).

Non-blocking but CI-run: route-library audit diffs (cost-gated), unit
conversions pinned, adversarial parse fixtures (extend existing `[REPO]`),
map-matching scenario suite, off-route observe-only replay metrics,
browser-lifecycle sims, safety-lock integration (existing invariants stay
green unchanged `[REPO]`), privacy audit test — grep-level check that no
module under `src/lib/navigator/` writes position to storage/logs (mechanizes
AD-7 the way `test-navigator-purity.ts` mechanizes AD-2 `[REPO]`).

## 4. Staged physical validation

| Stage | What | Entrance gate | Exit gate |
|---|---|---|---|
| 0 | Desktop simulation | Suites in §3 green | Replay metrics within targets |
| 1 | Phone in hand, stationary | Stage 0 exit | Permission flows, voice, lock behaviors verified on iOS Safari + Android Chrome |
| 2 | Passenger in a **car** | Stage 1 exit + observe-only off-route deployed | ≥ 10 varied drives; 0 false reroutes; announcement timing subjectively correct; no crashes |
| 3 | Passenger in a **commercial truck** (Shawn/Rosedale routes — passenger seat only, never driver-operated testing) | Stage 2 exit + reroute enabled in test builds | ≥ 5 revenue-realistic runs incl. truck stops, interchanges, one mountain route; zero P0/P1 observations (doc 15 severity) |
| 4 | Closed beta, experienced drivers | Stage 3 exit + incident process live (doc 15) + report template below | ≥ 10 drivers · ≥ 100 session-hours · 0 open P0/P1 · crash-free ≥ target |
| 5 | Limited public beta | Stage 4 exit + owner sign-off | Telemetry targets held ≥ 2 weeks; rollback drill executed once |
| 6 | General free release | Stage 5 exit + all launch gates (§5) | — |

Device matrix across stages 2–4: iOS + Android; Chrome + Safari; portrait +
landscape; weak/no coverage segments; heat; sessions ≥ 4 h; incoming call;
screen lock; battery saver; tunnels; urban canyon; app restart mid-route;
route cancellation.

**Tester report template:** route id · truck profile · expected vs actual
road · incorrect instruction (verbatim) · timing error · legal concern ·
detour concern · reroute behavior · device/browser/app version · severity
guess · screenshots where safe to capture · **no raw location history unless
explicitly approved in writing** (AD-7).

## 5. Launch gates (non-negotiable, no single "ready" label)

Readiness levels reported separately, in order: architecture-complete →
implementation-complete → automated-test-ready → device-test-ready →
passenger-road-test-ready → closed-beta-ready → public-beta-ready →
general-release-ready.

General-release gate list — all must hold simultaneously:

- Canonical library: zero routes traversing a documented forbidden segment.
- Serialization + cache-parity suites green; parameter manifest current.
- Estimated-route firewall and violation-notice rejection tests green.
- No duplicate announcements across the property-test corpus.
- Observe-only reroute false-positive rate below the pinned threshold
  (`[OWNER]` — proposed ≤ 1 false reroute per 20 session-hours, calibrated
  in Stage 2–4); truck-stop class at 0.
- Stale-response rejection green; leak counters at 0; long-run memory
  bounded.
- Production crash reporting live **without** precise-location collection.
- Route-source + confidence labels and the 12 §5 limitations statement
  shipped in product copy.
- Stage 1–4 exit gates all met; owner sign-off recorded.
- Rollback tested: `NEXT_PUBLIC_NAVIGATOR_ENABLED` flag off restores the
  planner-only product (flag pattern exists `[REPO]` doc 10 N5) — drill
  performed, not assumed.
- Incident process (doc 15) staffed and exercised on a synthetic P1.

## 6. Requirements traceability matrix

| # | Product requirement (11 §1) | Architecture | Milestone | Automated test | Device/road test | Launch gate |
|---|---|---|---|---|---|---|
| 1 | Destination + geocode confidence | 12 §2 | N8a | geocode-confidence fixtures | Stage 1 | copy gate |
| 2 | Validated, confirmed profile | 11 §5 | N8a | serialization + bounds `[REPO partial]` | Stage 1 | serialization gate |
| 3 | Route for that exact profile | 11 §6 | N8a | §3.1, §3.2, §3.10 | Stage 3 | cache-parity gate |
| 4 | Bounded maneuver placement | 13 §1–2 | N8b/N7 | maneuver-engine + timing sims `[REPO partial]` | Stage 2 | announce gates |
| 5 | Stay on evaluated-legal roads | 11 §2–4 | N8a | violation-notice reject | Stage 3 + library | forbidden-segment gate |
| 6 | Warned on low confidence | 12 §4.2 | N8a | outcome-matrix tests | Stage 2 | copy gate |
| 7 | Safe reroute | 13 §4–5 | N8d/N8e | reroute suite + replays | Stage 3–4 | false-positive gate |
| 8 | No needless detours | 12 §1.2 | N8a + audit tool | ratio-tier tests | library audit | forbidden-segment gate |
| 9 | No silent guidance loss | 13 §6 | N8c + hardening | leak/lifecycle/watchdog | Stage 2–4 long runs | crash-free gate |

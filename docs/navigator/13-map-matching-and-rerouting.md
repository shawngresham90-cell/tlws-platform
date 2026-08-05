# 13 — Guidance Accuracy, Map Matching, Off-Route & Rerouting (Blueprint Extension)

**Status: DESIGN ONLY.** Extends 05 (navigation engine) and 04 (state).
Fact tags per [11](./11-truck-legal-routing.md).

---

## 1. Guidance geometry — the resolution defect to fix first

`[REPO]` The pipeline today: `parseHereResponse` decodes the **full**
polyline → `toRoutePoints` downsamples to ≥ 2-mile spacing capped at 400
points (a planner display/sampling concern for weather/directory layers) →
`createRouteTracker` **re-densifies** those samples to 0.1-mile spacing by
**chord interpolation** (straight lines between 2-mile samples).

For planning this is fine. For turn-by-turn it is structurally wrong: on a
curving road, a chord between 2-mile samples can sit hundreds of meters off
the pavement, corrupting off-route distance, maneuver-mile placement, and
projection choice near parallel roads. The tracker's own header documents the
densification as a defense against sparse input `[REPO]` — the real fix is to
stop giving it sparse input.

**Requirement `[PROPOSED]` (pre-N8, small PR):** the navigation session
consumes the full decoded `positions` array (with true cumulative miles)
directly; `toRoutePoints` remains untouched for planner consumers (AD-3).
Memory bound: full geometry for a coast-to-coast route is tens of thousands
of points — within the tracker's existing `DENSIFY_MAX_POINTS = 20_000`
order-of-magnitude budget `[REPO]`; measure, don't assume (doc 14 §1).

## 2. Maneuver-guidance pipeline

Stages: provider action → normalized `HereManeuver` (offsets rebased across
sections, clamped `[REPO]`) → route-mile placement (`createManeuverEngine`
maps offset → mile via `positionMiles` `[REPO]`) → GPS projection (tracker) →
announcement threshold (N7) → visual card (`[REPO]` N5) → spoken instruction
(N7) → completion → next-maneuver transition (`PASSED_TOLERANCE_MI = 0.03`
`[REPO]`).

### 2.1 Instruction-content gaps `[REPO]`

The parse keeps `action`, `instruction` (prose), `direction`, `severity`.
There are **no structured** exit numbers, road names, route shields, or lane
guidance — they exist only inside prose text. `[HERE-DOC]`
`return=turnByTurnActions` provides structured current/next road, signpost
and exit data; adopting it is the path to exit-number verification and lane
hints (11 §6.4). Until then: prose is rendered verbatim, never re-generated
or paraphrased by the app (paraphrase is how wrong-exit bugs are minted), and
unknown `action` kinds render as a generic maneuver card — never dropped,
never guessed into a turn direction.

### 2.2 Announcement timing (N7 contract) `[PROPOSED]`

Distance-to-maneuver comes from `ManeuverView.distanceMi` `[REPO]`.
Announce at fixed **time-to-maneuver** converted through current speed:

| Speed | Advance call | Final call |
|---|---|---|
| ≥ 55 mph | 2 mi and 1 mi | 0.3 mi |
| 30–55 | 1 mi | 0.2 mi |
| < 30 | 0.3 mi | 400 ft |

Rules: each (maneuver, tier) announces at most once per route instance
(announce-once is already a doc 09 test theme `[REPO]`); a maneuver entered
inside its final window still gets exactly one call; chained maneuvers
< 0.25 mi apart are spoken as a compound ("… then keep right"); an
announcement whose maneuver mile is already behind `currentMile −
PASSED_TOLERANCE` is **suppressed, never spoken late**. Route replacement
resets all announcement state (§5).

### 2.3 Forbidden guidance failures (test-encoded, doc 14 §3)

Late instruction after the turn · duplicate speech · skipped maneuver on
projection jitter (the 0.03 mi tolerance exists for this `[REPO]`) · exit
number altered from provider text · direction inverted · guidance advancing
while position confidence is `low` (§3) — the card shows "hold" state
instead.

## 3. Map matching & position confidence

### 3.1 What exists `[REPO]`

The tracker is position-only nearest-point with a monotonic mile, a
3-fix + motion + net-progression reversal gate, `MAX_PROJECTION_MILES = 2`,
and binary confidence (`high`/`low`). Its header explicitly records the
known limitation: anti-parallel adjacent corridors (divided highways,
frontage roads) are ambiguous to position-only matching, and heading-aware
matching is "the real resolution." `direction-of-travel.ts` already exists
for the N4 lock — heading data is in the house.

### 3.2 Heading-aware matching `[PROPOSED — pre-reroute requirement]`

Candidate scoring adds: heading agreement between fix heading and local
route bearing (from full-resolution geometry, §1); continuity with the prior
matched point; fix accuracy and age (session gating already supplies both
`[REPO]` `gps-session.ts`). Score classes:

| Confidence | Meaning | Allowed |
|---|---|---|
| `high` | Distance small, heading agrees, continuous | Everything |
| `degraded` | One factor weak (accuracy, heading gap, gap in fixes) | Guidance continues; **no reroute evidence accumulates; no maneuver *completion* is committed; arrival cannot trigger** |
| `lost` | Unprojectable (> 2 mi) or stale | Card enters hold; only off-route candidacy (§4) may accumulate, from `lost`-with-good-GPS only |
| `unavailable` | Platform-level (denied/unavailable — controller already renders these `[REPO]`) | Nothing advances |

Forbidden in `degraded`/`lost` (merge-blocking): reroute decisions from
low-confidence fixes; route completion from a single fix (the current
controller can arrive on one fix reaching `remaining ≤ 0.05` `[REPO]` —
tighten to sustained-fix arrival, 12 §3.2); mile regression outside the
reversal gate.

Scenario coverage required in fixtures (doc 14 §2): parallel frontage road,
opposite carriageway, upper/lower decks (position-only unsolvable — heading
+ continuity mitigate; residual ambiguity is a documented limitation, not
hidden), cloverleafs (existing back-projection tests extend `[REPO]`),
tunnels (GPS loss → `lost`, resume without backward jump), stationary drift,
truck-stop pull-ins, genuine U-turns (reversal gate `[REPO]`), impossible
jumps (session accuracy/staleness gates `[REPO]`).

## 4. Off-route detection

States: `on-route` → `candidate` → `confirmed` → (`recovered` | reroute).

**Confirmation evidence — all required `[PROPOSED]`:** projection distance
> 0.15 mi for ≥ 5 consecutive accepted fixes spanning ≥ 20 s · confidence
was `high` entering candidacy (never enter from `degraded`) · heading
diverges from route bearing · **and** no suppression zone active.

**Suppression zones (false-positive killers):** within 0.5 mi of any
directory stop / planned fuel stop / rest area (the directory is loaded
in-session already per doc 05 §5 — reuse it) · within 1 mi of destination
(final-approach mode instead, 12 §3.2) · speed < 10 mph near the route
(parking, fuel islands, staging) · tunnel/`lost` transitions.
`recovered`: 2 consecutive on-route high-confidence fixes clears everything.

**Observe-only phase (mandatory, mirrors doc 10 N8 recommendation
`[REPO]`):** compute verdicts, **never call the provider**; log privacy-safe
diagnostics only — bucketed distances, counts, state transitions, **no
coordinates** (AD-7); validate against replay fixtures and volunteered,
consented traces converted to synthetic fixtures (doc 09 test-data policy
`[REPO]`); exit gate: 0 false reroutes on the `truckstop-pullin` class and
false-negative time-to-detect within target on wrong-turn traces. Raw
position history is never stored without explicit owner approval `[OWNER]`.

## 5. Rerouting

Pipeline `[PROPOSED]`: confirmed off-route → build request with **frozen
profile + original avoidances + destination** (waypoints not yet passed
retained; passed ones dropped) → keep current route + "Rerouting…" banner →
provider call through the same server-side adapter rails (caps, coalescing
`[REPO]`) → **validator (12 §4) on the reroute response — same bar as the
initial route** → atomic swap: new tracker + new engine + announcement-state
reset in one state transition → single "route updated" utterance.

**Failure/edge handling:** provider timeout or null → keep old route,
banner "reroute unavailable — follow signs toward destination", retry per
budget; offline → same, no retry until connectivity (AD-6: rerouting is
online-only `[REPO]`); no-route-found → `no-verified-truck-legal-route`
handling (12 §1.2); **stale-response token** — every reroute request carries
a monotonic session sequence; a response bearing an old token is discarded
even if it arrives after a newer request was issued (out-of-order and
route-replaced-twice defects); reroute during a maneuver → swap defers until
the maneuver's final window clears; driver returns to original route while
reroute in flight → cancel, discard response.

**Budget `[PROPOSED, OWNER-tunable]`:** ≤ 6 reroutes/hour/session, 60 s
cooldown after each, exponential backoff on consecutive failures (60 s →
2 min → 5 min), hard stop at budget with a persistent banner. All spend
rides inside the existing 100/hour instance cap `[REPO]`; a per-session
ceiling keeps one bad GPS day from draining the instance (15 §2).

Targets (labeled targets, not measurements): detection-to-request ≤ 3 s;
request-to-swap ≤ provider latency + 1 s; measured values await device
testing (doc 14 §1).

## 6. Crash resistance & session reliability

Long-haul sessions run 8–11 h. Requirements `[PROPOSED]` on top of what
exists:

**Already held by construction `[REPO]`:** pure core with injected clocks
(no hidden timers in `src/lib/navigator/`); single `watchPosition` owner
(N2); controller idempotent on repeated React renders (StrictMode guard in
`navigation-controller.ts`); exhaustive honest screen states — "a real
failure never renders as progress."

**To add:**

- **Error boundaries** around the driving surface rendering a full-screen
  honest failure card with a restart action — never a white/frozen screen.
- **Leak discipline:** one active GPS watcher, timer set, and speech queue
  per session, proven by long-run simulation tests that count them (doc 09
  §9 battery/long-run suite extends `[REPO]`); route swap (§5) and session
  end must dispose all three.
- **Lifecycle:** visibilitychange/pagehide → guidance pauses honestly
  ("navigation paused — screen was backgrounded"), never silently stale;
  wake → re-acquire before advancing. Background GPS is out of scope until
  N13 (Capacitor) `[REPO]` and copy must say so.
- **Resume:** persist only route-scoped, non-position state — route id,
  frozen-profile version, announcement watermark, session version — never
  fixes (AD-7). On reload within a max session age (`[OWNER]`, e.g., 14 h =
  driving window), integrity-check the stored route (validator re-run) and
  resume at `acquiring`; mismatch or expiry → clean fail-safe reset.
- **Version change mid-trip:** a service-worker/app update never hot-swaps
  the driving surface; it applies on next session. Session-version mismatch
  on resume → reset, stated plainly.
- **Watchdog:** the 1 Hz loop (doc 05 `[REPO]`) publishes a heartbeat; a
  UI-visible stall > 5 s flips the surface to the failure card. Error
  telemetry is bucketed and location-free (AD-7, `tpc-analytics` precedent
  `[REPO]`).

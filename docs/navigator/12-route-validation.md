# 12 — Route Selection, Final Approach & Route Validation (Blueprint Extension)

**Status: DESIGN ONLY.** Extends 00–10 and depends on the definitions in
[11](./11-truck-legal-routing.md). Fact tags (`[REPO]`, `[HERE-DOC]`,
`[PROPOSED]`, `[OWNER]`) as defined there.

---

## 1. Route selection — "closest practical truck-legal route"

### 1.1 Definition `[PROPOSED]`

Among candidate routes returned by the provider for the frozen profile:

1. **Hard filter:** discard any candidate carrying a violation-class notice
   (11 §4) or failing validation (§4 below). Legality where evaluated is a
   filter, never a weighted term. No preference — time, distance, tolls,
   commercial interest (directory sponsors, TPC affiliate placement) — may
   override a confirmed restriction. That prohibition is a merge-blocking
   test, not a guideline.
2. **Score survivors** on: provider-estimated duration (primary), distance,
   road-class mix (interstate/arterial share vs local-road share), turn
   count and complexity, toll/ferry conformance to the driver's stated
   preferences, and route stability (§1.3).
3. **Tie band:** candidates within 5 % duration **and** 5 % distance of the
   best are "legally and practically equivalent" — present the top 2–3 for
   driver choice while stationary; auto-select the first only if the driver
   starts without choosing.

Today `[REPO]` the adapter takes `routes[0]` only and never requests
alternatives; §1 requires `alternatives` in the navigation request (11 §6.4,
cost noted in 15 §2).

### 1.2 Detour-plausibility audit `[PROPOSED]`

Baseline = great-circle distance × 1.2 circuity (the repo's own estimate
model, `route-estimate.ts` `[REPO]`).

| Observation | Interpretation | Action |
|---|---|---|
| Route ≤ 1.5 × baseline | Normal | Accept |
| 1.5–2.0 × baseline | Suspicious | Accept **with warning**; log a route-audit diagnostic (privacy-safe: distances and ratios only, no coordinates) |
| > 2.0 × baseline, or > 75 mi absolute over baseline on trips ≥ 100 mi | Likely defect **or** genuinely constrained (hazmat, mountain) | Requires driver review while stationary; show the stated cause if the provider gave one (notices/avoid conformance), otherwise say "cause unknown" |
| Route shorter than baseline × 0.95 | Geometry/parse defect | Reject (already partially guarded: `distanceMiles < 0.1` rejected `[REPO]`) |

Worked examples the tests must encode (doc 14 §2):

- A 10-mile-longer interstate routing versus a shorter two-lane with a posted
  13′2″ underpass is **correct** — the shorter route must be absent or
  rejected, and its absence is not a defect.
- A 75-mile detour on a 120-mile lane with no hazmat and no restriction
  notice is a defect candidate → warning tier, audit log.
- Two interstates within the tie band → present alternatives.
- No candidate survives the hard filter → outcome
  `no verified truck-legal route` (§4); the app says it cannot verify a
  legal route and offers the planner view. It never silently falls back to a
  car-grade or estimated route for guidance (AD-8 + 11 §2 R3).

### 1.3 Route stability `[PROPOSED]`

Identical request inputs within one cache bucket must yield the identical
route (already true via cache `[REPO]`). Across buckets, a changed answer for
unchanged inputs is expected provider behavior (traffic/time) but must never
swap mid-session: the session's route changes only through the reroute
pipeline (doc 13 §5).

### 1.4 Route-comparison audit tooling `[PROPOSED]`

An **offline, scheduled** audit script (repo `scripts/` style) runs the
canonical route library (doc 14 §2) against the provider and reports, per
route: distance/duration vs recorded acceptance range, road-class mix drift,
restriction-notice presence, and diff vs last run. This is the regression
tripwire for silent provider-data changes. It spends metered transactions and
therefore runs on an owner-approved cadence `[OWNER]`, never in the live
request path (15 §2).

---

## 2. Geocode confidence before routing `[PROPOSED]`

Routing money and driver trust are both spent on the geocode. Before any
navigation route request:

- Show the resolved address and map pin; require a confirm tap.
- Surface provider geocode confidence/ambiguity when available `[HERE-DOC —
  verify current geocode response fields]`; multiple plausible matches →
  chooser, never auto-pick.
- Rural/industrial addresses (no house-number match, interpolated, or
  locality-level results) are labeled **approximate** and trigger the §3
  final-approach fallback automatically.

---

## 3. Destination & final-approach safety

Truck navigation fails disproportionately in the last mile. The provider
routes to a geocode; it does not know the truck entrance. TLWS has an asset
here most competitors lack `[REPO]`: the parking/stop directory
(`directory-layer.ts`) with curated coordinates already coordinate-audited
(`docs/coordinate-verification-audit.md`).

### 3.1 Entrance provenance labels `[PROPOSED]`

Every destination carries exactly one provenance label, displayed pre-drive
and on arrival approach:

| Label | Source | Guidance behavior |
|---|---|---|
| `verified-business` | TLWS directory entry with audited coordinates | Route to the directory coordinate |
| `owner-supplied` | Business-provided truck entrance (future directory field) | Route to it, labeled |
| `driver-confirmed` | This driver previously arrived here and confirmed the entrance (stored as a coordinate only with explicit consent — AD-7 forbids implicit position persistence) | Route to it |
| `community-report` | Another driver's report, unverified | Route to it **with "unverified entrance" banner** |
| `provider-geocode` | HERE geocode, good confidence | Route to it; final ½-mile banner: "entrance not verified" |
| `approximate` | Low-confidence geocode (§2) | **Fallback mode** (§3.2) |
| `unknown` | No usable geocode | Refuse guidance; planner view only |

The app must never route to a building centroid when any higher-provenance
entrance exists, and must never fabricate an entrance (no snapping the pin to
the nearest road segment and calling it a truck entrance).

### 3.2 Fallback mode `[PROPOSED]`

For `approximate` / `community-report` destinations, and whenever the final
segment's confidence is degraded:

1. Guidance targets the **last confirmed truck-suitable public-road point**
   short of the property (nearest route point on the provider route that
   precedes the final local-road segment).
2. At that point: "Final approach unverified. Review before proceeding." The
   map shows the remaining gap. Review controls are stationary-gated through
   the existing `LockGate` (`[REPO]` N4) — no final-approach browsing in
   motion.
3. Arrival tolerance: the controller's `ARRIVAL_TOLERANCE_MI = 0.05`
   `[REPO]` applies to the fallback point in this mode, and arrival requires
   sustained low speed across ≥ 3 accepted fixes `[PROPOSED]` — a single
   noisy fix must not complete a route (interacts with doc 13 §2
   forbidden-actions list).

### 3.3 Site-class handling `[PROPOSED]`

Distribution centers, ports, rail yards, mines, and construction sites get a
site-class chip when the directory knows the class; ports/rail/mines default
to fallback mode regardless of geocode confidence (gate procedures dominate).
Multiple-entrance sites in the directory may store multiple labeled
coordinates; the driver picks pre-drive. `[OWNER]`: whether community
entrance reports ship in v1 or post-launch.

---

## 4. Route-validation layer (post-response, pre-guidance)

A pure validator (`src/lib/navigator/route-validation.ts` `[PROPOSED]`,
respecting the AD-2 purity gate) runs on every route before the session may
consume it — initial and reroute alike.

### 4.1 Checks

Already enforced in the parse/adapter `[REPO]` and retained: malformed or
missing geometry → null; non-numeric/negative section summaries → null;
`meters<=0 || seconds<=0 || positions<2` → null; `distance < 0.1 mi` → null;
maneuver offsets clamped into geometry.

Added by the validator `[PROPOSED]`:

| Check | Reject / warn |
|---|---|
| Violation-class provider notice (11 §4) | **Reject** |
| Origin/destination mismatch: route endpoints > 0.25 mi from requested points | **Reject** |
| Implausible ratio vs baseline (§1.2 table) | Warn / review / reject per tier |
| Route loop: cumulative mileage ≥ 1.3 × net displacement path without matching waypoints, or self-overlap > threshold | Review |
| Duplicate consecutive maneuvers at the same offset | Warn + dedupe |
| Zero-maneuver route beyond trivial length | Reject |
| Local-road share above threshold for trip class | Warn (thresholds set from route-library calibration, doc 14 §2 — not invented here) |
| Avoid-preference breach (ferry/toll present though avoided) | Review with explicit callout |
| Profile echo mismatch: route requested for profile P, session frozen on P′ ≠ P | **Reject** (belt-and-braces over cache-key integrity, 11 §6.2) |
| Estimated route (`route-estimate.ts` output) presented to the session | **Reject** — AD-8, enforced structurally: the session constructor accepts only validator-accepted live routes |

### 4.2 Outcomes (exhaustive) `[PROPOSED]`

`accepted` · `accepted-with-warning` (banner text mandatory) ·
`requires-stationary-review` · `rejected(reason)` · `provider-unavailable`
(fail-soft null path `[REPO]`) · `no-verified-truck-legal-route`.

Guidance starts only from `accepted` or `accepted-with-warning`, or from
`requires-stationary-review` after an explicit stationary confirmation.
Merge-blocking test: every other outcome attempting to start guidance fails
CI (doc 14 §3).

---

## 5. Routing-data freshness & honest limitations

| Data | Source | Freshness reality | Behavior |
|---|---|---|---|
| Map geometry, restrictions, names, exits | HERE map data | Updated on provider cadence; latency unknowable to us `[HERE-DOC]` | Fail-soft; disclosure below |
| Time-aware restrictions | HERE + our `departureTime` `[REPO]` | Computed at request time | Warn on long trips crossing windows (11 §3) |
| Closures / construction / incidents | **Not integrated** (N14 blocked `[REPO]` doc 10) | — | Disclosed as not covered until N14 |
| Route answer itself | Cache, 6 h TTL, 30-min departure bucket `[REPO]` | ≤ 6 h stale by design | Navigation sessions should bypass or shorten cache TTL `[OWNER — cost tradeoff, 15 §2]`; at minimum display quote age, matching the weather-age precedent (doc 05 §8) |
| Weather along route | NWS, age-labeled `[REPO]` | Already honest | Keep |
| Directory entrances | TLWS directory | Audited, dated `[REPO]` | Show review date |

**Limitations statement (product copy, verbatim baseline) `[PROPOSED]`:**

> Routes are computed for your truck profile from the routing provider's map
> data. Road data can lag reality. Posted signs, local orders, and current
> conditions always control. You are responsible for the vehicle. TLWS
> Navigator does not yet include live closure or construction data.

This statement is a disclosure, not a defense: a P0/P1 incident (doc 15 §1)
is handled as a defect regardless of the disclaimer, and the disclaimer may
never be cited in an incident postmortem as a reason not to fix routing.

Correction path for stale/wrong data: in-app report (doc 15 §1) → triage →
provider map-feedback escalation where applicable → route-pattern blocklist
when severity demands immediate mitigation (doc 15 §1.4).

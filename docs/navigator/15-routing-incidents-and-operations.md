# 15 — Routing Incidents, Provider Dependency & Milestone Extension (Blueprint Extension)

**Status: DESIGN ONLY.** Extends 10 (milestones). Fact tags per
[11](./11-truck-legal-routing.md).

---

## 1. Incident & correction process

### 1.1 Severity

| Level | Definition | Response clock `[PROPOSED]` |
|---|---|---|
| **P0** | Immediate life-safety risk (active routing into a low-clearance strike path, guidance directing into oncoming/prohibited traffic) | Mitigate within hours: feature-disable or pattern blocklist |
| **P1** | Likely illegal or unsafe truck routing (prohibited road, weight-posted bridge, hazmat violation) | Mitigate ≤ 24 h |
| **P2** | Navigation failure / severe detour / reroute loop / crash | Fix in next release; workaround copy sooner |
| **P3** | Incorrect instruction, recoverable | Scheduled |
| **P4** | Cosmetic | Backlog |

### 1.2 Intake

In-app report (stationary-gated via `LockGate` `[REPO]`) with the doc 14 §4
template fields; email fallback. Reports carry route id, profile version, app
version — **no automatic location history** (AD-7); the reporter may
volunteer a description or, with explicit written consent, a trace that is
converted to a synthetic fixture and the original destroyed (doc 09 policy
`[REPO]`).

### 1.3 Handling

Reproduce via the route library / replay harness → classify: our defect
(adapter, validator, matching), provider-data defect (escalate through HERE
map-feedback channel — exact channel `[HERE-DOC]` verify), or user-input
defect (profile/geocode; feeds UX fixes). Every P0/P1 produces: a library
route or fixture that fails before the fix and passes after, a postmortem
note in `docs/navigator/incidents/` (no PII, no coordinates beyond the public
road segment), and a correction-validated release.

### 1.4 Emergency mitigations — never wait for a release cycle

- **Feature disable:** `NEXT_PUBLIC_NAVIGATOR_ENABLED` off (pattern exists
  `[REPO]`) — full stop, planner remains.
- **Route-pattern blocklist `[PROPOSED]`:** a small server-side list of
  forbidden segments/areas consulted by the validator (12 §4); adding an
  entry is a config change, deployable in minutes, and converts the matching
  route outcome to `requires-stationary-review` or `rejected` per severity.
  `[HERE-DOC verify]` whether `avoid[areas]` can express the block at request
  time as well.
- **Reroute kill-switch:** reroute path flag-off while detection stays
  observe-only (split already recommended in doc 10 N8 `[REPO]`).
- Rollback criteria + drill are launch gates (14 §5). User communication for
  P0/P1: in-app banner + status note; honest, no legalese-only response.

## 2. Provider dependency (HERE) — audit & risk

**Relied on today `[REPO]`:** Routing v8 truck profile (5 dims + hazmat),
avoid features, departureTime, polyline/summary/actions; geocoding
(`here-geocode.ts`); free tier ~5,000 truck transactions/month per the
adapter's own header, guarded by the 100/hour cap + cache + coalescing.

**Risks:**

| Risk | Exposure | Mitigation |
|---|---|---|
| Violation-notice semantics unverified | Safety (11 §4) | Verify before N8a; fail-closed parse |
| Param rename / API change | Silent field loss | Manifest canary (11 §6.3) |
| Outage | No live routes | Fail-soft exists `[REPO]`; guidance refuses estimates (AD-8); honest copy |
| Cost growth: navigation adds alternatives, turnByTurnActions, spans, reroutes, per-session cache-bypass | Overrun of free tier | Per-session ceilings (13 §5); cost model **required before enabling** `[OWNER]`; no second paid provider in the live path without an approved model |
| Vendor lock-in | Adapter-shaped, `RoutingPort` seam exists `[REPO]` | Seam keeps a swap tractable; **no provider change recommended — no evidence justifies one** |
| Data freshness | 12 §5 | Disclosure + incident path |

**Second-provider posture `[PROPOSED]`:** no fallback provider in the live
request path. An **offline scheduled audit** may compare the canonical route
library across one additional provider's free tier for divergence detection
only — an owner cost/commercial decision `[OWNER]`, explicitly out of v1.

**Owner decisions consolidated:** trailer-count/vehicle-type defaults (11
§5.1) · hazmat-without-tunnel-category blocking (11 §3) · community entrance
reports in v1 (12 §3.3) · session cache-bypass cost tradeoff (12 §5) ·
reroute budget numbers (13 §5) · max session age (13 §6) · false-positive
threshold (14 §5) · audit cadence + any second-provider spend (this section)
· N14 traffic product selection (doc 10 blocked list `[REPO]`).

## 3. Milestone extension — N8 split (no renumbering of completed work)

Current position `[REPO]`: N0–N6 merged (main @ `c128a88`); N7 (voice) in
progress per doc 10 ordering. Doc 10 already warns N8 is L-complexity and
recommends an observe-only split. This extension formalizes the split into
PR-sized sub-milestones. N8a is **the exact recommended next coding
milestone after N7.**

| Sub | Objective | Scope | Depends | Risk | Exit criteria |
|---|---|---|---|---|---|
| **N8a — Route API + validation** | NEW-1 `/api/navigator/route`: nav-grade request (11 §6.4), notices verified & parsed fail-closed (11 §4), validator + outcomes (12 §4), geocode confirm (12 §2) | Server route, additive parse fields, `route-validation.ts`, serialization/canary/notice tests | N1; **HERE-doc verification task precedes it** | Med-high: first nav provider spend | §14.3 items 1–4, 10 green; cost model approved |
| **N8b — Full-geometry session handoff** | Session consumes full polyline miles (13 §1); tracker fed dense true geometry; memory measured | Session wiring; no tracker algorithm change | N8a | Low-med | Memory budget met; planner untouched (existing tests green unchanged) |
| **N8c — Heading-aware matching + confidence classes** | 13 §3.2 scoring; forbidden-actions enforcement; sustained-fix arrival | `route-tracker` extension or wrapper (pure) | N8b | Med | Scenario suite green; §14.3 item 9 |
| **N8d — Off-route observe-only** | 13 §4 detector, suppression zones, privacy-safe diagnostics; **zero provider calls** | `off-route-detector.ts` + replays | N8c | Low (no spend) | Truck-stop class 0 false positives; metrics reviewed |
| **N8e — Reroute execution** | 13 §5 pipeline behind its own flag; budgets, stale-token, atomic swap | Controller reroute path + suite | N8a, N8d | Med-high | §14.3 items 5–6; kill-switch drill |
| **N8f — Final approach + blocklist** | 12 §3 provenance/fallback; 15 §1.4 blocklist in validator | Directory-entrance integration | N8a | Med | Approach fixtures; blocklist config drill |

Then per doc 10: N9–N11, blocked N12–N15 unchanged. Road-test tooling and
Stage 2+ (14 §4) begin after N8d. Each sub-milestone keeps the doc 10
cross-cutting PR rules: independently mergeable, flag-guarded, rollback =
flag/revert, no migrations, existing planner tests green unmodified.

## 4. Index note

Docs 11–15 extend the 00–10 package; 00–10 remain authoritative for
everything they cover. Where this extension tightens a rule (full geometry
over densified samples, sustained-fix arrival, violated-route = estimate
severity), the tighter rule governs and is cross-referenced rather than
edited into the original in this design pass.

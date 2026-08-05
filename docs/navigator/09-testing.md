# 09 — Testing Strategy

Design only.

## The existing harness is the right harness

`scripts/run-tests.mjs` bundles each `scripts/test-*.ts` with esbuild and runs it
in Node — **no DB, no network, no browser**. CI (`.github/workflows/ci.yml`) runs
format → lint → typecheck → build → all 82 harnesses, and **blocks merge on
failure**.

Navigator adds harnesses to this. **No CI changes are required** for the
merge-blocking safety gate to exist — it already exists, and safety tests
inherit it by being named `test-*.ts`.

This works because the Navigator core is pure (AD-2): no React, no DOM, no
`fetch`, no clock reads. Every engine decision is a function of its inputs and
can be tested offline and deterministically.

---

## Suite inventory

### 1. Unit — pure engine

| Harness | Covers |
|---|---|
| `test-navigator-purity.ts` | **Structural.** Nothing under `src/lib/navigator/` imports React, `next/*`, or `fetch`. Protects AD-2 |
| `test-route-tracker.ts` | Projection, monotonic smoothing, cloverleaf back-projection rejection, genuine-reversal acceptance after 3 fixes, remaining-miles |
| `test-maneuver-engine.ts` | Threshold tiers by speed, one announcement per (maneuver, tier), chained-maneuver combining, no re-fire on jitter |
| `test-offroute-detector.ts` | Hysteresis count, bearing gate, **planned-stop exclusion**, confidence gate, verdict transitions |
| `test-safety-lock.ts` | State machine, dwell timers, **UNKNOWN → locked** from every entry path, override grant/expiry/revocation |
| `test-safety-gating.ts` | **Default-deny**: every `UIAction` has an explicit mapping; an unmapped action is locked |
| `test-gps-session.ts` | Accuracy gate, staleness gate, jump rejection, speed derivation, dead-reckoning bounds |
| `test-navigation-controller.ts` | Phase transitions, single-writer invariant, reroute budget, session freeze rules |
| `test-offline-manager.ts` | Cache/evict priority, active-route protection, quota handling, budget accounting |
| `test-voice-guidance.ts` | Priority queue, critical preemption, passive drop, mute, unavailable degradation |

### 2. Integration — engine composition

| Harness | Covers |
|---|---|
| `test-navigator-tick.ts` | Full tick: fix → tracker → maneuver → lock → state, with an injected clock |
| `test-navigator-hos-integration.ts` | HOS advance at 60 s, threshold crossings escalate correctly, Last Legal Stop recompute on clock change |
| `test-navigator-panels.ts` | Parking/fuel/LLS recompute cadence, zero-space filter, overnight vocabulary preserved offline |
| `test-navigator-reroute.ts` | Off-route → budget → backoff → route swap → tracker reset |

### 3. Replay testing

**The most valuable suite.** A recorded or synthesised GPS trace replayed through
the engine, asserting the full decision sequence.

```
scripts/fixtures/traces/
  i75-knoxville-chattanooga.jsonl      normal highway run
  i40-nashville-memphis-reroute.jsonl  deliberate wrong exit
  cloverleaf-i65-i40.jsonl             self-intersecting geometry
  truckstop-pullin.jsonl               pulls into a stop, must NOT reroute
  tunnel-cumberland.jsonl              90 s signal loss
  urban-canyon-atlanta.jsonl           accuracy degradation
  stop-and-go-i285.jsonl               lock flicker stress
```

Each trace is JSONL of `{ tMs, lat, lng, accuracy, speed, heading }`. Replay is
deterministic because the engine takes time as a parameter.

`test-navigator-replay.ts` asserts per trace: announcement sequence, reroute
count (often **0** is the assertion), lock-state transitions, final route-mile,
and zero double-announcements.

**`truckstop-pullin.jsonl` asserts reroute count is exactly 0.** That is the
single most important replay assertion in the suite — it encodes the rule that
pulling into a truck stop is not going off-route.

### 4. GPS simulation

`test-gps-simulation.ts` — synthetic generators rather than recordings:

| Generator | Asserts |
|---|---|
| Perfect trace | Baseline: no reroutes, all maneuvers fire once |
| Gaussian noise (σ = 10 m) | No spurious reroute |
| Accuracy degradation to 80 m | Fixes discarded, off-route suspended |
| Total dropout 30 s | Dead reckoning within bounds |
| Total dropout 120 s | Guidance mutes |
| Teleport (impossible speed) | Fix rejected |
| Stationary jitter | Lock does not flicker to MOVING |
| Slow crawl 4 mph | Stays MOVING (asymmetric threshold) |

### 5. HOS simulation

Reuses the existing HOS harnesses (`test-hos-calculator.ts`,
`test-hos-hardening.ts`, split-sleeper tests) unchanged, plus:

`test-navigator-hos-sim.ts` — drive a full 14-hour day through the tick loop and
assert: 30-min break fires at 8 h cumulative; 11-hour and 14-hour exhaustion
escalate to critical; Last Legal Stop slots shrink as clocks burn; **the
no-reachable-stop escalation fires** when it should.

### 6. Rerouting

Covered by replay + `test-navigator-reroute.ts`. Specific assertions: budget
caps at 6/hour; backoff is 30/60/120 s; destination never changes; offline
reroute fails cleanly to paused; stale route stays rendered throughout.

### 7. Safety — **merge-blocking**

Beyond the unit suites, `test-safety-invariants.ts` asserts the seven
non-negotiables from [06](./06-safety.md):

1. `UNKNOWN` → locked, every entry path
2. Every `UIAction` mapped (default-deny)
3. Override expires at exactly 15 min
4. Override cleared by MOVING → STATIONARY → MOVING
5. Override never survives deserialization
6. Off-route never fires within 150 m of a planned stop
7. Emergency mode reachable in every lock state

A failing safety test blocks the merge. There is no override path, and that is
the point.

### 8. Offline

`test-navigator-offline.ts`: cache/restore round-trip; guidance runs with network
stubbed to throw; **overnight status and space counts survive the cache
byte-identically**; weather older than 6 h is suppressed; eviction never touches
the active route; quota exhaustion declines the new download rather than
breaking the current trip.

### 9. Battery & long-run

Not CI-gateable. Milestone sign-off only:

| Test | Method | Pass |
|---|---|---|
| 2-hour drive | Real device, dash mount | < 12 %/hour |
| 4-hour memory | Long-run harness sampling `performance.memory` | Zero growth |
| Thermal | Device in sun, 1 hour | Degrades per the ladder, guidance retained |
| Low-power mode | Forced | Voice + maneuvers retained |

`test-navigator-longrun.ts` can run the 4-hour memory check headlessly by
replaying an accelerated trace — the leak surfaces without waiting 4 hours.

### 10. Accessibility

`test-navigator-a11y.ts` (static) plus manual review:

| Check | Requirement |
|---|---|
| Touch targets while moving | ≥ 64 × 64 px |
| Contrast day / night | ≥ 7:1 / true dark |
| Type size | maneuver ≥ 32 px, body ≥ 20 px |
| Screen-reader labels | Every control, including the emergency button |
| Gesture-only affordances | **Zero** |
| Colour as sole signal | **Never** — overnight status has text, not just colour |
| Reduced motion | Honoured for sheets and transitions |

### 11. Mobile & responsive

`test-navigator-responsive.ts` — snapshot the driving screen at **320 / 375 /
390 / 428 px** and landscape, asserting: maneuver card ≥ 30 % viewport height;
HOS strip visible; all three one-touch targets ≥ 64 px; no horizontal overflow.

This mirrors the existing responsive tests from the mobile bottom-bar work, so
the pattern already exists in the repo.

---

## Coverage requirements by module

| Module | Requirement |
|---|---|
| `SafetyLockController` | **100 % branch.** No exceptions |
| `OffRouteDetector` | 100 % branch |
| `ManeuverEngine` | 100 % branch |
| `RouteTracker` | ≥ 95 % |
| `GPSSessionManager` | ≥ 95 % |
| `NavigationController` | ≥ 90 % |
| `OfflineManager` | ≥ 85 % |
| UI components | Snapshot + interaction on safety-relevant ones |

## Test data policy

- GPS traces are **synthetic or self-recorded**. No third-party trace data.
- Directory fixtures are drawn from the real schema shape but use fabricated
  rows — **no CAT Scale data in any fixture**, per the standing use policy.
- No fixture contains a real driver's position.
- Fixtures live under `scripts/fixtures/` and are committed, so replay is
  reproducible.

## What CI gates vs what milestone sign-off gates

| Gate | Where |
|---|---|
| All `test-*.ts` harnesses | **CI — blocks merge** |
| Format, lint, typecheck, build | **CI — blocks merge** |
| Bundle size budget | **CI — blocks merge** (new check) |
| Battery, thermal, real-device frame rate | Milestone sign-off |
| Accessibility manual review | Milestone sign-off |
| Long-run memory (4 h real) | Milestone sign-off |

The split is honest: anything that needs a real phone in a real truck cannot
gate a pull request, and pretending otherwise produces a flaky gate that people
learn to ignore.

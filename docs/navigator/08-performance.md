# 08 — Performance Targets & Budgets

Design only. Targets are proposals to be validated on real hardware, not
measurements.

## Reference device

Budgets assume a **mid-range Android phone, 3 years old, in a dash mount, in
summer heat, on a 10-hour driving day** — not a current flagship on a desk. If
Navigator is comfortable there, it is comfortable everywhere.

Reference hardware for CI-adjacent benchmarking: 4× A55-class cores, 4 GB RAM,
1080×2340, throttled to 4× CPU slowdown in Lighthouse.

---

## Launch

| Metric | Target | Hard limit |
|---|---|---|
| Cold launch → Launch screen interactive | < 1.5 s | 3.0 s |
| Warm launch → Launch screen | < 0.6 s | 1.2 s |
| Launch screen → Trip setup | < 200 ms | 500 ms |
| Route preview render (after quote returns) | < 400 ms | 800 ms |
| **Start → first maneuver card** | **< 1.0 s** | 2.0 s |
| Resume interrupted session | < 1.5 s | 3.0 s |

The start-to-first-maneuver figure is the one that matters emotionally: the
driver has just pressed Start and is already moving.

## Network

| Operation | p50 | p95 | Timeout |
|---|---|---|---|
| `/api/trip-planner/places` | 250 ms | 600 ms | 3 s |
| `/api/navigator/route` | 900 ms | 2.5 s | 5 s (matches existing HERE timeout) |
| `/api/navigator/corridor` | 800 ms | 3.0 s | 6 s |
| `/api/navigator/weather-refresh` | 500 ms | 1.5 s | 3.5 s (matches existing NWS) |
| `/api/trip-planner/quote` (preview) | 1.5 s | 4.0 s | per-provider budget |
| **Trip start total (parallelised)** | **3 s** | **8 s** | — |

Existing timeouts are already correct in `quote/route.ts` (HERE 5 s, NWS 3.5 s,
EIA 3.5 s) and should be reused verbatim.

**Data volume per trip:**

| Item | Budget |
|---|---|
| Route + maneuvers | < 2 MB |
| Corridor slice | < 5 MB |
| Weather (per refresh) | < 100 KB |
| Per-hour steady-state (weather only) | **< 200 KB/h** |
| Reroute | < 2 MB each, max 6/h |

Steady-state navigation should consume **under 1 MB/hour** with no reroutes.
Drivers on metered connections will notice anything more.

## Runtime — the 1 Hz loop

| Metric | Target | Hard limit |
|---|---|---|
| GPS fix → state update | < 16 ms | 50 ms |
| `RouteTracker.update()` | < 5 ms | 15 ms |
| `ManeuverEngine.update()` | < 2 ms | 10 ms |
| `OffRouteDetector.evaluate()` | < 1 ms | 5 ms |
| `SafetyLockController.evaluate()` | < 1 ms | 5 ms |
| **Full tick, end to end** | **< 25 ms** | 80 ms |
| HOS advance (60 s) | < 10 ms | 50 ms |
| Panel recompute (5 mi) | < 150 ms | 400 ms |

A full tick under 25 ms leaves the remaining ~975 ms of each second idle, which
is what makes an 11-hour battery plausible.

**Panel recompute** is the only expensive pure operation — it ranks a few
hundred candidates. It must run **off the critical path**: schedule it via
`requestIdleCallback` (or a 0 ms timeout fallback), never inside a GPS tick.

## Frame rate

| Surface | Target | Hard limit |
|---|---|---|
| Maneuver card update | 60 fps | 30 fps |
| Map pan/redraw while following | 30 fps | 20 fps |
| Panel sheet open/close | 60 fps | 30 fps |
| Scrolling a panel list | 60 fps | 45 fps |

**The map redraws at 30 fps, not 60.** Position moves smoothly enough at 30 and
it halves the GPU cost. Under thermal throttling the map drops to 15 fps before
anything else degrades — guidance is the last thing sacrificed.

**Never drop below 30 fps on the maneuver card.** It is the element a driver
glances at for under a second.

## Battery

| Scenario | Target | Notes |
|---|---|---|
| Active navigation, screen on, wake lock | **< 12 %/hour** | 11-hour day needs charging regardless; the goal is not being the dominant drain |
| Active navigation, low-power mode | < 8 %/hour | Map 0.5 Hz, dimmed |
| Route preview, idle | < 3 %/hour | |
| Backgrounded (post-N13) | < 4 %/hour | Background GPS only |

Dominant costs in order: **screen** (unavoidable, wake lock is required), **GPS
high-accuracy**, **map redraw**, then JS. This ordering is why the map is the
first thing throttled and guidance the last.

Battery mitigations by threshold are specified in [06](./06-safety.md) §Battery
saver.

## Memory

| Metric | Target | Hard limit |
|---|---|---|
| Baseline heap (navigating) | < 80 MB | 150 MB |
| Peak during reroute | < 120 MB | 200 MB |
| Corridor slice in memory | < 15 MB | 30 MB |
| Route + maneuvers in memory | < 5 MB | 10 MB |
| Leak over 4 hours | **0** | 0 |

**Zero growth over a long drive is a hard requirement, not a target.** An 11-hour
session that leaks 10 MB/hour will be killed by the OS mid-trip. The likeliest
leak sources are the map layer and the 1 Hz subscriber list — both need explicit
teardown tests.

Corridor rows are held as a compact typed structure, not raw JSON objects, once
the slice exceeds ~500 rows.

## Storage

| Metric | Target |
|---|---|
| Default offline budget | 250 MB |
| Route only | < 4 MB |
| App shell + code | < 5 MB |
| IndexedDB write per session persist | < 500 KB, ≤ 1/min |

Session persistence runs at 60 s, never at 1 Hz — writing every second would
thrash storage and battery for no recovery benefit.

## Bundle

| Metric | Target | Hard limit |
|---|---|---|
| Navigator route JS (gzipped) | < 180 KB | 300 KB |
| Shared with existing app | reuse Leaflet, React, existing UI | — |
| `src/lib/navigator/` core | < 40 KB | 60 KB |
| Time to interactive, mid-range, 4G | < 2.5 s | 4 s |

The pure core is small because it delegates all real work to the existing
planner modules — which are already in the bundle for the Trip Planner route.

## Degradation ladder

Under sustained pressure (thermal, battery, memory), degrade in this order.
**Never reorder this list** — it encodes the safety priority.

1. Map redraw 30 → 15 fps
2. Map tile detail reduced
3. Panel recompute 5 mi → 10 mi
4. Weather refresh 50 mi → 100 mi
5. Map hidden entirely (maneuver card + voice only)
6. **Voice guidance — never dropped**
7. **Maneuver card — never dropped**
8. **HOS strip — never dropped**
9. **Safety lock — never dropped, never throttled**

Items 6–9 are non-negotiable. A Navigator that has degraded all the way to
step 5 is still a usable, safe navigator: it tells the driver where to turn, when
to stop, and refuses to let them type.

## Measurement

| What | How | When |
|---|---|---|
| Tick duration | `performance.now()` around the loop, p50/p95/p99 in dev | Every build |
| Frame rate | `requestAnimationFrame` delta histogram | Dev + device testing |
| Memory | `performance.memory` sampled at 60 s | Long-run test |
| Battery | Manual device test, 2-hour drive | Per milestone |
| Bundle | `next build` output + size budget in CI | Every PR |
| Network volume | Instrumented fetch counter | Dev |

**A performance regression test belongs in CI for bundle size only.** Tick
duration and battery need real devices and cannot gate a PR honestly — they gate
milestone sign-off instead.

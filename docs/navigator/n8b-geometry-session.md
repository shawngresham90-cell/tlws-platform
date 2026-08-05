# N8b — Full-Resolution Geometry & Navigation Session Handoff (implementation record)

Status: **implemented** on branch `claude/navigator-n8b-geometry-session`
(stacked on N8a, draft PR, owner review required). Design authority: the
architecture package (docs 00–10) on `claude/navigator-architecture`.
The Blueprint Extension (Docs 11–15) remains absent from the repository on
every branch; nothing here modifies or invents it.

## What N8b guarantees

A navigation session receives the **complete provider geometry exactly
once**, validated, immutable, and handed to the UNCHANGED N5 navigation
engine (tracker + maneuver engine + controller). No navigation behavior
changes; no map matching, heading logic, off-route detection, or arrival
logic exists in this milestone.

## Pipeline

| Stage | File | What happens |
|---|---|---|
| Decode | `here-routing.ts` (existing flexible-polyline decode, unchanged) | Full positions already decoded per section; decode failures still fail the parse |
| Retain | `here-routing.ts` `retainGeometry` option (**opt-in, default off**) | Only the Navigator endpoint's adapter instance keeps full geometry (with `cacheMax: 24`); planner instances and their cache memory are byte-identical |
| Normalize | `route-geometry.ts` `normalizeGeometry` | Finite/range check every point; drop + count consecutive duplicates (with an **original→normalized index map** so provider maneuver offsets stay correct); cumulative haversine miles scaled to land the final point exactly on the provider total; monotonicity verified; hard bound `MAX_GEOMETRY_POINTS = 120,000` (reject, never truncate) |
| Validate | `route-geometry.ts` `validateGeometryEndpoints` | Route must begin ≤ 2 mi from the requested origin and end ≤ 2 mi from the destination |
| Integrity | `geometryFingerprint` | FNV-1a over 1e-5-quantized coordinates + count; survives the 5-decimal wire rounding; any moved point changes it |
| Session | `route-session.ts` `createRouteSession` | Immutable (deep-frozen) session: route id, truck, origin/destination, full geometry with miles, offset-remapped maneuvers with **exact** miles, distance, duration, validation state, warnings, fingerprint. Only `valid` / `valid-with-warning` routes are eligible — `requires-review`/`rejected` can never become a session |
| Handoff | `sessionToControllerRoute` | Builds N5's existing inputs: `createManeuverEngine` gets the full-resolution mile array (exact maneuver miles); `createRouteTracker` gets the complete geometry, thinned deterministically only above `TRACKER_HANDOFF_MAX_POINTS` (= the tracker's own 20k densify bound), endpoints always kept |
| Endpoint | `route.ts` | After the N8a verdict, geometry is normalized + endpoint-validated (failures → `geometry:*` 422); valid responses now carry a `routeId`, the **complete geometry** as 5-decimal `[lat,lng]` pairs, and the fingerprint |

## Measured performance (real numbers from `test-navigator-route-session`, this container)

Worst-case synthetic route, **100,000 points**:

- normalize: **202.7 ms**
- session creation (incl. re-normalize + freeze): **117.8 ms**
- handoff (tracker + engine build): **6.2 ms**
- retained heap delta for the whole pipeline: **12.9 MB**
- asserted bounds in the harness: total < 5 s, heap < 100 MB

Real HERE routes are far smaller (tens of thousands of points
coast-to-coast), so production cost is a fraction of the above.

## Memory bounds

- `MAX_GEOMETRY_POINTS = 120,000` — normalization rejects beyond (hostile/corrupt payloads).
- Tracker handoff thinned to ≤ 20k points (the tracker's existing bound); session geometry itself is never thinned.
- Adapter geometry retention is opt-in; the Navigator instance caches at most 24 full routes; planner caches unchanged.
- Endpoint payload bounded by 5-decimal rounding (~1 m precision, fingerprint-compatible).

## Rollback

Delete `route-geometry.ts`, `route-session.ts`, `test-navigator-route-session.ts`, this file; revert the small `retainGeometry` hunks in `here-routing.ts`/`providers.ts` and the endpoint's geometry block. Single squash-revert restores the N8a state exactly.

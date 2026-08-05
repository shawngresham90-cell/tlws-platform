# N8c — Heading-Aware Map Matching (implementation record)

Status: **implemented** on branch `claude/navigator-n8c-map-matching`
(stacked on N8b, draft PR, owner review required). Design authority: the
architecture package (docs 00–10). The Blueprint Extension (Docs 11–15)
remains absent from the repository on every branch; nothing here modifies
or invents it.

## What N8c decides

Which roadway the truck is ACTUALLY on, with an explicit confidence level
— **before** any recovery logic exists. `src/lib/navigator/map-matcher.ts`
is pure, observe-only in this milestone: **no navigator module consumes it
yet** (pinned by a boundary test), and no rerouting, off-route recovery,
arrival detection, or final-approach logic exists.

## The algorithm — never a bare nearest point

Each fix is judged on six signals:

1. **Lateral distance** to the best candidate segment (local-frame
   point-to-segment projection): ≤30 m high-eligible · ≤75 m medium
   (frontage-road band) · ≤150 m low · beyond = no match (unknown).
2. **Heading agreement** with the segment's precomputed bearing, only when
   heading exists and speed ≥ 5 mph: ≤30° high · ≤60° medium · >100°
   opposing → low (divided-highway wrong-carriageway killer).
3. **Travel direction** from recent committed-mile deltas:
   forward / reverse / stationary / unknown — reverse blocks advancement.
4. **Progression consistency**: the candidate mile is compared with the
   mile predicted from the committed mile + speed·Δt. A break (>0.5 mi)
   is low (`progression-break`) until **5 consecutive consistent fixes**
   re-anchor at medium (`reanchored`) — a stacked interchange or GPS jump
   is never followed on one fix. Across a tunnel/loss gap the prediction
   projects through the gap at current speed (≤3 min); beyond that,
   progression is not judged and the streak requirement guards
   re-acquisition.
5. **Ambiguity**: a rival candidate within 15 m of the best but >0.5 mi
   away in route mile (overlapping corridors, stacked interchanges) caps
   at medium when progression holds, low on a fresh start. While
   committed, the mile window itself excludes far-mile twins, so the
   committed strand is followed and the mile can never silently defect.
6. **Fix quality**: accuracy >30 m caps medium, >50 m low; speed < 5 mph
   with lateral >30 m is the pull-in case (`low-speed-pull-in`) — truck
   stops, fuel islands, rest areas, weigh stations.

**HIGH is earned, not granted**: three consecutive fixes meeting every
high bar (`building-confidence` until then); any doubt resets the streak.
A >10 s gap (`gap-reset`) keeps the committed mile but resets all trust.

## Confidence contract (the N8c invariant)

`advanceEligible = (high | medium) && direction ≠ reverse`. The committed
route mile moves **only** on eligible matches (monotonic, 0.15 mi backward
jitter tolerance). The harness asserts globally, across every scenario fix
in the file, that **low/unknown never moved the committed mile and was
never advance-eligible** — the same guarantee downstream milestones (N8d
maneuver completion, reroute triggers, arrival) will inherit by consuming
`advanceEligible` and nothing else.

## Measured performance (this container, `--expose-gc`, never invented)

100,000-point route: matcher build **+2.0 MB** heap (precomputed bearings)
· fresh-start global scan worst **8.72 ms** · windowed match average
**69 µs**, worst **0.80 ms** · dense self-overlapping corridor average
**257 µs** · heap delta after 5,500 matches **15.1 MB** (run-to-run GC
variance observed 4–15 MB; asserted <50 MB).

## Rollback

Delete `map-matcher.ts`, `test-map-matcher.ts`, and this file. Nothing
else references them (pinned). Single squash-revert restores the N8b
state exactly.

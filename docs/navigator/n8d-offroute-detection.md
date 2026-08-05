# N8d — Observe-Only Off-Route Detection (implementation record)

Status: **implemented** on branch `claude/navigator-n8d-offroute-detection`
(stacked on N8c, draft PR, owner review required). Design authority: the
architecture package (docs 00–10), especially doc 05 §4 (off-route
detection) and doc 06 §7 item 5. The Blueprint Extension (Docs 11–15)
remains absent from the repository on every branch.

## What N8d decides — and what it cannot do

`src/lib/navigator/off-route-detector.ts` decides, at **zero routing
cost**, that the truck has left the planned route. It consumes ONLY the
N8c matcher's outputs plus fix metadata the caller already holds
(timestamp, speed, optional nearest-planned-stop distance and remaining
miles). It has **no provider surface at all** (source-pinned: no fetch, no
HERE, no http), emits internal state-change events only, and nothing
consumes those events yet — route replacement is N8e.

## The decision

An observation **qualifies** as departure evidence only when the truck is
genuinely moving (≥ 10 mph) and the matcher reports it far from the line
(lateral > 75 m) or beyond every candidate bound (unmatched-unknown).
Matcher-internal doubt — gap resets, re-anchoring after GPS jumps,
building-confidence fixes — is never departure evidence.

**Never from a single fix**: confirmation requires 4 consecutive
qualifying observations AND ≥ 8 s elapsed AND no suppression at any point.
One confident on-line observation before confirmation dissolves the
episode entirely (false-positive prevention). A tunnel/loss gap breaks the
evidence chain and the count restarts.

## State machine (deterministic; every transition an event)

```
on-route → suspected      first qualifying observation
suspected → on-route      clean observation, or any suppression zone
suspected → confirmed     ≥4 qualifying + ≥8 s, unsuppressed throughout
confirmed → recovering    first clean observation back near the line
recovering → confirmed    qualifying evidence resumes
recovering → recovered    3 consecutive clean, advance-eligible fixes
recovered → on-route      next observation (one-shot acknowledgment)
```

Events carry from/to, timestamp, matcher confidence, lateral distance,
route mile, qualifying count, and elapsed time. The log is bounded (100).

## Suppression zones (all thresholds configurable, defaults exported)

- **≤ 150 m from a planned stop** (doc 06 §7 — now enforced behaviorally
  as safety invariant 5b): truck stops, fuel islands, weigh stations,
  rest areas.
- **Below 10 mph**: lots, fuel islands, queues — pull-ins and pull-outs
  can never look like departures.
- The matcher's own `low-speed-pull-in` verdict.
- **Low-speed destination approaches** (≤ 1 mi remaining at < 25 mph).

Suppression during a suspected episode stands the episode down entirely.

## Measured performance (this container, `--expose-gc` — never invented)

100,000-observation session on a ~1,381-mile route with periodic drift
excursions and repeated 45 s GPS losses: detector average **234 ns** per
observation, worst **453 µs**; heap delta for the whole session (matcher +
detector) **7.9 MB**; event log bounded at 100 as configured.

## Boundary graduations in this milestone

- The N8c "nothing consumes the matcher" pin now sanctions exactly one
  consumer: this detector. The controller and all guidance paths remain
  matcher-free (still pinned).
- Safety invariant 5 graduates: 5a keeps route-REPLACEMENT code absent
  (regex scan, still true); 5b proves the 150 m planned-stop exclusion
  against the real detector.

## Rollback

Delete `off-route-detector.ts`, `test-offroute-detector.ts`, and this
file; revert the two harness graduations. Single squash-revert restores
the N8c state exactly.

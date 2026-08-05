# N8e — Controlled Truck Rerouting (implementation record)

Status: **implemented** on branch `claude/navigator-n8e-controlled-rerouting`
(stacked on N8d, draft PR, owner review required). Design authority: the
architecture package (docs 00–10), especially doc 05 §4. The Blueprint
Extension (Docs 11–15) remains absent from the repository on every branch.

## What N8e may do — and everything it may not

`src/lib/navigator/reroute-controller.ts` is the first and only module
permitted to request a replacement route after navigation starts. The
replacement fetch is an **injected port** (the app will wire the
flag-gated `/api/navigator/route` endpoint; tests inject scripts) — the
module itself performs no I/O and reads no clock.

Trigger discipline: **CONFIRMED only** (safety invariant 5a, behavioral).
Suspected, recovering, on-route, recovered, and degraded/unknown-accuracy
positions are refused **without spending**.

Preserved verbatim on every replacement: **truck profile** (every legal
restriction), **destination**, **avoidances** (now carried on the session
— additive N8b extension). Only the path changes.

## Gate order (each refusal coded, counted, free)

1. single-flight/coalescing (concurrent requests share one promise — concurrent provider requests are impossible, proven with an overlap counter)
2. `not-confirmed` · 3. `degraded-position` (>30 m or unknown) ·
4. `cooldown` (with the honest retry time) · 5. `session-budget` (12) ·
6. `hourly-budget` (6 in the trailing hour, sliding) ·
7. `duplicate` (the same just-failed request inside 30 s is never re-spent)

## Validation — exactly like the original route

Every replacement runs through `createRouteSession` (N8b): the N8a verdict
must be `valid`/`valid-with-warning` (anything else is `ineligible-state`),
geometry is normalized and endpoint-checked (origin = truck position,
destination = session destination), maneuvers remapped and bounds-checked,
truck re-validated as a free pre-flight belt. **A rejected replacement
never touches the current session.**

## Failure behavior

Provider failure, thrown port, rejected validation, expired in-flight:
the current session is preserved, the failure is surfaced as a typed
outcome, the backoff ladder arms (30 s → 60 s → 120 s, repeating; reset on
success; success itself cools down 15 s), and a retry is allowed after
cooldown. A response that arrives after `expireInFlight` (15 s) or after
the session changed is **dropped as stale** — it belongs to a world that
no longer exists. The controller never throws.

## Cost accounting

`stats()` reports requested vs **providerCalls** (the number that costs
money), refusals by reason, coalesced, duplicates suppressed, successes,
rejected replacements, provider failures, stale drops, trailing-window
count, and session count — every number pinned in tests against the
scripted port's own counter.

## Measured (this container, `--expose-gc` — never invented)

500 sequential full replacement cycles (request → validate → session
swap, 400-point replacements): average **0.26 ms**, worst **3.6 ms**,
heap delta **0.8 MB**, provider calls exactly 500 (stats agree with the
port's count; no hidden calls).

## Rollback

Delete `reroute-controller.ts`, `test-navigator-reroute.ts`, and this
file; revert the small session `avoid` addition and the two harness
graduations. Single squash-revert restores the N8d state exactly.

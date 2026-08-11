# Navigator technical debt / safety audit — August 2026

**Audit only. No behavior was changed by this document or alongside it.**
Per the audit rules, a routing/safety/accounting fix ships only when it is
(1) clearly reproducible, (2) covered by a failing focused test,
(3) behaviorally unambiguous, and (4) independent of any owner decision.
None of the findings below cleared all four bars inside this audit —
several are mechanical but lack the failing-test coverage that must land
*with* the fix, one requires the owner to pick a seam, and the rest
involve genuine judgement calls. Every one is therefore documented here
with severity, reproduction, affected code, current behavior, the
decision needed, and a suggested focused follow-up PR.

Scope read in full: all 20 files in `src/components/navigator/`, the 14
relevant modules in `src/lib/navigator/`, `src/lib/navigator-api/`,
`src/middleware.ts`, `src/app/(navigator)/drive/page.tsx`, plus the git
history of PRs #272, #282, #283, #285 and the pinning harness
`scripts/test-navigator-reroute-reversal.ts`. The load-bearing claims of
Finding 1 (transition ordering in `navigation-lifecycle.ts`, effect
declaration order and guards in `DrivingScreen.tsx`) were independently
re-verified against source before publication.

**Headline:** resource management — listeners, timers, watchers, wake
lock, speech, Leaflet — is in genuinely good shape; nearly every
apparent issue there is documented and deliberate (see the non-findings
table at the end). The real defects are elsewhere: **one high-severity
dead code path in the off-route voice announcement**, and a cluster of
medium-severity accounting/caching problems around failed network calls.

---

## Finding 1 — HIGH — The off-route voice announcement is unreachable; the episode counter never advances

- **Severity:** HIGH. This is the safety announcement of a P0 road-test
  fix (#272, "It never said 'off route'"), and the driver gets silence
  at the moment the module's own comments call "exactly the moment a
  driver needs one short sentence."
- **Affected code:** `src/components/navigator/DrivingScreen.tsx` —
  reroute effect (guard at :722, `if (lcState !== 'off-route') return;`)
  vs voice effect (guard at :790,
  `if (snap.state === 'off-route' && prev !== 'off-route' && prev !== 'rerouting')`);
  `src/lib/navigator/navigation-lifecycle.ts:498`
  (`transition('rerouting', tMs, 'reroute-requested')`).
- **Current behavior:** `requestReroute` is an async function whose body
  runs synchronously up to its first `await` — and the
  `transition('rerouting', …)` call sits *before* that `await`. React
  runs same-component passive effects in declaration order, so the
  reroute effect (declared first) has already moved the machine to
  `'rerouting'` by the time the voice effect calls
  `lifecycle.snapshot()`. `snap.state` is therefore `'rerouting'`, never
  `'off-route'`, at the guard; and when a refused reroute falls back to
  `'off-route'` on the next tick, `prev` is `'rerouting'`, which the
  second clause also excludes. **The condition is unsatisfiable in the
  integrated screen.** Consequences: (a) "You're off route. Rerouting."
  (`voice-guidance.ts:556`) is never spoken; (b)
  `offRouteEpisodeRef.current` stays 0 forever, so the holding line
  always requests id `reroute-unsafe:0` and announce-once speaks it once
  per mounted session, not once per departure — a second off-route
  episode in the same trip is silently dropped as a repeat. Mitigating:
  the **visual** line is unaffected — `offRouteText`
  (`DrivingScreen.tsx:1051-1056`) keys off
  `lcState === 'off-route' || lcState === 'rerouting'`, so
  `OFF ROUTE · Rerouting — continue safely.` still renders. Only voice
  and the episode counter are lost.
- **Reproduction:** drive a scripted off-route departure through the
  integrated screen (or trace the two effects by hand from the guards
  above) and observe that the voice request at :792 is never issued and
  the episode counter never increments.
- **Why the harness missed it:**
  `scripts/test-navigator-reroute-reversal.ts:756-772` pins this wiring
  by regex-scanning the source text of `DrivingScreen.tsx`, not by
  running the effects. The regex
  `/snap\.state === 'off-route' && prev !== 'off-route'/` matches
  happily against code that can never execute.
- **Decision needed:** which seam carries the announcement — derive the
  off-route edge from the render-time `lcState` (which *is*
  `'off-route'` on the transition render) instead of a post-effect
  snapshot, move the announcement ahead of the reroute effect, or have
  `requestReroute` itself announce. Mechanical once chosen, but it is
  road-tested safety wiring and deserves the owner's one-line
  confirmation of the seam.
- **Suggested follow-up PR:** a focused PR that (a) lands a failing
  harness which actually drives the two effects in order rather than
  grepping for them, (b) applies the chosen seam, (c) restores per-
  episode announce ids. Nothing else in the diff.

---

## Finding 2 — MEDIUM — A failed destination search caches an empty result and permanently poisons that query

- **Severity:** MEDIUM. The driver is told a truck stop does not exist
  when the truth is "the request failed once."
- **Affected code:** `src/components/navigator/DestinationSearch.tsx:110-115`
  (failure branch calls `coord.accept(decision.seq, [])`);
  `src/lib/navigator-api/search-coordination.ts:78-91` (`accept()`
  caches unconditionally under the normalized query key).
- **Current behavior:** a network blip, a 5xx, or an expired pilot
  cookie stores `[]` under the query key. Retyping the same place
  returns `{kind: 'cached', places: []}` and the component shows
  "No places found. Try a different search." — factually wrong — and
  never issues another provider request for that string for the life of
  the mounted component. The cache's own doc comment ("a cached answer
  is current by definition") is a correct statement about *successful*
  answers only.
- **Reproduction:** type a query, fail the request once, retype the
  identical query; observe zero provider calls and the "no places
  found" message.
- **Decision needed:** none on behavior — unambiguously a defect. Only
  the seam is open: cache solely on `outcome.kind === 'places'`, or add
  a non-caching `reject(seq)` staleness check to the coordinator.
- **Suggested follow-up PR:** focused fix + a harness case that fails a
  request and asserts the retype reaches the port again.

---

## Finding 3 — MEDIUM — A 401 from the pilot gate is charged to the reroute budget and is silent to the driver

- **Severity:** MEDIUM. Six mid-trip auth expiries exhaust the hourly
  reroute budget without one request reaching HERE, and nothing on
  screen ever says why.
- **Affected code:** `src/lib/navigator/reroute-controller.ts:189`
  (`TRANSPORT_FAILURES = new Set(['network', 'port-threw'])`) and
  :310-315 (refund); `src/components/navigator/route-port.ts:100-106`
  (maps the 401 to `{kind:'failure', reason:'unauthorized:pilot-access-required'}`);
  `src/middleware.ts:34-39`; `src/lib/pilot-access.ts:32` (12-hour
  cookie, so mid-trip expiry is a real event on a long haul).
- **Current behavior:** the middleware answers `/api/navigator/route`
  with the 401; the reason `'unauthorized:pilot-access-required'` is not
  in `TRANSPORT_FAILURES`, so the attempt stays charged against
  `maxPerHour: 6` and the escalating failure ladder even though it was
  rejected at our own edge and provably never reached the provider —
  directly contradicting the refund's stated rationale ("A request that
  never reached the provider costs nothing… Only transport failures
  qualify", :294-309). Driver-facing: the reroute resolves
  `provider-failure`, the lifecycle lands back on `off-route`
  (`navigation-lifecycle.ts:519-523`), and the screen shows
  `OFF ROUTE · Rerouting — continue safely.` indefinitely. The only
  trace is a pilot-log transition record, and `pilot-mode.ts:88-90`
  enables that log only on non-production hosts. The parked plan path is
  better but still poor: `PilotTripControls.tsx:155` renders the raw
  string `Route refused: unauthorized:pilot-access-required`.
- **Reproduction:** expire/clear the pilot cookie mid-trip (or stub the
  port to return the unauthorized failure), trigger an off-route
  departure, read `stats()` and the screen.
- **Decision needed:** split. The **budget half is mechanical** — the
  refund set is a named constant implementing a written rule; adding the
  unauthorized class is unambiguous. The **driver-facing half is an
  owner decision**: does an expired session redirect a moving truck out
  of the driving surface to `/navigator/access`, or show a banner until
  parked? That is a safety call, not a code call.
- **Suggested follow-up PR:** (a) classify `unauthorized*` as a
  refunded non-provider failure with a stat, behind a failing test;
  (b) separately, once the owner decides, an honest distinct line for
  auth expiry.

---

## Finding 4 — MEDIUM — A reroute retired by `expireInFlight` is charged and never refunded, in the exact scenario the refund was built for

- **Severity:** MEDIUM. In a dead-signal canyon the refund mechanism is
  largely bypassed.
- **Affected code:** `src/lib/navigator/reroute-controller.ts:558-566`
  (`expireInFlight`), :287-290 (staleness check), :310-315 (refund),
  :176 (`inFlightTimeoutMs` 15 s); `route-port.ts:31` (HTTP abort 20 s);
  `navigation-lifecycle.ts:474-477`.
- **Current behavior:** on a stalled connection the ordering is fixed:
  at t=15 s `expireInFlight` retires the attempt (sets `expiredSeq`,
  applies `failureCooldown`, bumps `providerFailures`, does **not**
  touch `callTimes`), and the lifecycle leaves `'rerouting'` so a second
  charged request may fire. At t=20 s the original fetch aborts with
  `reason: 'network'` — but `fetchReplacement` checks staleness *before*
  the failure branch, returns `{kind: 'stale'}`, and the refund is never
  reached. Every attempt in the refund comment's own motivating scenario
  is charged despite never reaching the provider, and each timeout
  additionally permits one extra concurrent charged call.
- **Reproduction:** inject a never-settling replacement port, tick past
  15 s, read `stats()`.
- **Decision needed:** owner call on semantics — one can reasonably
  argue a 15 s stall *did* "reach the provider." But the current outcome
  is not a considered position; it is two checks in the wrong order
  relative to the refund.
- **Suggested follow-up PR:** either refund `callTimes` inside
  `expireInFlight` or evaluate the transport-failure refund before the
  staleness check — whichever the owner picks — plus a stat so the
  choice is auditable, behind a failing test.

---

## Finding 5 — MEDIUM — `beginHold` is not re-entrancy guarded; a second pointer orphans an interval that outlives the component

- **Severity:** MEDIUM (leak, not a safety-gate bypass — `doneRef`
  still prevents a double `onConfirm`).
- **Affected code:**
  `src/components/navigator/PassengerOverrideDialog.tsx:30-43`
  (`beginHold`), :45-52 (`endHold`), :54-58 (unmount cleanup).
- **Current behavior:** `beginHold` has no
  `if (timerRef.current !== null) return;`. A second `pointerdown` on
  the same button (two gloved fingers, a palm plus a finger) overwrites
  `timerRef.current`, dropping the handle to the first interval.
  `endHold` and the unmount cleanup clear only `timerRef.current`, so
  the orphan runs forever — calling `setProgress` on a dead component
  every 100 ms for the life of the page. The keyboard path *is* guarded
  (:76, `holdStart === null`), which shows the intent; the pointer path
  missed it.
- **Reproduction:** two simultaneous pointers on the hold button;
  observe the surviving interval after release/unmount.
- **Decision needed:** none — one-line fix, no design judgement.
  Undone here only because the fix must land with its failing test in
  its own focused PR, not inside an audit.
- **Suggested follow-up PR:** guard `beginHold` on
  `timerRef.current !== null` + a multi-pointer harness case.

---

## Finding 6 — MEDIUM — A route replacement renders one tick of the old route's maneuvers, and can speak one

- **Severity:** MEDIUM. Same class as #272's "the missed turn kept
  giving orders," in a ≤1 s window that self-corrects on the next fix.
- **Affected code:** `src/components/navigator/DrivingScreen.tsx:715`
  (`const view = useMemo(() => lifecycle.tick(position, Date.now()).view, [position, lifecycle]);`),
  :766-776 (route-replacement block installs a fresh
  `ManeuverAnnouncer`), :838-845 (collect/speak), :979-983 (`mapData`
  memo); `navigation-lifecycle.ts:508-514` (controller swap).
- **Current behavior:** a successful reroute swaps the controller and
  `bump()` re-renders — changing `lcState` but not `position` — so the
  `view` memo does not recompute and still holds the previous route's
  `DrivingView`. `mapData` (keyed on `lcState`) *does* refresh, so the
  map draws the new line while the maneuver card shows the old route's
  next turn. In the same pass the voice effect installs the fresh
  announcer (empty fired-set) and then reaches the collect loop with
  `staleGuidance` false and `view.maneuvers` belonging to the discarded
  route — a maneuver from the abandoned route can be queued directly
  behind "Route updated."
- **Reproduction:** drive a scripted replacement; inspect the rendered
  card and spoken queue between the swap and the next GPS fix.
- **Decision needed:** owner judgement on whether a ≤1 s window
  justifies touching a deliberately tuned memo in road-tested wiring.
- **Suggested follow-up PR:** add `lcState` (or a route id) to the
  `view` memo's dependencies so the swap re-derives the view
  immediately, and/or treat the swap tick as `staleGuidance` — behind a
  failing test that scripts the swap.

---

## Finding 7 — LOW/MEDIUM — Wake lock can be permanently disabled mid-trip by three hide/show cycles

- **Severity:** LOW/MEDIUM, **conditional on platform event order** —
  not yet established as a defect.
- **Affected code:** `src/lib/navigator/screen-wake.ts:84-86`
  (`MAX_REFUSALS`), :105-111 (`onRelease` → `sync()`), :129-136
  (`setActive` short-circuit).
- **Current behavior (if `release` fires before `visibilitychange`):**
  the platform releases the lock when the page hides; the `onRelease`
  callback nulls the sentinel and calls `sync()` while `visible` is
  still true, so `sync()` re-requests a wake lock on a hidden document,
  which the platform rejects — `refusals += 1`. Three cycles reach
  `MAX_REFUSALS` and permanently short-circuit `sync()`; `refusals`
  resets only on a successful request or `setActive(true)`, and
  `setActive` short-circuits on unchanged state, so mid-trip there is no
  reset. The screen then sleeps for the rest of the trip — precisely the
  failure the module header says it exists to prevent. If
  `visibilitychange` reliably precedes `release` on the pilot devices,
  the branch never executes and there is no bug.
- **Reproduction:** none from this environment — needs a phone
  lock/unlock experiment on the actual pilot devices.
- **Decision needed:** run the device test first. Instrument
  `snapshot().refusals` in the road-test report during a phone-lock
  cycle.
- **Suggested follow-up PR:** only if refusals climb on device: gate the
  `onRelease` re-request behind a hidden-document check, or reset
  `refusals` on `setVisible(true)`.

---

## Finding 8 — LOW — `resourcesReleased()` under-reports; `discardRoute` leaves state that `releaseEngines` clears

- **Severity:** LOW — an observability/invariant gap, not a live leak.
- **Affected code:** `src/lib/navigator/navigation-lifecycle.ts:661-662`
  (`resourcesReleased()` asserts four fields), :322-338
  (`releaseEngines()` clears six, including `destinationInfo`,
  `lastTickInput` — which holds the driver's last position, AD-7 — and
  `mapGeometryCache`, which pins a `RouteSession` plus up to 20,000
  frozen geometry points), :439-444 (`discardRoute`), :534-539
  (`route-ready` branch of `cancel`).
- **Current behavior:** `discardRoute` and the route-ready cancel branch
  null `routeSession`/`destinationInfo` by hand instead of calling
  `releaseEngines()`, leaving `mapGeometryCache` and `lastTickInput`
  populated — while `resourcesReleased()` returns `true`. In practice
  the cache self-clears on the next `mapData()` call and `lastTickInput`
  is harmless outside a trip, but the module header states the invariant
  as absolute ("observable, not asserted on faith") and it currently
  over-promises.
- **Reproduction:** plan a route, `discardRoute()`, assert
  `resourcesReleased()` is true while the cache still holds the session.
- **Decision needed:** none — unambiguous.
- **Suggested follow-up PR:** have both paths call `releaseEngines()`
  and extend `resourcesReleased()` to cover `destinationInfo` and
  `mapGeometryCache`, behind a failing test.

---

## Finding 9 — LOW — Sustained off-route floods both bounded logs and destroys the road-test report's history

- **Severity:** LOW for driving, real for triage.
- **Affected code:** `DrivingScreen.tsx:721-734` (reroute effect
  re-fires per tick); `navigation-lifecycle.ts:300-317, 253`
  (`MAX_TRANSITION_LOG = 500`); `pilot-mode.ts:111`
  (`PILOT_LOG_MAX_ENTRIES = 500`).
- **Current behavior:** while off-route with the controller in cooldown,
  each GPS tick produces `off-route → rerouting → off-route` — two
  transitions per second, written to both capped logs. Neither grows
  unbounded, but the entire pilot log is overwritten in roughly 250
  seconds of sustained off-route, evicting everything about how the trip
  got there — the single most valuable triage window.
- **Reproduction:** hold off-route for five minutes with a refusing
  port; read `log.dropped()`.
- **Decision needed:** none on the defect; seam choice open.
- **Suggested follow-up PR:** suppress the transition-pair record when a
  reroute is refused without a provider call (the refusal reason already
  lives in `stats`), or reserve a region of the pilot log for trip-start
  entries.

---

## Finding 10 — LOW — `GpsProvider.start()` can wedge permanently if the port throws synchronously

- **Severity:** LOW likelihood, high annoyance — "Enable location" does
  nothing forever with no sign why.
- **Affected code:** `src/components/navigator/GpsProvider.tsx:149-192`
  (`activeRef.current = true` at :156 before `activePort.watch(...)` at
  :157; guard `if (activeRef.current) return;` at :150).
- **Current behavior:** if `watch()` throws synchronously (a hardened
  browser throwing from `watchPosition`, or a misbehaving injected
  port), `activeRef.current` is left `true` with no cancel stored, so
  every subsequent `start()` is a silent no-op; `watching`/`acquiring`
  never change. The synchronous-*denial* path is handled carefully
  (:182-187); the synchronous-*throw* path is not.
- **Reproduction:** inject a throwing port through the existing test
  seam (`port?: GeolocationPort`, :100-104).
- **Decision needed:** none — unambiguous.
- **Suggested follow-up PR:** wrap `watch()` in try/catch; on throw,
  reset `activeRef.current = false` and surface an error state, behind a
  failing test using the seam.

---

## Finding 11 — LOW — The map's destination and next-maneuver pins are destroyed and rebuilt every second

- **Severity:** LOW — waste, not a leak or correctness bug.
- **Affected code:** `NavigationMap.tsx:230-258` (marker effect keyed
  `[ready, destination, nextManeuver]`);
  `navigation-lifecycle.ts:611-619` (`mapData()` returns fresh object
  literals per call).
- **Current behavior:** the `mapData` memo recomputes ~1 Hz, so the
  effect runs `clearLayers()` + two `L.marker()` + `divIcon` +
  `getElement()` + style writes once per second for the entire trip —
  thousands of unnecessary DOM create/destroy cycles per hour on a
  phone, resetting any CSS state on the pins each tick. It contrasts
  with the deliberate per-route geometry caching immediately above it
  (`navigation-lifecycle.ts:571-591`), which exists for exactly this
  reason.
- **Reproduction:** count marker constructions per minute during a
  scripted drive.
- **Decision needed:** none — unambiguous as waste.
- **Suggested follow-up PR:** key the marker effect on scalar
  coordinates (or memoize the `LatLng`s per route/maneuver).

---

## Finding 12 — LOW — `announced` in `VoiceGuidance` is the only unbounded collection in the feature

- **Severity:** LOW — a few MB over a ten-hour trip, not a crash.
- **Affected code:** `src/lib/navigator/voice-guidance.ts:132`
  (`const announced = new Set<string>();` never shrinks), :584-597
  (`createStatusAnnouncer` mints a monotonic `status:${seq}:${status}`
  id per status change).
- **Current behavior:** GPS flapping between `good` and `degraded` at
  1 Hz adds one entry per second, unbounded by construction — in a
  codebase where every other buffer is explicitly capped
  (`MAX_TRANSITION_LOG`, `PILOT_LOG_MAX_ENTRIES`, `DEFAULT_SINK_MAX`,
  `SEARCH_CACHE_MAX`, `cfg.maxEvents`).
- **Reproduction:** flap the status source; watch the set grow.
- **Decision needed:** none.
- **Suggested follow-up PR:** cap `announced` with an LRU, or exempt the
  already-unique monotonic status ids from the ledger.

---

## Finding 13 — INFORMATIONAL — A cancelled or unmounted trip leaves its HTTP request running

`route-port.ts:75` uses `AbortSignal.timeout(TIMEOUT_MS)` as the only
abort source; nothing wires unmount or `cancel()` to it. Unmounting
mid-reroute correctly cancels the lifecycle and drops the late
resolution (`navigation-lifecycle.ts:502-505`), but the socket stays
open for up to 20 s. Harmless — the call was already charged and the
response is discarded — noted because a real `AbortController` would
also stop the provider clock.

## Finding 14 — INFORMATIONAL — The voice watchdog does not tick when the GPS watch is off

`voice.tick(Date.now())` rides the voice effect
(`DrivingScreen.tsx:743, 756, 903`), whose only 1 Hz cadence source is
`position`; with `watching === false` an utterance stuck before a trip
starts is never retired. Narrow — little speaks in that state. The
watchdog itself is sound: two observations 20 s apart required, token
bumped before retiring, cannot double-fire.

---

## Deliberate, documented — NOT findings

These looked like issues and are not; each carries an explicit in-repo
rationale that was read and checked.

| Area | Location | Why it is correct |
|---|---|---|
| Every listener paired | `DrivingScreen.tsx:916-921` (online/offline), :941-942 (visibilitychange) | Both cleaned up; the visibility listener re-registers per `lcState` change and removes the prior one each time. |
| Every timer cleared | `GpsProvider.tsx:135-138`, `HosStrip.tsx:52`, `SafetyLockProvider.tsx:75`, `DestinationSearch.tsx:127`, `PassengerOverrideDialog.tsx:56` | All cleared; only the multi-pointer orphan (Finding 5) escapes. |
| `watchPosition`/`clearWatch` pairing | `GpsProvider.tsx:73, 129-139, 195` | `watch()` returns its own canceller; `teardown()` always calls it; unmount teardown guaranteed. |
| Double-start of the geolocation watch | `GpsProvider.tsx:126, 150` | `activeRef` exists precisely because `cancelRef` cannot guard during the synchronous `watch()` call (comment :122-125). |
| Denial keeps state visible | `GpsProvider.tsx:168-177` | Explicit: resetting would hide why the preview stopped. |
| Wake lock release paths | `DrivingScreen.tsx:934-950`, `screen-wake.ts:98-103, 121-125` | Unmount, trip end, and visibility all covered, including the sentinel-arrives-after-trip-end race. |
| `MAX_REFUSALS` never loop-retried | `screen-wake.ts:54-60` | Deliberate battery guard (its interaction with Finding 7 is the only open question). |
| Pending speech cancelled | `DrivingScreen.tsx:957, 1148` | `clearPending()` on unmount and stop; `stopCurrent()` invalidates the token before `port.cancel()`. |
| Leaflet teardown | `NavigationMap.tsx:148-158` | `map.remove()` plus every ref nulled; `cancelled` flag handles unmount-during-dynamic-import. |
| Phase 3 `fitBounds` deps | `NavigationMap.tsx:215-219, 227` | Checked specifically: the `drawnRouteRef.current === key` early return fires first, so a `false → true` `navigating` flip cannot re-fit; `selfMoveRef` wraps a synchronous non-animated `fitBounds`. Correct. |
| `wasNavigatingRef` clearing `lastCenteredRef` | `NavigationMap.tsx:267-272` | Correct edge-detect. |
| Refs inside Leaflet handlers | `NavigationMap.tsx:92-100, 130-140` | `followRef` mirrors `follow` per render because handlers close over their creation render; no stale closure. |
| `HosStrip` voice effect, no dep array | `HosStrip.tsx:60-65` | Deliberate — announce-once ledger drops repeats (documented :57-59). |
| Ref assignment during render | `SafetyLockProvider.tsx:67-68`, `HosStrip.tsx:40-41` | Intentional latest-value mirrors so the 1 Hz interval is created once. |
| `mapData` memo `exhaustive-deps` disable | `DrivingScreen.tsx:979-983` | Deliberate: `view`/`lcState` proxy "the engines changed." |
| Two reroutes in flight | `reroute-controller.ts:515-518`, `navigation-lifecycle.ts:497` | Structurally prevented on the normal path by the synchronous transition plus single-flight coalescing; the one post-`expireInFlight` window is deliberate and guarded (its *accounting* is Finding 4). |
| Unmount mid-reroute | `DrivingScreen.tsx:955-961`, `navigation-lifecycle.ts:502-505` | `cancel()` releases engines; late resolution detected and dropped. |
| Search debounce / repeat calls | `DestinationSearch.tsx:76, 87, 126-128`; `PilotTripControls.tsx:109-115` | The 1 Hz re-request bug is fixed twice over (coarse `originKey`, `settled`); coordinator adds staleness + bounded cache. Sound apart from Finding 2. |
| Reroute budget double-charging | `reroute-controller.ts:275-276, 458-462` | Charged exactly once per fetch; the forward-anchor second call is deliberately charged; `lastFailedKey` deliberately not set on reversal refusal (:466-475). |
| Memory caps | `navigation-lifecycle.ts:253`, `pilot-mode.ts:111`, `pilot-events.ts:337`, `off-route-detector.ts:182-183`, `search-coordination.ts:45`, `map-matcher.ts:396-397`, `route-tracker.ts:61` | Every buffer capped, oldest-first, with `dropped()` counters; `violationLog` deliberately uncapped because it must stay empty. Sole exception: Finding 12. |
| `lifecycle.tick()` during render | `DrivingScreen.tsx:715` | Guarded by reference-idempotency (`navigation-lifecycle.ts:450`, `navigation-controller.ts:73`) and documented (:283-287); safe in this tree (no Suspense/`useTransition`), revisit if concurrent features arrive. |

---

## Recommended order for follow-up PRs

**No owner decision required** (clearly reproducible, behaviorally
unambiguous — each still needs its failing focused test to land with
the fix):

1. Finding 1 — off-route voice / episode counter *(one-line seam
   confirmation, then mechanical)*
2. Finding 2 — failed searches poisoning the cache
3. Finding 5 — `beginHold` re-entrancy
4. Finding 10 — `GpsProvider.start()` throw path
5. Finding 8 — `resourcesReleased()` / `discardRoute`
6. Findings 11, 12 — marker churn, `announced` cap

**Owner decision required first:**

- Finding 3 (driver-facing half) — what does an expired pilot session do
  to a moving truck?
- Finding 4 — does a 15 s stall count as "reached the provider"?
- Finding 6 — is a ≤1 s stale-view window worth changing a road-tested
  memo?
- Finding 7 — a phone-lock experiment must run before it can be called a
  bug at all.

## Process note

Finding 1 exists because
`scripts/test-navigator-reroute-reversal.ts:756-772` verifies wiring by
regex-matching source text. That harness style passes against code that
cannot execute, and it is used elsewhere in the suite. Text pins are
excellent at freezing *what the file says*; they cannot attest *what the
component does*. Anywhere a pin guards behavior (rather than wording or
class strings), a driven test — one that actually runs the effects — is
worth adding alongside it. This observation is independent of any single
fix above.

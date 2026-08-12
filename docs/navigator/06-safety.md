# 06 — Safety Architecture

Design only. **This document governs the others.** Where it conflicts with a UX
or performance goal, this document wins.

## Governing principle

> A driver who cannot use a feature is inconvenienced.
> A driver who is distracted by one can be killed.

Every ambiguous case resolves toward locking. Every unknown state is treated as
the dangerous state.

---

## 1. Motion lock

### State machine

```
        ┌────────────┐   speed ≥ 5 mph sustained 10 s   ┌──────────┐
        │ STATIONARY │ ───────────────────────────────▶ │  MOVING  │
        └────────────┘                                  └──────────┘
              ▲   ▲    speed < 3 mph sustained 30 s          │  │
              │   └────────────────────────────────────────-─┘  │
              │                                                 │
              │            ┌───────────┐                        │
              └────────────│  UNKNOWN  │◀───────────────────────┘
                 (never)   └───────────┘
                                 │
                    TREATED AS MOVING — ALWAYS
```

**Asymmetric thresholds with dwell** (5 mph on / 3 mph off, 10 s / 30 s) prevent
flicker in stop-and-go traffic. The longer dwell on unlocking is deliberate: a
truck rolling at 4 mph in a queue is still in traffic.

`UNKNOWN` arises from: no GPS permission · no fix yet · fix older than 10 s ·
accuracy > 50 m · speed unavailable and underivable. **All are treated as
MOVING**, with exactly one carve-out — the cold-start setup window below.

### 1a. The cold-start SETUP WINDOW (pilot round 3 — startup simplification)

The simplified startup is **destination → Start**: location permission is
requested BY the Start tap, after the destination is chosen. Before that tap
there is no GPS at all, so motion is `UNKNOWN` — and under the plain rule
above, the destination surface would be locked behind an enable-location step
plus a 30-second stationary dwell. That was the old flow, and the pilot
driver reported it as too many steps.

So the lock carries one narrow, owner-decided exemption:

- `setupWindow` is **true while motion has been `UNKNOWN` continuously since
  the lock was created** — the cold start, when the app has zero motion
  evidence either way (the state every parked phone app starts in).
- While it is open, the shared permission map may admit actions explicitly
  marked setup-window-permitted. That list is **one action wide**:
  `edit-destination`, the trip-setup surface (destination search, the Start
  tap, and the optional name field that lives on it). A harness pins the
  list's size.
- The window **latches shut on the FIRST `MOVING` or `STATIONARY`
  determination and never re-opens** — not on watch stop, not on position
  reset. Once motion has been seen, absence of evidence is not evidence of
  stopping, and `UNKNOWN` goes back to being treated as `MOVING` for the
  rest of the session.

What this deliberately accepts: a driver already rolling with the page
freshly open can type until the watch's first 10 seconds of speed evidence
determine `MOVING`. What it deliberately refuses: any unlock after motion
has ever been determined — a truck that loses GPS at 60 mph stays locked.
A driver who denies location permission keeps the setup surface (they must
be able to read the denial recovery and retry) but nothing else unlocks,
and navigation cannot run without a fix.

### Capability matrix

| Capability | MOVING | STATIONARY |
|---|---|---|
| Map, maneuver card, HOS strip, status strip | ✅ | ✅ |
| One-touch Parking / Fuel / Legal panels | ✅ | ✅ |
| Panel scroll, single-tap select | ✅ | ✅ |
| Voice commands | ✅ | ✅ |
| **Emergency mode** | ✅ | ✅ |
| Mute / unmute voice | ✅ | ✅ |
| Any text input | ❌ | ✅ |
| Destination entry or change | ❌ | ✅ |
| Truck profile view/edit | ❌ | ✅ |
| Add a stop to the route (re-plan) | ❌ | ✅ |
| Driver report submission | ❌ | ✅ |
| Feed, profile, community, directory browse | ❌ | ✅ |
| Settings beyond one level deep | ❌ | ✅ |
| Trip summary, cost detail | ❌ | ✅ |

### Enforcement

Global, never per-component:

```
NavigatorShell
 └── SafetyLockProvider          (evaluates 1 Hz)
      └── <LockGate action="edit-destination">
           └── DestinationEditor  ← not rendered when locked
```

`LockGate` consults a single `ACTION_PERMISSIONS` map. **Default-deny:** an
action absent from the map is treated as locked, and a test asserts that every
`UIAction` has an explicit mapping ([09](./09-testing.md)). This makes it
impossible to add a UI affordance that is silently permitted while driving.

Per-component `if (moving)` checks are **prohibited**. They drift, and a drifted
safety check is worse than none because it looks handled.

---

## 2. Passenger override

Deliberately high-friction. A passenger genuinely needs it; a driver must find
it annoying enough not to bother at 65 mph.

```
1. Offered ONLY when: state == MOVING and user attempted a locked action.
   Never advertised proactively. No settings toggle.
2. Full-screen interstitial:
     "Only a passenger may use this.
      I am not the driver of this vehicle."
   Requires PRESS AND HOLD for 2 seconds — not a tap.
3. Grants 15 minutes.
4. Expires automatically. A countdown banner is always visible while active.
5. REVOKED IMMEDIATELY if the vehicle stops and starts again
   (MOVING → STATIONARY → MOVING clears the grant).
6. Never persisted. A page reload, app restart, or new session clears it.
```

### What is logged

| Field | Logged |
|---|---|
| Timestamp | ✅ |
| Session id (ephemeral) | ✅ |
| Duration granted | ✅ |
| Action class that triggered it | ✅ |
| **Position** | ❌ |
| **User identity** | ❌ |
| **Speed** | ❌ |

Logged locally, in memory, surfaced in the trip summary only. **Not transmitted
in v1.** If it is ever transmitted, that is a consent decision requiring
explicit product sign-off, not an engineering choice.

Rationale for logging at all: it makes override usage visible to the driver
themselves, which is a mild deterrent, and it gives an honest count if the
feature is ever reviewed. Logging position would turn a safety feature into
surveillance.

---

## 3. Voice-first interactions

Voice is how the locked interface stays usable.

**Output** (`speechSynthesis`, no dependency):

| Priority | Examples | Behaviour |
|---|---|---|
| `critical` | HOS violation imminent · no reachable legal stop · hard reroute · severe weather warning | Preempts anything speaking |
| `normal` | Maneuver announcements | Queued in order |
| `passive` | "Parking ahead in 12 miles" | **Dropped** if anything is speaking |

Rules: never speak two things at once; never repeat an announcement (fired-flags
in [05](./05-navigation-engine.md)); always available to mute with one touch;
degrade silently when `speechSynthesis` is unavailable.

**Input** (deferred to N15): ⚠ **`netlify.toml` currently sets
`Permissions-Policy: microphone=()`**, which disables the microphone site-wide.
PTT requires changing that header — a security-posture change requiring
approval, not a feature toggle.

Planned command grammar (small and closed, no free-form): "parking", "fuel",
"legal stop", "how long", "mute", "repeat", "emergency".

---

## 4. Emergency mode

One touch, **always available, never locked, never behind a menu.**

Shows:
1. **Position as readable text** — nearest cross-street or interstate +
   mile-marker + direction, in large type, designed to be read aloud to a
   dispatcher or 911. This is the only surface that renders precise position as
   text, and only on explicit user action.
2. Nearest truck stop with confirmed parking (from the cached corridor).
3. Nearest hospital exit if available in the directory; otherwise omitted rather
   than guessed.
4. One-touch dial affordance where the platform supports it.

Emergency mode **suspends guidance** (voice silences, maneuvers pause) so the
screen and audio are not competing with a phone call.

---

## 5. Every edge case

### Permission failures

| Case | Behaviour |
|---|---|
| Location denied at prompt | Navigation cannot start. Preview remains usable. **Lock stays engaged.** Deep-link to settings |
| Location revoked mid-trip | `UNKNOWN` → locked. Guidance mutes. Banner: "Location permission lost" |
| Location "while using" only | Works foreground; warn that backgrounding ends navigation (until N13) |
| Precise location denied, coarse granted | **Refuse to navigate.** Coarse position cannot support maneuver timing. Say so plainly |
| Microphone denied (N15) | PTT unavailable; everything else unaffected |
| Storage/persistence denied | Offline unavailable; online navigation unaffected |
| Wake lock denied | Warn once that the screen may sleep |

### GPS loss

| Case | Behaviour |
|---|---|
| No fix at start | Cannot start; "Acquiring position" with a retry |
| Fix lost < 10 s | Hold last; no visible change |
| Fix lost 10–60 s | `lost`; dead-reckon along polyline; **flagged in UI**; no reroute decisions |
| Fix lost > 60 s | Guidance mutes; map shows last known; lock stays engaged |
| Fix returns far from route | Treated as a fresh fix; off-route hysteresis restarts from zero |

### Poor accuracy

| Case | Behaviour |
|---|---|
| accuracy 20–50 m | Accepted; `PositionHealthBadge` shows "approximate" |
| accuracy > 50 m | Fix discarded; `degraded`; **off-route detection suspended** |
| Accuracy degrades near a maneuver | Announce on the last good fix; do not suppress a turn because accuracy dipped |

Off-route detection requiring `confidence: 'high'` is what stops an urban-canyon
accuracy drop from triggering a spurious reroute.

### Tunnels

| Case | Behaviour |
|---|---|
| Entering tunnel (fix lost, on-route, speed known) | Dead-reckon at last speed, up to 60 s |
| Long tunnel (> 60 s) | Mute guidance; "Position unavailable"; recover on exit |
| Exit reacquisition | First fixes often poor; require 2 consecutive good fixes before resuming reroute decisions |

Dead reckoning is **always visibly flagged**. Navigator never presents an
estimated position as a measured one.

### Battery saver

| Case | Behaviour |
|---|---|
| OS battery saver detected | Warn that background/high-accuracy GPS may be throttled |
| Battery < 20 % | Offer "low-power navigation": map redraw to 0.5 Hz, dim, voice retained |
| Battery < 10 % | Strongly recommend a stop; keep voice + maneuvers, drop the map |
| Device thermal throttling | Reduce map redraw before reducing guidance — **guidance is the last thing sacrificed** |

### Airplane mode / offline

| Case | Behaviour |
|---|---|
| Airplane mode with route cached | Full guidance continues. Banner: offline |
| Airplane mode without cache | Cannot start. "Route not downloaded" |
| Connectivity lost mid-trip | Guidance continues; reroute unavailable; panels serve cache with age |
| Reconnect | Weather refreshes; queued reports flush; **no reroute unless off-route** |

### Other

| Case | Behaviour |
|---|---|
| App backgrounded (pre-N13) | Guidance pauses; on return, re-acquire and resume; **never silently continue with stale position** |
| Incoming phone call | Voice yields; guidance continues visually |
| Screen locked | Wake lock should prevent; if it fails, warn |
| Truck profile changed mid-trip | Blocked while moving. When stationary, forces a new route — different truck, different legal roads |
| Destination changed mid-trip | Blocked while moving; new session when stationary |
| Route provider returns null at start | **Guidance never starts** (AD-8). Estimated routes are preview-only |
| Clock rollover / DST | All engine time is epoch ms; display converts. No DST logic in the engine |
| Session older than 12 h on resume | Offer discard rather than resume — clocks will be stale |

---

## 6. Large-touch driving controls

| Rule | Value |
|---|---|
| Minimum touch target (moving) | **64 × 64 px** |
| Minimum spacing between targets | 16 px |
| Maneuver text | ≥ 32 px |
| Body text on driving screen | ≥ 20 px |
| Contrast, day | ≥ 7:1 |
| Contrast, night | true dark, no pure-white surfaces |
| Interactive elements on driving screen | **≤ 5** (three panels, mute, emergency) |
| Gestures required | **none** — every action has a button; no swipe-only affordance |
| Confirmation dialogs while moving | **none** — actions available while moving are safe by definition |

Anything requiring precision, reading, or a decision belongs behind the lock.

---

## 7. Merge-blocking test requirement

CI already runs every `scripts/test-*.ts` and blocks merge on failure
(`.github/workflows/ci.yml`). Safety tests slot into that harness with **no CI
changes**. Detail in [09](./09-testing.md); the non-negotiable ones:

1. `UNKNOWN` state resolves to locked — asserted for every entry path.
2. Every `UIAction` has an explicit permission mapping (**default-deny**).
3. Override expires at 15 min and is cleared by a stop/start cycle.
4. Override never survives a reload.
5. Off-route never fires within 150 m of a planned stop.
6. Maneuvers never announce twice.
7. Emergency mode is reachable in every lock state.

**A failing safety test blocks the merge. No exceptions, no override path.**

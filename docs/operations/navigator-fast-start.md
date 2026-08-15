# Navigator Fast Start

**Date:** 2026-08-15
**Branch:** `claude/navigator-fast-start`
**Status:** audit complete; implementation in progress.

---

## 1. The pilot complaint

> "I'm a driver. Why do I have to keep entering my truck information? It should
> ask me once, save it and give me an Edit button. I also need saved settings
> such as avoiding tolls. There is too much setup before starting. I should not
> have to say I'm a passenger while I'm parked. I'm a trucker—time is money, and
> it takes too long to get moving."

Four separate claims. Each was measured against the running product before any
code was changed.

---

## 2. What the audit measured

Method: production build, Chromium at **390×844**, pilot gate unlocked, **no
geolocation permission granted** — a parked driver who has not shared location,
which is the pilot's actual situation.

| Measurement | Value |
| --- | --- |
| Parked-screen height | **8,826 px** |
| Screens of scrolling (844 px viewport) | **~10.5** |
| Distance from top to **Start Route** | **5,758 px** (~6.8 screens) |
| Start Route state on arrival | disabled |
| Occurrences of `13′6″` | **2** |
| Occurrences of `80,000 lb` | **2** |
| The word "passenger" on a parked screen | **present** |

"It takes too long to get moving" is not a feeling. A driver must scroll roughly
seven phone screens to reach the button that starts the trip.

---

## 3. Diagnosis, claim by claim

### 3a. "Why do I have to keep entering my truck information?"

**The persistence works. The screen does not use it.**

`truck-storage.ts` is sound: a versioned localStorage record, migrated from the
old sessionStorage key, whose confirmation fingerprint is honoured only when it
still matches the stored values. `DrivingScreen` restores it on mount and
already branches:

```
truckConfirmed && !editingTruck ? <TruckSummary/> : <TruckProfileEditor/>
```

So a returning driver with a valid confirmed truck *does* get a summary. The
friction is elsewhere, and it is threefold:

1. **The first visit is the whole form, inline and expanded** — height, width,
   length, gross weight, axles, hazmat, and five avoidance toggles, each with
   its own unit control. That is the correct place to confirm a truck, but it
   sits between the driver and everything else.
2. **The measurements are printed twice.** The trip-setup checklist near the top
   repeats the height and weight the editor shows below. A driver reading the
   screen twice reasonably concludes they are being asked twice.
3. **Route preferences live *inside* the truck profile.** `avoid` is a field on
   `EditableProfile`, so changing "avoid tolls" is editing the truck — which
   re-opens the truck editor and invalidates the truck confirmation. A
   preference change should never look like a truck change.

### 3b. "I also need saved settings such as avoiding tolls"

**The provider support already exists and is verified.** `avoid[features]` is
whitelisted in `here-truck-params.ts` and documented in the repository at
`docs/navigator/11-truck-legal-routing.md`:

| Preference | Wire value | Status in repo docs |
| --- | --- | --- |
| Avoid tolls | `avoid[features]=tollRoad` | **IMPL**, `[REPO]`-evidenced |
| Avoid ferries | `avoid[features]=ferry` | **IMPL**, `[REPO]`-evidenced |

Both reach the wire through `sanitizeAvoidances`, which drops anything outside
the whitelist, and both are part of the routing cache key — so a preference
change cannot be served a route computed without it. **No parameter needed to be
guessed or invented for this milestone.**

What is missing is not provider support but **independent persistence**: there
is no preference record, so nothing survives a reload except as part of the
truck.

### 3c. "I should not have to say I'm a passenger while I'm parked"

**Confirmed on a parked screen.** The word "passenger" is present with no
movement and no location permission.

The mechanism, traced through `safety-lock.ts` and `actions.ts`:

- Motion is `UNKNOWN` at cold start and `UNKNOWN` is treated as `MOVING`
  (locked) — correct default-deny.
- A **setup window** exists for exactly this problem: while motion has been
  `UNKNOWN` *continuously since the lock was created*, the setup surface is
  unlocked. But `SETUP_WINDOW_PERMISSIONS` grants **one** action —
  `edit-destination`.
- The window **latches shut forever on the first motion determination** —
  `MOVING` *or* `STATIONARY`.

That last rule is the defect. Consider a driver parked at a truck stop:

1. Location is granted, a fix arrives, 30 s below 3 mph → `STATIONARY`.
   The window latches shut. The screen is unlocked because stationary.
2. The fix goes stale under a canopy, or the phone loses signal → `UNKNOWN`.
3. `UNKNOWN` is treated as `MOVING`, the setup window is gone, and the parked
   driver is offered a **passenger declaration** to edit their own setup.

The truck has not moved. The app simply stopped being able to see it. The
existing rule — *"once motion has been seen, absence of evidence is not evidence
of stopping"* — is correct **after movement** and wrong after a stationary
determination, because standing still is what the truck was already doing.

### 3d. "It takes too long to get moving"

Beyond the truck editor, the parked screen also renders the pilot briefing
(`PilotOnboarding`) **expanded on every visit** — `useState(true)`, never
persisted. A returning driver scrolls past the entire first-trip briefing every
time. It accounts for a large share of the 8,826 px.

---

## 4. What is NOT wrong

Recorded so the fix does not "repair" working code:

- **Truck storage** — versioned, migrated, fingerprint-gated. Unchanged.
- **The confirmation rule** — a restored truck never restores permission to
  route for a truck nobody checked. Unchanged.
- **Feet-and-inches (PR #311)** — `13′6″` is stored as `13.5` ft and sent as
  `411` cm. Correct, and preserved exactly.
- **`avoid[features]`** — already verified against provider documentation.
- **The motion lock after real movement** — correct, and deliberately untouched.
- **Destination search, region/units, clocks, route-request dedup** — all reused
  as-is. No parallel system is introduced by this milestone.

---

*Sections 5 onward — what changed, what invalidates a route, the phone test and
remaining limitations — are written as the implementation lands.*

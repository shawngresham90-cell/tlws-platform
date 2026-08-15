# Navigator Fast Start

**Date:** 2026-08-15
**Branch:** `claude/navigator-fast-start`
**Status:** implemented and measured.

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

## 5. What changed

Five changes, one per diagnosed cause. Nothing in section 4 was touched.

### 5a. Route preferences left the truck profile

`src/lib/navigator/route-preferences.ts` (new, pure) and
`src/components/navigator/route-prefs-storage.ts` (new, its own versioned key
`tlws-navigator-route-prefs-v1`).

`avoid` was a field on `EditableProfile`, which made "avoid tolls" a **truck
edit**: it changed the routing fingerprint, invalidated the truck confirmation,
and sent the driver back through "this is my truck" to say something about a
toll booth. A trailer height is a property of the vehicle that a bridge does not
negotiate; a toll is a choice the same truck makes differently on Tuesday. They
are now stored apart, edited apart, and meet only on the wire.

Only avoidances the provider genuinely implements may be offered. The table is
asserted at test time against `HERE_AVOID_FEATURES` — the same whitelist the
route request sanitizes against — so a typo becomes a failing test rather than a
switch that silently does nothing.

**Both states are named.** The summary says "Tolls allowed" as plainly as it
says "Avoid tolls", because a missing line leaves a driver guessing whether
tolls are permitted or whether the app forgot to ask, and the difference is
money.

### 5b. The passenger prompt on a parked screen

`src/lib/navigator/safety-lock.ts` — `STATIONARY_GRACE_MS = 60_000`, plus
`parkedGrace` and `lockReason` on the lock state.

The setup window latched shut on the **first motion determination**, `MOVING`
*or* `STATIONARY`. A driver parked under a truck-stop canopy was therefore
offered a passenger declaration the moment their fix went stale — the truck had
not moved; the app had merely stopped being able to see it.

The rule is now split by what was last **determined**:

| Last determination | Signal lost | Result |
| --- | --- | --- |
| `STATIONARY` | yes | 60-second parked grace; setup stays usable |
| `STATIONARY` | grace expired | locked, reason `location-unknown` |
| `MOVING` | yes | locked, reason `moving` — **no grace, unchanged** |
| any | one sample ≥ 5 mph | grace ends **immediately**, before the 10 s dwell |

Being slow to unlock costs a driver seconds. Being slow to lock costs them a
text field at speed — so positive evidence of movement ends the grace on a
single sample, well short of the dwell a `MOVING` determination requires.

`LockGate` now distinguishes the two locks. A signal loss reads *"We can't
confirm this vehicle's location right now, so setup is on hold. It returns on
its own once the signal comes back."* It never says the vehicle is moving, and
it never offers passenger access. **The motion lock after real movement is
unchanged.**

### 5c. The parked screen collapses for a returning driver

`src/lib/navigator/setup-status.ts` gained `configured`;
`src/components/navigator/SetupSummary.tsx` is new; `PilotTripControls` renders
two orders.

| Setup state | Order, top to bottom |
| --- | --- |
| Still open | Driver → Region → Truck → Preferences → Clocks → Destination → **Start** |
| Settled | Destination → **Start** → one "Your setup" card |

`configured` is derived from `REQUIRED_ITEMS`, so a future required item cannot
let the screen collapse over it. An unconfirmed or invalid truck never collapses;
an open truck editor forces the long order.

The short screen is what a driver **arrives** to, never something that happens
to them mid-setup: `arrivedConfigured` is latched when the truck is restored, so
confirming the truck on a first run does not yank the form out from under a
thumb halfway down the page. They leave the long form by tapping **Done with
setup** — a decision, not a side effect. It is deliberately not persisted: the
fast path has to be the one you get without asking.

### 5d. What the collapse refuses to hide

A collapse that buries a limitation is worse than a long screen, because the
driver now believes setup is complete.

- **The truck's actual numbers**, not the word "Confirmed". A driver who hooked
  a different trailer this morning must be able to catch it without opening
  anything.
- **The driver's remaining hours**, not the word "Set". `summarizeEnteredClocks`
  prints drive time and shift window; a driver with 45 minutes left and one with
  nine hours would have read the identical word.
- **The blank-clocks warning.** `clocksWarning` now keys off `configured` rather
  than `canStart`, so it is already showing the moment the screen is allowed to
  collapse. Previously it waited for a destination, which would have let a driver
  see the short screen before being told HOS guidance was unavailable.
- **Canada's "not calculated in this region"**, which comes from the setup
  status rather than the clock formatter.

### 5e. The briefing is remembered

`src/components/navigator/onboarding-storage.ts` (new, key
`tlws-navigator-onboarding-v1`). `PilotOnboarding` opened expanded on every
visit — `useState(true)`, never persisted. It degrades **toward showing**: an
unreadable record reads as "not seen yet", so the failure mode is a briefing a
driver has already read rather than one they never saw.

---

## 6. What invalidates a built route

A route is provider geometry computed for a specific truck under a specific set
of restrictions. Anything that changes either must discard it rather than let
Start reuse it.

| Change | Route discarded | Truck re-confirmation |
| --- | --- | --- |
| A routing dimension (height, width, length, weight, axles, hazmat) | yes | **yes** — fingerprint changed |
| A route preference (tolls, ferries) | **yes** | **no** — this is the fix |
| Driver name | no | no |
| Clocks | no | no |
| Region or units | no | no |

`claimsMatchRequest` compares the on-screen summary against the request's own
`avoid` list, so the screen cannot claim an avoidance the wire did not carry.

---

## 7. Measurements

Method: production build, Chromium, pilot gate unlocked, **no geolocation
permission granted**, route and search endpoints intercepted (a full run spends
nothing). `scripts/bench/navigator-fast-start.mjs`, 65/65 checks.

| Viewport | First run height | First run → Start | Returning height | Returning → Start |
| --- | --- | --- | --- | --- |
| 320×568 | 9,906 px | 6,458 px | 5,759 px | 1,929 px |
| 375×667 | 9,066 px | 5,898 px | 5,263 px | 1,741 px |
| **390×844** | 8,942 px | 5,874 px | **5,163 px** | **1,741 px** |
| 412×915 | 8,734 px | 5,738 px | 4,979 px | 1,657 px |
| 430×932 | 8,530 px | 5,562 px | 4,771 px | 1,529 px |
| 768×1024 | 7,212 px | 5,154 px | 3,693 px | 1,361 px |
| 1024×768 | 6,940 px | 5,102 px | 3,449 px | 1,337 px |
| 1280×800 | 6,924 px | 5,102 px | 3,433 px | 1,337 px |

Against the audit baseline (390×844, returning driver):

| | Before | After | Change |
| --- | --- | --- | --- |
| Parked-screen height | 8,826 px | **5,163 px** | −3,663 px (41.5% shorter) |
| Top → Start Route | 5,758 px | **1,741 px** | −4,017 px (69.8% sooner) |
| Screens of scrolling to Start | ~6.8 | **2.1** | −4.7 screens |
| Occurrences of `13′6″` | 2 | **1** | duplication gone |
| Occurrences of `80,000 lb` | 2 | **1** | duplication gone |
| "passenger" while parked | present | **absent** | — |

Also measured: `Start Route` contrast **8.77:1** (WCAG AA for large text needs
3:1); every planner control ≥ 44×44 at 320 px; five rapid Start taps spend
**one** route request; that request carried exactly `["tollRoad"]` when the
driver had saved that preference and nothing else.

The bench prints the baseline beside the new value and computes the delta rather
than asserting against a hard-coded threshold, so a future regression shows up
as a number rather than being hidden behind a limit someone relaxed.

---

## 8. Test and mutation coverage

- **`scripts/test-navigator-fast-start.ts` — 88 checks.** The motion table is
  driven through the real `createSafetyLock` with real fixes and timestamps,
  never by reading source. The truck/preference separation is proved by running
  the real confirmation gate over all four preference combinations (READY
  throughout, profile unmutated, four distinct wire avoid lists) rather than by
  grepping a module for a type name.
- **`scripts/mutate-navigator-fast-start.mjs` — 10/10 mutations caught.** Each
  damages one safety- or contract-critical line and requires the harness to go
  red; a survivor is reported as a coverage hole, and an anchor that no longer
  matches counts as a survivor rather than silently passing.

One honest caveat, recorded rather than papered over: the
**grace-after-movement** mutation needs *two* edits, because the guard is
deliberately doubled — `stationaryLostAtMs` is only stamped while `STATIONARY`,
and `lastDetermined === 'STATIONARY'` re-checks the same fact. Mutating either
alone is an **equivalent mutant**: the surviving guard still produces correct
behaviour. A single-line mutation staying green would prove redundancy, not a
coverage hole, so both are removed together to make the unsafe behaviour
actually appear.

### A regression this milestone caused, and how it was caught

The `location-unknown` branch in `LockGate` was first written to return the
explanatory block card **unconditionally**, ignoring the `compact` prop that the
driving cockpit's row of controls depends on. On a full-screen map that turned
three row-sized controls into three stacked cards. Measured at 320×568:

| | Before | With the defect |
| --- | --- | --- |
| Voice control box | 67×64 px | 51×486 px |
| Route-overview control | present | **absent** |
| Guidance surface overflow | 0 px | up to 252 px |
| Map's unobstructed share | 39% | 14.4% |
| `navigator-viewports` | 0 failures / 619 | **97 failures / 614** |

It was found by running the same bench against a build of `origin/main` in a
separate worktree and comparing — not by inspection, which had already been
wrong about it once. The fix is in two parts:

1. The compact variant honours `compact`, and stays a **real control** rather
   than a bare `<div>`: a gap in the cockpit row leaves a driver looking for a
   control that vanished, and leaves a screen reader nothing to land on. It is
   `aria-disabled` rather than `disabled` so it stays focusable and can still
   say what it is.
2. `navigator-viewports` learned the second stand-in. Its invariant is
   unchanged — *a control a driver cannot reach is a defect whether it is the
   real one or the lock* — and both stand-ins are now measured against it.

The invariant is also pinned in `test-safety-gating` so it costs milliseconds
rather than a browser run: the compact variant must be one row-sized element,
must carry no block-card paragraphs, and must never offer passenger access.

### Regression benches on the final build

| Bench | Result |
| --- | --- |
| `navigator-viewports` | **619 checks, 0 failures**, 11 known-open notes — identical to `origin/main` |
| `navigator-pretrip-setup` | 40 checks, PASS |
| `navigator-startup` | PASS |
| `navigator-truck-profile` | PASS |
| `navigator-fast-start` | 65 checks, PASS |
| Harness suite | 186 harnesses, all passing |

Two `navigator-pretrip-setup` assertions were repointed, not weakened. They
pinned the phrase `"Driving as"` and located `5h 05m` inside the clock panel —
both artifacts of the old layout. They now assert the **facts** those checks
existed to protect: the saved name and the exact entered clocks are readable on
the returning screen, wherever the layout puts them. Note that a collapsed card
reading "Clocks: Set" would have **failed** this check, and should have; that is
why 5d prints the hours.

---

## 9. The phone test

1. Open the preview on a phone and unlock the pilot gate.
2. **First run.** Confirm the truck. The setup should stay open under your thumb
   — nothing should collapse mid-page.
3. Tap **Done with setup**. The screen should shorten and Start Route should
   move up.
4. Tap **Change setup** → **Edit preferences** → *Avoid tolls*. Tap **Done**.
   The card should read "Avoid tolls · Ferries allowed".
5. **Close the tab and reopen it.** You should land on the short screen with the
   truck's numbers, your hours and your toll setting already there — and you
   should not be asked to confirm the truck again.
6. Search a destination on the map and tap **Start Route**.
7. **Park under cover or turn location off while stationary.** Setup should stay
   usable for about a minute, then pause with *"We can't confirm this vehicle's
   location right now."* **You should never be asked to say you are a
   passenger.**
8. **While actually moving**, confirm the driving lock still behaves exactly as
   before — this milestone did not touch it.

---

## 10. Limitations

- **This device only.** No accounts, no cloud sync, no fleet profiles — out of
  scope for this milestone by instruction. Clearing site data clears the truck,
  the clocks, the name and the preferences.
- **Two preferences.** Tolls and ferries are what the provider is documented to
  support in this repository with `[REPO]` evidence. `tunnel`, `dirtRoad` and
  `uTurns` are in the whitelist but are not offered as driver-facing toggles in
  this milestone; adding one is a table entry plus a test, not new plumbing.
- **HOS remains driver-entered.** Nothing here reads an ELD, and the ELD is
  still named as the authority. Canada still declares its HOS calculation
  unavailable.
- **The first run is still long** — 8,942 px at 390×844. That is a driver
  confirming a truck for the first time, which is the one moment the long form
  is the correct screen. The milestone's claim is about the second visit onward.
- **The 60-second grace is a judgement call**, not a derived constant. It is
  long enough to survive a canopy or a parking-garage entrance and short enough
  that a truck which actually pulled away is locked well before it reaches road
  speed — and any single sample at or above 5 mph ends it immediately regardless.

# Navigator — pre-trip setup operations

**Date:** 2026-08-13
**Scope:** the Navigator pilot's parked setup flow — driver name, region/units, truck
profile, hours-of-service clocks, destination and Start Route — plus the three device
records that make it survive a reload.
**Audience:** whoever runs the pilot, answers a driver's question about it, and decides
what the app may and may not claim.

---

## 0. The one-paragraph answer

Before this milestone the Navigator assumed every driver began a trip with fresh
clocks. It seeded the HOS strip with eleven hours of driving, a full fourteen-hour
window and seventy hours of cycle, for everyone, every session. A driver six hours
into a shift was shown a full clock. This milestone removes that assumption and puts a
named sequence in its place: **Driver → Region/Units → Truck → Clocks → Destination →
Start Route**. The clocks now default to *nothing*, the driver enters what their ELD
actually says, and the three things worth remembering — name, truck, clocks — survive
a reload and the next morning. Start Route stays disabled until the truck is confirmed
and a destination is chosen. Clocks are **not** a gate: a driver may start a route
without entering them, and the screen says plainly that HOS guidance is unavailable.

---

## 1. The visible order, and why it is that order

| # | Step | Required to Start? | Notes |
| --- | --- | --- | --- |
| 1 | Driver name | No | Greeting only. Optional forever. |
| 2 | Region / units | No | Defaults to US / imperial. |
| 3 | Truck profile | **Yes** | Must be *confirmed*, not merely present. |
| 4 | HOS clocks | No | Unset is honest; guidance is withheld, not faked. |
| 5 | Destination | **Yes** | Chosen on the map above, not in the list. |
| 6 | Start Route | — | Disabled until 3 and 5 are done. |

The checklist at the top of the parked screen lists the same four items in the same
order, computed by `setupStatus()` in `src/lib/navigator/setup-status.ts`. One value
decides three things — whether Start is disabled, the sentence beneath it, and the
checklist — so they cannot disagree with each other.

**Truck is named before destination** in the blocked-reason sentence. A driver who has
done neither is told to confirm the truck first, because that is the step that changes
what a route *means*; a destination planned against unverified dimensions is the
failure this pilot exists to avoid.

**Destination is a status row, not a form.** Searching happens on the map at the top of
the parked screen, where it already lived and where it should stay. Row 5 reports
whether a destination has been chosen; it does not offer a second way to choose one.

**Start Route is the last step of a named sequence**, which is why it is no longer
called just "Start". Two other buttons in this flow begin with that word — "Start
navigation" on the route briefing and "Start with full clocks" in the clock editor —
so anything matching Start by prefix will eventually tap the wrong one. The test
harnesses match by exact alternatives for the same reason.

---

## 2. Storage schemas

Three records, three keys, three parsers. They fail **independently** by construction:
a damaged clock record costs the clocks and nothing else — not the verified truck, not
a trip in progress.

All three go through `src/components/navigator/versioned-storage.ts`, which is the
**only** module in the Navigator that touches browser storage. It never throws; every
failure returns `{ok: false}` and the caller falls back to its own default.

### 2.1 Driver name — `tlws-navigator-driver-v1`

```json
{ "v": 1, "firstName": "Shawn" }
```

- **Store:** `localStorage`
- **Module:** `src/components/navigator/driver-storage.ts`
- **Written by:** saving a name in the driver row
- **Cleared by:** "Clear name" in the same row
- **Validation:** `normalizeFirstName()` on the way **in and out**. The value reaches a
  speech synthesiser, so a hand-edited record must not be able to put arbitrary text
  into a driver's ear. A record that fails the check yields *no name*, not a repaired
  one.
- **Failure mode:** absent, corrupt or unreadable → no greeting. Nothing else changes.

### 2.2 Truck profile — `tlws-navigator-truck-v1`

```json
{
  "v": 1,
  "profile": { "heightFt": 13.5, "widthFt": 8.5, "lengthFt": 70, "grossLb": 80000, "axles": 5, "hazmat": "none", "avoid": [] },
  "confirmed": "<routing fingerprint string>"
}
```

- **Store:** `localStorage`
- **Module:** `src/components/navigator/truck-storage.ts`
- **Confirmation is a fingerprint, not a boolean.** The stored `confirmed` value is
  honoured **only** when it still equals `routingFingerprint(profile)`. Change a
  routing-critical value — height, width, length, weight, axles, hazmat, avoidances —
  and the fingerprint no longer matches, the confirmation lapses, and Start is gated
  again until the driver re-confirms. Change a **display unit** and it does not: the
  fingerprint is built from the parameters that go on the wire, and miles-vs-kilometres
  never reaches the wire.
- **Route invalidation:** the same fingerprint change discards any route already
  calculated. A route planned for a 13′6″ truck is not a route for a 14′0″ truck.
- **Failure mode:** corrupt → no truck, so the editor opens with app defaults and the
  driver must confirm them. It never silently confirms a profile nobody verified.

### 2.3 HOS clocks — `tlws-navigator-clocks-v1`

```json
{
  "v": 1,
  "entered": { "drivingMin": 305, "windowMin": 470, "untilBreakMin": 185, "cycleMin": 1325, "cycleRule": "70/8" },
  "enteredAtMs": 1754000000000,
  "fromFreshShift": false
}
```

All four minute values are **remaining**, matching what a driver reads off an ELD.

- **Store:** `localStorage`
- **Module:** `src/components/navigator/clocks-storage.ts`
- **Re-validated on read.** A stored clock that is out of range for the rule it claims,
  or internally impossible, is **discarded — not clamped into something plausible**.
  Example of impossible: 120 minutes of driving left means 540 used, which cannot fit
  inside the 370 minutes of window implied by 470 remaining. The fourteen-hour window
  does not pause.
- **`fromFreshShift`** records *how* full clocks were arrived at, so the screen can tell
  "I confirmed a fresh shift" from "I happened to type 11:00". They are different
  claims.
- **Failure mode — the important one:** anything unreadable returns **unset**, never a
  fresh driver. Every other storage failure in this app degrades to a sensible default;
  this one degrades to *silence*, because the sensible-looking default here is a
  specific false claim about a driver's legal standing.

### 2.4 Trip snapshot — `tlws-navigator-trip-v1` (unchanged, listed for contrast)

- **Store:** `sessionStorage`, deliberately. The trip is about **one drive** and should
  not outlive the tab. The three records above are about the **driver** and should.

### 2.5 Migration

One migration exists. A driver who used the pilot before this milestone has a truck
profile in `sessionStorage` under the same key. `readTruck()` checks `localStorage`
first, then that legacy `sessionStorage` record, promoting it on the way past. It runs
once and is invisible. There is no migration for the name (it did not persist before)
or the clocks (they did not exist before).

### 2.6 What may never be stored

No position, no position history, no searched address, no destination, no route, no
provider credential. The records above hold a first name, truck dimensions, and four
integers of clock time. That list is enforced by test, not by habit.

---

## 3. The driver's name never leaves the device

Say this plainly when asked, because it is the question drivers ask.

The name is used for **one** thing: the spoken greeting. It is not an account, not an
identity, not a login. It is never included in a route request, a destination search, a
problem report, a road-test report, a log line, or analytics. This is enforced by
`scripts/test-navigator-driver-name.ts`, which reads every module that could carry a
value toward a wire — both ports, the search and routing request builders, the two
report modules, the pilot log, the trip-restore module and the HERE parameter mapper —
and fails if any of them so much as mentions it.

### 3.1 Shared-device warning

**A saved name is visible to the next person who opens Navigator on that phone or
tablet.**

The name now survives the tab, the reload and the night. That is the point — a driver
who opens Navigator every morning should not retype their own name every morning — but
it means a shared cab tablet, a spare phone, or a demo device will greet the next
person by the previous person's name.

Operationally:

- On a **personal** phone, nothing to do.
- On a **shared** device, tell drivers to use "Clear name" at the end of a shift, or to
  leave the name blank. A blank name produces no greeting at all and stores no record —
  the app does not invent a personalised line for an anonymous driver.
- For a **fleet demo**, clear the name between demonstrations, the same way you would
  clear the truck profile.

The row says so on screen: *"Saved on this device only, and used only for your
Navigator greeting. Never sent anywhere."* That sentence is one constant used by both
the entry form and the settled view, so the two cannot describe it differently.

---

## 4. The clocks: what the app claims, and what it does not

### 4.1 The ELD is the record

`ELD is authoritative.` appears **beside the clock editor and beside the driving clock
display** — both the compact strip and the detailed card. It is short on purpose: a
driver glancing at a clock mid-shift should be able to read the whole disclaimer
without stopping.

The longer form travels with the entered values: *"Driver-entered planning estimate —
not an ELD record. Your certified ELD remains the record."*

Navigator does not read an ELD, does not write to one, and does not reconcile with one.
It has no HOS engine of its own beyond the one the Trip Planner already shipped, and
this milestone did not add a second one, a new FMCSA rule, an exemption, or a legal
interpretation.

### 4.2 "Clocks not set" is the default, and it is not a bug

A first-time driver, a returning driver with an empty store, and a driver whose clock
record was damaged all see the same thing: **Clocks not set**, with the explanation
*"Navigator does not know what you have already driven today. Enter your remaining
hours to get clock warnings, or leave this blank and use your ELD."*

Navigation still works. Start Route is **not** gated on the clocks. What the driver
gives up is stated where the blank is: *"HOS guidance is unavailable until you enter
your clocks. Navigation still works."*

### 4.3 Full clocks require an explicit, confirmed choice

"Start with full clocks" is a **separate action behind a confirmation**, never a
preselected option and never a default. The confirmation reads: *"Start with full
clocks? Only do this if you are actually beginning a fresh shift after a full reset."*

Replacing clocks already entered also asks first, because the previous values are not
kept.

### 4.4 The cycle limitation — read this before answering a driver's question

**The cycle balance is exact. The recap schedule is not derivable from it, and the app
does not attempt one.**

A driver's ELD shows a single number: hours remaining in the 60/7 or 70/8 cycle. That
number does not reveal **which** hours will recap on **which** upcoming day. Two
drivers with 22 hours remaining can have completely different recap schedules depending
on how their previous days were worked.

The shipped HOS engine models the cycle as a per-day history (`onDutyByDayMin[]`).
Converting a single remaining balance into that array requires inventing a distribution
across days. An earlier attempt in this milestone did exactly that, and the engine's own
validator rejected the result. It was removed.

What ships instead:

- The entered balance is preserved **losslessly** — enter 22:05, read back 22:05, and it
  round-trips through the engine unchanged. This is swept over thousands of values by
  `scripts/test-navigator-hos-clocks.ts`.
- The cycle is labelled, everywhere it appears, as
  **`Cycle remaining — recap schedule not calculated.`** The caveat is part of the
  label, not a footnote elsewhere, because a driver reading "22 h left" beside a date
  would reasonably plan around that date.
- **No future recap date and no projected recap hours are ever displayed.** No Navigator
  surface imports the recap projection or the HOS exception modules; that is pinned
  structurally by test, so it cannot be reintroduced quietly.

If a driver asks "when do my hours come back?" — the answer is their ELD. Navigator
does not know.

### 4.5 Canada

**Canadian HOS is not calculated in this pilot.** When the region is set to Canada, the
clock editor is replaced by that statement rather than shown with US numbers in it, and
the driving strip carries the same notice instead of clocks:

> Canadian HOS is not calculated in this pilot. Use your certified ELD as the record.

The setup checklist marks the clocks row **unsupported**, not "not yet entered", so a
Canadian driver is never nagged to complete a step the app will not honour. Navigation,
truck routing, search and metric display all work in Canada; only the clock calculation
is withheld.

The US limits the engine does implement — 11 h driving, 14 h window, 30-minute break
after 8 h driving, 10 h reset, 60/7 and 70/8 cycles — are federal property-carrying
limits and are taken from the engine's own constants rather than restated in the setup
code.

---

## 5. Route invalidation after a truck edit

Editing the truck through "Edit Truck" and changing anything routing-critical:

1. clears the confirmation (the fingerprint no longer matches),
2. discards any route already calculated,
3. re-gates Start Route until the driver confirms the new numbers.

Changing only the display units (miles ⇄ kilometres, pounds ⇄ kilograms) does **none**
of those things. The routing fingerprint is built from the parameters that reach the
provider, which are metric on the wire regardless of what the driver reads.

---

## 6. Phone test — the procedure that found this work

Run on a real phone, not a desktop window narrowed to phone width. The reference
viewport is **390 × 844** (iPhone 12/13/14 class).

1. Open the Navigator pilot and enter the pilot password.
2. **Driver:** type a first name, save it. Confirm the greeting line shows it.
3. Reload the page. The name must still be there.
4. Change it, then clear it. Clearing must leave the truck and clocks alone.
5. **Region:** leave US, or switch to Canada and back. Units must follow; the truck
   confirmation must **not** lapse.
6. **Truck:** confirm the default profile. Reload — it must come back **Confirmed**,
   shown as a compact summary with an "Edit truck" button, not as the full editor.
7. Edit the height. Confirmation must lapse and Start must go back to disabled.
8. **Clocks:** confirm the default reads "Clocks not set". Enter real remaining hours
   from the ELD. Reload — they must come back exactly, not rounded, and not full.
9. Tap "Start with full clocks" and read the confirmation before accepting it.
10. **Destination:** search on the map and choose a result.
11. **Start Route** should now be enabled. Tap it **five times rapidly** — this must
    produce **one** GPS watch and **one** route request, not five.
12. Drive or simulate: leave the route, let it reroute, then stop. The clocks must be
    the ones entered at every stage, and must survive the stop.
13. With the on-screen keyboard **open**, confirm every control in the setup list is
    still reachable by scrolling. The keyboard covers roughly the bottom third of a
    390-px-wide phone.

Steps 2–13 are covered by automated harnesses; step 13 and the 390 px layout are the
ones that need a real device, because a keyboard-shrunk viewport is not something a
test renderer can produce honestly.

---

## 7. Automated coverage

| Harness | What it proves |
| --- | --- |
| `test-navigator-hos-clocks` | The remaining ⇄ engine conversion, swept over thousands of values; cycle balance is lossless; no Navigator surface imports recap projection. |
| `test-navigator-clock-storage` | Save, reload, edit, corrupt and hostile storage — a returning driver reads UNSET, and a damaged clock record leaves truck, trip and name intact. |
| `test-navigator-clock-lifecycle` | The real tree, driven: clocks survive planning, navigating, going off route, rerouting, stopping and a full remount. |
| `test-navigator-driver-name` | Blank/save/reload/edit/clear, eleven corrupt records, and the name's absence from every module that could carry it to a wire. |
| `test-navigator-setup-order` | The visible order, pinned **by position**; the Start gate; saved-truck restoration; route invalidation; single-instance HOS wiring. |
| `test-navigator-startup` | One Start tap → one GPS watch → one route request, including five rapid taps. |
| `test-navigator-canada` | Canadian search, cross-border detection, metric display, and the "not calculated" HOS statement. |
| `test-navigator-purity` | The pure core stays clock-free and I/O-free at any depth. |

---

## 8. Known limitations carried forward

1. **No ELD integration.** Clocks are typed by the driver. Nothing verifies them.
2. **No recap projection.** See §4.4. This is a deliberate refusal, not a gap to fill
   later without a data source that supports it.
3. **No Canadian HOS calculation.** See §4.5.
4. **Shared devices leak a first name** to the next user until cleared. See §3.1.
5. **Clocks do not advance while the app is closed.** They are entered as of a moment
   and tick while the screen is open. A driver who enters clocks, closes the app for
   three hours and returns will see values that are three hours optimistic. The ELD
   remains the record; re-entering the clocks is the fix.
6. **`navigator-viewports.mjs` is stale** and fails identically on `main`. It was
   verified against a built worktree at the pre-milestone commit and is not a
   regression from this work. It is deliberately left unrepaired here.

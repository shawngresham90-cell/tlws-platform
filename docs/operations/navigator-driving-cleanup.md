# Navigator — driving-screen cleanup

**Date:** 2026-08-14
**Scope:** the live-navigation surface and the bench that measures it. Two reported
defects, one bench repair, and two further defects the repaired bench found.
**Audience:** whoever runs the pilot, decides whether the screen is safe to hand a
driver, and has to know what is still open.

This milestone follows PR #315 (pre-trip setup) and PR #316 (driving-screen
declutter). It changes no routing provider, no route geometry, no heading
calculation, no dependency, no credential and no Netlify setting.

---

## 0. What was asked, and what was actually wrong

Three items were raised:

1. Keep the truck marker visible above the bottom trip strip on short portrait and
   landscape phones.
2. Prevent driving controls from scrolling the guidance screen out of position.
3. Repair `scripts/bench/navigator-viewports.mjs` so it tests the current flow.

Item 1 was real and is fixed. Item 2 turned out to be **two separate things**: the
scrolling described in the #316 notes was a measurement artifact of my own making,
and the behaviour drivers actually hit had a different, worse cause. Item 3 was a
stale bench, and repairing it immediately surfaced a fourth defect nobody had
measured before.

Everything below is measured in Chromium against production builds — `main` at
`50736f0` for the before column, this branch for the after column — at the eight
phone sizes the milestone names, plus an in-session rotation of each.

---

## 1. The truck marker sat inside the cockpit band

### Root cause — three of them, all the same shape

The camera reserves space at the bottom of the screen so the followed truck is
parked above the overlays rather than under them. The reserve is measured in the
browser and handed to MapLibre as camera padding. It was being computed and then
lost, three different ways:

1. **The observer watched the wrong box.** A `ResizeObserver` on the trip strip
   alone fires on *size*, not position. The HOS strip appearing, collapsing, or
   growing an urgent band moved the trip strip without resizing it, so the reserve
   never re-reported.
2. **The camera threw the new number away.** The follow effect returned early
   unless the position or the bearing had moved. A changed inset was computed on
   every re-render and discarded, so the camera kept the inset the startup ease had
   applied — zero.
3. **The measurement inflated when the shell scrolled.** `innerHeight - rect.top`
   is only the band's share of the screen while the surface starts at the top of
   the viewport. The drive shell is a scrollable `fixed inset-0` element; with it
   scrolled, a 182 px band measured 426 px, and the camera lifted the truck to 17 %
   of the screen with no road ahead of it.

### The fix

- The trip strip, the HOS region and the control row now live inside **one wrapper**
  (`data-bottom-band`), and that wrapper is what is observed. A child changing
  height *is* a height change of the observed element. Off the driving screen the
  wrapper is `display: contents`, so the parked page's spacing is untouched.
- The follow effect tracks the applied inset in a ref and re-eases when it changes,
  and only when it changes — so a resize storm that re-reports the same number
  causes no camera movement at all.
- The band is measured **against the surface**, not the viewport: the band and the
  surface move together, so the distance between them does not care where the shell
  is scrolled to.
- Recomputation is driven by the wrapper's `ResizeObserver` *and* by `resize`,
  `orientationchange`, and `visualViewport` `resize`/`scroll`, because a viewport
  that changes underneath a band whose size stayed the same is not a resize of the
  band.
- The clearance constant was centre-clearance for a 36 px marker — six real pixels
  of gap. It is now the marker's half-height plus a gap
  (`FOLLOW_MARKER_HALF_PX + FOLLOW_MARKER_GAP_PX`), so the number means the gap
  under the marker's **lower edge**.

No pixel offsets were added for particular screen sizes, and nothing hides the trip
strip.

### Measured result

Clearance is the gap between the marker's **lower edge** and the top of the cockpit
band. Negative means the marker is inside the band. Each cell is `clearance /
fraction of screen height`.

| Viewport | `main`, after start | branch, after start | `main`, **after rotating** | branch, **after rotating** |
| --- | --- | --- | --- | --- |
| 320 × 568 | +14 px / 0.500 | **+27 px** / 0.477 | **−33 px** / 0.500 | **+26 px** / 0.316 |
| 360 × 640 | +14 px / 0.603 | **+28 px** / 0.581 | **−102 px** / 0.683 | **+26 px** / 0.328 |
| 375 × 667 | +13 px / 0.619 | **+27 px** / 0.598 | **−119 px** / 0.712 | **+26 px** / 0.325 |
| 390 × 844 | +8 px / 0.704 | **+27 px** / 0.681 | **−204 px** / 0.941 | **+26 px** / 0.351 |
| 412 × 915 | +27 px / 0.703 | **+33 px** / 0.696 | **−206 px** / 0.949 | **+26 px** / 0.386 |
| 430 × 932 | +30 px / 0.703 | **+27 px** / 0.706 | **−201 px** / 0.940 | **+26 px** / 0.412 |
| 844 × 390 landscape | +19 px / 0.369 | **+33 px** / 0.333 | +231 px / 0.440 | **+26 px** / 0.682 |
| 932 × 430 landscape | +7 px / 0.456 | **+27 px** / 0.409 | +238 px / 0.480 | **+26 px** / 0.707 |

**The rotation column is the defect.** Immediately after Start, `main` is merely
tight — 7 to 30 px, which on a 36 px marker means the gap under it is roughly a
finger's width and sometimes less. Rotate the phone, which is what a driver does
when they mount it, and the reserve never reaches the camera: on `main` the marker
ends up **204 px inside the cockpit band, 94 % of the way down the screen**, with no
road ahead of it at all. On this branch the same rotation leaves 26 px of clearance
on all eight.

The `main` column is derived by the same bench from the surface's own bottom-group
children, because `main` has no single band wrapper to measure; the branch column
reads the wrapper directly. Both measure the same edge, and the bench records which
path it used.

**One honest consequence.** Clearing the band and staying in the lower half of the
screen are not always both possible. At 320 × 568 the band is 245 px of a 568 px
screen; after rotating to 568 × 320 the truck sits at 0.316 — the upper third —
because that is where "above the band" is. Clearance wins, because a marker inside
the cockpit band shows the driver no road at all. The bench records the fraction on
every run so this stays visible rather than becoming a surprise.

---

## 2. Driving controls, and what was really happening

### The claim in the #316 notes was wrong, and this corrects it

Item 2 of that document said tapping a control scrolls the drive shell up to 382 px
out of view. **It does not.** That figure came from Playwright's `.click()`, which
calls CDP `scrollIntoViewIfNeeded` before dispatching the tap. Measured at
390 × 844 on `main`:

| How the control was activated | Guidance screen moved |
| --- | --- |
| `element.focus({preventScroll: true})` | 0 px |
| `element.focus()` | 0 px |
| `element.click()` (and again after 300 ms) | 0 px |
| a real touch tap at the control's centre | 0 px |
| **Playwright `locator.click()`** | **382 px** |

Only the test harness scrolled. Nothing in the product does. The declutter
document's §6 item 2 has been amended to say so.

### What drivers were actually hitting

The site's mobile bottom bar — `MobileToolBar`, `fixed inset-x-0 bottom-0 z-50
sm:hidden` — is mounted after `{children}` in the root layout. The driving shell was
`fixed inset-0 z-50`. At equal z-index, later-in-DOM wins, so **the toolbar painted
over the driving screen's entire control row**.

Measured on `main` at 390 × 844 during live guidance, `elementFromPoint` at the
centre of **Stop** returned the toolbar's *HOS* link. The same was true of Route
overview, Clocks and Voice, on every portrait phone from 320 px to 430 px. The two
landscape shapes were unaffected, because `sm:hidden` removes the bar at 640 px and
wider — which is exactly the split the bench recorded.

A driver reaching for **Stop** got a page about hours of service. Returning to
`/drive` restores the trip, so the symptom reads as "the guidance screen moved" —
which is how it was reported — while nothing had scrolled at all.

The repaired bench, run against `main`, is unambiguous about the consequence: on
**every** portrait phone the first real tap navigated the browser off the driving
screen, and all eight subsequent control taps recorded *not rendered* — there was no
driving screen left to tap.

### The fix

The guidance shell is `z-[60]`. That is ownership, not suppression: the toolbar is
untouched, still `z-50`, still `sm:hidden`, and still owns `bottom-0` everywhere
else on the site — including the **parked** `/drive` page, where the body's `pb-16`
reserves its band and a parked driver may well want Parking or Trip Planner. While
guidance is live the surface is a full-screen takeover and nothing may sit on it.

Nothing calls `scrollTo(0, 0)`. No focus behaviour changed, no keyboard
accessibility was removed, and no scrolling was disabled anywhere — the parked setup
still scrolls, and the bench asserts it does on every run.

### Measured result — real gestures, not harness clicks

| Viewport | controls reachable, `main` | controls reachable, branch | max screen movement per tap |
| --- | --- | --- | --- |
| 320 × 568 | 0 of 8 | **8 of 8** | 0 px |
| 360 × 640 | 0 of 8 | **8 of 8** | 0 px |
| 375 × 667 | 0 of 8 | **8 of 8** | 0 px |
| 390 × 844 | 0 of 8 | **8 of 8** | 0 px |
| 412 × 915 | 0 of 8 | **8 of 8** | 0 px |
| 430 × 932 | 0 of 8 | **8 of 8** | 0 px |
| 844 × 390 landscape | 8 of 8 | **8 of 8** | 0 px |
| 932 × 430 landscape | 8 of 8 | **8 of 8** | 0 px |

The eight taps are Clocks (hide), Clocks (show), Voice, Zoom in, Zoom out, Route
overview, Recenter and Stop, in that order, each one a real touch tap at the
control's own centre with no actionability pass. Movement is the largest of four
numbers: `window.scrollY`, the shell's `scrollTop`, the largest `scrollTop` of any
element on the page, and the guidance surface's own viewport-relative top. The
budget is one pixel of rounding; every measurement came back exactly zero.

---

## 3. A third defect the repaired bench found: zoom-out was unreachable

The map's zoom and recenter column was anchored `absolute right-3 top-1/2` — centred
on the **whole surface**. The cockpit band is the bottom fifth of that surface, so
on a short screen the lower half of the column was underneath it. Measured during
guidance on `main`:

| Viewport | column spans | band starts at | zoom-out reachable |
| --- | --- | --- | --- |
| 320 × 568 | 216 – 352 px | 316 px | **no** |
| 844 × 390 | 127 – 263 px | 181 px | **no** |
| 932 × 430 | 147 – 283 px | 221 px | **no** |
| 360 × 640 and taller | below the band | — | yes |

The column is now bounded by the same measured reserve the camera uses — `top:
0.5rem`, `bottom: calc(<reserve>px + 0.5rem)`, contents centred — so the control
column and the followed truck are placed from **one** measurement of the real
overlay rather than two guesses. At zero reserve (the parked map, which has no band)
the container is the whole map and the behaviour is identical to before.

After the change, zoom-in and zoom-out are reachable on all eight viewports in both
the expanded and collapsed HOS states, and on every rotation.

---

## 4. The repaired bench

`scripts/bench/navigator-viewports.mjs` had been failing for three milestones
against locators the product no longer has:

| Stale locator | Why it stopped existing |
| --- | --- |
| `Enable location` | the parked pilot page stopped showing a separate location button when Start took over the permission prompt (#305) |
| `Plan validated truck route` | two taps became one; there is no separate plan step |
| `Start navigation` | renamed to `Start Route` by the pre-trip setup milestone (#315) |

It also imported Playwright by absolute path and spent 34 seconds parking a truck
that the current flow never asks to be parked.

**The product was not broken — the bench was.** Every one of those failures was a
stale accessible name.

### What it drives now

The real pre-trip sequence, in the order the parked screen shows it, through the
real component tree against a production build:

1. **Driver name** (optional) — typed and saved; the checklist is read back.
2. **Region and units** — defaults asserted, the units control exercised and
   returned to miles.
3. **Confirm truck** (required) — the confirm control is tapped. Nothing is seeded
   into storage to skip it.
4. **Clocks** (optional) — entered through the editor in the main scenario and left
   blank in a second one.
5. **Choose a destination** (required) — typed into the search box, chosen from the
   result card by its full accessible name.
6. **Start Route.**

The Start gate is asserted, not bypassed: Start Route is checked as genuinely
`disabled` before the truck is confirmed, with the exact sentence the pure core owns
(`Confirm your truck first`), then `disabled` again with `Choose a destination.`
until a destination is picked. `Start Route` and `Start with full clocks` are
asserted to be **two distinct controls**, matched by exact name — a `/^Start/`
locator would match both, and confirming a fresh shift for a driver five hours in is
not a bench error anyone would notice.

Clock entry is read back as entered: the HOS card must show `5:05` and must **not**
show `11:00`. The unset scenario asserts the exact sentence a blank clock costs —
`HOS guidance is unavailable until you enter your clocks. Navigation still works.` —
and that Start Route still opens.

### What it measures

Per viewport, in the expanded HOS state, the collapsed state, and after an in-session
rotation with no reload: horizontal overflow; whether the 100 dvh surface overflows
itself; the map filling the viewport and the share of it left unobstructed (sampled
point by point, never read off the container's box); the maneuver card on screen,
unclipped, and above the 16 px drive-mode type floor; the truck marker's clearance,
screen fraction, and route visible ahead; every driving control's size, position and
whether it is genuinely on top; and the zero-scroll audit described in §2.

Keyboard reachability is checked by taking 260 px of viewport away while the search
field has focus — Chromium does not emulate a soft keyboard, and that is what a
keyboard actually does to a page — and requiring Start Route to still be reachable.

### Provider calls and credentials

Both first-party Navigator endpoints are intercepted and fulfilled locally, so no
run spends money or depends on a third party. Every request the page makes is logged
with credential-shaped query parameters, the pilot password and the driver's name
replaced by `<redacted>`. Anything leaving the local server that is not an
OpenStreetMap basemap tile fails the run.

**Exactly one route request per successful start**, on every run. Search requests: 1.
Position watches opened: 1. Third-party requests other than basemap tiles: 0.

The driver's name is searched for in every request URL and body and appears in none
— the privacy law from #315, asserted rather than assumed.

---

## 5. Totals

### The before/after run

| Run | Checks | Failures | Known-open notes |
| --- | --- | --- | --- |
| `navigator-viewports.mjs` against this branch | 619 | **0** | 11 |
| `navigator-viewports.mjs` against `main` (`50736f0`) | 617 | **204** | 13 |

The 204 failures on `main` are the four defects above plus their knock-on effects:
once the first control tap navigates the browser off the driving screen, everything
measured after it is absent.

### Every Navigator browser bench, against this branch

| Bench | Result |
| --- | --- |
| `navigator-viewports` | 619 checks, 0 failed, 11 notes |
| `navigator-declutter` | 150 checks, 0 failed, 3 notes |
| `navigator-heading-up` | 264 checks, 0 failed |
| `navigator-canada` | 287 checks, 0 failed |
| `navigator-truck-profile` | 105 checks, 0 failed |
| `navigator-pretrip-setup` | 40 checks, 0 failed |
| `navigator-fullmap` | pass |
| `navigator-startup` | pass (map tiles 100 % of the container at 390 × 844) |
| `navigator-trip-restore` | pass (route calls 1 → 1 across a reload) |
| `navigator-half-map` | pass |

The declutter bench's three notes are the same geometric limit as §7 item 3: on
320 × 568, 844 × 390 and 932 × 430 the band's top edge is high enough that the
marker cannot be both below mid-screen and clear of the band. That check now asserts
where the geometry allows it and records the number where it does not — decided from
the measured band and the camera's own constants, not from a list of viewports that
happened to fail.

### Offline validation

| Check | Result |
| --- | --- |
| `node scripts/run-tests.mjs` | **178 harnesses, all passed** |
| `tsc --noEmit` | clean |
| `next lint` | no warnings or errors |
| `prettier --check .` | clean |
| `git diff --check` | clean |
| `next build` | succeeded |

---

## 6. Phone test — five minutes

On a real phone, on the preview build:

1. Open `/drive` and enter the pilot password. **Portrait.**
2. Leave the driver name blank. Confirm the truck. Leave the clocks unset. Search a
   destination and pick it. Tap **Start Route**.
3. Once guidance is live, **look at the bottom of the screen**: you should see the
   Route overview / Clocks / Voice / Stop row, and *not* the site's
   PARKING / TRIP PLANNER / HOS bar. If you can see that bar, this fix is not on the
   build you are testing.
4. **Tap Stop.** It must stop the trip. If it opens the HOS page, the fix is not on
   the build.
5. Start again. Tap **Clocks**, **Voice**, **+**, **−** in turn. The screen must not
   move a pixel under your finger, and every tap must do what the button says.
6. Find the truck marker. There must be visible road **above** it and clear space
   **below** it before the Speed / Remaining / Arrive strip starts.
7. Tap **Clocks** to hide them. The marker must stay clear, and the map must gain
   space.
8. **Rotate to landscape** without stopping the trip. Repeat steps 5 and 6. Rotate
   back.
9. Stop the trip. The parked screen must scroll normally, and the site's bottom bar
   must be back.

---

## 7. Honest remaining limitations

1. **The two shortest landscape rotations do not fit.** At 568 × 320 (a 320 × 568
   phone on its side) the guidance surface overflows itself by **26 px** and the
   control row is below the fold; at 640 × 360 the overflow is **3 px**. A 97 px
   maneuver card, a trip strip, an HOS strip and a 64 px control row do not fit in
   320 px of height at any placement, and closing that gap means redesigning the
   screen rather than cleaning it up. Both are pre-existing — the same numbers
   measure on `main` — and the bench records them with their exact values as
   known-open notes, never as passes. Neither 568 × 320 nor 640 × 360 is one of the
   eight sizes this milestone names.
2. **The Clocks control does nothing while the clocks are unset.** The HOS strip's
   unset state is two lines — `Clocks not set` and the ELD line — and it returns
   them before consulting the visibility setting, so hiding changes nothing on
   screen (measured: 56.0 % map → 56.0 %, HOS 70 px → 70 px). The control is not
   wrong, it is inert, and a control that appears to do nothing is worth removing in
   that state. Not changed here: it is a behaviour change beyond a cleanup, and the
   bench records it as a known-open note on every run.
3. **On the shortest screens the truck sits just above mid-screen** rather than in
   the lower half — see §1. Clearing the band and staying below the middle cannot
   both be true at 320 × 568.
4. **`setupStatus.clocksWarning` is computed and never rendered.** The sentence a
   driver actually reads comes from the HOS strip's unset card, which says the same
   thing. Harmless, but it is dead output and should either be used or removed.
5. **The zoom column can still overlap the band at 844 × 390 when Recenter is
   showing.** Three 64 px buttons need 208 px; that viewport has 165 px of map above
   the band. Two buttons — the normal guidance state — fit with room to spare.
6. **The next-maneuver pin can sit behind the trip strip.** Visible in
   `after-844x390-normal-expanded.png`: the truck marker is clear, but the blue ↱
   pin marking the upcoming turn is partly behind the Speed / Remaining / Arrive
   row. It is a map pin at a geographic point, not a followed marker, so the camera
   reserve does not govern it. Pre-existing, and out of scope here — the milestone
   is about the truck marker — but it is on the screenshot and should be named
   rather than left for someone to spot.

---

## 8. Screenshots

Captured by the bench against production builds. `cleanup-evidence/`:

| File | What it shows |
| --- | --- |
| `before-390x844-toolbar-covering-controls.png` | `main`: the site's PARKING / TRIP PLANNER / HOS bar drawn over the driving control row — the four driving buttons are a sliver above it and unreachable |
| `after-390x844-normal-expanded.png` | the control row clear and reachable, truck 27 px above the band |
| `after-390x844-normal-rotated.png` | the same live session rotated to 844 × 390 without a reload |
| `after-320x568-normal-expanded.png` | the 320 px floor, clocks shown |
| `after-844x390-normal-expanded.png` | short landscape — zoom controls now above the band |
| `after-932x430-normal-expanded.png` | the wider landscape shape |
| `after-390x844-clocks-unset-expanded.png` | Start Route taken with the clocks left blank |

---

## 9. Files changed

| File | Why |
| --- | --- |
| `src/components/navigator/DrivingScreen.tsx` | one observed bottom band; scroll-invariant measurement; viewport and visual-viewport listeners; guidance shell raised to `z-[60]` |
| `src/components/navigator/NavigationMap.tsx` | camera re-eases when the reserve changes; the zoom/recenter column is bounded by that same reserve |
| `src/lib/navigator/heading.ts` | clearance is the marker's lower edge, not its centre |
| `scripts/bench/navigator-viewports.mjs` | repaired to the current flow; real-gesture scroll audit; redacted provider ledger |
| `scripts/bench/navigator-declutter.mjs` | measures the band as one rect; truck clearance promoted from note to assertion; the lower-half check asserts only where the band's own geometry allows it |
| `scripts/test-navigator-heading.ts` | honest clamp pins in place of a false one |
| `scripts/test-navigator-maplibre.ts` | pins the control column to the measured reserve |
| `scripts/test-navigator-network-degraded.ts` | pins the toolbar layering argument in three parts |
| `scripts/test-navigator-hos-compact.ts` | formatting-independent LockGate pin |
| `docs/operations/navigator-driving-declutter.md` | §6 item 2 corrected |

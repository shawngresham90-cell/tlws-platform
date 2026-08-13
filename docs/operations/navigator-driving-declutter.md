# Navigator — driving-screen declutter

**Date:** 2026-08-13
**Scope:** the live-navigation surface only — the maneuver card, the HOS strip and
the control row. The parked pre-trip setup shipped in PR #315 is untouched.
**Audience:** whoever runs the pilot, answers a driver's question about the clocks
button, and decides what the screen is allowed to claim.

---

## 0. Why the screen was decluttered

Road-test feedback from real drivers, in their words: the live screen feels too
cluttered, the HOS strip takes too much permanent space, they want the option to
hide it, the top turn card is too big, and they like the turn information but want
to see more of the map.

They were right, and the numbers say so. Measured on `main` before anything was
changed, at eight phone sizes, sampling the map point by point rather than reading
the container's dimensions:

| Viewport | Maneuver card | HOS strip | Unobstructed map |
| --- | --- | --- | --- |
| 320 × 568 | 134 px | 71 px | 28.5 % |
| 360 × 640 | 162 px | 71 px | 34.8 % |
| 375 × 667 | 164 px | 71 px | 37.9 % |
| 390 × 844 | 167 px | 72 px | 50.8 % |
| 412 × 915 | 168 px | 74 px | 54.3 % |
| 430 × 932 | 168 px | 75 px | 57.0 % |
| 844 × 390 landscape | 138 px | 70 px | 29.9 % |
| 932 × 430 landscape | 138 px | 70 px | 37.1 % |

On a 375 × 667 phone the driver was getting **38 % map**. The followed truck marker
was covered by an overlay on **four of the eight** viewports.

**The map container was never the problem.** It has been `absolute inset-0` since
#304 — it is already 100 % of the viewport, and any report quoting that number
would have said "100 %" before and after while changing nothing a driver sees. What
matters is the part *not covered by an overlay*, and that is what is measured here
and everywhere below.

---

## 1. The compact maneuver card

The card used to stack four rows — arrow + distance, instruction, road name,
following turn — so its height was their **sum**. It is now two columns, so its
height is the **max** of the two:

```
┌─────────────────────────────────────────┐
│  ↱      Turn right onto Old Mill Road   │
│ In 0.4  on Old Mill Road                │
│  mi     then Arrive at the gate         │
└─────────────────────────────────────────┘
```

Nothing the road test asked to keep was dropped to get there. All four pieces are
still on the card:

| Kept | Where |
| --- | --- |
| Turn/maneuver arrow | left rail, top |
| Live distance | left rail, below the arrow — still the largest numeral |
| Maneuver instruction | right column, largest prose, clamped to two lines |
| Street / exit name | right column, truncated |

The following turn ("then …") is the only thing that yields, and only under 700 px
of viewport height. It is the one item the road test did not name.

### Hierarchy

Blueprint law 5 — numerals are the biggest thing on screen — is about **ordering**,
not about 60 px. The driving card's distance now reads a new design token,
`--size-maneuver-compact` (30 px), instead of `--size-maneuver` (60 px). The parked
and briefing surfaces keep the full token; they are not competing with a map for
room. The ordering is unchanged and still enforced by test: distance > instruction >
road name, and nothing else on the surface reaches either.

Nothing on the card is under the project's 16 px drive-mode floor. The first draft
used 14 px for the road name and the design harness caught it.

### Safety properties preserved

- Left/right correspondence with the heading-up map: the arrow still comes from the
  provider's structured `action`/`direction` pair through the existing whitelist,
  never parsed out of prose.
- Unit formatting is unchanged in both US and Canadian modes — the same
  `formatDistance` call, so under a fifth of a mile it still switches to feet.
- Spoken guidance is untouched. The instruction remains the card's only live region.
- Long names clamp and truncate; a missing road name omits the line rather than
  rendering an empty one.
- Safe-area insets, the 28 dvh cap and `overflow-hidden` are all unchanged.
- No Fullscreen API, no new permission, no change to the route engine, voice engine,
  maneuver logic or map renderer.

---

## 2. The collapsible HOS strip

### The control

A **Clocks** button in the existing bottom control row, beside Overview, Voice and
Stop. 64 px tall — the Navigator's glove floor, well past the 48 px this milestone
requires. Its accessible name is the full sentence, `Hide clocks` or `Show clocks`,
and `aria-pressed` states which way it is set. Never a bare chevron.

**Why that row and not under the strip.** Under the strip was the obvious place and
the wrong one: a full-width button there took the expanded HOS area from 71 px to
**139 px**, and at 320 × 568 the unobstructed map fell from 28.5 % to **25 %** — a
milestone about giving space back to the map making the expanded state worse in
order to improve the collapsed one. The bench caught it. In a row that already
exists it costs nothing in either state, and there is exactly one of it.

### What hiding does, and does not do

Hiding is a **presentation change and nothing else**.

- The `HosStrip` stays **mounted** in every state. The collapse is a prop, never a
  conditional mount — `{visible ? <HosStrip/> : null}` would restart the clocks on
  every tap, and no amount of careful state handling inside the component would
  save it. This is pinned by test.
- The clock state, the sixty-second advance, the trip-restore application and the
  persistence callback all keep running.
- The **voice announcer sits above the presentation branch**, so a hidden strip
  keeps speaking. Also pinned by test, by source position.
- Navigation start, reroute, stop, reload and collapse/expand all leave the clocks
  alone.

Proven behaviourally, not asserted: hide the strip, drive twenty minutes, show it
again — drive time reads **4:45**, not the 5:05 it was hidden at.

### The one thing hiding may not hide

A clock at **URGENT** or already **OVER** is not decoration. The presentation
function has three states, not two:

| Driver's choice | Clocks | What is drawn |
| --- | --- | --- |
| Shown | anything | the compact four-clock strip |
| Hidden | all calm | nothing — just the Clocks button in the control row |
| Hidden | any URGENT or OVER | a compact warning band: the words, the red severity edge, and the ELD line |

The warning is deliberately **not** the strip. It is a moment, not a settings
change, and it must not become a second permanent panel. Measured at 55 px against
the strip's 72 px.

The driver's preference is remembered through all of it. The override is about the
moment; nothing is silently rewritten on their behalf.

### ELD authority

`ELD is authoritative.` is shown wherever HOS values or an HOS warning are shown —
inside the compact strip's own disclaimer line when expanded, and inside the warning
band when hidden. Never omitted because a panel is closed.

### The cycle-recap prohibition is unchanged

No recap date and no projected recap hours are displayed anywhere, in any visibility
state. No Navigator surface imports the recap-projection or HOS-exception modules,
and that is pinned structurally across `DrivingScreen`, `HosStrip`,
`HosCompactStrip` and `hos-visibility`. **This refusal is load-bearing and was not
weakened, removed or worked around by this milestone.**

### Canada

Canadian mode is unchanged: the region states that Canadian HOS is not calculated
and offers no clock editor. It is also offered **no Clocks toggle** — there are no
clocks to hide, and a button that hid an honesty notice would be the wrong control
entirely.

### Clocks never entered

If no clocks were entered, none are fabricated. The strip shows "Clocks not set" and
the toggle behaves the same way; hiding still hides nothing that was invented.

---

## 3. The saved visibility preference

### Schema — `tlws-navigator-hos-visible-v1`

```json
{ "v": 1, "visibility": "hidden" }
```

- **Store:** `localStorage`, matching the other three driver records — the milestone
  asks for the choice to survive reload *and future visits*, which `sessionStorage`
  cannot do.
- **Module:** `src/components/navigator/hos-visibility-storage.ts`, through the same
  single `versioned-storage` envelope as the name, truck and clocks.
- **Contents, exhaustively:** one of two string literals. Not a clock value, not a
  name, not a position, not a timestamp that could act as one.

### First-use default: **shown**

Documented reasoning, not a preference. At the reference 390 × 844 phone the
expanded strip costs about 8 % of the viewport, and a driver who has never seen it
cannot know it exists to ask for it. Defaulting to hidden would make the app's only
hours display an easter egg. The road-test complaint was that the strip was too
*permanent*, not that it was unwanted — so the default is visible, with an obvious
way out, and the choice is remembered from the first time it is made.

### Failure behaviour

Every failure — no storage, no record, bad JSON, wrong version, a word this build
does not know — lands on the default. That is safe **here** in a way it deliberately
is not for the clocks: showing a driver their clocks when they asked for them hidden
is a small annoyance, while showing a driver clocks they never entered would be a
false claim about their legal standing. Different records, different fallbacks.

Nothing throws into the render path, and a damaged preference costs the preference
and nothing else.

### It never leaves the device

The preference is not sent to HERE, to search, to routing, to analytics or to any
outside service. Enforced by test against every module that could carry a value
toward a wire, plus a scan of the storage module itself.

---

## 4. Before and after

Both columns produced by the same bench, `scripts/bench/navigator-declutter.mjs`,
against production builds of `main` and this branch. Map percentage is the share of
the viewport **not covered by an overlay**, sampled at 2,800 points per frame.

| Viewport | Card before | Card after | HOS before | HOS after | HOS collapsed | Map before | Map after (shown) | Map after (hidden) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 320 × 568 | 134 px | **97 px** (−28 %) | 71 px | 71 px | **0 px** | 28.5 % | 35.2 % | **44.9 %** |
| 360 × 640 | 162 px | **97 px** (−40 %) | 71 px | 71 px | **0 px** | 34.8 % | 45.7 % | **56.5 %** |
| 375 × 667 | 164 px | **97 px** (−41 %) | 71 px | 71 px | **0 px** | 37.9 % | 47.4 % | **58.3 %** |
| 390 × 844 | 167 px | **94 px** (−44 %) | 72 px | 72 px | **0 px** | 50.8 % | 58.9 % | **67.1 %** |
| 412 × 915 | 168 px | **94 px** (−44 %) | 74 px | 74 px | **0 px** | 54.3 % | 61.0 % | **69.2 %** |
| 430 × 932 | 168 px | **94 px** (−44 %) | 75 px | 75 px | **0 px** | 57.0 % | 62.4 % | **70.5 %** |
| 844 × 390 landscape | 138 px | **114 px** (−17 %) | 70 px | 73 px | **0 px** | 29.9 % | 31.9 % | **49.4 %** |
| 932 × 430 landscape | 138 px | **114 px** (−17 %) | 70 px | 73 px | **0 px** | 37.1 % | 39.4 % | **55.9 %** |
| 390 × 844 · long exit name | 167 px | **94 px** (−44 %) | 72 px | 72 px | **0 px** | 50.8 % | 58.9 % | **67.1 %** |
| 390 × 844 · urgent clock | 167 px | **94 px** (−44 %) | 72 px | 72 px | **55 px** | 50.8 % | 58.9 % | **63.0 %** |

Three things to read out of that table:

- **The card alone pays for itself.** Every viewport gains map with the clocks still
  shown — 37.9 % → 47.4 % at 375 × 667 — because the card is the only thing that
  changed in that state.
- **The expanded HOS costs exactly what it always did**, 71–75 px. The toggle lives
  in a row that already existed, so the option costs nothing to the driver who never
  uses it. (The +3 px in landscape is the strip's own short-viewport padding rule,
  not the toggle.)
- **Hiding is worth about 9–18 points of map.** The largest gains are in landscape,
  where the screen is shortest and the strip cost the most.

A driver on a 375 × 667 phone who hides the clocks goes from **37.9 % map to
58.3 %** — the screen they asked for.

---

## 5. Phone test — five minutes

Run on a real phone, not a narrowed desktop window. Reference viewport 390 × 844.

1. Open the pilot, complete setup, and start a route.
2. Look at the top card. Arrow, distance, instruction and road name should all be
   there, in about half the height they used to take.
3. Watch the distance count down as you approach the turn. Under 0.2 mi it should
   switch to feet.
4. Tap **Clocks** in the bottom row. The HOS strip disappears; the map grows.
5. Tap **Clocks** again. The strip returns — and the numbers must have *moved*, not
   reset to what they were when you hid them.
6. Reload the page. Your choice is remembered.
7. Drive until a clock goes urgent with the strip hidden. A red warning band must
   appear over the map with the words and `ELD is authoritative.`, and voice must
   still speak.
8. Rotate to landscape. Everything above still holds.
9. Confirm Overview, Voice, Stop and Clocks are all reachable with a gloved thumb.

---

## 6. Honest remaining limitations

1. **The truck marker is still covered by the trip strip on the three shortest
   viewports** — 320 × 568, 844 × 390 and 932 × 430. This predates the milestone: on
   `main` the marker was covered on four of eight viewports. Collapsing the clocks
   **fixes 360 × 640 and 375 × 667 outright**, and the remaining cover is the
   Speed / Remaining / Arrive strip, which this milestone was not asked to change
   and did not touch. The bench measures and reports it as a known-open note; it is
   never counted as a pass.
2. **Tapping any control during guidance scrolls the drive shell.** The shell is a
   `fixed inset-0 overflow-y-auto` element, so focusing a button scrolls the
   guidance surface up to 382 px out of view while `window.scrollY` stays 0. This is
   pre-existing — tapping **Voice** does it on `main` — and was traced while
   diagnosing a bench artifact it caused. Not fixed here; a driver who scrolls back
   to the top gets the guidance surface back. Worth its own small milestone.
3. **`scripts/bench/navigator-viewports.mjs` remains stale** on `main` and is
   deliberately left unrepaired, as instructed. It is not counted as proof.
4. The HOS strip cannot be hidden on the **parked** screen. That surface is not
   competing with a map for room, and the setup flow needs the clock row visible.

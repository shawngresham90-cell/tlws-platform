# Navigator Pilot — Accessibility Audit

Audited against the code on 2026-08-10 at `main` = `b6a1260`.

**What this audit can and cannot establish.** Structure — labels, roles,
live regions, focus, target sizes, whether information is carried by text
rather than by colour — is readable from the source and is asserted by
test. **Behaviour is not.** Whether two audio channels actually collide,
how a specific screen reader queues a polite region, and whether a target
is comfortable at arm's length in daylight are device questions. Where the
evidence stops, this document says so rather than guessing, and names the
test that would settle it.

---

## Summary

| Surface | Verdict |
|---|---|
| Password screen | **Pass**, with one note |
| Driver name entry | **Pass** — and its unusual choice is correct |
| Destination search | **Pass** |
| Truck panel | **Pass** |
| Route plausibility (`RouteCheck`) | ⚠ **One open question — device testing required** |
| Map, recenter, zoom | **Pass** |
| Mute / voice controls | **Pass** |
| Start navigation | **Pass** |
| Report a problem | **Pass** |
| Post-trip feedback | **Pass** |
| Crash boundary | **Pass** (added separately) |

**No change is proposed by this audit.** The one open question has strong
structural evidence and weak behavioural evidence, and the brief is explicit
that a change on weak evidence is not worth making.

---

## ⚠ The open question: `RouteCheck` and the route-start phrase

### What is structurally true

At the moment the lifecycle reaches `route-ready`, two things happen:

1. `RouteCheck` renders `<div role="status">` containing *"Worth a look
   before you start"* and the plausibility findings — **but only when there
   is at least one finding.**
2. The app speaks the personalized route-start phrase through
   `speechSynthesis`: *"Here's your route, [name]. Now let's get it!"*

`role="status"` carries an **implicit `aria-live="polite"`**. So on a route
with a plausibility finding, a screen-reader user with voice guidance
enabled has two independent audio sources addressing them at the same
instant: the screen reader announcing the findings, and the page speaking
through the synthesis API.

Both go to the same output. Neither knows the other exists.

### What is NOT established

Whether they audibly collide, and how badly.

- Screen readers queue their own polite announcements. They do **not**
  coordinate with a page's `speechSynthesis` calls.
- Behaviour differs by platform. iOS VoiceOver, Android TalkBack and desktop
  readers each handle a page speaking over them differently — some duck,
  some interleave, some talk straight through.
- The collision only occurs when a finding exists. A clean route produces
  no `RouteCheck` at all and therefore no collision.

**None of that is knowable from source.** It needs a phone, a screen reader,
and a route with a plausibility finding.

### Why nothing was changed

Three candidate fixes, and the reason each was left alone:

| Candidate | Why not |
|---|---|
| Drop `role="status"` from `RouteCheck` | Removes the announcement entirely for a screen-reader user. That is a **loss of safety-relevant information** to fix a problem that has not been confirmed to exist. |
| Delay the route-start phrase | Changes voice timing on the surface PR #272 is actively fixing, on speculation. |
| Lower the route-start phrase's priority | It is already `passive` — the lowest tier there is. There is nothing below it. |

**Device test required, and it is small.** Plan a route that trips a
plausibility finding, turn on a screen reader, enable voice, and listen once
at `route-ready`. If the two collide, the cheapest honest fix is to suppress
the courtesy phrase when a finding is present — a finding is worth hearing
and *"now let's get it"* is not. **Do not make that change without hearing
it happen first.**

---

## Live regions — the count, and a gap in how it is measured

The driving surface budgets polite live regions so the ones that exist stay
worth hearing. The existing test caps `aria-live="polite"` in
`DrivingScreen.tsx` at three.

**That count is lower than the true number, because `role="status"` implies
`aria-live="polite"` without writing it.** Regions that carry status
semantics, by file:

| File | Regions |
|---|---|
| `DrivingScreen.tsx` | 5 |
| `NavigatorStatus.tsx` | 4 |
| `HosWarningLine.tsx` | 3 |
| `PilotTripControls.tsx` | 3 |
| `MotionLockOverlay.tsx` | 2 |
| `DestinationSearch.tsx` · `LockGate.tsx` · `VoiceControls.tsx` · `PostTripFeedback.tsx` · `DriverNameEntry.tsx` | 1 each |

Not all of these are mounted at once — `MotionLockOverlay`, `LockGate` and
`PostTripFeedback` are state-specific — so this is not "twenty regions
shouting". But it is more than three on the driving surface, and the budget
test does not see the implicit ones.

**Recorded as an observation, not fixed here.** Tightening the budget test
to count `role="status"` as well would change what a merge-blocking gate
measures, and it belongs in a change that can also decide what to do about
whatever it then finds. Two things are worth knowing when that happens:

- `HosWarningLine` deliberately escalates to `aria-live="assertive"` for a
  critical warning. That is correct and must survive any tightening.
- `role="status"` on a **button's result message** (the copy-confirmation in
  `PilotTripControls`, the mute state in `VoiceControls`) is the right
  pattern and is not chatter — it fires on a deliberate user action, not on
  a tick.

---

## Surface by surface

### Password screen

- Real `<label htmlFor>` bound to the input; `autoComplete="current-password"`.
- Error uses `role="alert"`, so it is announced immediately rather than
  waiting for focus.
- The error text describes nothing about the expected value — an
  accessibility win and a security one at the same time.
- **Note:** `autoFocus` on the password field moves focus on load. It is
  defensible on a single-purpose screen with one input, and it is worth
  knowing that a screen-reader user may hear the field before the heading.

### Driver name entry

Its unusual choice is the right one and worth recording so nobody
"fixes" it:

- The validation message is wired through **`aria-describedby` +
  `aria-invalid`, with focus returned to the field** — not through a live
  region.
- **There is deliberately no `aria-live` here.** On this screen the audio
  channel belongs to spoken guidance. A chatty live region on a text field
  would compete with the thing the driver actually needs to hear.
- Real `<label htmlFor>`, real `<form>`, 64px targets.

### Destination search

- Labelled input with a descriptive `aria-label` naming what can be
  searched — address, business, truck stop, city.
- Status line is `aria-live="polite"` + `role="status"`: correct, since
  results arrive asynchronously.
- The results list carries `aria-label="Destination search results"`, so a
  screen reader announces what the list is rather than reading it as
  anonymous items.

### Truck panel and route plausibility

- Plain semantic content, readable at a glance.
- `RouteCheck` — see the open question above.
- Findings are a list, each with its own message. Not colour-coded alone.

### Map, recenter, zoom

- The map container is `role="region"` with an `aria-label` describing what
  it shows.
- Every control has an explicit `aria-label`: *"Recenter the map on your
  truck"*, *"Zoom in"*, *"Zoom out"*.
- The truck marker itself is `aria-hidden` in the artwork with a `title` of
  "Your truck" on the marker — decorative SVG, meaningful container.
- **Not established:** whether the map is usable by keyboard alone. It is a
  Leaflet surface on a driving screen where the interaction model is
  touch-and-glance. Worth a decision rather than an assumption.

### Voice controls

- Mute is a real `<button>` with `aria-pressed`, so state is exposed rather
  than implied.
- State is carried **in the words and in `aria-pressed`, never in colour
  alone.**
- The confirmation line is `role="status"` — fires on a deliberate tap.

### Report a problem and post-trip feedback

- Both render inside the stationary gate, so they are unreachable while
  moving. That is a safety feature that happens to be an accessibility one:
  nothing demands attention at speed.
- Copy confirmation is `role="status"`.
- The report text area carries `aria-label="Problem report"` — it is a
  read-only region a screen-reader user can navigate into.

---

## What must be tested on a device

None of these are answerable from source. All are small.

| # | Test | Settles |
|---|---|---|
| 1 | Screen reader on, voice on, plan a route with a plausibility finding | **The open question above.** Do the two audio channels collide? |
| 2 | Screen reader on through a full trip | Whether the live-region count is heard as informative or as chatter |
| 3 | Every control at 200% text size | Whether the 64px targets and the layout survive |
| 4 | The driving screen in direct sunlight | Contrast in the condition it is actually used in — a lab ratio is not the same claim |
| 5 | Keyboard-only pass over the map | Whether recenter and zoom are reachable without touch |
| 6 | The crash boundary with a screen reader | Whether "Navigation has stopped" is the first thing heard |

Record the results in this file. An untested row is not a pass.

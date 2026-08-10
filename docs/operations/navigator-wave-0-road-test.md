# Wave 0 — Owner Road Test Checklist

**Who runs this:** the owner, alone, in the truck. Nobody else drives
Navigator until every line below has a mark against it.

**How to mark:** `PASS` · `FAIL` · `NOT TESTED` · `BLOCKED` (something
upstream stopped you getting to it). Every line starts as `NOT TESTED`.
Nothing on this page is pre-marked, and nothing may be marked from a fixture
— **an offline test passing is not a road test passing.**

**A `FAIL` on any line marked 🛑 is a P0.** Stop the drive, write down what
happened and the build sha, and read the stop policy.

**Do every interaction that involves the screen from a stop.** The motion
lock exists because typing while moving is the thing that gets people killed;
do not defeat your own safety feature to test it.

---

## Before you start

| | Item | Mark |
|---|---|---|
| 0.1 | Build sha recorded from the on-screen build strip: `________` | |
| 0.2 | Date/time recorded, and roughly what the weather is doing | |
| 0.3 | Phone model and browser recorded | |
| 0.4 | Phone charged, or on a charger — this drains a battery | |
| 0.5 | A second navigation source available (paper, another device, your own knowledge) | |

---

## 1. Access

| | Item | Mark |
|---|---|---|
| 1.1 | Homepage loads and the Navigator tile is visible | |
| 1.2 | Tapping the tile leads to the pilot password screen | |
| 1.3 | The correct password is accepted | |
| 1.4 | A wrong password is refused, and the refusal does not say *why* it was wrong | |
| 1.5 | 🛑 Typing `/drive` directly, in a private window with no cookie, does **not** reach the driving screen | |
| 1.6 | 🛑 Same for `/navigator` | |
| 1.7 | After unlocking, you land on the driving screen rather than somewhere else | |

## 2. Driver session

| | Item | Mark |
|---|---|---|
| 2.1 | The first-name field is offered while stationary | |
| 2.2 | Entering a name is accepted; a 60+ character name is refused rather than truncated silently | |
| 2.3 | The greeting is spoken once, and uses the right part of the day for **your local time** | |
| 2.4 | The greeting does not repeat on later screens in the same session | |
| 2.5 | 🛑 The greeting never speaks over a maneuver or an HOS warning | |

## 3. Destination

| | Item | Mark |
|---|---|---|
| 3.1 | Address search finds a real address you know | |
| 3.2 | Search finds a business by name (a truck stop, a warehouse) | |
| 3.3 | Results are readable at a glance and distinguishable from each other | |
| 3.4 | Selecting a result sets the destination you actually meant | |
| 3.5 | 🛑 The destination shown matches the one you selected — not a nearby one | |

## 4. Truck profile

| | Item | Mark |
|---|---|---|
| 4.1 | The truck panel is reachable and readable while stopped | |
| 4.2 | The configured dimensions shown are the ones you expect for your combination | |
| 4.3 | The truck routing disclosures are legible and you understand what they claim | |
| 4.4 | 🛑 Nothing on the panel claims a guarantee of legal routing | |

## 5. Route

| | Item | Mark |
|---|---|---|
| 5.1 | An initial route plans within a reasonable wait | |
| 5.2 | The route drawn is one you'd consider driving | |
| 5.3 | Distance and time are plausible for the trip | |
| 5.4 | The plausibility advisory appears when it should, and reads as an advisory rather than an approval | |
| 5.5 | 🛑 No screen anywhere promises the route is legal for your truck | |

## 6. Map

| | Item | Mark |
|---|---|---|
| 6.1 | The TL vehicle marker is the icon shown | |
| 6.2 | 🛑 The marker sits **on the roadway you are driving**, not beside it | |
| 6.3 | The marker points the way you are going | |
| 6.4 | The map follows the truck without being asked | |
| 6.5 | Panning the map away, then tapping recenter, returns to the truck | |
| 6.6 | Follow resumes after a recenter rather than staying manual | |
| 6.7 | 🛑 When GPS accuracy degrades, the screen says so — it does not keep drawing a confident position | |

## 7. Voice

| | Item | Mark |
|---|---|---|
| 7.1 | Voice is enabled from a stop, and the confirmation is heard | |
| 7.2 | The personalized greeting is heard | |
| 7.3 | "Here's your route, *[name]*. Now let's get it!" is spoken **once**, after the first route | |
| 7.4 | It does **not** repeat after a reroute later in the trip | |
| 7.5 | Ordinary maneuver announcements arrive early enough to plan for, not react to | |
| 7.6 | 🛑 An HOS warning is not spoken over by anything else | |
| 7.7 | Mute silences voice; unmute restores it | |
| 7.8 | Muting does not silence the on-screen guidance too | |
| 7.9 | Voice survives the screen locking and unlocking | |

## 8. Missed turn and reroute — **PR #272, on `main` since 2026-08-10, road retest NOT PERFORMED**

> These lines test the fixes in PR #272, which is **merged but unverified
> on the road**. Run this section against a `main` build containing #272 —
> `1ee4932` or later, read off the build strip — and record that sha. Until
> this section passes, Wave 1 is NO GO.

| | Item | Mark |
|---|---|---|
| 8.1 | 🛑 Miss a turn deliberately, somewhere safe. Navigator says **"You're off route. Rerouting."** — once | |
| 8.2 | 🛑 The missed turn **disappears** from the card and the voice. It does not keep repeating a turn you have passed | |
| 8.3 | 🛑 A replacement route arrives, and it is **actionable** — a turn you can actually take from where you are | |
| 8.4 | 🛑 The replacement does **not** imply a U-turn, a turnaround, or reversing direction | |
| 8.5 | 🛑 The replacement keeps you moving **forward** — it does not send you back the way you came | |
| 8.6 | Navigator does not sit in "Rerouting…" indefinitely | |
| 8.7 | If no replacement is possible, it says so honestly rather than staying silent | |
| 8.8 | 🛑 The marker stays on the roadway throughout the off-route and recovery | |

## 9. Failures

| | Item | Mark |
|---|---|---|
| 9.1 | Turn the phone to airplane mode mid-trip. The screen says what is wrong | |
| 9.2 | 🛑 It does **not** invent a route or pretend everything is fine | |
| 9.3 | The existing route stays on screen and usable where safe | |
| 9.4 | Restoring the network recovers without a reload | |
| 9.5 | If the routing provider fails, the message distinguishes "provider is down" from "no such place" | |
| 9.6 | Nothing in any error message shows a URL, a key, or an internal error | |

## 10. Arrival

| | Item | Mark |
|---|---|---|
| 10.1 | Arrival is announced and the screen changes state | |
| 10.2 | The arrival point is where you actually needed to be | |
| 10.3 | Post-trip feedback is offered and can be completed from a stop | |
| 10.4 | A problem report can be generated, and it copies | |
| 10.5 | 🛑 The report contains **no coordinates**, no key, no token, no password | |
| 10.6 | The report names the build sha | |
| 10.7 | The diagnostic snapshot can be produced and read | |

## 11. Session

| | Item | Mark |
|---|---|---|
| 11.1 | Start a second trip in the same session. It plans and guides normally | |
| 11.2 | Reload the page. The first name is **gone** — by design, it is session-only | |
| 11.3 | Re-entering the name works and greets correctly | |
| 11.4 | After the pilot session expires, re-entering the password restores access | |
| 11.5 | Expiry mid-trip is survivable and the screen explains itself | |

---

## Scoring

| | |
|---|---|
| Total lines | 63 |
| 🛑 P0 lines | 20 |
| PASS | |
| FAIL | |
| NOT TESTED | |
| BLOCKED | |

**Wave 0 is complete when:** every line has a mark, every 🛑 line is `PASS`,
and every `FAIL` has been written up with a build sha.

**Wave 0 is NOT complete because some lines were "obviously fine."** An
unmarked line is `NOT TESTED`, and `NOT TESTED` on a 🛑 line blocks Wave 1
exactly like a `FAIL` does.

---

## Current status — 2026-08-10

**NOT STARTED.** No line on this checklist has been marked by anyone.

Section 8 can now be run against `main`: PR #272 merged on 2026-08-10 at
`1ee4932`. Run it against a build at that sha or later, confirmed off the
build strip — a production build deployed from before the merge does not
contain the fixes this section tests.

# Navigator Incident Playbook

**Fourteen things that can go wrong, and what to do about each one.**

Written for the owner, on a phone, while something is happening. Each entry
answers the same seven questions in the same order, so you never have to hunt:

> **Severity** · **Tell the driver** · **Pilot posture** · **Collect** ·
> **Keep using Navigator?** · **Engineering triage** · **Resume when**

**Posture** is CONTINUE / PAUSE EXPANSION / STOP, and it maps to the ids in
the pilot stop policy — **STOP here is the policy's STOP IMMEDIATELY**
(`stop-immediately`), shortened only because it is read on a phone. When an
entry names a stop-policy condition, that condition's own owner actions and
resume criterion apply too.

**Two rules that override everything below.** First: if you are not sure how
bad it is, treat it as worse. Second: the driver's safety instruction is
always the first thing you send, before you understand anything.

---

## Quick triage

| What the driver says | Go to |
|---|---|
| "It tried to send me somewhere a truck can't go" | 1, 3 |
| "It wanted me to turn around" | 2 |
| "It told me to go the wrong way" | 4 |
| "It said rerouting and never did anything" | 5 |
| "The truck is in the wrong place on the map" | 6 |
| "It stopped talking" / "it talks too much" | 7 |
| "It didn't warn me about my hours" | 8 |
| "It froze" / "it reloaded itself" | 9 |
| "It can't find a route at all" | 10, 11 |
| "It won't let me in" / "it logged me out" | 12, 13 |
| Anything about a password, a key, or someone else getting in | 14 |

---

## 1 · Unsafe route

*Navigator routed the truck somewhere a truck must not be — a low bridge, a
posted weight limit, a no-commercial road.*

**Severity** P0 — `prohibited-roadway-directed` or
`clearance-weight-width-contradiction`

**Tell the driver** *Stop using Navigator for guidance. Finish this trip on
your own knowledge or another device. Do not attempt the restricted road.*

**Pilot posture** **STOP.** Every driver, immediately.

**Collect** The road and the direction of travel. The posted restriction —
photograph it if you can do so safely from a stop. The build sha. The truck
dimensions shown in the truck panel at the time. Whether the route was the
original one or a replacement.

**Keep using Navigator?** No.

**Engineering triage** Was the profile carried on the request that produced
it? A route computed without the dimensions is a different bug from a route
computed with them. Reproduce offline before touching anything.

**Resume when** The case reproduces in a fixture, fails on the shipped build,
passes on the fix, and the owner has re-driven the corridor.

---

## 2 · Implicit or unverified turnaround

*The route — usually a replacement after going off route — required reversing
direction, with no verified place to do it.*

**Severity** P0 — `unsafe-turnaround-implied`

**Tell the driver** *Do not turn around. Keep going the way you are pointed,
pull over somewhere you know is safe, and stop using Navigator for guidance.*

**Pilot posture** **STOP.**

**Collect** The road, the direction of travel, and what the app said —
exactly, if the driver can remember the wording. Whether an off-route message
had been given first. A screenshot of the maneuver card if one survives.

**Keep using Navigator?** No.

**Engineering triage** This is the defect PR #272 exists to fix. **#272
merged to `main` on 2026-08-10 but is not road-verified**, and a production
build deployed from before the merge has no reversal check on a replacement
route at all — check the build sha in the report against `1ee4932` before
assuming the guard was even present. Either way, a report of this is a hard
stop.

**Resume when** the owner road retest of #272's fixes passes and a fixture
reproduces the specific geometry.

---

## 3 · Truck restriction concern

*The driver is not certain the route was illegal, but it looked wrong for a
truck — a residential street, a tight industrial turn, a road with no truck
traffic on it.*

**Severity** P1, unless the driver can point at a posted restriction — then
it is incident 1 and a P0.

**Tell the driver** *Trust your judgment over the app. If it looks wrong,
it is wrong. Take the route you would have taken.*

**Pilot posture** **PAUSE EXPANSION** while you work out which it was.

**Collect** Where, what the driver expected instead, and whether there was
anything posted. The plausibility advisory's state, if it appeared.

**Keep using Navigator?** Yes, with the instruction above.

**Engineering triage** Distinguish "the provider's answer was poor" from "our
request was missing something". The known-limitations list is the first place
to look: vehicle type, weight per axle, trailer count and tunnel category are
all absent from the request today.

**Resume** N/A — pilot continues. Expansion resumes when the case is
classified.

---

## 4 · Wrong-way guidance

*An instruction into oncoming traffic, or against a one-way or divided
roadway.*

**Severity** P0 — `wrong-way-instruction`

**Tell the driver** *Stop using Navigator now. Do not act on that
instruction.*

**Pilot posture** **STOP.**

**Collect** The intersection. The exact wording, spoken and on screen.
Whether the map marker was on the correct roadway at the time — this is the
single most useful fact, because a wrong-way instruction from a
correctly-matched position is a different defect from one produced by a
position on the wrong road.

**Keep using Navigator?** No.

**Engineering triage** Check matching first, guidance second. Wrong-way
protection exists in the matcher and the off-route detector; establish
whether it fired and was overruled, or never fired.

**Resume when** Reproduced, fixed, fixture-pinned, and re-driven.

---

## 5 · Bad rerouting

*Navigator announced rerouting and either produced nothing, produced
something unusable, or kept repeating a turn already passed.*

**Severity** P1 — `repeat-reroute-failure`. **P0 if a stale maneuver kept
being shown or spoken** (`stale-maneuver-after-reroute`), because a confident
wrong instruction is worse than silence.

**Tell the driver** *If it says rerouting and nothing comes, ignore it and
navigate yourself. Do not follow a turn instruction after you have already
passed the turn.*

**Pilot posture** PAUSE EXPANSION at 3 occurrences or 2 independent drivers.
STOP if the stale-maneuver variant is confirmed.

**Collect** How long it sat in "Rerouting". Whether a replacement ever
arrived. Whether the old turn kept repeating. The diagnostic snapshot — it
carries the reroute counters, which distinguish "budget exhausted" from
"provider failed" from "we never asked".

**Keep using Navigator?** Only for the P1 form, and only with the instruction
above.

**Engineering triage** Read the reroute counters before assuming a provider
fault. The budgets are 6 per hour and 12 per session per driver, with a
30/60/120-second failure backoff — a driver who went off route repeatedly can
exhaust them legitimately, and that looks identical to a failure from the
driver's seat.

**Resume when** Reproduced offline and the recovery path is fixture-pinned.

---

## 6 · GPS or map-position failure

*The truck is drawn on the wrong road, far off the road, frozen, or jumping.*

**Severity** P1 normally. **P0 if it was severely wrong and no degraded-accuracy
warning was shown** (`severe-gps-error-undisclosed`) — a wrong position
presented as certain is the input to every instruction that follows.

**Tell the driver** *If the map does not match where you are, stop using it
for guidance. Do not follow turn instructions while the marker is on the
wrong road.*

**Pilot posture** PAUSE EXPANSION for the ordinary form; STOP for the
undisclosed form.

**Collect** How far off and on what road. What the accuracy indicator showed.
Whether it recovered. Phone model — this one correlates with hardware more
than anything else on the list.

**Keep using Navigator?** Not while the position is wrong.

**Engineering triage** Establish whether the underlying fix was bad or the
display was. Those are different defects with different fixes, and the
snapshot's GPS health category tells you which.

**Resume when** The degradation disclosure is verified to fire for that
accuracy class.

---

## 7 · Voice failure

*Silent when it should have spoken, late, or talking constantly.*

**Severity** P0 if a maneuver that had to be announced was not, or arrived
too late to take safely (`critical-maneuver-guidance-failure`). P1 for
lateness that was merely annoying, or for chatter.

**Tell the driver** *Watch the screen for turns until we sort this out. If it
is talking too much, tell me — do not just mute it.*

**Pilot posture** STOP for the P0 form. PAUSE EXPANSION for the P1 forms.

**Collect** **The single most important question: was the phone capable of
speaking?** Voice was enabled while stopped? Silent switch off? Volume up?
Bluetooth connected to something the driver could hear? A phone that never
played the audio is a completely different incident from an app that never
produced it.

Then: the maneuver, the road speed, and how late it felt.

**Keep using Navigator?** Screen-only, for the P1 forms.

**Engineering triage** Separate "not spoken" from "not heard" before anything
else. Then check arbitration: nothing may outrank a maneuver or a critical
HOS warning.

**Resume when** The announcement path is verified on the same device class,
including the speech-unlock state that was in effect.

---

## 8 · HOS failure

*An hours-of-service warning did not appear, or was spoken over.*

**Severity** P0 — `hos-critical-warning-suppressed`

**Tell the driver** *Do not rely on Navigator for your hours. Use your ELD
and your own log.*

**Pilot posture** **STOP.**

**Collect** The clock state at the time. What else was speaking. Whether the
strip on screen was correct even though the announcement was not.

**Keep using Navigator?** No.

**Engineering triage** Voice arbitration. Nothing outranks a critical HOS
announcement; establish what did.

**Resume when** Arbitration re-verified against the specific collision.

---

## 9 · Crash or freeze

*The app stopped responding, went blank, or reloaded itself.*

**Severity** P1 for one occurrence. **P0 for more than one during an active
trip** (`repeated-navigation-freeze`) — a frozen navigation screen still
looks like navigation, and the driver keeps trusting a picture that stopped
being true.

**Tell the driver** *If the screen stops updating, assume it is wrong. Pull
over safely and reload. Tell me whether the trip survived the reload.*

**Pilot posture** PAUSE EXPANSION on the first; STOP on the second.

**Collect** Build sha. How far into the trip. Whether the screen stayed lit.
Whether a reload recovered the trip or lost it. Phone model, and whether
anything else was running.

**Keep using Navigator?** Not after a second freeze.

**Engineering triage** Long-session behaviour first — memory and timers over
hours. A freeze at 20 minutes and a freeze at 4 hours are different bugs.

**Resume when** A long-session run reproduces the conditions without a
freeze.

---

## 10 · Routing provider outage

*Routes will not plan, or reroutes will not come, and the message points at
the provider.*

**Severity** P1 — `provider-outage-confusing` if the driver could not tell
what was wrong.

**Tell the driver** *The routing service is down, not the app. Your current
route still works. You will not get a new one until it comes back.*

**Pilot posture** CONTINUE. This is expected and survivable — unless the
driver could not tell an outage from a broken app, which is the P1.

**Collect** What the screen said, and what the driver believed it meant. The
error code if it is visible. Whether the existing route stayed usable.

**Keep using Navigator?** Yes, for the route already loaded.

**Engineering triage** Confirm it is an outage and not a rate limit or a
missing key — the app distinguishes these deliberately and the message names
which. A limit is our problem; an outage is not.

**Resume** N/A.

---

## 11 · Network outage

*The phone lost signal.*

**Severity** P2 normally. P1 if the app misrepresented it.

**Tell the driver** *Your route stays on screen. The map will not load new
tiles and you will not get a new route until signal comes back. Do not expect
a reroute in a dead zone.*

**Pilot posture** CONTINUE.

**Collect** Only if the app claimed something untrue — invented a route,
showed a confident position it could not have, or said everything was fine.
That is a different and more serious incident.

**Keep using Navigator?** Yes.

**Engineering triage** None unless the app misrepresented state.

**Resume** N/A.

---

## 12 · Password or authentication failure

*A correct password refused, a wrong one admitted, or the gate behaving
inconsistently.*

**Severity** P0 — `pilot-auth-failure`

**Tell the driver** *Stop for now. I will send you a new password.*

**Pilot posture** **STOP.**

**Collect** Which direction it failed. Whether it reproduced. What the driver
typed — specifically whether autocorrect capitalised or auto-spaced it, which
is by far the most common cause of a "correct password refused".

**Keep using Navigator?** No.

**Engineering triage** Rule out the phone keyboard before the code. Then run
the access harness against the deployed sha.

**Resume when** The access harness is green on the deployed sha and the
specific direction of failure is pinned by a test.

---

## 13 · Session expiry

*The pilot session ended and the driver was bounced to the password screen.*

**Severity** P2 normally — the session is 12 hours by design. P1 if the
driver could not tell what had happened or how to get back in
(`session-expiry-confusing`).

**Tell the driver** *That is normal — the pilot password lasts 12 hours.
Enter it again. If it happened mid-trip, tell me whether the trip survived.*

**Pilot posture** CONTINUE, unless it was confusing — then PAUSE EXPANSION.

**Collect** Whether it happened mid-trip. Whether the trip survived
re-entry. What the driver thought had gone wrong.

**Keep using Navigator?** Yes, after re-entering the password.

**Engineering triage** Only if the trip did not survive, or the screen did
not explain itself.

**Resume** N/A.

---

## 14 · Privacy or security concern

*A key, the pilot password, a token or a coordinate appeared somewhere it
should not have. Or someone reached Navigator without the password.*

**Severity** P0 — `secret-exposure` or `unauthorized-navigator-access`

**Tell the driver** *Stop using Navigator. Do not share the report or the
screenshot with anyone else until I have looked at it.*

**Pilot posture** **STOP.**

**Collect** **Preserve the artifact that showed it** — the screenshot, the
report text, the URL — before anything is redeployed. Then: exactly where it
appeared, and who could have seen it.

**Keep using Navigator?** No.

**Engineering triage, in this order:**

1. **Rotate the exposed value first.** Fixing the code that emitted it does
   not un-emit it.
2. For unauthorized access: **change `NAVIGATOR_PREVIEW_PASSWORD`.** Every
   issued pilot cookie is signed with it and stops verifying.
3. Then find every *other* path that could emit the same value. One leak is
   rarely one path.

**Resume when** The value is rotated, the path is fixed, and a redaction test
pins the surface that emitted it.

---

## After any P0

Three things, none of which are optional:

1. **A written incident note**, dated, in `docs/operations/`. What the driver
   saw, what the build was, what you did, what the evidence showed, and what
   would have caught it earlier. No coordinates, no personal data.
2. **A row in the release register** for whatever state you ended up in.
3. **A regression fixture** that fails on the shipped build and passes on the
   fix. A P0 without one has not been fixed; it has been guessed at.

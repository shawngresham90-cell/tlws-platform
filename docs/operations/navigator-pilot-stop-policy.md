# Navigator Pilot Stop Policy

**This is the authoritative answer to one question: when does the pilot stop?**

Written to be read at 11 p.m. by one person, on a phone, after a driver has
just sent a photograph of something that should not have happened. It is
short on purpose.

The conditions and thresholds below are not prose — they are generated from
`src/lib/navigator/pilot-stop-policy.ts`, and
`scripts/test-navigator-stop-policy.ts` fails the build if this document and
that module ever disagree. If you change one, change the other.

---

## The three postures

| Posture | What it means | Who keeps driving |
|---|---|---|
| **CONTINUE** | Run the pilot as scoped. | Everyone currently in it. |
| **PAUSE EXPANSION** | Add **no** new drivers, open **no** new wave. | Everyone currently in it keeps driving. |
| **STOP IMMEDIATELY** | Tell every driver to stop using Navigator for guidance now and finish on their own knowledge or another device. | Nobody. |

### The rules, in order

1. **One confirmed P0 stops the pilot.** Not a rate. Not a pattern. Not two.
   A rate-based rule assumes the next occurrence is as survivable as the last
   one, and a bridge strike is not survivable.
2. **A P0 that has been *reported but not confirmed* pauses expansion.** You
   do not hand a possible strike-path defect to a second driver while you are
   still working out whether it was real.
3. **A P1 pauses expansion** when it is confirmed and either its occurrence
   threshold is met, its independent-driver threshold is met, or it is a
   judgment condition you have confirmed.
4. **Otherwise, continue** — subject to the wave gates, which are separate.

**"Confirmed" means you established it happened** — you reproduced it, saw it
first-hand, or the report carries evidence. A driver saying it happened is a
*report*, not a confirmation. That distinction is the whole load-bearing part
of this policy, and it is why nothing here is automated: an automatic stop
driven by reports would hand anyone who can file one the power to kill a
driver's navigation mid-trip, on an unconfirmed claim.

**Nothing in this repository stops the pilot on its own.** The policy module
has no flag, no fetch, no timer, and no importer in the running app. You stop
the pilot.

---

## P0 — STOP THE PILOT

The bar: *a driver acting on what Navigator said could have put a 70-foot
combination somewhere it must not be, or the pilot's access controls have
failed.* Not "the app was wrong" — "the app was wrong in a way a driver could
have followed."

| # | id | What you'd hear |
|---|---|---|
| 1 | `unsafe-turnaround-implied` | A route required the truck to reverse direction with no verified place to do it. |
| 2 | `prohibited-roadway-directed` | Directed onto a roadway commercial vehicles may not use. |
| 3 | `clearance-weight-width-contradiction` | Route conflicted with a posted clearance/weight/width the profile should have excluded. |
| 4 | `wrong-way-instruction` | Instructed a movement into oncoming traffic or against a one-way. |
| 5 | `guidance-conflicts-with-direction` | Turn guidance for a road going the other way. |
| 6 | `critical-maneuver-guidance-failure` | A maneuver was never announced, or arrived too late to take safely. |
| 7 | `repeated-navigation-freeze` | Froze or stopped updating more than once during an active trip. |
| 8 | `severe-gps-error-undisclosed` | Truck drawn on the wrong road with no degraded-accuracy warning. |
| 9 | `hos-critical-warning-suppressed` | A critical HOS warning did not appear or was spoken over. |
| 10 | `unauthorized-navigator-access` | Someone reached a Navigator surface without the pilot password. |
| 11 | `pilot-auth-failure` | Wrong password admitted, right one refused, or a session that would not expire. |
| 12 | `secret-exposure` | A key, the pilot password, or a token appeared on screen, in a report, in a URL, or in a log. |
| 13 | `corrupted-accepted-route` | A malformed route was accepted and guided on. |
| 14 | `stale-maneuver-after-reroute` | After going off route, it kept showing or speaking a maneuver from the abandoned route. |

### What you do, for every P0

The per-condition actions live in the module (each condition carries its own
`ownerActions` and `resume`). Four are common to all of them:

1. **Tell every pilot driver to stop using Navigator for guidance now.** One
   message, no explanation needed in the moment.
2. **Capture evidence before you change anything.** The build id, the driver's
   report, the diagnostic snapshot. A redeploy destroys the thing you need to
   reproduce.
3. **Do not redeploy a fix you cannot reproduce.** A P0 that cannot be
   reproduced offline has not been fixed; it has been guessed at.
4. **Do not resume on a fix alone.** Resume needs the condition's own
   `resume` criterion met — for most of them that means a fixture that fails
   on the shipped build and passes on the fix, *and* the owner re-driving it.

Three of them have an extra first move:

- `unauthorized-navigator-access` and `pilot-auth-failure` → **change
  `NAVIGATOR_PREVIEW_PASSWORD`.** Every issued pilot cookie is an HMAC keyed
  by that password, so changing it invalidates every outstanding session.
  (Verify once on your Netlify setup whether the change takes effect on the
  running functions immediately or needs a redeploy — record the answer in
  the release register. See "Unverified" in the rollback doc.)
- `secret-exposure` → **rotate the exposed value first.** Fixing the code
  that emitted it does not un-emit it.

---

## P1 — PAUSE EXPANSION

These do not stop a driver mid-trip. They stop the pilot *growing*, which is
the decision actually under pressure: every one of these is a defect a second
and third driver would hit too, and adding them converts one person's bad
evening into three.

Thresholds are **per review window** — one driver-day of pilot use, or one
owner review, whichever comes first — and per driver unless the driver
threshold says otherwise.

| id | What you'd hear | Pauses at |
|---|---|---|
| `repeat-reroute-failure` | Said it was rerouting, never produced a usable replacement. | 3 occurrences, or 2 independent drivers |
| `frequent-search-failure` | Destination search could not find real, ordinary places. | 3 occurrences, or 2 independent drivers |
| `voice-materially-late` | Announcements arrived late enough to react to rather than plan for. | 3 occurrences, or 2 independent drivers |
| `follow-recenter-breaks` | Map stopped following, or would not recenter. | 2 occurrences, or 2 independent drivers |
| `reporting-fails` | The driver could not produce or send a report. | 1 — the pilot runs on reports |
| `independent-multi-driver-defect` | Two drivers independently reported the same significant defect. | 2 independent drivers |
| `provider-outage-confusing` | During an outage the driver could not tell what was wrong. | **Your judgment** |
| `excessive-voice-chatter` | It talked so much the driver wanted to mute it. | **Your judgment** |
| `session-expiry-confusing` | Session expired and the driver could not tell what happened. | **Your judgment** |

### Why three of these have no number

Because there isn't one. "Provider outage handling was confusing" is a
verdict, not a count, and inventing a threshold for it would be arithmetic
worn as rigour. The classifier **refuses** to trigger a judgment condition
from an occurrence count — it fires only when you mark it confirmed. Where a
number would be fake, the policy says so instead of pretending.

Two of the counted thresholds are worth defending:

- **`reporting-fails` pauses at one.** Losing the reporting path does not
  lose one report; it makes the pilot unmeasurable while it continues. A
  pilot you cannot measure is not a pilot.
- **`excessive-voice-chatter` is judgment, not a count, and it is a P1 rather
  than a nuisance** because a muted Navigator cannot warn. Chatter does not
  fail loudly — it converts a safety channel into an annoyance the driver
  switches off, and then the next HOS warning goes nowhere.

---

## Using the classifier

```ts
import { classifyPilotPosture, postureSummary } from '@/lib/navigator/pilot-stop-policy';

const verdict = classifyPilotPosture([
  { conditionId: 'repeat-reroute-failure', confirmed: true, occurrences: 3 },
  { conditionId: 'unsafe-turnaround-implied', confirmed: false },
]);

postureSummary(verdict);
// "PAUSE EXPANSION — no new drivers: unsafe-turnaround-implied, repeat-reroute-failure"
```

It is deterministic and total: an unknown id is reported as unknown, never
guessed at and never silently dropped. It returns a posture and the reasoning
that produced it. It does not act.

---

## What this policy does not cover

- **P2 and below** — an incorrect but recoverable instruction, a cosmetic
  defect. These do not gate the pilot and are not modelled. They go in the
  report pile and get scheduled.
- **Deciding whether to *start*.** That is the Wave 0 and Wave 1 gates, which
  are separate documents and separate decisions. This document only answers
  what to do once drivers are already out there.
- **How to respond to a specific incident.** See the incident playbook.

---

## Current standing decision

**PR #272 has not been road-verified.** It is green, drafted, and unmerged,
and it addresses `unsafe-turnaround-implied`, `stale-maneuver-after-reroute`
and `severe-gps-error-undisclosed` — three P0 conditions on the list above,
all three found on real road tests rather than in a fixture.

Until the owner road retest passes, Wave 1 is **NO GO** regardless of what
this policy says about postures. See the Wave 1 gate.

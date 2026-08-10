# Wave 1 — First Outside Drivers

**Scope: 2–3 trusted, experienced truck drivers. Not four. Not "a few more
if it goes well."**

Wave 1 is the first time Navigator gives truck guidance to somebody who is
not the person who built it. That is the entire risk, and the size of the
wave is the only control that reliably bounds it.

---

## Current status — 2026-08-10

# 🔴 NO GO

Three entry requirements are unmet, and one of them cannot be waived:

| Blocker | State |
|---|---|
| **PR #272 owner road retest** | **NOT PERFORMED.** #272 merged to `main` on 2026-08-10 (`1ee4932`) — merging is not road verification. It fixes three P0-class conditions found on real drives — implied turnaround, stale maneuver after reroute, and a truck marker drawn off the roadway. Until the owner re-drives the Hwy 92 / Charles Hardy scenario and it passes, Wave 1 is NO GO. |
| **Wave 0 owner road test** | **NOT STARTED.** Zero of 63 lines marked. |
| **Known-good rollback target** | **CANDIDATE only.** `94fc659` passes 22 Navigator harnesses and builds, but nobody has driven it. No row in the release register is graded KNOWN-GOOD. |

The rest of this document is the gate you run once those clear.

---

## Entry requirements

Every line is a hard gate. There is no "mostly."

### Product

| | Requirement | How you know it's met |
|---|---|---|
| E1 | Wave 0 complete | Every line marked; every 🛑 line `PASS` |
| E2 | **PR #272 owner road retest PASSED** | Section 8 of Wave 0 run against a `main` build containing #272 (`1ee4932` or later), all 🛑 lines `PASS` |
| E3 | No open P0 | Stop-policy classifier returns `continue` with an empty `stopping` and empty `unconfirmedP0` |
| E4 | No unresolved safety-critical P1 | Any P1 touching guidance, rerouting, position or voice is closed, not deferred |
| E5 | Phone compatibility tested | At least one iOS Safari and one Android Chrome device have completed a full trip, including voice unlock |

### Operations

| | Requirement | How you know it's met |
|---|---|---|
| E6 | Production build recorded | Release register names the deployed sha, **and the owner has read it off the build strip** rather than inferred it |
| E7 | Known-good rollback target recorded | A register row graded KNOWN-GOOD with a date and evidence |
| E8 | Rollback drill completed as far as safely possible | Drill record exists; the owner-authorization steps are listed as such rather than skipped silently |
| E9 | A publishable Netlify deploy still exists for the rollback target | Checked in the Netlify Deploys list — retention is a Netlify setting, not a repository fact |
| E10 | Stop policy exists and the owner has read it | Not "exists in the repo" — read it |
| E11 | Incident playbook exists and the owner has read it | Same |
| E12 | The owner knows how to stop the pilot **without a computer** | Can state, from memory: send the stop message, then change the pilot password |

### Security

| | Requirement | How you know it's met |
|---|---|---|
| E13 | Access harness green on the deployed sha | `npm test navigator-pilot-access` |
| E14 | Adversarial pass green on the deployed sha | `npm test navigator-adversarial` |
| E15 | The pilot password is not the one used during development | Rotated before an outside driver ever sees it |
| E16 | Each driver gets the password directly from the owner | Not forwarded, not in a group chat that outlives the wave |

### Driver readiness

| | Requirement | How you know it's met |
|---|---|---|
| E17 | Outside-driver guide ready and sent | Each driver confirms they have read it |
| E18 | Known limitations disclosed to each driver | Specifically the ones about vehicle profile and turnarounds |
| E19 | Issue-report procedure ready | Reports go to `shawngresham90@gmail.com` — owner-selected 2026-08-10, see below |
| E20 | Each driver has confirmed they will not follow an unsafe instruction | In their own words, not a checkbox |

### Provider

| | Requirement | How you know it's met |
|---|---|---|
| E21 | Request and rate limits understood | Route API 6/hour/IP; search 30/min/IP; reroute 6/hour and 12/session per driver; HERE free tier 5,000 truck transactions/month |
| E22 | Projected wave volume fits inside the free allowance | See the provider-volume simulation |

---

## ✅ E19's owner decision — resolved 2026-08-10

**Where does a driver send a problem report?** Answered: the owner selected
**`shawngresham90@gmail.com`** on 2026-08-10.

The app still sends nothing automatically — a report is generated, copied to
the driver's clipboard, and the driver sends it to the address above. The
driver guide names it, and `test-navigator-pilot-docs` pins it: any *other*
email, phone number, chat channel or form link appearing in the guide fails
the build, so the destination can only change on the owner's word.

The destination was deliberately never guessed at while it was open —
guessing would have sent truck-route defect reports somewhere nobody was
reading. This closes the destination half of E19; whether the issue-report
procedure is actually *ready* is still checked at the gate like every other
entry, and every other blocker in this document stands unchanged.

---

## Wave 1 operating limits

| Limit | Value | Why |
|---|---|---|
| Drivers | **2–3. Hard stop.** | Below the point where you can still talk to every driver personally after every trip. Above it, you stop noticing things. |
| Expansion during the wave | **None.** A fourth driver is Wave 2 and needs the exit gate below. | |
| Trip type | Ordinary working trips the driver would drive anyway | A pilot that changes what the driver was going to do is testing the pilot, not the product |
| Second navigation source | **Required on every trip** | Navigator is the thing under test. It does not get to be the only source |
| Reporting | One report per trip minimum, even when nothing went wrong | "Nothing went wrong" is data, and it is the only way to tell a quiet week from a week nobody reported |
| Owner contact | Owner speaks to each driver after their first trip | Not a form. A conversation |
| Duration | Runs until the exit criteria are met, or until a stop condition fires | No fixed end date — a calendar deadline is a reason to overlook something |

---

## Wave 1 exit criteria — required before a fourth driver

**These are not statistical.** Two to three drivers cannot produce
statistical significance about anything, and a document claiming otherwise
would be lying to make a decision feel safer than it is. What these criteria
establish is *coverage* and *absence of known harm* — which is what a pilot
this size can honestly deliver.

| | Criterion | Threshold |
|---|---|---|
| X1 | Minimum useful driving | **At least 10 completed trips across the wave, at least 3 per driver, and at least 20 hours of guided driving in total.** Rationale: fewer than 3 trips per driver and you have not seen that driver's second-trip behaviour, which is where session and habit defects show up |
| X2 | Road variety covered | At least one of each: interstate, two-lane state route, dense urban delivery, night driving, and rain |
| X3 | Missed-turn recovery observed in the field | At least 3 real off-route events across the wave, each producing an actionable forward replacement |
| X4 | Zero unresolved P0 | Not "no P0 in the last week." Zero, resolved or never occurred |
| X5 | P1 pattern acceptable | Every P1 raised is either fixed, or explicitly accepted and written into the known-limitations document. An accepted P1 must be one the owner would be comfortable reading aloud to the next driver |
| X6 | Reports actually collected | At least one report per completed trip. If reports are missing, the wave has not produced the evidence it exists to produce, regardless of how the driving went |
| X7 | Reroute results reviewed | Every off-route event in the wave reviewed by the owner — not sampled |
| X8 | No security event | No unauthorized access, no secret exposure, no auth anomaly |
| X9 | Owner review completed | The owner has personally read every report and spoken to every driver |
| X10 | Rollback target upgraded to KNOWN-GOOD | By the end of the wave, the build the drivers used should be a genuine known-good — driven, not merely built |

**If X1 is not met, the wave is not over.** Adding a driver to reach the trip
count faster is exactly the move this gate exists to prevent.

---

## What Wave 2 is not

Wave 2 is not "the same thing with more people." Before any wave larger than
three, redo the volume simulation with the real observed per-driver call
rates from Wave 1 rather than the modelled ones, and re-read the free-tier
allowance against them. The simulation in this repository is an estimate
built from code budgets; Wave 1 is the first chance to replace it with a
measurement.

# Truck parking verification audit — 2026-07-31

**Read-only. No production data was written. No row was added, changed, published,
quarantined or deleted.**

Objective: increase the number of verified, driver-useful truck parking locations
without weakening any verification standard.

**Outcome: zero locations newly verified.** The verification step is blocked by an
environment constraint, not by the data. This document records the audit, the
blocker, and the queue that is ready to execute the moment the blocker lifts.

---

## 1. The blocker

Every authorized recovery action — verify coordinates, verify interstate, verify
exit, verify city/state, verify parking evidence — requires an authoritative
external source. **No authoritative source is reachable from this environment.**

| Source | Attempt | Result |
|---|---|---|
| Census geocoder (`geocoding.geo.census.gov`) | direct `curl` | `CONNECT tunnel failed, 403` |
| Census geocoder | `WebFetch` | HTTP 403 |
| OpenStreetMap Nominatim | `WebFetch` | HTTP 403 |
| Ohio DOT (`dot.state.oh.us`) | `WebFetch` | HTTP 403 |
| Operator's own site (`creektravelplaza.com`) | `WebFetch` | HTTP 403 |
| Wikipedia (control, to prove it is not host-specific) | `WebFetch` | HTTP 403 |

The agent proxy's own status endpoint confirms it: egress is allowed only to
package registries and Anthropic, and it logged the denial —
`connect_rejected … geocoding.geo.census.gov:443`.

`WebSearch` does work, but it returns summaries of aggregator sites (Allstays,
Roadtrippers, Yelp, Trucker Path, findtruckservice). Those rank **below** the
existing legacy data under the project's standing rule that state-DOT evidence
outranks legacy data. Promoting an aggregator snippet to "verified" would be
exactly the weakening of the standard this authorization forbids, and writing a
coordinate inferred from one would violate "never invent coordinates."

Per the standing instruction to stop immediately when evidence becomes
uncertain, no verification was recorded and no row was written.

**What is NOT the blocker:** database access (full read/write available), the
audit itself, or the state of the data. Only the evidence supply.

---

## 2. Baseline (read-only, 2026-07-31)

`locations`, `deleted_at IS NULL`, 2,830 rows.

| Metric | Value | Definition used |
|---|---|---|
| Published locations | **2,454** | `is_published` |
| Driver-useful parking | **1,856** | published ∧ `parking_spaces > 0` |
| Trip Planner pool | **1,940** | published ∧ lat ∧ lng (loader filter) |
| Trip Planner parking-eligible | **1,777** | pool ∧ `parking_spaces > 0` (`hasConfirmedTruckParking`) |
| Route-usable | **1,947** | published ∧ `interstate` ∧ `exit_number` |
| Coordinate coverage (all rows) | **1,973 / 2,830 = 69.7 %** | lat ∧ lng |
| Coordinate coverage (published) | **1,940 / 2,454 = 79.1 %** | |
| States present | 48 | |

Definitions are taken from the code, not invented for this audit:
`hasConfirmedTruckParking` (`lib/trip-planner/directory-layer.ts`) requires a
finite positive space count — the zero-space safety rule — and the planner pool
filter is the one in `lib/trip-planner/directory-loader.ts`.

### Overnight status

| Status | Rows |
|---|---|
| confirmed | 541 |
| prohibited | 0 |
| unknown / NULL | 2,289 |

---

## 3. What the audit found

### 3.1 Overnight provenance is airtight — no action needed

Of 541 `confirmed` rows: **0** lack a source, **0** lack a verified-at
timestamp, **0** lack a parking count. The M3 overnight model holds with no
exceptions. Unknown stays unknown, as designed.

### 3.2 ZIP/state consistency is clean — no action needed

Checked every row with a 5-digit ZIP against the state that dominates its
ZIP-3 prefix elsewhere in the same database (internal evidence only, no external
claim), requiring the majority verdict to itself be attested by ≥3 rows.
**0 contradictions.**

### 3.3 Coordinate plausibility — no gross errors

Flagged every coordinate more than 4° from its state's centroid. All hits were
legitimate: El Paso/Brownsville (Texas is wide), Yreka/Weed CA, Sidney MT. No
row was found in the wrong state. The heuristic detects large states, not
errors — reported here so the absence of a finding is not mistaken for an
unrun check.

### 3.4 Address-level duplication is already well controlled

205 addresses carry more than one row, but nearly all are **legitimate
co-located services**: a travel center, its scale, its tire bay and its truck
wash share one street address in four different categories. Collapsing them
would destroy real listings.

Same address **and** same category — the only true-duplicate shape — occurs
**once**, and it is already handled: two Flying J rows at 23866 Rogers Clark
Blvd, Ruther Glen VA. The `csv-import` row is unpublished; the
`pilot-master-2026-07-27` row is published. The duplicate is already
suppressed. No action.

### 3.5 FINDING — parking capacity is double-counted across co-located rows

**13 addresses repeat the identical parking count across co-located rows,
inflating stated capacity by 2,189 spaces across 16 redundant rows.**

The same physical lot is counted once per category. Example shape: one address
carries a travel-center row, a scale row and a tire-service row, each stating
250 spaces — 750 spaces where 250 exist.

This does not create a false *location*, and each individual row's count is
accurate for its own site. But any figure that sums `parking_spaces` across
rows overstates real capacity. Nothing in the current product sums them, so
there is no live driver-facing defect — this is a correctness trap for future
reporting, and the reason the headline metric in §2 counts **locations**, never
summed spaces.

Resolving it means deciding which row owns the count at a shared address. That
is a policy decision, not a data fix, so it is referred rather than executed.

### 3.6 FINDING — four coordinate collisions between distinct businesses

Four pairs share an identical coordinate while having **different street
addresses**, so at least one row in each pair is wrong:

| Coordinate | Rows sharing it |
|---|---|
| 35.29195, −84.81805 | Love's #364 (200 Lower River Rd NW) · Ponderosa Truck Stop (9227 Frontage Rd NW), TN |
| 35.54517, −84.56551 | Crazy Ed's Travel Center (547 Hwy 309) · Pilot #4598 (507 Hwy 309), TN |
| 36.37677, −84.24871 | Pilot #1577 (106 Comfort Ln) · TA Caryville (305 Howard Baker Hwy), TN |
| 36.37677, −84.24871 | the two scale rows mirroring that same pair |

These are **quarantine candidates**: provably imprecise, not provably wrong in a
specific direction. Deciding *which* row holds the bad coordinate requires the
authoritative geocoder that is unreachable, so they are flagged and left alone.
Guessing would be inventing a coordinate.

### 3.7 Coordinate provenance is largely unrecorded

**1,623 of 1,973 coordinate-bearing rows (82 %) have `coord_verification_status`
= NULL and `geocode_source` = NULL.** Only 40 rows carry
`manually_verified_at`; `verified_at` is unused across the whole table (0 rows).

Flagging this because `lib/trip-planner/directory-loader.ts` currently states in
its header comment that "every coordinate in this platform reached the database
through the human-review apply flow." The provenance columns do not evidence
that claim for 82 % of coordinates. Either the comment overstates what can be
demonstrated, or the apply flow did not stamp provenance. **I could not
determine which, and did not change the comment or the data.** Worth resolving,
because provenance is what makes a re-verification campaign auditable later.

### 3.8 Route-usability gaps

| Shape | Published rows |
|---|---|
| `interstate` set, `exit_number` NULL | 198 |
| `exit_number` set, `interstate` NULL | 26 |
| neither set | 283 |

The 26 exit-without-interstate rows are **all** `pilot-master-2026-07-27`, and
many hold surface-road references in the exit field (`FL-817`, `Service Area`,
`Third St`, `E Wyandot Rd`, `FM 3066`). Those are not interstate exits, so the
rows correctly never reach corridor browse. This is the schema being used for
non-interstate sites, not a defect to repair.

Filling the 198 missing exit numbers would require exit evidence. It cannot be
derived from a mile marker (explicitly prohibited) or inferred from geometry.
Blocked with everything else in §1.

### 3.9 Minor data-shape observations

| Observation | Rows |
|---|---|
| `exit_number` holds a mile reference (`Mile 97`, `Mile 21`) | 6 |
| `exit_number` holds two values (`50 SB/50A NB`) | 142 |
| Published with `parking_spaces = 0` | 1 |
| `interstate` not matching `I-\d+` | 0 |

The 6 mile-style values are the mirror image of the prohibited
mile-marker-from-exit derivation — here a mile reference sits in the exit field.
Noted, not touched.

---

## 4. Recoverable-row queue (ready to execute; blocked on evidence only)

**79 published rows already state a positive parking count but have no
coordinates**, so they are driver-useful yet invisible to the Trip Planner and
to Near Me. Recovering their coordinates alone would raise Trip Planner
parking-eligible rows from 1,777 toward 1,856 — a **+4.4 %** gain with no new
locations invented and no standard relaxed.

Of those 79, after applying this authorization's own exclusions:

| Bucket | Rows | Disposition |
|---|---|---|
| `cat-scales` category | 6 | **Excluded** — CAT Scale data is prohibited; stop condition |
| Love's / Pilot / Flying J / ONE9 / TA / Petro rows | 8 | **Excluded** — "do not redo completed operator work" |
| Independent operators, full street address + ZIP present | ~65 | **Eligible**, blocked only on §1 |

The eligible set concentrates exactly where the original CSV corridor import
landed:

| State | Published | Missing coords | Driver-useful but invisible |
|---|---|---|---|
| TN | 191 | 103 | 19 |
| MI | 79 | 51 | 16 |
| KY | 117 | 58 | 10 |
| AR | 115 | 74 | 9 |
| OH | 146 | 40 | 9 |
| IN | 142 | 62 | 5 |
| GA | 126 | 18 | 4 |

These carry a street address and ZIP, so they are a clean batch geocode against
an authoritative source — one query each, human-reviewable, fully traceable.
The work is ready; only the evidence supply is missing.

---

## 5. Work log

| Item | Result |
|---|---|
| Locations audited | 2,830 (every non-deleted row) |
| Newly verified | **0** — blocked, §1 |
| Rejected | 0 (no candidate reached a verification decision) |
| Quarantined | 0 written; **8 rows identified** as quarantine candidates (§3.6) |
| Duplicates removed | 0 |
| Duplicates flagged | 1 true duplicate pair, already suppressed (§3.4); 13 capacity double-counts (§3.5) |
| Corrections made | 0 |
| Evidence sources used | Production database (read-only) and repository source code only. No external source was reachable; no aggregator was accepted as evidence. |
| Production writes | **None** |

### Checks run and passed with no finding

Recorded so a future run does not repeat them: overnight provenance (§3.1),
ZIP/state consistency (§3.2), coordinate plausibility vs state centroid (§3.3),
same-address-same-category duplication (§3.4), interstate format validity
(§3.9).

---

## 6. Recommended next milestone

**Unblock the evidence supply, then run the 65-row independent-operator
coordinate recovery as a guarded batch.**

1. Allow egress to the Census geocoder
   (`geocoding.geo.census.gov`) — one host, public, no key, and already the
   calibrated source used by earlier geocoding passes on this project. That
   single change converts the entire §4 queue from blocked to executable.
2. Run the 65 eligible rows as a canary-first batch (5 rows → audit → remainder),
   one state per transaction, stamping `geocode_source` and
   `coord_verification_status` on every row written — closing the §3.7 gap for
   new work rather than repeating it.
3. Separately decide the shared-address capacity-ownership rule (§3.5) before any
   feature sums `parking_spaces`.
4. Resolve the four coordinate collisions (§3.6) in the same pass, since the
   geocoder that unblocks §4 also adjudicates them.

Deliberately **not** recommended: raising coverage by accepting aggregator data,
publishing rest areas, importing CAT data, or inferring exits from mile markers.
Each would raise the count while lowering the thing the count is supposed to
mean.

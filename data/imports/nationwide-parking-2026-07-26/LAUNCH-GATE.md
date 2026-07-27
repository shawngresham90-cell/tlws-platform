# Launch gate — public directory and trip planner

**Status: NOT READY. No gate line passes.** One line (Love's) is in progress
as of 2026-07-27 — 604 Tier-A locations are in hand, pending a completeness
confirmation. The other seven are unstarted.

This is the formal, binding coverage gate for launching the public directory
and trip planner. It supersedes any earlier informal readiness language. A
launch decision is a check against this table, not a judgement call.

---

## Total rows are not the coverage metric

The directory holds 1,556 rows. That number means nothing for launch and must
not be quoted as progress.

A driver does not ask "how many rows do you have". They ask "where can I park
on this lane tonight", and the directory answers that only if the specific
facility on their route is present, correctly classified, and **mappable**.
Coverage is therefore measured as **percentage of the real-world universe
captured, per source and per corridor** — never as a row count, never as a
count of pages, and never as growth versus a previous run.

Two of the numbers below make the point: the directory has 1,165 published
records, and 635 of them cannot be placed on a map. A row count of 1,165 would
report that as success.

---

## Required coverage gate

Every line must pass. There is no partial launch.

| # | Requirement | Threshold | Current | Pass |
|---|---|---|---|:--:|
| 1 | Authorized current Truck Parking Club feed | **100 %** | no authorized feed held | ❌ |
| 2 | Love's Travel Stops | **100 %** | **604 eligible in hand** — pending completeness confirmation | ⏳ |
| 3 | Pilot, Flying J and ONE9 | **100 %** | not sourced | ❌ |
| 4 | TA, Petro and TA Express | **100 %** | not sourced | ❌ |
| 5 | Official public rest areas, welcome centers, service plazas | **≥ 95 %** | not sourced | ❌ |
| 6 | Official weigh stations, **classified separately** | **100 %** | not sourced | ❌ |
| 7 | Route-segment coverage, major freight corridors | **≥ 95 %** | not measurable | ❌ |
| 8 | Route-segment coverage, all Interstates | **≥ 85 %** | not measurable | ❌ |

Line 2 moved on 2026-07-27: the Love's export arrived and yielded **604
Tier-A truck-parking locations across 42 states and 64 corridors** — see
`data/sources/loves-master/2026-07-27/FINDINGS.md`. It is marked ⏳ rather than
✅ because the file is named `LovesSearchResults` and there is no independent
count to prove it is the full national export rather than a filtered search.
Confirm that, and line 2 passes.

**Every threshold is measured against an authorized source of record**, not
against what the database happens to contain. A category is at 100 % only when
the count reconciles to the official export for that operator or agency.

Lines 7 and 8 are marked *not measurable* rather than 0 %: route-segment
coverage cannot be computed at all until facilities carry coordinates, because
a segment is only "covered" if a mappable facility sits on it.

### Weigh stations are not parking

Binding rule, applying to line 6 and to every future import:

> A weigh station, inspection station, scale complex, check station or port of
> entry **must not be counted as truck parking, surfaced on a parking page, or
> returned by a parking query** unless an authoritative source explicitly
> confirms that legal parking is permitted there.

They are captured at 100 % as their **own category** so a driver can see and
avoid them. The current reconciliation already applies this: of 43 weigh rows,
42 are quarantined as inspection-only and 1 as needing explicit confirmation.
The only two sites that crossed into parking are TDOT's former I-65 weigh
stations, which TDOT states were converted to truck parking.

`scripts/test-parking-expansion.ts` enforces this rule and fails the build if a
weigh row is ever marked publishable as parking.

---

## Current baseline — the number to beat

Measured read-only against production on 2026-07-26, `main` @ `7168b7e`. These
figures are authoritative and are preserved here deliberately, so progress is
always reported against a fixed, honest starting point.

| Measure | Value |
|---|--:|
| Published parking records | **76** |
| …of those, **mappable** (have coordinates) | **31** |
| States with any published parking | **10** |
| States with **none** | **40** |
| Published parking on **I-95** | **0** |
| Prior addressless rows fully reconciled | **216** |
| **Tier A candidates** | **0** |
| Published directory records missing coordinates | **635 of 1,165** |

**Tier A is 0 because authoritative coordinates were inaccessible** — every
state DOT GIS, ArcGIS, FHWA and USDOT endpoint is blocked at this
environment's egress proxy. It is not 0 because the standard was set too high,
and it must not be raised by inventing coordinates. See `BLOCKED-SOURCES.md`.

Reference points that follow from the same audit:

- I-80, I-90/I-94, I-10 and I-15 hold **zero** parking rows of any status.
- 54.5 % of the published directory is unmappable, worst at roadside-service
  (85 %) and cat-scales (80 %).
- 35 rows meet every Tier-A test except the coordinate; they are a work queue,
  not a tier.

**Movement since the baseline** (recorded here, not merged into the table
above — the baseline stays fixed): the Love's export of 2026-07-27 produced the
project's first Tier-A set, **604 locations across 42 states and 64 corridors**,
541 of them net-new. None is published; publication needs separate
authorization. It also exposed three **published** directory rows for Love's
locations the operator does not list — see
`data/sources/loves-master/2026-07-27/FINDINGS.md`.

---

## What the gate implies about sequencing

The gate cannot be approached by publishing what is already held. Lines 1–4 are
operator feeds the project does not have, and lines 5–6 need agency datasets
that are unreachable. **The binding constraint is source acquisition, not
engineering.**

The order that unblocks the most gate lines per file obtained is in
`SOURCE-ACQUISITION.md`. The process to run the moment a file lands is in
`INTAKE-PROCESS.md`. Neither involves writing to production without a separate,
explicit authorization.

---

## Gate review

Re-measure with `FINGERPRINT.sql` and `RECONCILE.sql` after every intake, and
update the Current column above in the same commit. The gate passes only when
all eight lines read ✅ against an authorized source of record.

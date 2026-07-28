# Launch gate — public directory and trip planner

**Status: NOT READY.** The gate's first two lines passed on 2026-07-27:
**4a and 4b — TA / Petro / TA Express — are ✅ at 348/348 and 347/347**,
reconciled to the sha-verified official master and counted by distinct
official Site ID. Every other line is still open: Love's and Pilot are
complete-and-verified acquisitions with unexecuted packages (acquisition is
not coverage), and the remaining lines need agency data unreachable from
this environment. There is no partial launch; NOT READY stands until every
line passes.

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
| **2a** | Love's Travel Stops — **directory coverage** | **100 % of 615** | **613 represented** by exact store-number reconciliation (closeout applied 2026-07-28: +21 resolved quarantines); remaining 2 = #234 (non-overnight, quarantined) + #420 Flowood (held state-conflict) | ⏳ |
| **2b** | Love's Travel Stops — **overnight-parking coverage** | **100 % of 604** | **603 route-usable** by distinct store number (overnight-confirmation closeout 2026-07-28: +9 flips; #317 Skippers VA confirmed + published under its dedicated single-record authorization the same day); remaining 1 = #420 Flowood (held state-conflict) | ⏳ |
| **3a** | Pilot / Flying J / ONE9 — **U.S. directory coverage** | **100 % of 820** | **818 represented** (709 + 100 matched applied 2026-07-27; 9 quarantine resolutions applied 2026-07-28); remaining: #195 OR (needs page evidence) + #749 VA (identity conflict) | ⏳ |
| **3b** | Pilot / Flying J / ONE9 — **U.S. truck-parking coverage** | **100 % of 803** | **801 route-usable by distinct official store number** (695 imports + 68 matched 2026-07-27; +25 matched publications, +9 resolved inserts, +4 repaired enrichments 2026-07-28); remaining: #195 OR + #749 VA | ⏳ |
| **4a** | TA / Petro / TA Express — **directory coverage** | **100 % of 348** | **348 represented** — every official site has its own correctly-labeled row (0393 relabel applied 2026-07-27) | ✅ |
| **4b** | TA / Petro / TA Express — **route-usable coverage** | **100 % of 347** | **347 route-usable by distinct official Site ID** — 37 enrichments + closeouts applied 2026-07-27; zero duplicate pins | ✅ |
| 5 | Official public rest areas, welcome centers, service plazas | **≥ 95 %** | not sourced | ❌ |
| 6 | Official weigh stations, **classified separately** | **100 %** | not sourced | ❌ |
| 7 | Route-segment coverage, major freight corridors | **≥ 95 %** | not measurable | ❌ |
| 8 | Route-segment coverage, all Interstates | **≥ 85 %** | not measurable | ❌ |

**Every threshold is measured against an authorized source of record**, not
against what the database happens to contain. A category is at 100 % only when
the count reconciles to the official export for that operator or agency.

Lines 7 and 8 are marked *not measurable* rather than 0 %: route-segment
coverage cannot be computed at all until facilities carry coordinates, because
a segment is only "covered" if a mappable facility sits on it.

### Line 2 is two gates, and neither is source acquisition

Love's is the first line where a source of record actually exists, which
exposes a distinction the rest of the table will hit in turn.

**Source acquisition for Love's is 100 % and complete as of 2026-07-27.** The
export holds 731 of 731 locations — Love's own results page reports 731, across
all five location types and 42 operating states, and the workbook matches
exactly. Recorded in `SOURCE-ACQUISITION.md` and `source-acquisition.json` with
sha256 `ec5146ee…a89ab2`.

**That closes the acquisition. It does not move either gate.** A complete file
says nothing about whether the database represents it. The gate measures the
database.

| Gate | Universe | Passes when |
|---|--:|---|
| **2a — directory coverage** | **615** active Travel Stops | all 615 are correctly reconciled and represented in the directory |
| **2b — overnight-parking coverage** | **604** Travel Stops with `overnightparking = Y` | all 604 are represented **and route-usable** — mappable, on a corridor, surfaceable as parking |

`615 = 604 + 11`. These are two different numbers measuring two different
things, and **neither may be reported as the other**. Quoting 604 against the
directory gate overstates it; quoting 615 against the parking gate overstates
it worse, because 11 of those locations must never be offered as parking at
all.

Both read ⏳. Insertion, enrichment and publication are three separate
authorizations and **none has been given**; the guarded package sits unexecuted
in `data/imports/loves-2026-07-27/`. Two store numbers (#618, #420) are held
back pending exact-ID verification — see that package's `CORRECTIONS.sql` and
`QUARANTINE.md`.

#### The 11 non-overnight Travel Stops

Eleven active Love's Travel Stops carry `overnightparking = N`. They are real
locations and **belong in the directory as truck stops** — they count toward
2a. They must **never** be offered as overnight or HOS-rest parking, and they
do not count toward 2b.

**Store #201, Elk City, Oklahoma** states **zero spaces**. It does not qualify
as parking of any kind under any circumstance — directory record only.

This is the same principle as the weigh-station rule below: presence in the
directory is not a claim that a driver can sleep there.

### Line 3 splits the same way, on a different axis

**Source acquisition for Pilot / Flying J / ONE9 is 100 % and complete as of
2026-07-27.** The export holds **875** official-network locations, sha256
`d39ab57d…e330a`. Every independently reported figure reproduces exactly.

| Gate | Universe | Passes when |
|---|--:|---|
| **3a — U.S. directory coverage** | **820** U.S. network locations | all 820 are correctly reconciled and represented |
| **3b — U.S. truck-parking coverage** | **803** with a positive official parking-space count | all 803 are represented **and route-usable** |

`820 = 803 + 17`. Both read ⏳; the guarded package sits unexecuted in
`data/imports/pilot-2026-07-27/`.

**875 is never the U.S. coverage number.** 55 of the locations are Canadian
(AB, ON, BC, SK, MB). They are preserved separately in `CANADA-55.csv`, are
**excluded from every U.S. denominator**, and are never imported.

The **17 zero-space** U.S. locations are real network listings and count toward
3a. The operator states 0 spaces, so they must **never** be returned as parking
and **never** as a last-legal-stop recommendation. They do not count toward 3b.

#### Overnight permission is not in this source, and is not invented

Unlike Love's, this export carries **no overnight-permission field**. A positive
operator space count confirms truck parking for directory and map purposes only.
It does not confirm that overnight rest is permitted, and parking restrictions
and duration limits stay **unknown**.

`locations.overnight_parking` is `NOT NULL DEFAULT false` and cannot hold
"unknown", so every Pilot row lands at `false` — meaning *not confirmed*, not
*prohibited*. That under-claims, which is the safe direction. **No Pilot-network
row may be offered as overnight or HOS-rest parking** until a second
authoritative source states it.

Five directory rows conflict with the export and twelve are probable-closure
candidates, six of them published today. **Nothing is deleted or unpublished on
that basis** — absence from a single export is not proof of closure, and closure
review is a separate exercise with its own authorization.

### Two measurements, never one number

Every operator line is measured **twice**, and the two must never be collapsed:

| Measurement | Question it answers | Passes when |
|---|---|---|
| **Operator acquisition coverage** | Do we hold the operator's complete official list? | the file is in hand, checksummed, and its count is independently confirmed |
| **Route-usable coverage** | Can a driver actually use these on their lane? | the rows are in the database, **published**, **mappable**, and carry confirmed truck parking |

A location is **route-usable** only when all four hold: it exists in the
directory, it is published, it has an authoritative coordinate, and truck
parking is confirmed. Missing any one of them and it is not usable on a route,
whatever the acquisition percentage says.

| Line | Operator acquisition | Route-usable | Gap |
|---|--:|--:|--:|
| **2 — Love's** | **100 %** (731 held, 615 U.S. Travel Stops) | **0** of 604 | 604 |
| **3 — Pilot / Flying J / ONE9** | **100 %** (875 held, 820 U.S.) | **0** of 803 | 803 |
| **4 — TA / Petro / TA Express** | **100 %** (354 held; 348 TA-brand) | **347** of 347 | **0** |

TA's shape is the inverse of the other two, because most of its data landed on
2026-07-25: 304 of its sites already have published, digest-verified rows. The
full Site-ID reconciliation (`data/sources/ta-master/2026-07-27/FINDINGS.md`)
resolved the "~30 questionable rows" of the earlier gap analysis into exactly
**2 duplicates (1 published), 0 closures** — the rest were colocated service
records and the sites' own pre-existing rows. The TA provenance caveat is
closed: Shawn's official download artifact (`a0c612f0…`) was verified and
committed 2026-07-27 as `locmaster20260727.xlsx`, and the enrichment package
was executed against it the same day (37 of 38 applied; site 0269 quarantined
by the coordinate-collision guard).

**Acquisition coverage without route-usable coverage is a file on a disk.
Route-usable coverage without acquisition coverage is unverified claims in
front of drivers.** With TA's master in hand, line 4 has become the program's
first CLOSED line: **100 % route-usable (347 of 347)** after the 2026-07-27
enrichment run and two closeouts. The last three sites landed on official
TA public-page evidence (0001 TA Ashland, 0142 TA Richmond — each page
binding a distinct name to a distinct address, phone and coordinate) and a
one-record exact-ID collision exception for the co-located Blue Beacon
truck wash beside Petro Florence (0393). Coverage counts by distinct
official Site ID with zero double-counted pins.

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
above — the baseline stays fixed, and none of the following has been applied):

The Love's export of 2026-07-27 produced the project's first Tier-A set,
**604 overnight-eligible locations across 42 states and 64 corridors**, 541 of
them net-new, 62 enrichments of existing rows, 1 held. All 604 arrive with an
operator-supplied, machine-checked coordinate, so the unmappable published rows would
not grow. **Zero rows are published by the package**; publication is a separate
authorization that has not been given.

Were 2b to close, 32 states would gain their first published parking and I-95,
I-80, I-90, I-94, I-10 and I-15 would each go from **zero** to covered. That is
the prepared effect, not an achieved one. Figures in
`data/imports/loves-2026-07-27/COVERAGE.md`.

The export also contradicted four existing directory rows, three of them
**published** — Love's #618 recorded in Michigan (it is Kentucky), #306
recorded in Tennessee (absent from the export), and #420 recorded in South
Carolina (it is Mississippi). The first three are proposed for unpublishing
pending exact-ID verification; the fourth stays unpublished and quarantined.
Nothing is deleted. See `data/imports/loves-2026-07-27/CORRECTIONS.sql` and
`QUARANTINE.md`, and `data/sources/loves-master/2026-07-27/FINDINGS.md`.

---

## What the gate implies about sequencing

The gate cannot be approached by publishing what is already held. Line 1 is an
authorized feed the project does not have, line 4 is an operator export
**blocked at the network policy**, and lines 5–6 need agency datasets that are
equally unreachable. **The binding constraint is source acquisition, not
engineering.**

The ranked order for lines 5 and 6 is now computed, not guessed:
`AGENCY-REGISTRY.md` scores all 39 states on the five priority corridors,
weighted inversely by what the directory already publishes on each. I-95
dominates because it publishes **4** mappable parking rows nationwide.

Love's and Pilot are the exceptions that prove the shape of the rest: both
sources are now held in full, and gates 2a, 2b, 3a and 3b *still* do not pass.
Acquiring a file moves a line from "cannot be worked" to "can be worked".
Closing a gate takes reconciliation, representation and an explicit
authorization to write.

Two operator exports also cover **1,435 U.S. locations between them** (615
Love's Travel Stops + 820 Pilot-network) while the rest-area baseline below
stays at 76. That contrast is the point: operator data
is obtainable and agency data is not, so lines 2–4 will close long before line 5
moves at all. **Line 5 is the launch's real critical path.**

The order that unblocks the most gate lines per file obtained is in
`SOURCE-ACQUISITION.md`. The process to run the moment a file lands is in
`INTAKE-PROCESS.md`. Neither involves writing to production without a separate,
explicit authorization.

---

## Gate review

Re-measure with `FINGERPRINT.sql` and `RECONCILE.sql` after every intake, and
update the Current column above in the same commit. The gate passes only when
all eight lines read ✅ against an authorized source of record.

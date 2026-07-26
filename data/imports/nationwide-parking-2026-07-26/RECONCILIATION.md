# The 216 addressless rows — reconciled individually

Every one of the 216 rows the previous audit set aside as "no usable street
address" is classified below. **None was discarded.** Per-row detail is in
`RECONCILIATION-216.csv`; the query that produces it is `RECONCILE.sql`.

Fidelity: the id set of the CSV digests to `1d707c73ad5f2aad741a20b7d88c7d92`,
byte-identical to the same digest computed in the database. The CSV is a
provably faithful copy of the live set, not a transcription.

## Outcome

| Disposition | Rows |
|---|--:|
| `A-PENDING-COORDINATE` — meets every Tier-A test except the coordinate | **35** |
| `C:out-of-scope-not-parking` — repair shops, hotels, CDL schools, truck stops | 92 |
| `C:quarantine-inspection-only-no-parking-evidence` | 42 |
| `C:quarantine-no-official-source` | 29 |
| `C:quarantine-truck-parking-unconfirmed` | 17 |
| `C:quarantine-weigh-needs-parking-confirmation` | 1 |
| **Total** | **216** |

## By facility type

The previous audit treated these as one undifferentiated bucket. They are not.

| Type | Rows | Official source | Source text confirms truck parking |
|---|--:|--:|--:|
| Non-parking business | 92 | 0 | — (out of scope) |
| Rest area | 44 | 36 | 25 |
| Weigh / inspection | 43 | 21 | **1** |
| Welcome center | 18 | 10 | 9 |
| Truck parking | 14 | 2 | 6 |
| Service plaza | 5 | 4 | 4 |

Two typing decisions are worth stating because a naive classifier gets them
backwards:

- **TN `5f8a9e1f` and `d375452a`** are named "…Truck Parking Area (former
  weigh station…)". They are *parking* — TDOT converted both during the I-65
  widening — but a name-based weigh-station rule would file them as inspection
  infrastructure and quarantine them. `RECONCILE.sql` matches the "former weigh
  station" pattern *before* the generic weigh rule for exactly this reason, and
  a test locks that ordering.
- **43 rows are weigh/inspection stations.** Only one carries any text about
  parking. A weigh station is not parking, and the default here is refusal:
  42 are quarantined as inspection-only, 1 as needing explicit confirmation.
  None is eligible.

## Tiers

The brief's Tier A is *official source + exact coordinates + truck parking
explicitly confirmed*.

**Tier A: 0. Tier B: 0. Tier C: 181.**

Not one of the 216 rows has a coordinate, and no authoritative source is
reachable to supply one (`BLOCKED-SOURCES.md`). Tier A and Tier B both require
coordinates, so both are empty. Reporting "all 216 are Tier C" is technically
right and tells you nothing, so this package also records:

**`A-PENDING-COORDINATE`: 35 rows, 10 states.** These satisfy every other
Tier-A criterion — correct facility type, primary agency source, and source
text that explicitly confirms truck parking. They are *not* Tier A, they are
*not* publishable, and none is marked `eligible_for_canary`. They are the work
queue for the moment a coordinate becomes obtainable.

| State | Pending | Facility types |
|---|--:|---|
| VA | 7 | 5 rest area, 2 welcome center |
| FL | 6 | 6 rest area |
| TN | 6 | 3 rest area, 2 truck parking, 1 welcome center |
| MD | 4 | 4 service plaza (**= 2 physical facilities**) |
| SC | 4 | 2 rest area, 2 welcome center |
| AR | 2 | 2 rest area |
| NC | 2 | 1 rest area, 1 welcome center |
| OH | 2 | 2 rest area |
| GA | 1 | 1 rest area — **quarantined**, see below |
| IN | 1 | 1 rest area |

## Duplicates, pairs and shared facilities

**16 directional pairs (32 rows)** — 8 among parking facilities (AL Butler,
AL Conecuh, KY Scott, NC McDowell, NC Cumberland, OH Miami, TN Dickson,
VA Ladysmith) and 8 among weigh stations (AL Athens, AR Alma, GA Townsend,
IN Seymour, NC Robeson, TN Bradley, VA Carson, VA Dumfries). Opposite
carriageways of the same named facility. These are **two places, not one** — a driver northbound
cannot use the southbound site. They keep separate rows, and
`ENRICH-TEMPLATE.sql` refuses a batch in which two facilities share one
coordinate, which is how a well-meaning dedupe would break them.

**2 same-facility groups across categories (4 rows), MD.** `Chesapeake House
Travel Plaza` (truck-stops) + `Chesapeake House Travel Plaza Truck Parking`
(parking); the same split for `Maryland House`. Same MDTA plaza, same address,
same source URL. Four rows describe two physical places. They are flagged
`same_facility_group` in the manifest and must be resolved — one canonical row,
or an explicit parent/child convention — **before** either is published, or the
directory will show the same plaza twice.

**No closures detected.** Nothing in the current row text indicates a
permanently closed facility. That is a weak negative: closure status is exactly
the kind of fact only the agency dataset carries, and it is one more reason the
coordinate fetch matters.

## The one data defect

`49bf9a34` — **"Carson Safety Rest Area - I-95 NB", city Port Wentworth, GA**,
sourced to `dot.ga.gov`, description confirming separate truck parking.

Carson is a **Virginia** rest area: VDOT, I-95 MM 37, Prince George County. The
database already holds it correctly as `0b924a84` in VA, and holds the adjacent
`Carson Weigh Station` NB/SB pair in VA too. GDOT does operate an I-95
northbound rest area near Port Wentworth, but it is not called Carson — the
name appears to have been carried across from the Virginia record at import.

This row scored as `A-PENDING-COORDINATE` on every automated test, which is
precisely what makes it worth calling out: the automated gates would have
waved through a plausible, wrongly-named facility. It is **quarantined** in
`manifest.json` with `confidence: quarantined`, and
`scripts/test-parking-expansion.ts` asserts it can never enter a canary while
the anomaly stands.

## Category misassignment

`weigh_inspection` rows appear under **two** category slugs: 41 under
`weigh-stations` and 2 under `parking`. The 2 in `parking` are the TDOT
converted sites and are correctly categorised. No correction is needed — but
the reverse case is worth watching, since a genuine weigh station filed under
`parking` would surface on parking pages as if a driver could shut down there.

## What would change these dispositions

| Disposition | What moves it |
|---|---|
| `quarantine-no-official-source` (29) | the state agency's own dataset, replacing a tourism board or aggregator |
| `quarantine-truck-parking-unconfirmed` (17) | an agency statement that trucks may park, with a space count if published |
| `quarantine-weigh-needs-parking-confirmation` (1) | an agency statement that parking is permitted, as TDOT gave for its two converted sites |
| `quarantine-inspection-only` (42) | realistically nothing — these are scales, not parking |
| `out-of-scope-not-parking` (92) | nothing; they are correctly filed in other categories |
| `A-PENDING-COORDINATE` (35) | one rooftop coordinate each |

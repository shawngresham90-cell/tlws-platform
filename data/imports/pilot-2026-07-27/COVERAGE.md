# Pilot / Flying J / ONE9 — before / after coverage

Source of record: `all_locations.csv`, sha256 `d39ab57d…e330a`.

Every figure the operator's own inspection reported reproduces exactly from the
file: 875 total, 820 U.S., 55 Canadian, 43 U.S. states, 803 U.S. with a positive
parking-space count, 17 with zero, 72,189 stated U.S. spaces, and zero duplicate
store numbers, coordinates or name/address/state triples.

**Executed 2026-07-27** under explicit authorization — see
`EXECUTION-RECORD.md` for the applied result. The figures below are what the
package produces at full application; execution quarantined 10 inserts and 4
enrichment targets (guards intact, `QUARANTINE-EXECUTION.csv`), so the
measured landing is **3a 809 of 820 represented** and **3b 763 of 803
route-usable**, with the remaining gap accounted for row by row in the
execution record.

---

## 875 is not the U.S. coverage number

| | Rows | Counts toward |
|---|--:|---|
| Total official-network locations | **875** | nothing on its own |
| **U.S.** | **820** | gate 3a |
| Canada | **55** | **excluded from every U.S. denominator** |

The 55 Canadian locations (AB 17, ON 16, BC 11, SK 6, MB 5; 2,358 stated spaces)
are preserved in `CANADA-55.csv` and are **not imported**. `VERIFY.sql` §10
fails if a single Canadian row ever appears under this import's source tag.

## Source acquisition: 100 %

Gate line 3's *source* is complete. **Source acquisition being 100 % does not
make directory coverage 100 %.** The file being complete says nothing about
whether the database represents it. The two database gates below are what
actually pass or fail.

## The two U.S. database gates, kept separate

| Gate | Universe | Before execution | Prepared target | **Measured after (2026-07-27)** |
|---|--:|--:|--:|--:|
| **3a — U.S. directory coverage** | **820** network locations | 101 reconciled | 820 | **809** (10 quarantined, 1 conflict) |
| **3b — U.S. truck-parking coverage** | **803** with a positive official space count | 0 route-usable | 803 | **763** (10 quarantined, 29 matched rows unpublished, 1 conflict) |

820 = 803 with parking + 17 with zero stated spaces. Both figures come from the
same file and neither may be reported as the other.

### The 17 zero-space U.S. locations

Real network listings, and they belong in the directory as **truck stops**. They
must **never** be returned as parking and **never** as a last-legal-stop
recommendation. The operator states 0 — that is a stated fact, not an absence,
so it is stored as 0 rather than null.

`PUBLISH-PER-STATE.sql` filters on `coalesce(parking_spaces,0) > 0`,
`PUBLISH-CANARY.sql` guard 3 rejects them outright, and `VERIFY.sql` §3 asserts
zero of them are ever published.

Fourteen of the 17 are net-new; the other three already exist in the directory.

### Overnight permission is unknown, and stays unknown

The export has **no overnight-permission field**. `locations.overnight_parking`
is `NOT NULL DEFAULT false`, so it cannot hold "unknown" — every imported row
therefore lands at `false`, which here means **not confirmed**, not
"prohibited". That is the safe direction: it under-claims.

A positive operator space count confirms truck parking **for directory and map
purposes only**. Parking restrictions and duration limits stay unknown. No row
from this import may be offered as overnight or HOS-rest parking until another
authoritative source states it. `VERIFY.sql` §4 fails if any imported row ever
claims overnight parking.

This is a schema limitation worth fixing later — a three-valued
`overnight_status` (confirmed / prohibited / unknown) would let the directory
say "we don't know" instead of implying "no". **Not built here**, and not
required for this import to be safe.

## What the package moves

| | Rows |
|---|--:|
| Net-new inserts | **719** — 705 with parking + 14 zero-space |
| Enrichment of existing rows (map pins), blank-only | **84** |
| Colocated service rows reconciled, **no pin** | **92** |
| Conflicting records held back, no SQL | **5** |
| Probable-closure candidates, no SQL | **12** |
| Published by the import itself | **0** |
| Canadian rows imported | **0** |

**719 + 101 matched = 820.** Nothing unaccounted for. The 101 matched breaks
down as 87 exact authoritative matches, 8 blank-only enrichments, 5 matched by
address + brand + state, and 1 conflicting record that is deliberately **not**
enriched.

### What "blank-only" actually means here

Checked field by field against the real current values, not assumed:

| Field | Rows filled | Why not more |
|---|--:|---|
| `lat` / `lng` | **82** | 2 targets already have coordinates |
| `interstate` | **0** | every matched row already carries one |
| `parking_spaces` | **38** | 73 directory rows already state a count |
| `overnight_parking` | **0** | never written — the export does not state it |
| `exit_number` | **0** | 217 of 222 rows already have one, in a different format |
| `is_indexable` | **0** | never named in any statement |

## Corridors

Pilot-network parking, by corridor, against what the directory publishes today
(mappable rows carrying a stated parking count):

| Corridor | Mappable parking today | This package adds |
|---|--:|--:|
| **I-95** | **4** | **+31** |
| I-10 | 23 | +56 |
| I-80 | 28 | +50 |
| I-40 | 19 | +50 |
| I-20 | 20 | +49 |
| I-75 | 53 | +43 |
| I-90 | 15 | +35 |
| I-70 | 19 | +29 |
| I-15 | 7 | +26 |
| I-5 | 10 | +24 |
| I-35 | 11 | +24 |
| I-81 | 11 | +22 |
| I-94 | 12 | +21 |
| I-65 | 4 | +20 |
| I-84 | 7 | +11 |

**70 corridors** gain Pilot-network parking. A further **115** of the 803 sit on
non-Interstate routes (US highways, state routes) or carry no route string at
all; they are valid parking and are imported, but they do not land on a corridor
page.

## States

| | |
|---|--:|
| U.S. states in the export | **43** |
| States gaining Pilot-network parking | **43** |
| Stated U.S. parking spaces | **72,189** |
| Imported rows carrying a coordinate | **820 / 820** |

Seven states and DC have no Pilot-network location at all: AK, DE, HI, ME, NH,
RI, VT. That is the operator's footprint, not a gap in this import, and those
states still need gate lines 1, 4, 5 and 6 to be covered at all.

## Directory-wide effect

| Measure | Before | After | Change |
|---|--:|--:|---|
| Total live rows | 1,556 | 2,275 | +719 |
| Published rows | 1,165 | 1,870 | +705 |
| Rows with coordinates | 534 | 1,335 | +801 |
| **Published rows missing coordinates** | **635** | **635** | **unchanged** |
| Featured rows | 0 | 0 | unchanged |
| Manually indexable rows | 0 | 0 | unchanged |
| Soft-deleted rows | 0 | 0 | unchanged |

Every one of the 820 arrives **with** an operator coordinate, so the unmappable
count does not grow. The pre-existing 635 unmappable published rows are a
separate problem this package does not touch.

### This does not move the rest-area baseline

The launch gate's headline baseline — **76 published parking records, 31
mappable, 10 states, zero on I-95** — measures **public parking facilities**:
rest areas, welcome centers and service plazas, gate line 5. An operator
truck-stop import does not change it, and must not be reported as if it did.
Pilot moves **gate line 3 only**. Gate line 5 still needs the state DOT
datasets, which remain blocked.

## What is still not passed

Gates 3a and 3b both still read **in progress**, not ✅, after the 2026-07-27
execution (3a **809/820**, 3b **763/803**):

- **10 quarantined inserts** (8 cross-operator interchange adjacencies against
  published TA pins, 2 store-number-guard false positives) await individual
  collision review under a future authorization.
- **29 matched positive-parking sites** now carry coordinates and/or space
  counts but their pre-existing rows remain **unpublished** — enrichment never
  publishes, and publishing pre-existing rows was not part of this
  authorization.
- **4 enrichment targets** were quarantined whole on published-pin collisions
  (#1330 AR, #1550 AL, #353 KY, #95 FL) — identity review first.
- **1 record conflicts** with the export (#749 VA) and is held for exact-ID
  verification; the other 4 prepared conflicts sit outside the 820 mapping.
- 12 rows remain probable-closure candidates; closure review is a separate
  exercise with its own authorization. **Nothing was deleted or unpublished.**
- The **17 zero-space locations stay staged** (14 inserted unpublished, 3
  matched untouched) until the app hard-excludes `parkingSpaces <= 0` from
  every route-usable / last-legal-stop query — see EXECUTION-RECORD.md §7.

The gate passes when the database represents all 820, not when the file does.

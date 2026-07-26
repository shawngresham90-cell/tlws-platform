# Nationwide truck-parking coverage — 50-state baseline

Read-only audit of `public.locations`, 2026-07-26, `main` @ `7168b7e`.
Total rows 1,556 · published 1,165 · unpublished 391. No write was performed.

## The headline

**Published truck parking exists in 10 states. Forty have none.**

| | |
|---|--:|
| `category_slug = 'parking'` rows | 167 |
| …published | **76** |
| …published **and mappable** (lat/lng) | **31** |
| …unpublished | 91 |
| States with ≥1 published parking row | **10** |
| States with **zero** | **40** |

Of 76 published parking locations, **45 have no coordinates** — they exist as
directory pages but cannot be placed on the map or answer "what's near me".

## Published parking by state

| State | Published | With coords | Unpublished | With exit | Free | Overnight | Corridors |
|---|--:|--:|--:|--:|--:|--:|---|
| OH | 15 | 11 | 6 | 4 | 0 | 10 | I-75 |
| IN | 14 | 6 | 3 | 6 | 1 | 11 | I-65 |
| TN | 13 | 0 | 14 | 6 | 3 | 7 | I-40 I-65 I-75 |
| KY | 10 | 7 | 7 | 3 | 0 | 4 | I-75 |
| MI | 6 | 0 | 4 | 1 | 1 | 2 | I-75 |
| FL | 5 | 1 | 8 | 2 | 1 | 3 | I-75 |
| NC | 4 | 3 | 12 | 2 | 2 | 2 | I-40 |
| GA | 4 | 2 | 4 | 3 | 0 | 0 | I-75 |
| AR | 4 | 1 | 7 | 3 | 1 | 3 | I-40 |
| AL | 1 | 0 | 6 | 1 | 0 | 1 | I-65 |
| **Total** | **76** | **31** | **71** | **31** | **9** | **43** | |

The remaining 40 states hold **0** published parking rows. Four of them hold
unpublished ones (VA 7, SC 5, MD 4, IL 3, DE 1); the other 35 have nothing at
all in this category.

TN is the sharpest single gap: 13 published parking locations, **none mappable**.
MI is the same at 6.

## Corridor coverage

Published parking touches five corridors only:

| Corridor | Published parking rows | States |
|---|--:|---|
| I-75 | 30 | OH, KY, MI, FL, GA |
| I-65 | 15 | IN, AL, (TN) |
| I-40 | 12 | NC, AR, (TN) |
| I-95 | **0** | — |
| I-24 | 0 | — |

**I-95 has zero published parking anywhere on its length**, despite being the
densest freight corridor in the Northeast. Every I-95 parking row in the
database (VA 7, SC 5, MD 4, NC, GA, FL) is unpublished.

The corridors named in the brief as priorities are in worse shape still:

| Corridor | Rows in DB (any status) | Published |
|---|--:|--:|
| I-95 | 27 | 0 |
| I-80 | **0** | 0 |
| I-90 / I-94 | **0** | 0 |
| I-10 | **0** | 0 |
| I-15 | **0** | 0 |

I-80, I-90/I-94, I-10 and I-15 are not weakly covered — they are **entirely
absent**. Improving them is not a publication problem; it requires net-new
records, which requires authoritative sourcing (see `BLOCKED-SOURCES.md`).

## Public versus private

Among the parking-relevant unpublished rows, the split matters because the
brief targets *public* facilities drivers can legally use:

| Kind | Rows | Public/agency-operated |
|---|--:|---|
| Rest area | 44 | yes (state DOT) |
| Welcome center | 18 | yes (state DOT / tourism authority) |
| Service plaza | 5 | yes (toll authority — MDTA) |
| Truck parking | 14 | **mixed** — 2 public (TDOT), 12 private/commercial |
| Weigh / inspection | 43 | public, but **not parking** unless confirmed |

The 12 private rows are mostly a commercial marketplace brand
("Truck Parking Club", "My Parking Hub", "Toledo Truck Hub"). They are real
businesses but they are not public parking, and none carries an official
source. All are quarantined.

## Coordinate and duplicate risk

- **No unpublished parking or weigh row has coordinates.** Not one of the 137.
  Coordinate coverage among unpublished parking-relevant rows is exactly 0 %.
- **16 directional pairs (32 rows)** share a base facility name and differ only
  by carriageway: **8 among parking facilities** (AL Butler, AL Conecuh,
  KY Scott, NC McDowell, NC Cumberland, OH Miami, TN Dickson, VA Ladysmith) and
  **8 among weigh stations** (AL Athens, AR Alma, GA Townsend, IN Seymour,
  NC Robeson, TN Bradley, VA Carson, VA Dumfries). These are **separate
  facilities on opposite carriageways**, not duplicates. Each needs its own
  coordinate, and a naive dedupe would wrongly collapse them.
- **2 cross-category same-facility pairs** in MD: `Chesapeake House Travel
  Plaza` (truck-stops) + `Chesapeake House Travel Plaza Truck Parking`
  (parking), and the same for `Maryland House`. Same MDTA facility, same
  address, same source. Four rows, two physical places.
- **2 rows are misfiled**: TN `5f8a9e1f` and `d375452a` sit in `parking` and
  are correctly parking, but their names begin "…former weigh station", which a
  naive type classifier reads as inspection infrastructure. `RECONCILE.sql`
  matches them before the weigh rule for exactly this reason.

## Data defect found

`49bf9a34` — **"Carson Safety Rest Area - I-95 NB", city Port Wentworth, state
GA**, sourced to `dot.ga.gov`. Carson is a *Virginia* rest area (VDOT, I-95
MM 37, Prince George County), and this row's twin `0b924a84` correctly records
it in VA. GDOT does operate an I-95 northbound rest area near Port Wentworth,
but it is not named Carson. The name appears to have been carried across from
the Virginia record during import.

This row otherwise scores as the strongest class of candidate, which is exactly
why it is dangerous: it would have published a plausible, wrong name. It is
**quarantined pending a name correction from GDOT's own facility list**, and a
regression test asserts it never enters a canary while the anomaly stands.

## What this baseline implies

1. The fastest real coverage win is **not** new records — it is coordinates for
   rows the directory already has. 45 published parking pages are unmappable,
   and 137 more are unpublished solely for want of a rooftop coordinate.
2. **I-95 is the highest-value corridor to fix**: 27 rows already exist, zero
   are published, and it is the corridor the brief names first.
3. I-80 / I-90 / I-94 / I-10 / I-15 need a sourcing campaign before any
   publication work is meaningful.

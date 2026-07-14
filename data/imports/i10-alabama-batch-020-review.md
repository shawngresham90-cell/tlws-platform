# Batch 20 — I-10 Alabama: Review Summary

CSV: `data/imports/i10-alabama-batch-020.csv` · researched 2026-07-14 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`), both run with the REAL 64-row live Alabama comparison set. **Nothing has been
imported to production.**

This batch continues the I-10 corridor eastward from Batch 19 (Mississippi), covering the Alabama
Gulf Coast stretch of I-10 through Mobile — roughly 66 interstate miles from the Mississippi line
at Grand Bay to the Florida line past Robertsdale.

Unlike Batches 17–19 (Texas, Louisiana, Mississippi — all brand-new states with 0 existing rows),
**Alabama already has 64 production listings, all on I-65.** This batch was therefore deduped
against that full live set (name+city+state keys AND detail slugs). The existing Mobile-area rows
(Love's #624 Prichard, Pilot #75 Satsuma, Qualawash Saraland) sit on I-65 north of Mobile and were
explicitly excluded from the research prompts. **Result: 0 collisions — every row here is new and
on I-10.**

## Totals

- Total rows in CSV: **12**
- Segments: West of Mobile Bay (6, Grand Bay–Tillmans Corner) · Eastern Shore (6, Loxley–Robertsdale)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — all 12 rows flagged `needs-geocoding`.

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 5 |
| truck-washes | 2 |
| cat-scales | 1 |
| tire-repair | 1 |
| roadside-service | 1 |
| parking | 1 |
| hotels-truck-parking | 1 |

## Rows by city (west → east)

Grand Bay (1) · Irvington (1) · Theodore (2) · Mobile/Tillmans Corner (2) · Loxley (3) · Robertsdale (3)

## Curation & accuracy decisions

- **West anchors**: TA Mobile #54 (Grand Bay, Exit 4), Love's #846 (Irvington, Exit 10), Pilot #302
  (Theodore, Exit 13) — each carries a CAT scale (kept as amenities on the truck-stop row for this
  segment).
- **Eastern Shore anchors**: Love's #206 (Loxley, Exit 44) and the Oasis Travel Center / TA Express
  #0989 (Robertsdale, Exit 53).
- **Omitted Buc-ee's Loxley** — it sells diesel but bans 18-wheelers at all locations, so it is not
  a truck stop.
- **Oasis = TA Express Robertsdale** are the same physical facility (27801 County Rd 64) — listed
  once, not double-counted.
- **Honestly omitted** dedicated truck stops for Spanish Fort / Daphne / Malbis (Exits 35–38) and
  Seminole/Wilcox toward the FL line — only gas stations and hotels there, no confirmable truck stop.
- Blanks kept where sources conflict: Super 8 exit (15A vs 15B), Stop N Shop ZIP/exit.

## Co-location (expected, not duplicates)

- **Theodore Exit 13**: Pilot #302 (truck-stop) + Action Resources tank wash (truck-washes).
- **Loxley Exit 44**: Love's #206 (truck-stop) + its CAT scale (cat-scales) + Love's Truck Care (tire-repair).
- **Robertsdale Exit 53**: Oasis Travel Center (truck-stop) + its truck wash (truck-washes) + the
  adjacent All Truck and Trailer road-service shop (roadside-service).

## Dedup against live Alabama (64 rows, all I-65)

- Import-parser dedup vs 64 existing `importDupKey`s: **0 duplicates**.
- Detail-slug collision vs 64 existing AL detail slugs: **0**.
- All existing AL rows are on I-65 (Athens → Prichard/Satsuma); this batch is entirely on I-10.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West of Mobile Bay (Grand Bay → Tillmans Corner) | 6 |
| part2 | Eastern Shore (Loxley → Robertsdale) | 6 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Compact by design**: outside the Exit 4–13 (west) and Exit 44–53 (east) clusters, the Mobile
  I-10 stretch is thin on dedicated truck stops. Omitted rather than padded.
- **Research-grade candidate set, not a verified import.** Nothing written to production.

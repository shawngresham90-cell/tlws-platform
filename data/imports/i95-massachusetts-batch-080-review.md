# Batch 80 — I-95 Massachusetts: Review Summary

CSV: `data/imports/i95-massachusetts-batch-080.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Massachusetts has **0** existing production rows — first live coverage of
the state (the I-90 Mass Pike batch remains an unmerged draft). **Nothing has been imported to
production.**

Covers the **Massachusetts** stretch of I-95 — from the Rhode Island line at Attleboro north
through Foxborough, Canton and Dedham, then around the western/northern Boston beltway (Route
128) through Norwood, Needham, Newton, Waltham, Lexington and Burlington, splitting off at
Peabody to run north through Danvers, Rowley, Newburyport and Salisbury to the New Hampshire
line. South (RI line/Attleboro → Burlington), North (Burlington → Peabody split → NH line).

## Totals
- Total rows in CSV: **16**
- ready-to-publish: **11** · import-unpublished (held): **5** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Roadside Service | 4 |
| Truck Parking (rest areas / service plaza / park-and-ride) | 4 |
| Tire & Repair | 3 |
| Weigh Stations | 2 |
| Truck Stops & Travel Centers | 1 |
| Truck Washes | 1 |
| Hotels with Truck Parking | 1 |
| **Total** | **16** |

## Rows by city (top)
Peabody 3 · Woburn 3 · Foxborough 2 · (Attleboro, Lexington, Newbury, Newburyport, Norwood, Plainville, Rowley, Salisbury 1)

## Segments
- **A — South (7):** RI line/Attleboro → Burlington. The Attleboro weigh/inspection station; the
  Pete Store (Peterbilt heavy-truck dealer, Plainville); Sullivan Tire (Norwood); Foxboro
  Towing; the Lexington MassDOT service plaza (Gulf fuel, NB only); M & L Boston Fuel & Wash
  (Woburn); and a Foxboro truck-parking hotel. **No true truck stops or CAT scales exist in the
  dense Boston-metro/Route 128 stretch — none fabricated.**
- **B — North (9):** Burlington → NH line. **Peabody Truck Stop (J&H Auto & Truck Stop, Exit
  44-45)** — the only genuine full-service truck stop on MA I-95, with diesel, showers, service
  bays and a restaurant; STTC and Pete's Tire (Peabody/Woburn); Murray's and Four Star heavy
  towing; the Rowley weigh station; and the Newbury rest area, Newburyport park-and-ride and
  Salisbury MA Welcome Center near the NH line.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official operator sites, mass.gov/MassDOT,
  catscale.com and directory sites. Per-row sources in `-sources.md`.
- **Dense Boston metro is deliberately sparse:** Peabody Truck Stop is the only true truck stop
  on all of MA I-95; the rest are commercial tire/repair, heavy towing, a Peterbilt dealer, a
  truck wash, weigh stations, MassDOT rest areas and a hotel. **No CAT scale exists on MA I-95
  (catscale.com lists none) — none fabricated.**
- **Cross-segment reconciliation:** no facility appears in both segments; the Woburn facilities
  (M & L wash, Pete's Tire, Murray's Towing) are distinct businesses.
- **Omitted, not fabricated:** the Newburyport park-and-ride and Newbury/Salisbury rest areas
  are noted as primarily commuter/passenger facilities (not dedicated truck parking); milepost
  facilities carry a blank exit; no coordinates.
- **Dedup:** MA production is empty (0 rows); no collisions possible. No internal duplicates.

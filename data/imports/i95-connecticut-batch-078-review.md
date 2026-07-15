# Batch 78 — I-95 Connecticut: Review Summary

CSV: `data/imports/i95-connecticut-batch-078.csv` · verified 2026-07-15 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Connecticut has **0** existing production rows — first live coverage of
the state. **Nothing has been imported to production.**

Covers I-95 the length of the **Connecticut** shoreline — from the New York line at Greenwich
northeast through Stamford, Darien, Norwalk, Bridgeport, Stratford, Milford, New Haven,
Branford, Madison, Old Saybrook, New London, Groton, Mystic and North Stonington to the Rhode
Island line at Pawcatuck. South (NY line/Greenwich → New Haven), East (New Haven → RI line).

## Totals
- Total rows in CSV: **36**
- ready-to-publish: **16** · import-unpublished (held): **20** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 12 |
| Truck Parking (service-plaza + Pilot lots) | 6 |
| CAT Scales | 3 |
| Weigh Stations | 3 |
| Hotels with Truck Parking | 3 |
| Roadside Service | 3 |
| Truck Washes | 2 |
| Tire & Repair | 2 |
| CDL Schools | 2 |
| **Total** | **36** |

## Rows by city (top)
Milford 10 · Branford 5 · North Stonington 4 · Bridgeport 3 · Darien 3 · Madison 3 · Waterford 3 · (others 1)

## Segments
- **A — South (18):** NY line/Greenwich → New Haven. The Darien (NB/SB) and Milford (NB/SB)
  I-95 service plazas; **Pilot #255 (Milford Exit 40)** — the one major branded truck stop on
  southwest CT I-95, with the corridor's western CAT scale and ~150 truck spaces; two Milford
  truck washes (Blue Beacon, Trans-Clean); the Greenwich NB weigh/inspection station; Bud's
  and Thompson truck repair and Bang's towing (Bridgeport/Stratford); NETTTS CDL (Bridgeport);
  and the Mayflower and Milford Motel 6 trucker-friendly hotels.
- **B — East (18):** New Haven → RI line. **TA Express New Haven (Branford Exit 56)** and the
  independent **American Auto Stop / Tinaco Plaza (North Stonington Exit 93)** — each with a
  CAT scale; the Branford, Madison and North Stonington I-95 service plazas; the twin Waterford
  weigh stations; Motel 6 Groton; One Source and CT Towing roadside (New Haven/New London); and
  the Waterford 160 Driving Academy.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against ctserviceplazas.com, official brand/operator sites,
  catscale.com, CT DMV/State Police weigh-station references and directory sites. Per-row
  sources in `-sources.md`.
- **Three CAT scales verified corridor-wide** (Pilot Milford, TA Branford, American Auto Stop
  North Stonington), each kept once. CT I-95 service plazas and DMV weigh stations are
  milepost facilities (exit blank, nearest named locality for city).
- **Cross-segment reconciliation:** no facility appears in both segments. Bud's Truck & Diesel
  (Bridgeport) was listed once (as tire-repair) rather than twice — its towing arm is the same
  business at the same address/phone. The Pilot Milford CAT-scale row was renamed to drop a
  conflicting store number.
- **Omitted, not fabricated:** southwest CT (Greenwich→New Haven) is dense/affluent with no
  true truck stops apart from Pilot Milford and the service plazas — none fabricated; the
  Waterford SB scale house is noted as demolished (roving enforcement); no coordinates.
- **Dedup:** CT production is empty (0 rows); no collisions possible. No internal duplicates.

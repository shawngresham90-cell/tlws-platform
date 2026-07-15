# Batch 82 — I-95 Maine: Review Summary — COMPLETES I-95

CSV: `data/imports/i95-maine-batch-082.csv` · verified 2026-07-15 · dry-run validated against
the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). Maine has **0** existing production rows — first coverage of the state.
**Nothing has been imported to production.** This batch **completes the I-95 corridor** to its
northern terminus at the Canadian border in Houlton, ME.

Covers I-95 the length of **Maine** — from the New Hampshire line at Kittery north along the
Maine Turnpike through York, Wells, Saco, Scarborough, Portland, Auburn/Lewiston, West
Gardiner and Augusta, then up the mainline through Waterville, Fairfield, Newport, Bangor,
Medway, Sherman and Island Falls to Houlton at the Canadian border. South (NH line/Kittery →
Augusta), North (Augusta → Houlton/Canada terminus).

## Totals
- Total rows in CSV: **42**
- ready-to-publish: **27** · import-unpublished (held): **15** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 14 |
| Truck Parking (service plazas / rest areas) | 6 |
| CAT Scales | 4 |
| Tire & Repair | 4 |
| Weigh Stations | 4 |
| Roadside Service | 4 |
| Truck Washes | 3 |
| CDL Schools | 3 |
| **Total** | **42** |

## Rows by city (top)
Bangor 6 · Auburn 5 · Kittery 5 · Hermon 3 · Kennebunk 3 · Scarborough 3 · (others 1–2)

## Segments
- **A — South (22):** NH line/Kittery → Augusta. The Maine Turnpike service plazas (Kennebunk
  NB/SB, Gray, West Gardiner), Irving Kittery Big Stop (Exit 2, CAT) and Auburn Irving Big
  Stop (Exit 75, CAT #1196), Crossroads Market (Auburn); Britewash and Eco Detail truck
  washes; STTC and Goodyear commercial tire (Scarborough); the Kittery and York weigh
  stations; the Kittery visitor center; Ray's heavy towing (Saco); and NTI Scarborough / CMCC
  Auburn CDL schools.
- **B — North (20):** Augusta → Houlton/Canada terminus. The Bangor/Hermon freight hub —
  **Dysart's Travel Stop (Hermon, the famous independent)**, Dysart's Bangor, plus the Irving
  Big Stop chain (Fairfield Exit 133 [CAT], Newport, Medway, Sherman, and **Houlton Exit 302
  [CAT] — the last stop before Canada**); Bangor Tire and Freightliner of Maine; Leonard, W
  and W and Bangor Mobile roadside/towing; the Sidney and Old Town weigh stations; the Hampden
  and Medway rest areas; and NTI Bangor CDL.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against maineturnpike.com, Irving/Dysart's operator sites,
  catscale.com, maine.gov (MSP/MaineDOT) and directory sites. Per-row sources in `-sources.md`.
- **Four CAT scales verified corridor-wide** (Irving Kittery, Auburn Irving #1196, Fairfield
  Irving, Houlton Irving), each kept once. **Dysart's Hermon has "certified scales" but no
  confirmed CAT-branded scale — no CAT row fabricated for it.** Maine Turnpike service plazas
  and MSP weigh stations are milepost facilities (exit blank where not at a numbered ramp).
- **Cross-segment reconciliation:** no facility double-listed; NTI Scarborough and NTI Bangor
  are distinct campuses (different cities).
- **Omitted, not fabricated:** no TA/Petro or Pilot/Flying J on the northern segment (the
  former Fairfield Pilot is closed — Dysart's is the real Bangor hub); no fixed Houlton weigh
  station invented; no hotel-truck-parking invented on the northern stretch; some conflicting
  street numbers left blank; no coordinates.
- **Dedup:** ME production is empty (0 rows); no collisions possible. No internal duplicates.

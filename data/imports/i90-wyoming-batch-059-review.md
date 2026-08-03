# Batch 59 — I-90 Wyoming: Review Summary

CSV: `data/imports/i90-wyoming-batch-059.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Wyoming has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers I-90 across the **northeastern corner of Wyoming**, from the Montana line at
Ranchester south/east through Sheridan and Buffalo (I-25 junction), then east through
Gillette, Moorcroft, and Sundance to the South Dakota line near Beulah. West (MT line
→ Sheridan → Buffalo), East (Buffalo → Gillette → Sundance → SD line).

## Totals
- Total rows in CSV: **24**
- ready-to-publish: **6** · import-unpublished (held): **18** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 8 |
| CAT Scales | 2 |
| Truck Parking (rest areas / welcome center) | 4 |
| Hotels with Truck Parking | 4 |
| Weigh Stations | 2 |
| Roadside Service | 2 |
| Tire & Repair | 2 |
| **Total** | **24** |

## Rows by city
Sheridan 7 · Gillette 7 · Buffalo 4 · Sundance 3 · Moorcroft 2 · Beulah 1

## Segments
- **A — West (10):** MT line → Sheridan → Buffalo. Common Cents Travel Plaza (Sheridan Exit 20), Love's #965 (Buffalo Exit 58) + its CAT Scale #3528, Cenex Zip Trip #60 (Buffalo I-90/I-25 junction), the Sheridan I-90 port of entry (~mile 16) and rest area/info center (mile 23), Bighorn Diesel & Equipment, Gills Point S Tire (Sheridan), plus Super 8 and Days Inn (Sheridan).
- **B — East (14):** Buffalo → Gillette → SD line. Red Eagle Food Store (Buffalo), Flying J #762 (Gillette Exit 126) + its CAT Scale, Cenex Travel Plaza (Gillette Exit 128), Coffee Cup Fuel Stop #5 (Moorcroft Exit 154), Sundance Travel Center (Exit 189), the Sundance port of entry, Pomp's Tire and Manning's Wrecker (Gillette), Red Lion and Howard Johnson (Gillette), the Moorcroft/Sundance rest areas and the Beulah welcome center.

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, Cenex/Coffee Cup, CAT Scale, Pomp's, WYDOT/WHP, Wyndham/Sonesta) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- Cross-segment reconciliation: the Love's Travel Stop #965 (Buffalo Exit 58) and its CAT Scale #3528 were each returned by both segments under differently-normalized names; each kept once (West part).
- Only two CAT Scales are verified on the corridor (Love's Buffalo, Flying J Gillette). A directory claim of a CAT Scale at Common Cents Sheridan was **not** corroborated by the CAT locator and was omitted, not fabricated.
- Buffalo Cenex Zip Trip #60 sits at the I-90/I-25 junction (exit left blank, junction noted in-description). Rest areas/welcome center with no town assigned the nearest named I-90 locality (Sheridan/Moorcroft/Sundance/Beulah).
- **Omitted, not fabricated:** no verifiable commercial truck wash on the corridor (the "307 Truck Wash" hit is in Casper, off-corridor); the closed Big Horn Travel Plaza (Buffalo); Ranchester Conoco (unconfirmed as a parking truck stop); several Gillette oilfield tire/towing outfits lacking verifiable address+phone.
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) WY production set. Separate from the I-80 Wyoming draft (Batch 48, southern cities) — no city overlap.

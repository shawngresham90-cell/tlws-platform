# Batch 57 — I-90 Idaho: Review Summary

CSV: `data/imports/i90-idaho-batch-057.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). Idaho has **0** existing production rows
— first coverage of the state. **Nothing has been imported to production.**

Covers the entire I-90 crossing of the **Idaho panhandle**, from the Washington
line at Post Falls east through Coeur d'Alene, Kellogg, and Wallace to Lookout Pass
at the Montana line.

## Totals
- Total rows in CSV: **11**
- ready-to-publish: **5** · import-unpublished (held): **6** · manual-review / reject: **0 / 0**
- Featured: **0**; TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by category
| Category | Rows |
| --- | --- |
| Truck Stops & Travel Centers | 3 |
| CAT Scales | 2 |
| Tire & Repair | 1 |
| Truck Washes | 1 |
| Roadside Service | 1 |
| Weigh Stations | 1 |
| Truck Parking | 2 |
| **Total** | **11** |

## Segment
- **A — Panhandle (11):** the Post Falls Exit 2 cluster (Love's #301 + Flying J #639, each with a CAT scale; Love's Truck Care; A1 Truck Wash), the Huetter Port of Entry + rest area/welcome center (MP8, near Coeur d'Alene), the small Junction Quick Stop (Cataldo Exit 34), and Jim's Towing mobile service (Kellogg).

## Accuracy & exclusions
- Every row web-verified 2026-07-15 against official brand/operator locators (Love's, Pilot/Flying J, CAT Scale, Idaho Transportation Dept) with directory sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: mobile-service and rest-area addresses/exits left blank where unverified.
- The Huetter rest area/welcome center carry an ITD reconstruction-closure notice (summer 2026), noted in-description.
- **Omitted, not fabricated:** no TA/Petro on I-90 in Idaho (nearest is Petro Spokane, WA); no hotel with source-verified dedicated truck parking; the in-town Kellogg Super Stop (big rigs reportedly struggle to maneuver).
- **No coordinates** (separate geocoding workflow). No internal duplicates; no collision against the (empty) ID production set.

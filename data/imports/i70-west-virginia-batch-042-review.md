# Batch 42 — I-70 West Virginia: Review Summary

CSV: `data/imports/i70-west-virginia-batch-042.csv` · verified 2026-07-15 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). West Virginia has **0** existing
production rows, so this is first coverage of the state. **Nothing has been
imported to production.**

This batch covers the entirety of I-70's crossing of **West Virginia** — the
interstate clips only the state's ~14-mile northern panhandle through Wheeling.
Truck services on this short stretch cluster at a single interchange, **Exit 11
(Dallas Pike)**, where both listings sit.

## Totals

- Total rows in CSV: **2**
- Expansion verdict — ready-to-publish: **1**
- Expansion verdict — import-unpublished (held, documented): **1**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| WV | 2 | 1 | 1 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 2 | 1 | 1 |
| **Total** | **2** | **1** | **1** |

## Corridor coverage

- Distinct I-70 exits represented: **1** — Exit 11 (Dallas Pike). This is the only
  interchange on the WV stretch with truck services.

## Rows by city

| City | Rows |
| --- | --- |
| Valley Grove | 1 |
| Triadelphia | 1 |

## Segment

- **A — Panhandle (2):** the whole WV crossing. TA Wheeling (Valley Grove, Exit 11)
  — a full-service travel center with CAT scale and repair bays — and the
  independent Dallas Pike Fuel Center (Triadelphia, Exit 11).

## Accuracy & exclusions

- Both rows web-verified 2026-07-15 against official brand locators (TA/Petro,
  CAT Scale) with directory sites (iExit, Allstays, West Virginia Tourism) as
  secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: the Dallas Pike Fuel Center's exact street address and ZIP
  are left blank because sources conflicted.
- **Omitted, not fabricated:** no Pilot/Love's/Petro/Flying J operate on this
  stretch, and no staffed weigh station could be confirmed — none were invented.
- **No coordinates** (geocoding is a separate verified workflow). No internal
  duplicates; no collision against the (empty) WV production set.

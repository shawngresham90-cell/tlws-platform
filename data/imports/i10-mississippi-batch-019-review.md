# Batch 19 — I-10 Mississippi: Review Summary

CSV: `data/imports/i10-mississippi-batch-019.csv` · researched 2026-07-14 · dry-run validated
against the live import parser (`prepareImport`) **and** the Expansion Readiness assessment
(`assessExpansion`). **Nothing has been imported to production.**

This batch continues the I-10 corridor eastward from Batch 18 (Louisiana), covering the short
but truck-heavy **Mississippi Gulf Coast** — the roughly 77 interstate miles from the Louisiana
line to the Alabama line at Grand Bay. **Mississippi** is a new state for the directory (0
existing rows), so there is zero overlap risk with anything already live.

The Gulf Coast is a compact corridor, so research was split across two segments (west and east
coast). Every facility was confirmed against an official brand locator and/or 2+ directory
sources; unverifiable fields were left blank rather than guessed.

## Totals

- Total rows in CSV: **12**
- Segments: West coast (6, Bay St. Louis–Gulfport) · East coast (6, Ocean Springs–Moss Point)
- Published flag: all rows imported **unpublished**.
- Featured = yes: **0**; TruckParkingClub URLs: **0**; affiliate codes: **0**.
- Coordinates: **none supplied** — geocoding is a separate verified workflow (all 12 rows
  flagged `needs-geocoding`).

## Rows by category

| Category | Rows |
| --- | --- |
| truck-stops | 5 |
| roadside-service | 3 |
| cat-scales | 2 |
| parking | 1 |
| tire-repair | 1 |

## Rows by city (west → east)

Gulfport (5) · Bay St. Louis (1) · Ocean Springs (1) · Gautier (1) · D'Iberville (1) ·
Pascagoula (1) · Moss Point (2)

## Curation & accuracy decisions

- **Gulfport is the real anchor**: Love's #595 (Exit 28) and Flying J #676 (Exit 31), each with
  its own CAT scale (listed as separate cat-scales rows), plus Truckworx Kenworth (Exit 34A) for
  heavy-duty service.
- **Moss Point (Exit 69)** is the eastern anchor: Pilot #586 (with CAT scale) and an adjacent
  Chevron diesel stop.
- **Honestly omitted** dedicated-truck-stop rows for Diamondhead, Bay St. Louis, Waveland, Pass
  Christian, Long Beach, Pearlington (west) — no verifiable truck stop found, only gas/convenience.
- **Omitted casinos** (Silver Slipper, Hollywood, Scarlet Pearl, Hard Rock) — no confirmed
  diesel/truck fueling and inconsistent overnight policies; these are off US-90, not directly I-10.
- **Omitted a new Highway 63 truck stop** — only early-2026 development news, not confirmed open.
- **Best Truck Parking (Gautier)** is a legitimate gated lot but sits ~4 mi south of Exit 61 on
  US-90 — noted honestly in its description.
- Blanks kept where sources conflicted: Chevron ZIP (39562 vs 39563), Pascagoula Tire phone (two
  numbers), and exit numbers for the two mobile/in-town service providers.

## Co-location (expected, not duplicates)

- **Gulfport Exit 28**: Love's #595 (truck-stop) + its CAT scale (cat-scales).
- **Gulfport Exit 31**: Flying J #676 (truck-stop) + its CAT scale (cat-scales).
- **Moss Point Exit 69**: Pilot #586 + adjacent Chevron — two separate operators, same exit.

## Staged import parts

| Part | Segment | Rows |
| --- | --- | --- |
| part1 | West coast (Bay St. Louis → Gulfport) | 6 |
| part2 | East coast (Ocean Springs → Moss Point) | 6 |

## Honest limitations

- **Coordinates deferred** — every row needs geocoding before map/near-me use.
- **Smaller batch by design**: the MS I-10 stretch is short and, outside Gulfport and Moss Point,
  genuinely thin on dedicated truck stops. Padding it with gas stations or casinos would violate
  the accuracy policy, so the batch is deliberately compact.
- **Research-grade candidate set, not a verified import.** Nothing written to production.

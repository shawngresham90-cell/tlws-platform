# Batch 66 — I-90 New York: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 3 parts: 100% clean. Master: total 57 / imported 57 / skipped 0 / duplicates 0 / errors 0. part1 (west) 15/15, part2 (central) 24/24, part3 (east) 18/18.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live New York production)
- New York existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation: Iroquois Service Area (MP 210 WB) kept once (East, with its EB pair Indian Castle). McCarthy Tire appears in West (Buffalo) and Central (East Syracuse) — distinct locations, both kept.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 24 / import-unpublished 33 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-new-york-batch-066-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 39 / median 63 / mean 62.2 / max 76; Good 24, Needs work 32, Incomplete 1. (Needs-work/Incomplete rows are Thruway service areas, small-town fuel stops and mobile roadside operators that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- The NY Thruway is a ticketed tollway; its on-highway stops are the Applegreen service areas (captured under Truck Parking); off-Thruway truck stops sit at numbered interchanges. Both included. Berkshire Connector (I-90 east of Albany) uses Bx exit numbers.
- Six distinct CAT scales verified corridor-wide, each kept once. Service areas use milepost identifiers (decrease eastbound).
- **Omitted, not fabricated:** no fixed permanent Thruway weigh stations (only the NYSDOT Schodack WIM inspection site listed); the "Blue Beacon Exit 35" in some summaries is Erie PA.
- **I-90 status:** WA, ID, MT, WY, SD, MN, WI, IL, OH (lakefront), PA, NY now covered as drafts. Remaining: MA (Mass Pike) to the Boston terminus completes I-90. (Indiana and the OH-west Turnpike skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)

# Batch 76 — I-95 New Jersey: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 33 / imported 33 / skipped 0 / duplicates 0 / errors 0. part1 (south) 16/16, part2 (north) 17/17.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live New Jersey production)
- New Jersey existing production listings: **0** (verified live via Supabase; the I-80 NJ batch is an unmerged draft). No dedup avoid-list vs live required.
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean at Woodbridge; no service-area overlap; the two E-Z Wheels CDL rows are distinct campuses (Hopelawn vs Elizabeth).

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 16 / import-unpublished 17 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-new-jersey-batch-076-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 54 / median 65 / mean 65.0 / max 76; Good 17, Needs work 16. (Needs-work rows are the NJ Turnpike service areas — which carry milepost/no-street addresses — plus mobile roadside operators that legitimately lack full address/amenity data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- In NJ, I-95 is the New Jersey Turnpike; the seven Turnpike service areas (Richard Stockton, Woodrow Wilson, Molly Pitcher, Joyce Kilmer, Thomas Edison, Grover Cleveland, Vince Lombardi) are the backbone truck-stop/parking facilities.
- Two CAT scales corridor-wide (Petro Bordentown, Pilot #1098 Port Newark). No CAT scale fabricated for the service areas (catscale.com lists none).
- No fixed public Turnpike weigh station with a verifiable address (NJSP roving enforcement) — category omitted, not fabricated.
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE, PA, NJ now covered as drafts. Next northbound: New York (GWB/Bronx → New England Thruway/I-95 → Westchester → CT line), then CT/RI/MA/NH/ME to Maine.

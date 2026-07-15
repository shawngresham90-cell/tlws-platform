# Batch 80 — I-95 Massachusetts: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 16 / imported 16 / skipped 0 / duplicates 0 / errors 0. part1 (south) 7/7, part2 (north) 9/9.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Massachusetts production)
- Massachusetts existing production listings: **0** (verified live via Supabase; the I-90 Mass Pike batch is an unmerged draft). No dedup avoid-list vs live required.
- In-batch name|city|state duplicates: **0**. Cross-segment boundary clean at Burlington; the Woburn facilities are distinct businesses.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 11 / import-unpublished 5 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i95-massachusetts-batch-080-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 55 / median 71 / mean 69.4 / max 80; Good 12, Needs work 4. (Needs-work rows are milepost weigh stations and rest areas that legitimately lack a street address and amenities.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- **Peabody Truck Stop is the only full truck stop on MA I-95; no CAT scale exists on the corridor (catscale.com lists none) — none fabricated.** The dense Boston metro/Route 128 beltway is otherwise tire/repair, towing, weigh stations, MassDOT rest areas and a hotel.
- Exit numbers use MA's 2021 milepost-based renumbering where known.
- **I-95 status:** FL, GA, SC, NC, VA, MD, DE, PA, NJ, NY, CT, RI, MA now covered as drafts. Remaining to complete I-95: New Hampshire (short Seabrook→Portsmouth stretch) and Maine (Kittery → Portland → Bangor → Houlton/Canada border).

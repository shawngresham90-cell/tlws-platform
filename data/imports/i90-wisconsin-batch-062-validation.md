# Batch 62 — I-90 Wisconsin: Validation Report

All checks run 2026-07-15 with the REAL production code, read-only. Nothing imported.

## Import parser (`prepareImport`)
- Master + 2 parts: 100% clean. Master: total 50 / imported 50 / skipped 0 / duplicates 0 / errors 0. part1 (west) 28/28, part2 (south) 22/22.
- 0 invalid categories, 0 malformed URLs, 0 coordinates, 0 over-length interstate/exit, 0 empty city. Column width 20 on every row.

## Duplicate detection (vs live Wisconsin production)
- Wisconsin existing production listings: **0** (verified live via Supabase). No dedup avoid-list required.
- In-batch name|city|state duplicates: **0**. Cross-segment reconciliation at the Portage node (Exit 108A): Petro #403 + its CAT scale each kept once (South, with the co-located Blue Beacon).
- Concurrency handled: I-90/I-94 (Tomah→Madison) and I-90/I-39 (Portage→Janesville) facilities are included as I-90; when I-94/I-39 are later covered these segments will be skipped.

## Expansion Readiness (`assessExpansion` vs live)
- ready-to-publish 23 / import-unpublished 27 / manual-review 0 / reject 0.
- slug collisions vs live + in-batch: **0**. dup hits: **0**.
- Per-row verdicts: `data/imports/i90-wisconsin-batch-062-expansion-report.csv`.

## Quality (`scoreCompleteness`)
- min 44 / median 64 / mean 63.1 / max 76; Good 23, Needs work 27. (Needs-work rows are mostly rest areas, weigh stations, CDL schools and convenience-store fuel stops that legitimately lack full amenity/phone data.)

## Notes
- No coordinates supplied (geocoding is a separate verified workflow).
- Nine distinct CAT scales verified corridor-wide (West Salem, Sparta, Tomah, Oakdale, Mauston, Portage, DeForest/TA Madison, Janesville/TA, Beloit/Pilot), each kept once after cross-segment dedup.
- Tomah's Kwik Trip #796 + CAT are signed I-94 Exit 143 at the I-90/I-94 split; interstate kept I-90 with the I-94 exit noted in-description.
- **Omitted, not fabricated:** the smaller Tomah Kwik Trip c-store; unverified Pilot dealer numbers at Oakdale Exit 47/27; hotels advertising truck parking on this stretch; the I-94-only Millston rest area.
- **I-90 status:** WA, ID, MT, WY, SD, MN, WI now covered as drafts. Remaining east: IL (Jane Addams tollway, distinct from the I-80 Chicago work), and the I-90-only OH-east/PA-Erie/NY (Thruway)/MA (Mass Pike) stretches to Boston. (Indiana and OH-west skipped — covered under I-80 Batches 52–53 via the I-80/90 concurrency.)

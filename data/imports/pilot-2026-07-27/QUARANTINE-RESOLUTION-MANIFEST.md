# Quarantine resolution — prepared package for the 13 authorized records

**EXECUTED 2026-07-28.** Database access returned; the live pre-flight
re-audit passed exactly (13/13 exempted neighbours matched their documented
identities, 2/2 clash rows unchanged, 4/4 enrichment targets still
published-and-coordless, 0 slug conflicts), and the package ran verbatim
with **zero guard failures**: mixed canary first (#17 MI, #35 IN, #700 OH,
#95 FL), audited, then the remainder. Measured after: live 2,274 (+9) ·
published 1,896 (+9) · with_coords 1,364 (+13) · published-unmappable 551
(−4) · flags 0 · 9/9 inserts route-usable · 4/4 enrichments mappable ·
space-fills exactly 42 (#1330) and 10 (#95), legacy counts 70 (#1550) and
175 (#353) preserved · control digest `4b5aed26…` byte-identical · held
rows untouched. **Gate 3a 809 → 818 of 820 · Gate 3b 788 → 801 of 803** —
the only remaining gap on both gates is #195 OR (needs page/parcel
evidence) and #749 VA (identity conflict).

## Scope

| Group | Records | Action |
|---|---|---|
| Net-new inserts | #282 CA, #46 KY, #17 MI, #266 NM, #387 NV, #303 OH, #12 OH, #35 IN, #700 OH | Insert unpublished (official values only) → separate guarded publish |
| Published-coordless enrichments | #1330 AR, #1550 AL, #353 KY, #95 FL | Blank-only: official coordinate + provenance; parking count **only** where currently NULL (#1330 → 42, #95 → 10; #1550 keeps 70, #353 keeps 175) |

**Explicitly out of scope, untouched:** #195 OR (needs independent
page/parcel evidence — 70 m gap), #749 VA (unresolved identity conflict),
#290 MD and #187 TN (closure review), every zero-space, Canadian, duplicate
or held record.

## How the guards stay whole

- **Collision guard:** unchanged box (±0.0015°). Each exception names one
  exact record and its exact documented neighbour UUID(s); the neighbour's
  name, category, publication state and in-box position are re-proven in the
  same transaction. **Any other published pin inside the box aborts** (the
  third-pin rule).
- **Store-number guard:** pattern unchanged. #35 and #700 exclude only the
  exact re-proven clash row by UUID (`1f830c7e` Family Express Rensselaer;
  `861f3ac4` the site's own CAT-scale row at 26415 Warns Dr) — a by-ID
  exclusion after identity re-proof, not a pattern change.
- **Blank-only:** each enrichment requires `lat IS NULL AND lng IS NULL` (and
  `parking_spaces IS NULL` where a count is staged) at write time.
- **Publish separately:** every insert lands unpublished and is published in
  its own guarded transaction requiring value-match + positive parking.
- Never written: `geo`, `is_indexable`, `is_featured`, `overnight_parking`,
  identity fields.

## Order

1. **Mixed canary:** #17 MI (adjacency insert) · #35 IN (store-number-scope
   insert) · #700 OH (own-companion insert) · #95 FL (enrichment).
2. Canary audit (read-only): rows published/mappable/positive, no forbidden
   flags, control digest unchanged, no unexpected pins.
3. Remainder: #282, #46, #266, #387, #303, #12 inserts; #1330, #1550, #353
   enrichments.

Rollback (`QUARANTINE-RESOLUTION-ROLLBACK.sql`, prepared before any write):
per-record value-matched — de-enrich only rows still holding exactly the
staged values with `batch-csv` provenance; unpublish-then-delete inserted
rows only when slug + source tag + values match.

## Expected movement — recompute live, never trust

If all 13 pass, **and** after the separately authorized 25-row publication
(which flips `is_published` only and moves no coordinate): +9 published
net-new locations; +4 published rows become mappable; live rows
2,265 → 2,274; published 1,887 → 1,896; with_coords 1,351 → 1,364 (+9
inserted pins, +4 enriched pins); published-unmappable 555 → 551;
**Gate 3a 809 → 818 of 820**; **Gate 3b 788 → 801 of 803**. Remaining gap
after both: #195 OR and #749 VA (−2 on each gate). These are diff targets
for the live audit, not results.

## Residual risks recorded honestly

- **#1330 AR:** the exempted "Diesel Truck Repairs" pin sits 48 m from the
  official ONE9 coordinate and is legacy `csv-import` data; the earlier
  review recommended confirming that pin's true parcel. This package
  re-proves everything provable in the database; if the legacy pin is
  actually misplaced onto the ONE9 lot, that is a *separate correction* to
  that row, and nothing here prevents or prejudges it.
- **#1550 AL:** Jack's Truck Stop and its wash share one identical legacy
  coordinate (a pre-existing duplicate-pin pair) — flagged for the legacy
  dedup backlog; not touched here.

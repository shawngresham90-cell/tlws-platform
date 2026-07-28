# Love's operator closeout — execution record (2026-07-28)

Executed under the operator-closeout authorization, serially, with a
committed rollback preceding every write phase. **Zero guard failures across
every transaction. Zero rollbacks used.**

## Phase 0 — verified before anything ran

- Baseline matched the authorization exactly: live 2,804 · published 2,416 ·
  mappable 1,945 · published-unmappable 515 · flags 0/0; full-table digest
  `d4a15c558232a5ea69b00154bdc46a5c`.
- Export checksum `ec5146ee…a89ab2` re-verified; accounting reproduced from
  the raw workbook: 731 = 604 + 127; 615 Travel Stops; 42 states; 49,976
  eligible spaces; 0 duplicate numbers.
- The 48-site gap reconciled to exactly 21 + 15 + 9 + 2 + 1
  (`CLOSEOUT-MANIFEST-2026-07-28.md`), with two universe corrections found
  and documented: #306 is absent from the export (identity conflict on the
  live row), and the 615th export row is #420 Flowood (held state-conflict).

## Phase 1 — the 15 verified matches PUBLISHED

Canary #435 VA · #412 NC · #480 TN · #371 SC · #338 GA · #316 FL (6 states),
then the remaining 9 (#415 #467 #603 #828 #894 FL · #405 #893 GA · #740
#790 SC). Every row re-proved in-transaction (unpublished, official pin with
`batch-csv|high|machine-checked` provenance, exact staged coordinate,
spaces > 0, overnight confirmed, unique slug, no pin collision). Only
`is_published` and `updated_at` changed. **15/15 route-usable after.**
Gate 2b measured 556 → **571**.

## Phase 2 — the 21 quarantined official inserts RESOLVED

Mixed canary #340 NV + #607 AR (store-number) and #577 AL + #305 VA
(adjacency), audited, then 9 more store-number records (#249 IL, #314 TN,
#328 AZ, #375 TX, #388 MS, #669 MO, #677 MS, #738 TX, #739 TX) and 8 more
adjacency records (#23 CO, #778 GA, #476 IA, #414 IN, #393 MS, #690 OH,
#823 OR, #539 TX). Each record: one guarded INSERT (unpublished) + one
guarded PUBLISH, with the exact clash/neighbour row re-proven by UUID
inside both transactions, exclusions scoped to those UUIDs only, and a
third-pin abort for anything unexpected. All values verbatim from the
checksummed export (21/21 verified pre-write). **21/21 inserted, published,
route-usable; all 22 neighbour/clash rows untouched.** Gate 2b 571 → **592**;
Gate 2a 592 → **613**.

## Phase 3 — the 9 coordinate candidates: 0 writes, honestly

Live re-measurement showed **six already carry the official coordinate
byte-for-byte** (#307 #325 #359 #698 #735 with legacy-NULL provenance, plus
#801 despite its interpolation label) — there is no replacement to perform.
The three that differ (#364 ≈ 199 m, #550 ≈ 22 m, #861 ≈ 210 m) all carry
`coord_verification_status = 'manually-verified'`, which the authorization
explicitly protects — **quarantined without change**, distances documented.
All 9 remain published/mappable; their only Gate-2b blocker is
`overnight_parking = false` on-row, and this authorization forbids
overwriting overnight status. The export confirms overnight = Y for all 9.

## Phase 4 — #451 IN and #317 VA

- **#451** (`1822b81f`): blank-fill of coords (39.551539, −86.044627) +
  70 spaces under an exact-neighbour exemption (Pilot #37 `7edab277`,
  ≈ 122 m, re-proven in-box in-transaction; third-pin abort). Row was
  already published + overnight-confirmed → **route-usable**. Gate 2b
  592 → **593**.
- **#317** (`5a5fa4df`): same blank-fill pattern (36.605447, −77.560647 +
  72 spaces; neighbour Pilot #4651 `8cb6aa2b` ≈ 166 m). Row remains
  **unpublished** — its `overnight_parking = false` fails the publish gate
  and the overnight write is not authorized; the post-check proved its
  visibility did not change.

## Phase 5 — #306 review and #201 protection + publication

- **#306 Dandridge TN** (`f6404302`): read-only review only. The conflict:
  the live published row claims store 306, and **the operator's 731-row
  export contains no store 306**. Required evidence before any action:
  operator confirmation of the Dandridge site's current store number, a
  renumbering record, or a closure record. Absence from one export is not
  grounds to unpublish; the row is untouched.
- **#201 Elk City OK** (`7acf5fa7`): already existed (inserted 2026-07-28
  with the 552 as a zero-space, non-overnight, unpublished directory
  record). UI audit found the detail page rendered a bare `Truck spaces: 0`
  with no overnight statement — inadequate. **PR #200** (separate, runtime
  only) added the explicit disclosure: zero renders "None reported by the
  operator", a visible warning notice ("do not plan a rest break or
  overnight stop here"), reserve-CTA suppression, and an 18-case harness.
  Merged `c4f4fb5` with CI + preview green; after the production deploy
  reached ready, #201 was published as **directory-only** (see addendum
  below). #197's trip-planner guard excludes it from every parking,
  overnight, fallback, corridor and last-stop path; it may legitimately
  appear for fuel/food needs. It counts toward 2a (already did) and never
  toward 2b.

## Addendum — final audit

(Recorded after the #201 publication; see `CLOSEOUT-MANIFEST-2026-07-28.md`
for targets and the final report for measured gates, counters and
fingerprints.)

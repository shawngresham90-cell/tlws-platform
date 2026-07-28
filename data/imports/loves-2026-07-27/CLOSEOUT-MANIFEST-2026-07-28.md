# Love's operator closeout — Phase 0 manifest (2026-07-28, pre-write)

Prepared and committed **before any write**, under the operator-closeout
authorization. Baseline re-measured live, not assumed.

## Baseline (measured at run start)

- Counters: live **2,804** · published **2,416** · mappable **1,945** ·
  published-unmappable **515** · featured/indexable **0/0**.
- Full-table digest `d4a15c558232a5ea69b00154bdc46a5c` (2,804 rows).
- Operator-scope digests: Love's scope (source tag or Love's-named)
  `cfbce5ea22f65ed1a1928bed21dfdaed` (688 rows) · Pilot source
  `f42622d5aea54e09da22a4834cf49ec6` (718) · TA/Petro name-scope
  `95229290299f857a84ac23268291ccf7` (380).
- Export checksum re-verified: sha256
  `ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2`.
- Accounting reproduced from the raw workbook: **731 = 604 + 127**;
  615 Travel Stops; 127 = 116 non-Travel-Stop (59 Country Store,
  52 Truck Service, 4 Car Stop, 1 Service Center) + 11 non-eligible Travel
  Stops; 42 states; 49,976 eligible spaces; 0 duplicate store numbers;
  every row classified exactly once.

## The 48-site route-usable gap — reconciled row-by-row (= exactly 48)

### A. Phase 1 — 15 verified matches to publish (all re-proven live: unpublished, official pin `batch-csv|high|machine-checked`, spaces > 0, overnight confirmed)

| Ref | State | UUID (8) | Spaces |
|---|---|---|--:|
| #316 | FL | ad67dd4a | 79 |
| #338 | GA | 89c2531c | 140 |
| #371 | SC | 22da63bd | 92 |
| #405 | GA | cb44453b | 78 |
| #412 | NC | 29c0000b | 55 |
| #415 | FL | d875c6d8 | 87 |
| #435 | VA | 025700b8 | 52 |
| #467 | FL | f31f9d24 | 130 |
| #480 | TN | d58e3dbf | 95 |
| #603 | FL | 8c6afd87 | 82 |
| #740 | SC | b2af1bed | 52 |
| #790 | SC | a5c289a1 | 97 |
| #828 | FL | 29e9199c | 77 |
| #893 | GA | a7cd01f6 | 97 |
| #894 | FL | aab7a84d | 64 |

### B. Phase 2 — 21 quarantined official inserts (all re-proven absent live; every clash/neighbour row re-proven by UUID)

Store-number coincidences (11): #249 IL (Pilot #249 `6facb8c4`), #314 TN
(Southern Tire Mart at Pilot #314 `6e837904`), #328 AZ (Pilot #328
`f71ab457`), #340 NV (Pilot #340 `ab253003`), #375 TX (Pilot #375
`cc28db2b`), #388 MS (Pilot #388 `f073d103`), #607 AR (Flying J #607
`394f5b7a` + its CAT row `32e1f8ab`), #669 MO (Flying J #669 `34e41995`),
#677 MS (Flying J #677 `d4680fe8`), #738 TX (Flying J #738 `ee6f90b1`),
#739 TX (Pilot #739 `e1a714de`).

Cross-operator adjacencies (10): #577 AL (Petro Shorter `aa7af198`),
#23 CO (TA Express Lamar `fdaa5d66`), #778 GA (Pilot #1390 `8dece562`),
#476 IA (Flying J #636 `297c5144`), #414 IN (Flying J #647 `8c80a1c5`),
#393 MS (TA McComb `18e05b55`), #690 OH (Pilot #8 `c8eeb6ab`),
#823 OR (Pilot #504 `b9e10477`), #539 TX (Pilot #1211 `41506782`),
#305 VA (Pilot #4642 `3f2f034c`).

(#234 TX — the 12th store-number clash — is a **non-overnight** Travel Stop
and is *not* in this authorization's 21; it stays quarantined.)

### C. Phase 3 — 9 official-coordinate candidates (live re-measured)

| Ref | UUID (8) | Live provenance | Live vs official coordinate | Disposition |
|---|---|---|---|---|
| #307 | 4c23e030 | ∅ (legacy csv-import) | **identical** | no replacement exists — no action |
| #325 | 6dbef08c | ∅ | **identical** | no action |
| #359 | a45b0906 | ∅ | **identical** | no action |
| #698 | ed2d89b5 | ∅ | **identical** | no action |
| #735 | 15f5c84b | ∅ | **identical** | no action |
| #801 | f4591f0b | interpolation\|medium\|manually-verified | **identical** | no action |
| #364 | 08d24d71 | interpolation\|medium\|manually-verified | differs ≈ 199 m | **QUARANTINED** — `manually-verified` status blocks overwrite per authorization |
| #550 | 371724fa | interpolation\|medium\|manually-verified | differs ≈ 22 m | **QUARANTINED** — same rule |
| #861 | 0b49a63f | interpolation\|medium\|manually-verified | differs ≈ 210 m | **QUARANTINED** — same rule |

All 9 are already published and mappable; their Gate-2b blocker is
`overnight_parking = false` on-row, and this authorization explicitly
forbids overwriting overnight status ("Do not overwrite … overnight
status"). They therefore **cannot enter 2b this run**; the export confirms
overnight = Y for all 9, so a future one-field authorization closes them.

### D. Phase 4 — 2 enrichment collision candidates

- **#451 IN** `1822b81f` — published, overnight **true**, coordless,
  spaces NULL. Blank-fill (coords 39.551539,-86.044627 + 70 spaces + exit)
  under exact-neighbour exemption (Pilot #37 `7edab277` at
  39.5511786,-86.0459880, ≈ 122 m away) → becomes route-usable.
- **#317 VA** `5a5fa4df` — unpublished, overnight **false**, coordless,
  spaces NULL. Blank-fill (coords 36.605447,-77.560647 + 72 spaces) under
  exact-neighbour exemption (Pilot #4651 `8cb6aa2b` at
  36.6069402,-77.5609570, ≈ 166 m). **Cannot be published this run** — the
  overnight publish gate fails and the overnight write is not authorized.

### E. Phase 5 — 1 held record + #201

- **#306 Dandridge TN** `f6404302` — published, coordless, 65 spaces,
  overnight true. **Read-only identity review only.**
- **#201 Elk City OK** `7acf5fa7` — **already exists** (inserted 2026-07-28
  with the 552 as a directory-only record: official coords, spaces = 0,
  overnight = false, unpublished, source `loves-master-2026-07-27`).
  No insert needed; pending the UI disclosure audit, only its directory-only
  publication remains. Ledger correction: LAUNCH-GATE 2a's "remaining 23"
  = 22 insert quarantines + **#306** (not #201, which is already counted
  among the 530 inserted).

**Total: 15 + 21 + 9 + 2 + 1 = 48 ✓**

## Universe corrections discovered during execution (measured, not assumed)

1. **#306 Dandridge is NOT in the export.** The 731-row workbook contains no
   store 306 (QUARANTINE.md §C). The live published row
   `f6404302 Love's Travel Stop #306` therefore claims a store number the
   operator's current directory does not list — that IS the identity
   conflict. It is **not** a member of the 615/604 gate universes; it is an
   extra live record held for independent operator evidence (current store
   number, closure, or renumbering). Absence from one export is never
   grounds to unpublish.
2. **The 615th export row is #420 Flowood MS**, disposition
   `net-new-state-conflict` (604 = 541 net-new + 62 update-existing + 1
   #420). It is held pending the Petro Florence relabel re-proof
   (QUARANTINE.md §D) and is NOT part of this authorization's 48.
3. Exact universe accounting: 615 = 552 staged + 62 update-existing +
   **#420 (held)**. The gate remainders below use this, not the earlier
   "remaining = #234 + #306" wording.

## Measured expectations under THIS authorization (recompute live, never trust)

- Gate 2b (604): 556 → **593** max (+15 P1, +21 P2, +1 #451 P4). Remaining
  11 = the 9 P3 rows + #317 (all blocked only by the unauthorized
  `overnight_parking` write — export confirms Y for all 10) + #420 (held).
- Gate 2a (615): 592 → **613** max (+21 P2). Remaining 2 = #234 TX
  (non-overnight quarantine, not in this authorization's 21) + #420 (held).
  #201's publication changes visibility only — it is already counted among
  the 530 inserted.
- Combined operator route-usable: 1,704 → **1,741** max of 1,754 (99.26 %).

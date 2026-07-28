# Love's overnight-confirmation closeout — pre-write manifest (2026-07-28)

Scope: the exact 10-record authorization — stores #307, #317, #325, #359,
#364, #550, #698, #735, #801, #861. The only field this run may change is
`overnight_parking = false → true` (plus automatic `updated_at`) on rows that
pass every pre-write condition. Nothing else — no coordinates, parking
counts, publication, identity, category, slugs, descriptions, indexability,
featured state, or `geo`.

## Requirement 1 — UUID resolution (committed manifest, never name-only)

Each store resolved from `CLOSEOUT-MANIFEST-2026-07-28.md` (8-char anchors)
to exactly one live row; full UUIDs confirmed live, one row per prefix:

| Store | UUID | State | City |
|---|---|---|---|
| #307 | `4c23e030-e4d3-473c-a3b8-cfafc1599bc4` | GA | Jackson |
| #317 | `5a5fa4df-c324-4405-bdb6-977ffb7f01a5` | VA | Skippers |
| #325 | `6dbef08c-6306-4db2-bccf-5da49a0a2ac8` | GA | Tifton |
| #359 | `a45b0906-ec99-4785-bfd6-afae328bc2aa` | GA | Emerson |
| #364 | `08d24d71-a131-473b-9ffd-cc56b92b5466` | TN | Charleston |
| #550 | `371724fa-2260-4d55-bbc7-0ddeeb680138` | GA | Valdosta |
| #698 | `ed2d89b5-609b-4e0e-91fa-bde1dbd93533` | GA | Macon |
| #735 | `15f5c84b-8284-455e-8928-c688f5a308ab` | GA | Calhoun |
| #801 | `f4591f0b-087b-4856-8957-5a7e020fa209` | GA | Cordele |
| #861 | `0b49a63f-9886-4ac2-a547-81b6ecda5d6f` | TN | Loudon |

Uniqueness proven: the only other live rows carrying these store numbers are
the seven known legacy companion rows (CAT Scale / Truck Care / Speedco at
the same complexes) — none is a competing Travel Stop identity, none is
touched.

## Requirement 2 — export re-verification

Workbook `LovesSearchResults.xlsx` sha256 re-verified:
`ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2`.
All ten refs report **overnight = Y**, type **Travel Stop**, spaces > 0.

## Requirement 3 — live row conditions (measured pre-write)

| Store | Published | Mappable | Spaces | overnight | Verdict |
|---|---|---|---|---|---|
| #307 | ✅ | ✅ | 50 | false | **PASS** |
| #317 | ❌ **unpublished** | ✅ | 72 | false | **QUARANTINED — fails "Published"** |
| #325 | ✅ | ✅ | 115 | false | **PASS** |
| #359 | ✅ | ✅ | 93 | false | **PASS** |
| #364 | ✅ | ✅ | 85 | false | **PASS** |
| #550 | ✅ | ✅ | 111 | false | **PASS** |
| #698 | ✅ | ✅ | 119 | false | **PASS** |
| #735 | ✅ | ✅ | 93 | false | **PASS** |
| #801 | ✅ | ✅ | 92 | false | **PASS** |
| #861 | ✅ | ✅ | 102 | false | **PASS** |

**#317 quarantine.** The authorization requires each live row to be
Published, and separately requires published totals to remain unchanged —
publishing #317 is therefore not authorized, and an unpublished row cannot
meet the condition. Per "abort and quarantine any mismatch; never weaken a
guard," #317 receives **no write**. Consequence: Gate 2b lands at
**602/604**, not the expected 603/604; the expected-results section itself
was marked "subject to live verification." #317's remaining blockers are
publication (unauthorized here) after which a future authorized
overnight-confirmation would make it route-usable.

Write set: **9 rows — 7 GA + 2 TN. No VA write** (VA's only member is #317).

## Requirement 4 — coordinate stability (all nine candidates unchanged)

- Official-exact and unchanged: #307, #325, #359, #698, #735, #801 (live
  coordinate = export coordinate byte-for-byte).
- Protected `manually-verified` coordinates retained unchanged:
  #364 (35.291951, −84.818048), #550 (30.77424, −83.29849),
  #861 (35.733196, −84.397797). No coordinate is written this run.
- #317 carries its blank-fill coordinate (36.605447, −77.560647,
  `batch-csv|high|machine-checked`) unchanged.

## Requirement 5 — rollback

`OVERNIGHT-CLOSEOUT-ROLLBACK.sql` — exact-ID, value-matched (id + current
coordinate + current spaces + overnight_parking = true), restoring
`overnight_parking = false` for each of the nine written rows. Committed
**before** any write. #317 has no rollback entry because it receives no
write.

## Requirement 6 — baseline fingerprints (measured 2026-07-28, pre-write)

Canonical serialization (identical query to the closeout record):

- Counters: live **2,825** · published **2,453** · mappable **1,968** ·
  published-unmappable **514** · featured/indexable flags **0**.
- Full-table digest: `3490fa2dd3206f73e4a6f62c7b410d0c` — byte-identical to
  the closeout record's post-run digest (zero drift since).
- Love's scope digest: `95812cf7903f97eb758c967dca41d9aa` (709 rows).
- Pilot scope digest: `f42622d5aea54e09da22a4834cf49ec6` (718 rows) — must
  be byte-identical post-write.
- TA scope digest: `95229290299f857a84ac23268291ccf7` (380 rows) — must be
  byte-identical post-write.
- Out-of-scope digest (non-Love's/Pilot/TA): `f847cddd31e8742dcfbc3a946fda8ed0`
  (1,018 rows) — must be byte-identical post-write.

## Execution plan

1. Canary, geographically diverse, one per written state: **#307 GA +
   #364 TN**, each in its own guarded transaction (re-prove id, name, state,
   published, mappable, spaces, overnight=false, exact coordinate
   in-transaction; `GET DIAGNOSTICS` must equal 1 or raise).
2. Verify the canary through the actual trip-planner recommendation
   contract: build candidates through the real loader mapping and assert
   `recommendParking` returns them with `overnightAllowed = 10`, and that a
   zero-space control row remains excluded.
3. If clean: the remaining 7 (6 GA + 1 TN) in guarded per-state transactions.
4. Post-write audit, gates, fingerprints, eligibility proof.

Do not touch: #420, #234, #306, #905, Pilot #195, Pilot #749, rest areas,
weigh stations, or any other row.

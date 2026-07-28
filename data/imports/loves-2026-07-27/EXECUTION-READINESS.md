# Love's — execution readiness, verified offline 2026-07-28

**EXECUTED 2026-07-28** after database access returned. Every live
pre-flight check below was performed and passed before any write; the
staging table was digest-proven against this package
(server md5 `4718c6212962261e801f1dbe2a1902b0` over the DB-normalized
projection of the same parse that reproduces `058b277e04faacea77c0a95e6680e43f`).
Results, quarantines (22 insert + 11 enrichment exclusions, each named with
its live clash row), the #340→#835 canary substitution, and the measured
final audit are in `EXECUTION-QUARANTINE-2026-07-28.md`. Outcome: 530
inserted · 51 enriched · **520 published** across 42 states · 0 non-overnight
or zero-space rows published · control digest byte-identical · rollbacks
(`ROLLBACK.sql` block 1 + `ROLLBACK-DEENRICH-51.sql`) committed before the
first write and unused.

The section below is preserved as written pre-execution (historical record).

---

**NOT EXECUTED. Zero database writes.** Prepared under the autonomous-run
authorization while database access was unavailable (the Supabase connection
returned a permission error on every call, read-only included). Everything
below that could be verified **without** the database has been verified
fresh; everything live-dependent is listed as a pre-flight check and marked
UNVERIFIED.

## Artifact re-verified

`LovesSearchResults.xlsx` sha256
`ec5146ee475af473d037ed4913e4f9b4c1059c737581ff93d2b2eefcc5a89ab2` —
recomputed 2026-07-28, matches `CHECKSUM.txt` and `SOURCE-ACQUISITION.md`.

## Accounting reproduced from the raw workbook (not from derivatives)

Parsed directly from the xlsx (banner row + header row skipped):

| | Count |
|---|--:|
| Source rows | **731** |
| Travel Stops | **615** |
| Country Store | 59 · Truck Service 52 · Car Stop 4 · Service Center 1 → non-Travel-Stop | **116** |
| **Eligible truck-parking Travel Stops** | **604** |
| Excluded / quarantined non-parking rows | **127** = 116 non-Travel-Stop + 11 non-eligible Travel Stops |
| States (eligible and all-TS alike) | **42** |
| Duplicate store numbers | **0** |
| Every row accounted exactly once | 604 + 127 = 731 ✓ |
| Stated spaces across the 604 | **49,976** |

Eligibility applied exactly as authorized: `StoreType = Travel Stop`, U.S.
coordinate envelope, exact finite coordinates, `ParkingSpaces > 0`,
`overnightparking = Y`, stable official store number.

The 11 non-eligible Travel Stops, individually: #167 Chickasha OK, #170
Chandler OK, #168 Walters OK, #171 McAlester OK, #166 Muskogee OK, #176
Cassoday KS, #233 Waller TX, #234 Katy TX, #419 Houston TX, #315 Houston TX
(all `overnightparking = N`), and **#201 Elk City OK** (zero spaces AND
overnight off — directory record only, never parking of any kind). They may
count toward gate 2a only, never 2b.

## Package state

- 42 guarded per-state INSERT transactions + 42 publish transactions, canary
  first; `loves-master-2026-07-27` source tag; enrichment metadata uses the
  schema-valid `batch-csv` (the constraint defect found during the TA run is
  already fixed here).
- 10-record canary: 10 states (CO FL IA IL MT NM NV TX WA WI), 10 corridors
  (I-5, I-10, I-15, I-35, I-40, I-70, I-80, I-90, I-94, I-95) — meets the
  geographic-diversity requirement as committed.
- Rollback, VERIFY, COVERAGE, CORRECTIONS and QUARANTINE files present.

## Items held, exactly as authorized

- **#618 Birch Run MI** (`c32686ff` + CAT companion `485085d9`) and **#306
  Dandridge TN** (`f6404302`): suspected live-page issues, untouched,
  documented in `QUARANTINE.md` for separate correction.
- **#420 Flowood MS** — *status changed since QUARANTINE.md §D was written*:
  the SC row `beb05d53` that falsely carried "Love's Travel Stop #420" was
  relabeled to its true identity (Petro Florence, TA/Petro Site 0393) and
  published under the TA closeout merged in PR #195. QUARANTINE.md §D is
  therefore historical. Flowood #420 remains **out of the package** and may
  be inserted only after a live re-proof that the Petro Florence correction
  still stands and no identity/slug/coordinate conflict remains — that
  re-proof requires database access and is UNVERIFIED today.
- Fuel-price columns: excluded — time-sensitive, never imported.

## Live pre-flight checklist — UNVERIFIED, blocks execution until run

1. Reconcile all 604 against the **current** live database (the committed
   reconciliation predates the Pilot execution of 2026-07-27: 709 inserted +
   695 published Pilot rows now exist, plus 25 more matched-row publications
   pending under their own authorization).
2. Expect new insert-time collision-guard hits at shared interchanges where
   Love's sits across from newly published Pilot/TA pins — **quarantine, do
   not weaken**; each becomes a documented review record exactly like the
   Pilot ten.
3. Fresh control + in-scope fingerprints before any write; per-row
   value-matched rollback regenerated against live values.
4. Canary first; audit directory visibility, map eligibility, positive
   parking, overnight confirmation, unique slugs and trip-planner
   eligibility; then remaining safe states, one guarded transaction each; a
   failing state rolls back alone and is quarantined.
5. Never write `geo`, `is_indexable`, `is_featured`; never import Canadian
   rows (this export has none — 42 U.S. states only); never publish a
   zero-space or non-overnight row as parking.

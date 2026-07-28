# Love's execution — live pre-write sweep results and quarantines (2026-07-28)

**EXECUTED 2026-07-28, zero guard failures.** Measured after completion —
every number below matched the pre-declared target exactly:

- Enriched **51 of 62** (all 51 carry the official pin with
  `batch-csv|high|machine-checked` provenance; 36 published rows became
  mappable).
- Inserted **530 of 552** across 42 per-state transactions (0 published or
  featured at insert; 0 missing coordinates; 10 non-overnight directory-only
  records — the 11th, #234 Katy TX, is quarantined under A1).
- Published **520** (10-record canary — 10 states, 10 corridors, all
  mappable/positive/overnight — then 42 per-state remainder transactions,
  510 rows). **0 non-overnight and 0 zero-space rows published.**
  42,469 published parking spaces added.
- Directory counters moved exactly as predicted: live 2,274 → **2,804** ·
  published 1,896 → **2,416** · with_coords 1,364 → **1,945** ·
  published-unmappable 551 → **515** · featured/indexable still 0.
- Love's-scoped control digest `49022eb9796052895445d2244f7e2f56`
  (2,116 non-Love's rows) byte-identical before and after. 0 duplicate
  slugs table-wide. Held rows (#618 Birch Run pair, #306 Dandridge and its
  Truck Care companion) re-verified untouched by identity.
- Staging table `public._loves_stage_20260728` dropped after the final audit.

**One write-shape deviation, documented:** the live schema constrains
`exit_number` to 20 characters. Nine staged rows carry longer official exit
strings (#846 AL, #803 IL, #782 KY, #497 NC, #667 NC, #744 OH, #167 OK,
#169 OK, #170 OK). These inserted with `exit_number = NULL` —
verbatim-or-nothing, never truncated — and the full values remain in
`INSERT-NET-NEW.sql` for enrichment if the column is ever widened. No other
field was altered.

The staging table `public._loves_stage_20260728` was loaded with all 552
net-new tuples and digest-proven against the committed package
(server md5 `4718c6212962261e801f1dbe2a1902b0` over the DB-normalized
13-column projection; the same parse reproduces the package digest
`058b277e04faacea77c0a95e6680e43f` byte-for-byte). The read-only pre-write
sweep then evaluated **the exact committed guard expressions** against the
live database. Every mismatch below is resolved by **excluding the record**,
never by weakening a guard.

## A. Insert quarantines — 22 of 552 (530 inserted)

### A1. Store-number guard (guard 4) — 12 refs

The guard refuses any staged ref whose `#number` already appears on a live
in-state row (excluding only `boss truck shop|speedco`). All 12 hits are
**same-number-different-brand coincidences** — Pilot / Flying J stores whose
independent numbering collides with a Love's store number in the same state.
None of the live rows is a Love's site, so these are *not* duplicates of the
staged stores; but exempting them would require named-record authorization
the current run does not include.

| Ref | State | Live clash row |
|---|---|---|
| #234 | TX | Pilot Travel Center #234 (`e78731c7`) |
| #249 | IL | Pilot Travel Center #249 (`6facb8c4`) |
| #314 | TN | Southern Tire Mart at Pilot #314 (`6e837904`) |
| #328 | AZ | Pilot Travel Center #328 (`f71ab457`) |
| #340 | NV | Pilot Travel Center #340 (`ab253003`) |
| #375 | TX | Pilot Travel Center #375 (`cc28db2b`) |
| #388 | MS | Pilot Travel Center #388 (`f073d103`) |
| #607 | AR | Flying J Travel Center #607 + its CAT Scale row (`394f5b7a`, `32e1f8ab`) |
| #669 | MO | Flying J Travel Center #669 (`34e41995`) |
| #677 | MS | Flying J Travel Center #677 (`d4680fe8`) |
| #738 | TX | Flying J Travel Center #738 (`ee6f90b1`) |
| #739 | TX | Pilot Travel Center #739 (`e1a714de`) |

### A2. Published-pin proximity guard (guard 5, ±0.0015°) — 10 refs

Cross-operator adjacency: the staged official coordinate sits within the
guard box of an already-published pin of a different operator (genuinely
adjacent truck stops at the same exit). Same doctrine as the Pilot line:
quarantine now; resolve only under a future authorization that names each
record and its exact neighbour.

| Ref | State | Published neighbour |
|---|---|---|
| #577 | AL | Petro Shorter (`aa7af198`) |
| #23 | CO | TA Express Lamar (`fdaa5d66`) |
| #778 | GA | Pilot Travel Center #1390 (`8dece562`) |
| #476 | IA | Flying J Travel Center #636 (`297c5144`) |
| #414 | IN | Flying J Travel Center #647 (`8c80a1c5`) |
| #393 | MS | TA McComb (`18e05b55`) |
| #690 | OH | Pilot Travel Center #8 (`c8eeb6ab`) |
| #823 | OR | Pilot Travel Center #504 (`b9e10477`) |
| #539 | TX | Pilot Travel Center #1211 (`41506782`) |
| #305 | VA | Pilot Travel Center #4642 (`3f2f034c`) |

## B. Enrichment exclusions — 11 of 62 (51 enriched)

### B1. Blank-only rule — 9 refs now carry coordinates

Since the package was authored, the interpolation enrichment line filled
coordinates on nine of the 62 targets (#364, #550, #801, #861 carry
`interpolation|medium|manually-verified` provenance; #307, #325, #359, #698,
#735 likewise verified non-null in the sweep). The blank-only guard would
abort on any of them, correctly. Upgrading an interpolated coordinate to the
official operator coordinate **overwrites a non-null value** and therefore
needs its own explicit authorization; documented here as a follow-up
candidate, untouched today.

Excluded: #307, #325, #359, #550, #698, #735, #801 (GA) · #364, #861 (TN).

### B2. ADDED published-pin collision guard — 2 refs

The committed ENRICH file had no published-pin proximity guard. One was
**added** (strengthening only — box ±0.0015°, self-excluded) and two targets
fail it against published cross-operator pins:

| Ref | State | Published neighbour |
|---|---|---|
| #317 | VA | Pilot Travel Center #4651 (`8cb6aa2b`) |
| #451 | IN | Pilot Travel Center #37 (`7edab277`) |

## C. Canary substitution — one record

`canary.json`'s NV pick, **#340 Las Vegas (I-15)**, is quarantined under A1
(Pilot Travel Center #340 exists in NV). To preserve the canary's authorized
property — ten distinct states on ten distinct corridors — the I-15 slot is
filled by **#835 Fillmore, UT (I-15, exit 163, 79 spaces, overnight
confirmed)**, which passes every guard. NV coverage still arrives through the
per-state publication of its remaining 7 stores (I-80 corridor).

## D. Untouched by design

- `CORRECTIONS.sql` was **not run** — it touches the #618 Birch Run MI pair
  and #306 Dandridge, which this authorization requires be left untouched
  (documented in `QUARANTINE.md`).
- #420 Flowood: §D of `QUARANTINE.md` is historical since the Petro Florence
  relabel; no action taken.
- The 11 non-overnight stores (#176 KS, #167/#170/#168/#171/#166 OK — plus
  zero-space #201 OK excluded upstream —, #233/#419/#315 TX; #234 TX also
  quarantined under A1) insert as **directory-only** records and are never
  published by the parking-publication files.

## Expected movement (recompute live, never trust)

Inserted 530 (unpublished) → enriched 51 (+51 pins, 36 of them on published
rows) → canary 10 → per-state remainder 510 → **520 published Love's rows**,
0 non-overnight published, 0 zero-space published. Counter targets: live
2,274 → 2,804; published 1,896 → 2,416; with_coords 1,364 → 1,945;
published-unmappable 551 → 515 (36 published-coordless Love's rows gain
pins; the other 15 enriched rows are unpublished).

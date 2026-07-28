# Love's overnight-confirmation closeout — execution record (2026-07-28)

Executed under the exact 10-record authorization (stores #307, #317, #325,
#359, #364, #550, #698, #735, #801, #861), serially, rollback committed
before any write. **Zero guard failures. Zero rollbacks used. 9 of 10
written; #317 quarantined on a pre-write condition, exactly as the
authorization's abort-and-quarantine rule requires.**

## Pre-write (all six requirements met before the first write)

1. **UUIDs** resolved from `CLOSEOUT-MANIFEST-2026-07-28.md` anchors to
   exactly one live row each — never name-only
   (`OVERNIGHT-CLOSEOUT-MANIFEST-2026-07-28.md`, requirement 1 table).
2. **Export** re-verified (sha256 `ec5146ee…a89ab2`): overnight **Y**,
   Travel Stop, spaces > 0 for all ten refs.
3. **Live conditions**: nine rows Published + Mappable + positive-parking +
   `overnight_parking=false` + exact official identity + unique.
   **#317 VA (`5a5fa4df`) is unpublished** → fails the Published condition.
   Publishing it is not authorized (published totals must stay unchanged),
   so it was **quarantined with no write** rather than weakening the guard.
4. **Coordinates unchanged**: six official-exact (#307 #325 #359 #698 #735
   #801); three protected `manually-verified` retained (#364, #550, #861).
   No coordinate written this run.
5. **Rollback** `OVERNIGHT-CLOSEOUT-ROLLBACK.sql` (exact-ID, value-matched,
   nine entries) committed at `bca977b` before any write. Unused.
6. **Fingerprints** captured pre-write: full `3490fa2dd3206f73e4a6f62c7b410d0c`
   (byte-identical to the previous closeout's post-run digest — zero drift),
   Love's scope `95812cf7903f97eb758c967dca41d9aa` (709), Pilot
   `f42622d5aea54e09da22a4834cf49ec6` (718), TA
   `95229290299f857a84ac23268291ccf7` (380), out-of-scope
   `f847cddd31e8742dcfbc3a946fda8ed0` (1,018). Counters 2,825 / 2,453 /
   1,968 / 514 / flags 0.

## Execution

- **Canary** (geographically diverse, one per written state): #307 GA +
  #364 TN, each in its own guarded transaction re-proving id, exact name,
  state, city, publication, exact coordinate, exact space count,
  `overnight_parking=false`, flags false, not deleted;
  `GET DIAGNOSTICS = 1` or raise. Both clean.
- **Canary verified through the actual trip-planner recommendation
  contract** (`scripts/verify-overnight-canary.ts`, 14/14): both canaries
  now returned by the real `recommendParking` with
  `overnightAllowed = 10`; a pre-flip twin proves the flip is worth exactly
  +10 and nothing else; the zero-space control (#201's exact live values)
  stays excluded from `recommendParking`, `rankCandidates`, and every
  last-stop slot even when explicitly free; `hasConfirmedTruckParking`
  unchanged.
- **Remainder**: 6 GA (#325 #359 #550 #698 #735 #801) in one guarded
  per-state transaction (per-row raise + batch total = 6 check), then
  1 TN (#861) in its own. All clean.
- Only `overnight_parking` and `updated_at` changed on exactly nine rows.

## Post-write audit

- Counters **unchanged**: live 2,825 · published 2,453 · mappable 1,968 ·
  published-unmappable 514 · flags 0.
- Full-table digest moved (authorized writes only):
  `3490fa2dd3206f73e4a6f62c7b410d0c` → `6629b77c7c39fb8e8bdc08c915b80bc9`.
- Love's scope digest moved: `95812cf7…` → `5eac572acab700a39e60df346864c988`
  (709 rows — count unchanged).
- **Pilot digest byte-identical** (`f42622d5…`, 718) · **TA digest
  byte-identical** (`95229290…`, 380) · **out-of-scope digest
  byte-identical** (`f847cddd…`, 1,018).
- Change window contains **exactly the nine authorized stores** —
  307, 325, 359, 364, 550, 698, 735, 801, 861 — and no other row.
- **No zero-space or unconfirmed row became eligible**: every route-usable
  Love's store number is inside the export's 604-store universe (offline
  set difference = ∅); the 20 legacy overnight-true rows with zero/null
  spaces predate this run, were untouched, and remain hard-excluded from
  recommendations by `hasConfirmedTruckParking`.
- #420, #234, #306, #905, Pilot #195, Pilot #749, rest areas and weigh
  stations: untouched (by-ID and by-scope digests above).

## Gates (measured, offline set intersection with the checksummed export)

- **Gate 2a: 613/615** — unchanged; missing #234 (quarantined
  non-overnight) + #420 Flowood (held state-conflict).
- **Gate 2b: 602/604** (was 593) — missing #317 (quarantined unpublished)
  + #420 (held).
- Pilot 3a/3b: **818/820 · 801/803** — untouched, proven by byte-identical
  scope digest.
- TA 4a/4b: **348/348 · 347/347** — untouched, proven by byte-identical
  scope digest.
- **Combined operator route-usable: 1,750 / 1,754 = 99.77 %**
  (Love's 602/604 + Pilot 801/803 + TA 347/347).
  The authorization's expected 1,751 assumed all ten rows would pass the
  pre-write conditions; #317's unpublished state was the one live mismatch,
  and the expected-results section was explicitly subject to live
  verification.

## #317 quarantine record

`5a5fa4df-c324-4405-bdb6-977ffb7f01a5` — Love's Travel Stop #317, Skippers
VA. Export confirms overnight Y + 72 spaces; row is enriched (coords +
spaces + provenance, 2026-07-28) but **unpublished**, and this authorization
neither publishes rows nor writes overnight flags on rows failing the
Published condition. No write was made. To make #317 route-usable a future
authorization must (a) publish it and (b) confirm its overnight flag.

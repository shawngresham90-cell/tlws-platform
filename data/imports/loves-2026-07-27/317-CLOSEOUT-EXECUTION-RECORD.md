# Love's #317 Skippers VA — single-record closeout (2026-07-28)

Executed under the dedicated #317-only authorization, immediately after the
9-record overnight-confirmation closeout (PR #202). **Two guarded
transactions, zero guard failures, zero rollbacks used. Exactly one row
changed.**

## Pre-write

1. **UUID** resolved from the committed manifest
   (`OVERNIGHT-CLOSEOUT-MANIFEST-2026-07-28.md` requirement-1 table), never
   name-only: `5a5fa4df-c324-4405-bdb6-977ffb7f01a5`.
2. **Reverified live + offline** against the checksummed export
   (`ec5146ee…a89ab2`): exact official identity (Love's Travel Stop #317,
   Skippers VA); export overnight = **Y**; **72** positive spaces; official
   coordinate 36.605447, −77.560647 byte-equal on the live row
   (`batch-csv|high|machine-checked`); currently **unpublished**;
   `overnight_parking = false`; unique slug
   (`love-s-travel-stop-317-skippers-va`), zero (name, state, city)
   composites, zero other Love's #317 rows; the only published pin inside
   the ±0.0015° box is the documented neighbour Pilot #4651 (`8cb6aa2b`,
   ≈166 m, different brand) — no unsafe collision.
3. **Rollback** `317-CLOSEOUT-ROLLBACK.sql` (exact-ID, value-matched, both
   transactions reversed in reverse order) committed at `7cc7425` **before**
   any write. Unused.

## Execution

- **TXN 1** (guarded, own transaction): `overnight_parking = false → true`
  + `updated_at`, with the row still unpublished; in-transaction re-proof of
  id, exact name/state/city, unpublished state, exact coordinate, exact
  spaces, flags false, not deleted; `ROW_COUNT = 1` or raise.
- **Audited while still unpublished**: `pub=false | overnight=true |
  spaces=72 | 36.605447,-77.560647 | flags=false/false` — only the overnight
  flag moved.
- **TXN 2** (guarded, separate transaction): `is_published = false → true`
  + `updated_at`; the guard requires `overnight_parking = true`, so the
  publish could not have preceded the confirmation; `ROW_COUNT = 1` or raise.

## Verification

- **Directory visible**: published + not deleted → true.
- **Map visible**: published + coordinates → true.
- **Actual trip-planner recommendation contract**
  (`scripts/verify-317-closeout.ts`, **15/15**): #317's exact live values
  are returned by the real `recommendParking` with `overnightAllowed = 10`
  and `coordinates = 8` (machine-checked); ranked for the `parking` need;
  outranks an overnight-false twin; a free-parking probe takes a last-stop
  slot. **Guards intact**: the zero-space control (#201's exact live
  values) and an unknown-count control stay excluded from
  `recommendParking`, `rankCandidates`, and every last-stop slot;
  `hasConfirmedTruckParking` unchanged (72 → true, 0 → false, null → false).

## Post-write audit

- Counters: live 2,825 (unchanged) · published **2,454** (+1, exactly #317)
  · mappable 1,968 (unchanged — the row already carried its coordinate) ·
  published-unmappable 514 · flags 0.
- Full-table digest `6629b77c7c39fb8e8bdc08c915b80bc9` →
  `8a463bce726468e391fdb823df2bf891` (authorized #317 writes only).
- **Pilot digest byte-identical** (`f42622d5…`, 718) · **TA digest
  byte-identical** (`95229290…`, 380) · **out-of-scope digest
  byte-identical** (`f847cddd…`, 1,018).
- The change window contains **exactly one row: Love's Travel Stop #317**.
- **Zero** zero-space or unknown-count rows became route-usable.
- #420, #234, #306, #905, Pilot #195, Pilot #749, rest areas, weigh
  stations: untouched.

## Gates

- **Gate 2a: 613/615** — unchanged (missing #234 quarantined non-overnight
  + #420 held).
- **Gate 2b: 603/604** (was 602) — remaining **#420 Flowood only**.
- Pilot 3a/3b **818/820 · 801/803** and TA 4a/4b **348/348 · 347/347** —
  untouched, proven by byte-identical scope digests.
- **Combined operator route-usable: 1,751 / 1,754 = 99.83 %**
  (Love's 603/604 + Pilot 801/803 + TA 347/347) — exactly the authorized
  expected result.

## Remaining operator route gaps (3)

1. **Love's #420 Flowood MS** — export's 615th row, held state-conflict.
2. **Pilot #195 OR** — held pending page/parcel evidence.
3. **Pilot #749 VA** — held pending identity resolution.

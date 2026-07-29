# M2 execution record — Love's overnight-status backfill (2026-07-29)

Executed the exact committed script (M2-BACKFILL-AS-EXECUTED.sql, commit
ee82d7b; value-matched rollback M2-ROLLBACK.sql committed alongside,
BEFORE the write). Single guarded transaction; every guard passed:

- Cohort re-derived by id (never name-only): source tag
  `loves-master-2026-07-27` (set by the checksummed-export guarded import)
  ∧ `overnight_parking = true` (set only under export overnight = Y in the
  evidenced closeouts, PRs #202/#203). Id-set fingerprint matched the
  authorized `d68a000a205e14cfd7c58b4e60da34dc`; count exactly 541; every
  row carried a positive parking count; the 10 unconfirmed Love's rows are
  outside the cohort by definition.
- Legacy csv-import true queue verified = 330 pre-write and NOT touched
  (Option A binding); all 330 remain `unknown` post-write.
- Wrote ONLY: overnight_status='confirmed',
  overnight_status_source='official-operator-export',
  overnight_status_verified_at=now() — on rows still 'unknown'
  (correction-safe). No 'prohibited' written anywhere. No mile_marker
  values (still 0 populated).

## Post-write audit (live)
- Totals: confirmed=541 · prohibited=0 · unknown=2,289 (sums to 2,830)
- Confirmed set: 541/541 Love's, 541/541 source-tagged, 541/541
  timestamped; confirmed id-set fingerprint =
  `d68a000a205e14cfd7c58b4e60da34dc` (identical to the authorized cohort)
- `overnight_parking` unchanged: true=871 / false=1,959
- Old-field digest byte-identical: `640482ae283d3445b88f8d32688cfce7`
  (2,830 rows)
- New-field fingerprint (id|mile_marker|mm_source|status|status_source):
  `125161f8ea510f6ddaef2d5f0630a0c5`
- M3 runtime switchover NOT implemented (per authorization) — no code
  reads the new columns; runtime behavior unchanged.

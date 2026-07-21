# Census coordinate approval runbook

The owner's step-by-step guide for approving the 745 Census-proposed
coordinates (`data/geocoding/census/census-review.csv`, PR #157). This is the
single gate the whole of Directory Phase 1 is waiting on: approvals lift
coordinate coverage from 6.8% to 66.3%, and unlock the 122 corridor
interpolation candidates in PR #158 (76.0% total).

The workflow below is **verified end to end offline**: the committed CSV
parses through the admin console's importer with zero errors, every row is
held back only by the two human gates (`action=manual-review`,
`confidence=medium`), and after the upgrade edit every one of the 745 rows
becomes applicable with **zero overwrites** (all target listings currently
have no coordinates). Re-verify anytime:

```bash
npx esbuild scripts/verify-census-approval-readiness.ts --bundle --platform=node \
  --format=cjs --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/verify-census.cjs && node /tmp/verify-census.cjs \
  data/geocoding/census/census-review.csv data/geocoding/dry-run/directory-snapshot.json
```

## Step 1 — Triage (highest scrutiny first)

Work these lists before bulk-approving anything:

1. **32 cross-validation disagreements** — rows marked `NO — investigate` in
   `data/geocoding/corridor-package/corridor-cross-validation.csv` (PR #158).
   The Census point and the corridor math disagree by more than 2 miles;
   one of them is wrong. Check the matched address in `census-review.csv`
   against the business name/exit before deciding.
2. **1 verification suspect** — flagged in
   `data/geocoding/census/census-verification.csv`.
3. **Spot-check a sample** (a few rows per state) against the
   `verification_notes` column, which carries the exact address the Census
   service matched.

## Step 2 — The approval edit

Open `census-review.csv` in a spreadsheet. For every row you ACCEPT, set:

- `action` → `ready`
- `confidence` → `high`

Leave rows you are unsure about untouched — the console can never apply a
`manual-review` row, so unedited rows are automatically held back. Delete
nothing; keep all other columns exactly as they are. (Leading apostrophes on
some cells are formula-injection guards; the importer strips them on upload.)

This edit **is** the approval — by design, nothing in the pipeline can make
a row applicable except this human change.

## Step 3 — Upload and apply at `/admin/directory/geocoding`

1. Upload the edited CSV. The server preview re-validates every row against
   the live listings (identity match on address/city/state, coordinate
   sanity, duplicate detection, stale-data guards).
2. Recommended: work in batches — filter by state or upload state-sized
   slices — so each apply is reviewable at a glance.
3. The default selection already excludes anything that would overwrite an
   existing coordinate (none expected here). Select → confirm → **Apply**.
4. Every apply writes `location_history` first and stamps provenance
   (`geocode_source`, `geocode_confidence`, timestamps). A per-listing
   rollback is available on the same page if anything looks wrong after.

## Step 4 — Tell the session it's done

After the last batch is applied, say the word and the following runs
(engineering side, ~1 hour):

1. Fresh SELECT-only production snapshot.
2. Regenerate the corridor interpolation package (PR #158) so all 122
   candidates rest on **verified** anchors — then you review that CSV the
   same way (it's already in the same 15-column format).
3. The consolidated Directory Completion Report (actual coverage, per-state,
   per-corridor, remaining workload, time to 90/95/100%).

No coordinate is ever applied by automation anywhere in this pipeline; the
console apply you perform in Step 3 is the only write path.

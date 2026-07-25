# Batch 75 — I-76/I-80/I-81 Pennsylvania: Validation Report

All checks run 2026-07-24 with the REAL production code, read-only. Nothing
imported. This batch is a **scaffold** (0 data rows); the checks below prove the
template is structurally correct and record the PA baseline for the future run.

## Template schema (`validateSchemaHeaders`, M5 harness)

Ran against `i76-i80-i81-pennsylvania-batch-075.csv`:

- **ok:** `true`
- **recognized columns:** 20 / 20 (canonical 20-column corridor subset)
- **unknown headers:** 0
- **missingRequired:** none (name + category present)
- **duplicateFields:** none

The 20-column header is the established corridor subset of the 32 canonical
import columns (`CANONICAL_IMPORT_COLUMNS`); the omitted 12 (coordinates,
parking flags, TPC/affiliate/image, published/featured) are optional.

## Importer (`prepareImport`, the real admin gate)

- Header-only template → `total 0`, and the importer correctly reports
  *"File needs a header row and at least one data row."* This is the **expected
  template state**: a submittable batch must add verified rows first. When rows
  are added, the target is `imported == total`, `skipped 0`, `errors 0`.

## Duplicate baseline (vs live Pennsylvania production)

- Pennsylvania existing production listings: **0** (verified live via Supabase,
  read-only). No dedup avoid-list required today — but the networked run must
  re-check dedup-vs-live PA at fill-in time, not rely on this snapshot.
- In-batch `name|city|state` duplicates: **0** (no rows).

## Coverage (`stateCoverageReport`, M5 harness)

- PA row present, `existing = 0` — consistent with the M5 coverage snapshot
  (`data/imports/coverage/state-coverage-2026-07-24.md`). PA remains one of the
  36 states + DC that are uncovered.

## Reproduce

```
# schema + importer check on the template
npx esbuild scripts/test-directory-harness.ts --bundle --platform=node \
  --format=cjs --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/t.cjs && node /tmp/t.cjs        # 59 passed

# PA dedup baseline (read-only)
select count(*) from public.locations where deleted_at is null and upper(state)='PA';  -- 0
```

## Blocker

Listing verification is blocked by outbound-fetch policy (WebFetch 403 across
all hosts; WebSearch returns non-dereferenceable summaries). See
`…-batch-075-sources.md` for the full record. No rows were fabricated.

# Phase 2B — Corridor Calibration & Supervised Geocoding Backfill

Dry-run artifacts for the staged coordinate backfill. **Nothing in this
folder writes to the database**; every candidate still goes through the
admin geocoding console's per-row human review, and nothing the pipeline
emits is ever auto-applicable (`action=manual-review`, confidence capped at
`medium` for interpolation; Census results are likewise review-only).

## Files

| File | What it is |
|---|---|
| `phase2b-report.json` | The full machine-readable report: totals, per-corridor interpolation, Census counts, concurrency normalizations, duplicate risks, stage summaries, projected coverage, confidence distribution, never-auto-geocode list, calibration detail + worklist. |
| `stage-a-candidates.csv` | The exact Stage A records in the admin console's reviewable batch contract. |
| `corridor-calibration-report.md` | Per-corridor anchor tables, gap analysis, anomaly tables (rejected/skipped anchors), calibration worklist, concurrency table. |

## The stages

| Stage | Contents | Gate |
|---|---|---|
| **A** | Interpolation candidates on the proven I-75 GA/TN calibration | Per-row manual review in the console |
| **B** | Candidates on newly calibrated corridors (empty today; grows as the worklist is anchored — concurrency-flagged rows such as Watt Road stay in D until a human confirms corridor identity) | Per-row manual review |
| **C** | Census exact (high-confidence) address matches | Per-row manual review |
| **D** | Medium/ambiguous/concurrency/conflict/unresolved records | Manual research queue only — never automatic |

No stage is applied without explicit owner approval after reviewing the report.

**Stale-review protection:** the apply action rejects any row whose
`current_latitude/current_longitude` no longer match the live listing — so
batches must be generated fresh (the pipeline fills `current_*` from the
snapshot) and re-generated after any apply. Hand-built correction rows must
copy the listing's current coordinates into `current_*` for the same reason.

## Concurrency normalization rules

Documented in `src/lib/directory/concurrency.ts` (`CONCURRENCY_RULES`) —
each rule carries state, tagged corridor, exit range, canonical corridor,
and a written justification. Normalization is **non-destructive** (original
`interstate`/`exit_number` values are never modified), **conservative**
(only documented segments), and **identity-safe** (never creates listings,
never touches slugs). Current rules: I-75→I-40 west of Knoxville TN (exits
368–385, the physical concurrency), I-24→I-40 through Nashville TN (exits
200–216, where I-24 carries I-40 mileposts). Concurrency-normalized rows
always stage as D — corridor identity must be human-confirmed before any
coordinate is proposed for them.

## Census geocoder

`src/lib/directory/census-geocoder.ts` implements the free US Census
service behind the `ExternalGeocoderAdapter` seam: injected fetch (offline
tests prove zero real calls), address normalization, PO-box/highway-only
rejection, tie/wrong-state/impossible-coordinate rejection, deterministic
confidence (Exact in-state → high; Non_Exact in-state → medium), retry with
exponential backoff on 429/5xx, and a politeness interval between batch
requests. **The Census service is unreachable from the build environment**
(egress proxy denies it), so this report carries zero live Census results;
run the batch from an environment with access and pass the results JSON as
the third argument to `geocode-stage-report` to fold them in.

## Reproducing

```
npx esbuild scripts/geocode-stage-report.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/geocode-stage-report.cjs && node /tmp/geocode-stage-report.cjs \
  data/geocoding/dry-run/directory-snapshot.json data/geocoding/dry-run/phase2b
```

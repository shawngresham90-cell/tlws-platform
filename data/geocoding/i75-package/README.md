# I-75 GA/TN interpolation review package

Generated from the committed snapshot (`snapshot_taken_at: 2026-07-21`,
SELECT-only export of `public.locations`) and the committed calibration set.
Fully reproducible offline — no network, no database, no clock:

```bash
# 1. rebuild anchors from verified data
npx esbuild scripts/build-calibration.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/build-calibration.cjs && node /tmp/build-calibration.cjs \
  data/geocoding/dry-run/directory-snapshot.json data/geocoding/dry-run/calibration.json

# 2. regenerate this package
npx esbuild scripts/i75-review-package.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/i75-review-package.cjs && node /tmp/i75-review-package.cjs \
  data/geocoding/dry-run/directory-snapshot.json \
  data/geocoding/dry-run/calibration.json data/geocoding/i75-package
```

| file | contents |
| --- | --- |
| `i75-full-dry-run-candidates.csv` | every interpolation candidate from the full snapshot (admin-console contract) |
| `i75-ga-tn-review.csv` | the I-75 GA/TN candidates for upload to `/admin/directory/geocoding` |
| `i75-ga-tn-rejected.csv` | in-scope missing-coordinate rows with no included candidate (incl. concurrency-excluded rows), with per-row reasons |
| `anchor-report.md` | every anchor used, by corridor, with source provenance |
| `outlier-report.md` | existing-coordinate outliers + near-duplicate flags |
| `plausibility-report.md` | per-candidate checks and the no-extrapolation guarantee |
| `summary.json` | machine-readable totals, confidence distribution, projected coverage |

Applying any row remains a human decision in the admin console (preview →
select → confirm → apply), which writes `location_history` first and stamps
provenance. This package cannot and does not modify the database.

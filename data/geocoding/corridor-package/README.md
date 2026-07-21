# Corridor interpolation expansion package (P1·S4)

Generated offline from the committed snapshot (`2026-07-21`), the
committed Census checkpoint, and the committed geocoding batch CSVs.
Deterministic: same inputs, same bytes. **No database access occurs.**

## Review order — this matters

1. **Approve the Census package first** (`data/geocoding/census/census-review.csv`
   in `/admin/directory/geocoding`). Most anchors below are unapproved Census
   matches (`census-pending-approval`).
2. `corridor-review-now.csv` uses **verified anchors only** (applied directory
   coordinates / human-researched batch rows) — reviewable at any time.
3. `corridor-review-after-census.csv` depends on Census anchors. **Do not
   apply these rows until the Census approvals land** — after they do,
   refresh the snapshot and REGENERATE this package so every anchor is a
   verified coordinate:

```bash
npx esbuild scripts/corridor-review-package.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/corridor-review-package.cjs && node /tmp/corridor-review-package.cjs \
  data/geocoding/dry-run/directory-snapshot.json \
  data/geocoding/census/census-results.json \
  data/geocoding data/geocoding/corridor-package
```

| file | contents |
| --- | --- |
| `corridor-review-now.csv` | candidates bracketed by verified anchors only (admin-console contract) |
| `corridor-review-after-census.csv` | candidates that depend on unapproved Census anchors |
| `corridor-cross-validation.csv` | Census match vs corridor math, miles apart; `comparison_basis` says whether the interpolation used verified anchors (independent) or other unapproved Census anchors (internal consistency only) |
| `corridor-rejected.csv` | missing-coordinate non-Census rows with no candidate, with reasons |
| `anchor-report.md` | every corridor, anchor counts and provenance, sanity rejections |
| `summary.json` | machine-readable totals, reconciliation, coverage projections |

## Headline

- Coverage now: 85/1252 (6.8%)
- After Census approvals: 830 (66.3%)
- After Census + these interpolation candidates: **952 (76%)**
- Candidates: 122 (verified-only 0, census-dependent 122; medium 93, low 29)
- Co-location flags: 84 candidates propose a point identical to ANOTHER listing's pending anchor, in 27 shared-point group(s) — each is flagged in its reviewer_notes (same exit ≠ same driveway; confirm distinct businesses before applying)
- Cross-validation, independent (verified anchors): 8 compared, 8 agree within 2 mi
- Cross-validation, census-internal (checkpoint consistency ONLY — adjacent Census results vs each other, NOT independent proof): 305 compared, 273 agree within 2 mi, 32 total disagreements flagged for review
- Reconciliation `missingCoords = censusMatched + reviewNowCsvRows + afterCensusCsvRows + rejectedCsvRows` (recounted from the emitted CSV text): HOLDS

Every candidate ships `action=manual-review` with confidence capped at
`medium`; the admin console (preview → select → confirm → apply, history-
first, provenance-stamped) remains the only path to the database.

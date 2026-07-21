# Census batch runner — worklist, checkpoint, review package

Artifacts of the Phase 1 · Step 3 **automated Census geocoder runner**
(`scripts/census-runner.ts` over the pure lib `src/lib/directory/census-runner.ts`).
Free federal service (geocoding.geo.census.gov) — no API key, no cost.

## The three steps

```bash
npx esbuild scripts/census-runner.ts --bundle --platform=node --format=cjs \
  --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
  --outfile=/tmp/census-runner.cjs

# 1. deterministic worklist (offline)
node /tmp/census-runner.cjs worklist data/geocoding/dry-run/directory-snapshot.json data/geocoding/census

# 2. THE NETWORK STEP — run on a machine with internet access (see below)
node /tmp/census-runner.cjs fetch    data/geocoding/dry-run/directory-snapshot.json data/geocoding/census

# 3. review package (offline, deterministic)
node /tmp/census-runner.cjs package  data/geocoding/dry-run/directory-snapshot.json data/geocoding/census
```

## Files

| file | contents |
| --- | --- |
| `census-worklist.csv` | every eligible row (missing coords + normalizable street address), sorted by id |
| `census-ineligible.csv` | rows the runner will never send (already has coords · PO box · highway-only · blank address · no city/state), with reasons |
| `census-results.json` | the resumable CHECKPOINT — raw classified results keyed by listing id; existing entries always win, so reruns are idempotent |
| `census-review.csv` | matched results in the admin console's 15-column contract — **every row `action=manual-review`** |
| `census-unresolved.csv` | fetched-but-unusable rows (no-match / tie / wrong-state / …) with reasons |
| `census-verification.csv` | every proposed coordinate cross-checked against state/corridor bounds |
| `summary.json` | counts, confidence split, verification flags, actual + clearly-labelled estimated coverage |

## Where the fetch step runs

The build sandbox blocks external hosts, so `fetch` is run by the owner (or any
network-capable machine/CI job): ~2 requests/second against the free service,
checkpoint saved every 25 results — safe to interrupt and rerun; it only fetches
rows not already in the checkpoint (`--limit N` for a bounded trial run, e.g.
`--limit 50`). Afterwards run `package` and commit the refreshed artifacts —
`package` is a pure function of (snapshot, checkpoint), so its output is
reproducible byte-for-byte offline.

## Safety guarantees

- The runner has **no database client** — it cannot read or write production.
- Network exists only inside the `fetch` subcommand, behind the same injected
  `CensusFetch` seam the adapter uses; **tests run fully offline** with fixture
  fetches (`scripts/test-census-runner.ts`).
- The review CSV inherits the adapter contract: every row is `manual-review`,
  deliberately never `ready` — a human must inspect and upgrade each row in
  `/admin/directory/geocoding` (which writes `location_history` first and stamps
  provenance) before any coordinate changes.

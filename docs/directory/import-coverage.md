# Directory import + coverage harness (M5)

Analysis and planning tooling for directory expansion batches. Everything here
is **pure and read-only-by-design**: it never inserts, never opens a database
client, and never fetches a URL. It reuses the canonical importer and shared
vocabularies — it does not fork them — and produces reports plus an insert
*plan* that a human reviews before any separately-authorized apply step runs.

## What it reuses (never re-implements)

| Concern | Canonical source | Used by |
|---|---|---|
| Parse + validate + dedupe a CSV | `prepareImport` (`src/lib/directory/import.ts`) | `validateBatchCsv`, `analyzeBatch` |
| The one write-gate schema | `listingSchema` (`src/lib/directory/admin.ts`) | via `prepareImport` |
| Dedupe key | `importDupKey` (`import.ts`) | dedupe checkers |
| Header vocabulary | `HEADER_MAP` → `recognizeHeader` / `CANONICAL_IMPORT_COLUMNS` (`import.ts`) | `validateSchemaHeaders` |
| Text normalization | `normalizeText` (`duplicates.ts`) | cross-type report |
| 50 states + DC | `DIRECTORY_STATES` (`states.ts`) | coverage report |
| Amenity list | `AMENITIES` (`amenities.ts`) | via schema |

The only additions to a canonical file are two **exports** on `import.ts`
(`CANONICAL_IMPORT_COLUMNS`, `recognizeHeader`) so the schema validator draws
from the importer's own map instead of a copy. No importer logic was changed.

## Files

- `scripts/imports/directory-coverage.ts` — coverage, dedupe (both directions),
  cross-type same-name, blanks-where-unverified, the insert plan, and the
  deterministic `analyzeBatch` that ties them together.
- `scripts/validation/validate-directory-batch.ts` — CSV cleanliness through the
  real importer, plus the provenance / verified-date / source-link validators
  the importer does not cover.
- `scripts/test-directory-harness.ts` — 59 offline assertions (schema, coverage,
  dedupe, cross-type, blanks, insert-only plan, determinism, dates, links,
  provenance). Run:
  ```
  npx esbuild scripts/test-directory-harness.ts --bundle --platform=node --format=cjs \
    --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
    --outfile=/tmp/t.cjs && node /tmp/t.cjs
  ```
- `data/imports/coverage/state-coverage-2026-07-24.md` — a real 50-states+DC
  coverage snapshot (read-only counts, no content read, nothing modified).

## 32-column schema validation

`validateSchemaHeaders(csv)` resolves every header cell through the importer's
own `recognizeHeader`. It reports: recognized `header → field` pairs, `unknown`
headers the importer would ignore, `missingRequired` (name + category are the
only hard requirements), and `duplicateFields` (two headers mapping to one
field). The canonical set is exactly **32 columns** (`CANONICAL_IMPORT_COLUMNS`);
existing corridor batches use a 20-column subset, which is valid — the extra 12
columns (coordinates, parking flags, TPC/affiliate/image, published/featured)
are optional.

## 50-states + DC coverage report format

`stateCoverageReport(existing, incoming?)` returns one row **per registered
state, always all 51**, each `{ code, name, existing, incoming, projected }`,
sorted by USPS code. Zero-coverage states are emitted deliberately — they are
the expansion map. `uncoveredStates(existing)` is the shortlist. The rendered
report (see `data/imports/coverage/`) adds coordinate and published breakdowns
from a read-only count query.

Current snapshot (2026-07-24): **1,252** live listings across **15** states;
**85** carry coordinates (GA 55 + TN 30); **1,167** are coordinate-free; **36**
states + DC are uncovered. Pennsylvania is uncovered — the M6 target.

## Per-state before / dry-run / after manifest

For each state a batch touches, the intended record is three numbers:

- **before** — `select count(*) … where state=$ and deleted_at is null` (the
  `beforeCountSql` the insert plan emits),
- **dry-run** — the insertable count from `prepareImport` (post-validation,
  post-dedupe), surfaced as `incoming`/`projected` in the coverage report,
- **after** — the same before-count query re-run once an authorized apply
  completes; it must equal `before + dry-run`.

## Dedupe (both directions)

- `existingDedupeCheck(incoming, production)` — incoming rows whose
  `importDupKey` already exists live (would be dropped by `prepareImport`).
- `incomingDedupeCheck(incoming)` — duplicate keys **within** the batch.
- `crossTypeSameName(existing, incoming)` — the same normalized name under more
  than one directory `type` (advisory: many real sites are multi-category).

## Blanks-where-unverified

`blanksWhereUnverified(incoming)` refuses any row carrying `lat`/`lng` without a
verified date. This is the guard against invented coordinates: a coordinate may
only ride along with provenance, otherwise it must be blank.

## Provenance / date / link validators

- `validateProvenanceFile(md, todayIso)` — parses a batch `sources.md` in the
  established `### Heading` + `- **Verified:**` + `- **Source:**` convention and
  flags any block missing a date or source, plus bad dates and bad links.
- `validateVerifiedDate(v, todayIso, required)` — ISO `YYYY-MM-DD`, a real
  calendar date, not in the future. Deterministic (today is injected).
- `validateSourceLink(raw)` — **shape only**. Accepts bare hosts/paths and
  prose named-sources; rejects non-http(s) schemes (`javascript:`, `data:`, …)
  and malformed URLs. It does **not** confirm the page exists.

### Source-link network check is gated

Live source-link verification (HEAD/GET each URL) is **not performed**: outbound
egress is restricted in this environment. `extractSourceLinks` returns the
dereferenceable URL set so a future run *with* network permission can layer a
real reachability check on top — no change to the batch is needed for that.

## Insert plan — insert-ONLY, transactional, reversible (DESIGN, not executed)

`buildInsertPlan(rows, batchLabel)` groups `prepareImport`'s insertable rows by
state and, per state, emits:

1. **before-count SQL** — the pre-insert row count for that state.
2. **insert-preview SQL** — a `begin; … commit;` scaffold stamped
   `source='<batchLabel>'`, guarded by a **slug-collision check** that
   `raise exception`s (aborting the state) if any incoming slug already exists
   live. It is **insert-only** — there is no `UPDATE` in the plan, so no
   existing row is ever touched.
3. **rollback SQL** — `delete from public.locations where source=$ and state=$
   and slug in (…)`, removing exactly this batch's inserted rows and nothing
   else.

State-by-state: one state's failure aborts only that state. The plan is a
document a human reviews; **executing it requires separate explicit
authorization** and a fresh before-count immediately prior.

## Never, in this milestone

No `INSERT`, no migration, no network fetch, no coordinate invention, no change
to any existing row. The 85 coordinated rows and every other live row are
untouched. This harness only reports and plans.

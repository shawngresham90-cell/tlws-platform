# TA/Petro interstate + exit enrichment — checkpoint

Populating `interstate` and `exit_number` on the 304 published TA/Petro rows from
the **authoritative operator location master**. Writes only those two fields, only
where currently blank. Never touches `is_published`, `is_indexable`, `geo`,
coordinates, names, slugs, categories, descriptions, or `completeness_score`.

- **Source label:** `official-ta-petro-20260725-5ebe0e9f`
- **Evidence source:** `data/imports/locmaster20260725.xlsx`, **sha256
  `5ebe0e9f034153536fe3946a3e5cc3d5a45c9a59b010131d5ccee20e21553303`**, column
  **Directions** (master date 2026-07-25). This sha256 matches the provenance
  recorded in `ta-petro-review.csv` for the original import — the same official
  operator master that sourced the 304 rows. Interstate + exit are read verbatim
  from the Directions text (e.g. `I-85/I-40 & Hwy 61, Exit 138`). No coordinate
  inference, no search snippets, no store-name/city guessing.
- **Project:** `tlws-platform` (`cgvxwvymkembftznhcdl`), Postgres 17.

## Format / normalization (matches the 1,241 existing rows and the route code)

- `interstate` = `I-<number>` (single primary). For a concurrency the operator's
  own first-listed interstate is used; all listed interstates are recorded in the
  manifest (`all_interstates`, `concurrency: true`). Verified against
  `interstateSlug()` — every value maps to a valid `/directory/i<n>` corridor.
- `exit_number` = `<number>` with an optional adjacent letter (`138`, `15B`).
  Verified against `exitSlug()` — every value maps to `/directory/i<n>/exit-<n>`.

## Decisions (from the master Directions, per row)

| Decision | interstate | exit_number |
|---|--:|--:|
| approved (written) | 264 | 239 |
| not-applicable — operator locates it on a U.S./state highway, not an Interstate | 40 | 65 |
| unresolved — Directions list multiple direction-dependent exits (quarantined) | 0 | 11 |
| both fields written | | 239 |
| interstate written, no numbered exit in Directions | | 25 |

The 40 N/A + 11 unresolved + N/A-exit rows are detailed in `UNRESOLVED-and-NA.md`.
They are deliberately left blank — authoritative evidence of absence/ambiguity,
not missing research. `is_indexable` is never changed and stays 0/304.

## Manifest — statically proven against the live DB

| Check | Expected | Actual |
|---|--:|--:|
| interstate approved / distinct | 264 / 264 | 264 / 264 |
| exit approved / distinct | 239 / 239 | 239 / 239 |
| all in the 304 batch | 264 / 239 | 264 / 239 |
| all currently blank in that field | 264 / 239 | 264 / 239 |
| exit approved without interstate approved | 0 | 0 |

Manifest-integrity + normalization tests: `scripts/test-ta-petro-enrichment.ts`
(2,492 assertions) — format, evidence-support, slug round-trip, decision vocab.

## Pre-execution fingerprints (baseline)

- Batch, excluding `interstate`+`exit_number`+`updated_at`: `a85163de48e0381348b10a0fb3ee81a5`
- Pre-existing 1,252 rows, full (incl. every field): `214b7e0586bd5f641e8f5874f2de6b57`
- batch published 304, is_indexable 0, has_interstate 0, has_exit 0.

## Pass plan (each state its own guarded block; blank-only; exact ROW_COUNT)

Canary (10 rows, distinct states + interstates: AL AR AZ CA CO CT FL GA IA ID)
runs first and is audited before the passes. ENRICH passes exclude the canary
rows, so their per-state counts are exact.

| Pass | States | interstate | exit |
|--:|---|--:|--:|
| canary | 10 distinct states | 10 | 10 |
| 1 | AL AR AZ CA CO CT FL GA IA ID | 48 | (see expectations.json) |
| 2 | IL IN KS KY LA MI MN | 48 | |
| 3 | MO MS MT NC ND NE NH NJ NM NV | 49 | |
| 4 | NY OH OK OR PA RI SC | 49 | |
| 5 | SD TN TX UT VA WA | 44 | |
| 6 | WI WV WY | 16 | |
| **total** | | **264** | **239** |

## Artifacts

| File | Purpose |
|---|---|
| `manifest-enrichment.json` | Per-row approved interstate/exit, decisions, evidence, concurrency |
| `SOURCE-EVIDENCE.csv` | Per-value source: master file + sha256 + Directions text + master date |
| `ENRICH.sql` | Per-state guarded blocks (blank-only, VALUES-join, ROW_COUNT), by pass |
| `CANARY.sql` | 10-row canary |
| `ROLLBACK-canary.sql` / `ROLLBACK-full.sql` | Revert exactly what we wrote (id+value match) |
| `AUDIT.sql` | Read-only audit + corridor coverage |
| `expectations.json` | Per-pass / per-state counts + canary ids |
| `UNRESOLVED-and-NA.md` | The N/A and quarantined rows, with evidence |

## Execution log

Executed 2026-07-25 via the project's authenticated Supabase SQL connection.
Canary first, then 6 passes; each state its own guarded block (blank-only
UPDATE, VALUES-join, `GET DIAGNOSTICS ROW_COUNT` per field). **Every guard passed
on the first attempt — zero exceptions, zero rollbacks, zero quarantines.** After
each pass a read-only audit confirmed the running totals, formats, and both
fingerprints.

| Step | States | interstate | exit | cumulative interstate | cumulative exit |
|---|---|--:|--:|--:|--:|
| canary | 10 distinct | 10 | 10 | 10 | 10 |
| pass 1 | AL AR AZ CA CO CT FL GA IA ID | 48 | 42 | 58 | 52 |
| pass 2 | IL IN KS KY LA MI MN | 48 | 45 | 106 | 97 |
| pass 3 | MO MS MT NC ND NE NH NJ NM NV | 49 | 42 | 155 | 139 |
| pass 4 | NY OH OK OR PA RI SC | 49 | 45 | 204 | 184 |
| pass 5 | SD TN TX UT VA WA | 44 | 39 | 248 | 223 |
| pass 6 | WI WV WY | 16 | 16 | 264 | 239 |

At every audit: live 1,556; batch 304; published 304; **is_indexable 0**;
pre-existing 1,252 with 0 touched; 0 malformed interstate/exit; 0
exit-without-interstate; 0 duplicate detail_slug; 0 geo writes. The batch
fingerprint (excl. the two enrichment fields + `updated_at`) held constant at
`a85163de48e0381348b10a0fb3ee81a5` and the pre-existing full digest at
`214b7e0586bd5f641e8f5874f2de6b57` through every pass — proving only
`interstate`/`exit_number` moved, and only on batch rows.

## Final audit (live, read-only)

| Check | Target | Actual |
|---|--:|--:|
| Live rows | 1,556 | 1,556 |
| TA/Petro batch | 304 | 304 |
| Published | 304 | 304 |
| **is_indexable** | **0** | **0** |
| interstate populated | 264 | 264 |
| exit_number populated | 239 | 239 |
| malformed interstate / exit | 0 / 0 | 0 / 0 |
| exit without interstate | 0 | 0 |
| pre-existing rows | 1,252 | 1,252 |
| pre-existing rows touched | 0 | 0 |
| duplicate detail_slug | 0 | 0 |
| geo writes | 0 | 0 |
| batch fingerprint excl. interstate/exit/updated_at | `a85163de…` (baseline) | `a85163de…` |
| pre-existing full fingerprint | `214b7e05…` (baseline) | `214b7e05…` |

Only `interstate` and `exit_number` changed, only on batch rows. `is_indexable`
was never written. No insert/delete/schema/migration/trigger/policy/app-code
change. Held/excluded networks untouched.

### Directory value unlocked

- **52 interstate corridors** now carry published TA/Petro rows (top: I-80 ×28,
  I-10 ×23, I-20 ×20, I-70 ×19, I-40 ×17, I-90 ×15) — up from ~5 interstates
  present in the whole table before. ~48 new `/directory/i<n>` corridor pages.
- **239 exit pages** (`/directory/i<n>/exit-<n>`) become resolvable.
- Corridor/exit pages render on-demand (ISR `revalidate=300`, `dynamicParams`
  true); `interstateBySlug()` synthesises corridor entries for any `I-<n>`.

### Local checks

`format:check`, `lint`, `typecheck` clean; **`npm test` 61/61 harnesses**
(incl. the new `test-ta-petro-enrichment` with 2,492 assertions); `npm run build`
success with no generated-file drift.

### Production reachability

The sandbox egress policy blocks WebFetch to `ta-petro.com`, state DOT sites,
and Wikipedia (403); the authoritative interstate/exit values came from the
in-repo operator master (`locmaster20260725.xlsx`), not the live web. The
production domain is likewise unreachable from here, so corridor/exit pages were
verified via the database query paths and the app's `interstateSlug()` /
`exitSlug()` / `isDetailIndexable()` contracts rather than fetched. A
geographically diverse URL sample is in the PR for manual inspection.

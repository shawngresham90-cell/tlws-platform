# Directory Growth, Monetization & Data-Quality System (Milestone 21)

Implementation plan and decisions of record. Written after a full audit of the
directory stack (M12–M20) and before implementation. This milestone ships in
**one draft PR** on branch `feat/directory-growth-system` and is verified on
the Netlify deploy preview only. **Nothing is merged, deployed, applied, or
written to production.**

## Existing architecture (audit summary)

- **Data**: `public.locations` (139 rows live: 119 published / 20 unpublished /
  45 with coordinates), RLS anon-read published-only; `location_history`
  (45 geocoding records; `source` CHECK-constrained to
  `submission | review | admin-edit | merge | closure | geocoding`);
  `location_reviews` + `location_submissions` (moderated, RLS no-anon);
  `location_duplicate_ignores` (pair table, `a < b`).
- **Slugs**: composite `slug` (unique per type/state/city) + globally unique
  `detail_slug` (migration 022: backfilled, NOT NULL, BEFORE INSERT trigger).
  Detail pages at `/directory/location/[slug]`; admin regeneration is
  deterministic and warn-gated; no redirects exist yet.
- **Admin**: env-gated (`requireAdmin()`, HMAC cookie), service-role reads in
  `lib/admin/*`, all writes through server actions
  (`app/admin/(dashboard)/directory/actions.ts`), `revalidatePath` after
  writes, history-first for community/geocoding changes.
- **Bulk tooling**: CSV import/export (`lib/directory/import.ts`, RFC-4180
  parser in `csv.ts`, `IMPORT_LIMITS`), duplicates
  (`lib/directory/duplicates.ts` bucketed pair finder + ignore table),
  geocoding batches (`lib/directory/geocoding.ts` — 15-column CSV contract,
  id+address identity cross-check, `ready`+`high`-only applicability).
- **Public**: category/state/interstate/exit/parking/map/detail pages, ISR 300,
  anon client fails soft to empty; `tpc_url` column EXISTS end-to-end (schema,
  zod `httpUrl`, admin form, CSV import/export, cards/popups/detail CTA with
  `rel="sponsored noopener noreferrer"`) but is **null on every live row**.
- **Verification**: `prod-health-check.yml` (19 routes + content asserts) and
  `preview-smoke.yml` (detail-page suite) — both dispatch-only, read-only GETs.
- **Tests**: pure-lib scripts (`scripts/test-*.ts`, esbuild+node), 144 checks
  across geocoding/map/detail suites.

## Non-negotiables honored in this milestone

- Additive migrations only, **committed but NOT applied** to production.
- No production writes of any kind. Apply-style admin actions are built and
  unit-tested (dry-run pure functions) but never executed against live data.
- No paid APIs, no new services, no auth/payments/Books/Apps/Academy changes.
- One branch, one draft PR, deploy preview must be green.

## Migration plan (committed, unapplied)

`supabase/migrations/023_directory_growth.sql` — additive only:

1. `directory_slug_redirects` — `old_slug` (unique) → `location_id`,
   `created_at`, `created_by`, `reason`. RLS enabled, **anon SELECT policy**
   (redirects are public routing data; they contain only slugs). Redirect
   resolution joins `locations` for the CURRENT `detail_slug`, so a redirect
   row never goes stale and chains collapse to one hop by construction.
2. `location_pair_decisions` — persisted duplicate-review outcomes
   (`a`,`b` ordered pair unique, `decision` in
   `co-located | not-duplicates | duplicate-confirmed`, `note`, `admin`,
   `created_at`). RLS enabled, no anon policy.

**Because 023 is not applied, all code paths that touch these tables detect
the missing relation and degrade**: the detail route skips redirect lookup
(unknown slugs 404 exactly as today), slug regeneration REFUSES to run
(redirect-first is mandatory; without the table it aborts with a clear
message), and pair decisions fall back to the existing ignore table for
exclusion with a notice that reasons need migration 023.

## Feature plan

- **P2 TPC**: `lib/directory/tpc.ts` (pure): strict URL validation
  (https + `truckparkingclub.com` apex/`www` only, reject credentials/ports/
  IPs/deceptive subdomains, normalize trailing slash), candidate detection,
  duplicate-URL and category warnings. `/admin/directory/tpc`: stats,
  candidates, warnings, CSV export, correction-CSV upload → server-side
  validation → identity cross-check (same contract as geocoding: id +
  city/state, address when both sides have it) → row selection → explicit
  confirm → history-first apply (source `admin-edit`; the CHECK constraint
  forbids new sources — decision: reuse `admin-edit` with a note prefix).
- **P3 Completeness**: `lib/directory/completeness.ts` — 0–100 deterministic,
  documented weights, category-aware (weigh stations aren't punished for no
  phone/website/TPC; only parking-capable categories are scored on TPC/space
  count). Labels: Excellent ≥85, Good ≥65, Needs work ≥40, Incomplete <40.
  Admin-only display. **Decision: no public completeness badge** — the only
  public trust surface is the factual "Information last verified" date
  (already on detail pages when `verified_at` exists); a numeric quality badge
  on incomplete-but-legitimate businesses would be misleading.
- **P4 Quality**: `/admin/directory/quality` — `lib/directory/issues.ts`
  (pure detectors: missing/malformed fields, stale verification >365d,
  duplicate coords/addresses/names, TPC candidates, suspicious slug,
  indexability) + completeness distribution + severity + filters + CSV export
  (formula-injection-guarded). Server-rendered, capped tables + full CSV.
- **P5 Corrections**: `lib/directory/corrections.ts` (pure parse/validate/
  diff): field allowlist (safe directory data only — never status/moderation/
  internal fields), header validation, stable identity (listing_id +
  city/state cross-check), duplicate detection, per-field validators reusing
  `listingSchema` fragments, blanking flagged as destructive, unrelated
  fields never touched (only columns present in the CSV are diffable, only
  selected rows apply). `/admin/directory/corrections`: upload → preview
  (current vs proposed, warnings) → row selection → confirm → history-first,
  per-row atomic apply → success/failure report + failure CSV.
- **P6 Slug redirects**: table above; `lib/directory/redirects.ts`
  (fail-soft lookup + loop/collision guards, pure planning helpers);
  detail route: exact match → redirect lookup → `permanentRedirect` to
  current canonical only when target is published (unpublished/deleted →
  404); regeneration action rewrites: history + redirect row BEFORE the slug
  update, abort on any failure; self/loop rows pruned (`old_slug` equal to
  the new slug is deleted, uniqueness upsert-guarded).
- **P7 Geocoding console**: extend the CSV contract with OPTIONAL evidence
  columns (`confidence_reason`, `source_count`, `source_urls`,
  `last_researched`, `reviewer_notes`, `side_of_road_confirmed`,
  `property_confirmed`, `priority`, `concern_flag`, `status`) — 15-column
  files stay valid. Console gains summary counts, filter/sort, per-row
  evidence drawer, OpenStreetMap links, staging-file export of the selected
  subset, and a review-queue download. No coordinates applied; no research.
- **P8 Duplicates**: `lib/directory/colocation.ts` — deterministic pair
  classifier over the existing finder's signals + phone/website/category/
  exit: `exact-duplicate`, `probable-duplicate`, `co-located`,
  `shared-address-sub-service`, `brand-multi-exit`, `same-coords-diff-category`,
  `similar-name-diff-address`, with per-signal reasons. Admin page shows
  class + reasons, decision actions (co-location / false positive), CSV
  export. Never auto-merges or deletes.
- **P9 Trust**: `lib/directory/trust.ts` — status from stored evidence only
  (`verified_at` recency, geocoding history, approved reviews/corrections):
  `recently-verified` (≤90d), `verified` (≤365d), `community-confirmed`
  (approved review/correction evidence), `needs-reverification` (>365d),
  `unverified`. Admin filter on quality page. Public wording stays
  "Information last verified [date]" only.
- **P10 Expansion**: `/admin/directory/expansion` — template download,
  vocabulary docs (from the real registries), upload → readiness report
  (import-parser reuse + slug preview + duplicate preview vs live refs +
  completeness + geocoding/publication readiness verdicts:
  `ready-to-publish | import-unpublished | manual-review | reject`).
  Read-only; no inserts.
- **P11 Nav**: `DirectoryToolsNav` sub-nav on every directory admin page.
- **P12 Public**: no redesign. Already-shipped M20 surfaces cover verified
  date/CTAs/empty-field omission; this milestone only wires TPC CTA coverage
  checks and keeps canonicals/ISR untouched.

## Security rules

- Every new route/action begins with `requireAdmin()`; no new public POSTs.
- All bulk operations: explicit field allowlists, server-side re-validation at
  apply time (never trust the preview payload), file-size (2 MB) and row
  (2000) caps, identity cross-check before any write, history-first writes.
- CSV exports: cells starting `= + - @` (or tab/CR variants) are prefixed with
  `'` (formula-injection guard) — applied via a shared `safeCsvCell` helper.
- URL fields: https-only, allowlisted domains for TPC, generic http(s) for
  website; never rendered unescaped (React escapes; popups use
  `document.createElement` — unchanged).
- No internal ids in public URLs (slugs only, unchanged); no service-role use
  outside `lib/admin`/server actions; no location logging.

## Rollback approach

- Single squash-revertable PR; migration 023 is unapplied, so production
  schema is untouched — reverting the PR fully removes the feature.
- If 023 is ever applied and must be rolled back: both tables are additive and
  referenced only by fail-soft code; `drop table` restores prior behavior.

## Testing plan

- New pure-lib suites under `scripts/`: TPC validation, completeness scoring,
  quality detectors, corrections pipeline, slug-redirect planning, duplicate
  classification, trust statuses, expansion readiness, CSV injection guard.
- Existing suites must stay green (detail 58, map 35, geocoding 51).
- `tsc`, ESLint, production build; deploy-preview verification via the
  existing dispatch workflows (admin gate 3xx, public routes 200, no
  regressions) — read-only GETs only.

## Assumptions & decisions of record

1. `location_history.source` cannot gain new values without a migration to the
   CHECK constraint; rather than alter it, admin bulk flows write
   `source='admin-edit'` with a machine-readable note prefix
   (`tpc-bulk:`, `correction-csv:`, `slug-regenerate:`).
2. The deploy preview shares the production database, and 023 is unapplied —
   preview verification of redirect persistence is via unit fixtures; the
   admin UIs show an explicit "migration 023 pending" state instead of
   half-working writes.
3. TPC's approved domain set is exactly `truckparkingclub.com` and
   `www.truckparkingclub.com`. Anything else (including other subdomains) is
   rejected — deceptive-subdomain rule.
4. No public completeness/risk display (see P3). Trust wording stays factual.
5. Stale verification threshold: 365 days; "recently verified": 90 days.
6. All apply-capable admin tools are exercised in dry-run only during this
   milestone; no history rows, no field updates, no TPC URLs are written to
   production data.

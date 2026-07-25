# Controlled coordinate application — design (NOT executed)

How reviewed geocodes become live `lat`/`lng` **safely**. Implemented as a pure
planner (`scripts/imports/apply-geocodes.ts`) that emits SQL; **nothing runs
without a separate, explicit future authorization.** No database client, no
network, no write path exists in this code.

## Inputs

- **Approved rows** — only rows a human reviewed and marked `reviewerApproved`
  in the coordinate-review sheet (`toReviewReportCsv`). Rejected /
  manual-review-pending / no-match rows are never eligible.
- **A read-only live snapshot** — each candidate's current `lat`/`lng` and
  `deleted_at`, so the planner can refuse anything already coordinated.

## Guards (all enforced; a failing row is refused, never applied)

1. **Reviewer-approved** — else `not-reviewer-approved`.
2. **UUID matches a live row** — else `uuid-not-live`.
3. **Live `lat`/`lng` currently NULL** — else `existing-coordinate-present`.
   *This is how the 85 existing coordinates are protected — they can never be
   overwritten.*
4. **No duplicate approved id** — else `duplicate-approved-id`.
5. **Finite, in-range coordinate** — else `invalid-coordinate`.

## What is written (and what is not)

Only: `lat`, `lng`, `geocode_source`, `geocode_confidence`,
`coord_verification_status`, `last_geocoded_at`, `manually_verified_at`,
`manually_verified_by`. **Never `geo`** (vestigial). **Never** name / address /
city / phone / website / description / slug or any identity field.

**Census confidence is capped at `medium`** — Census returns TIGER
address-range estimates, never rooftop, so a census row is never `high` and is
never labeled rooftop-verified.

## Execution shape (per state, transactional)

For each state the planner emits three artifacts:

1. **Before-snapshot SQL** — `select id, lat, lng, geocode_source, …` for every
   targeted row, captured and saved before anything changes.
2. **Apply SQL** — `begin;` then one `UPDATE … WHERE id=$ AND deleted_at is
   null AND lat is null AND lng is null` per row (compare-and-swap: a row that
   gained a coordinate since the snapshot is skipped, not clobbered), then a
   **row-count guard** that `raise exception`s (aborting the whole state) if the
   number of newly-coordinated rows ≠ the expected count, then `commit;`.
3. **Rollback SQL** — `begin; update … set lat=null, lng=null, geocode_source=
   null, … where id in (…); commit;` — restores the exact coordinate-free state.

State-by-state: one state's failure aborts only that state's transaction; the
others are independent. Before/after row counts and map eligibility (a row is
map-eligible iff `is_published` + `lat`/`lng` not null) are verified per state.

## Never, in this phase

No Supabase write, no migration, no auto-approval, no rooftop labeling, no `geo`
write, no execution. A future run requires the owner's explicit authorization
and re-runs the before-snapshot immediately prior.

# M1 execution record — migration 047 (2026-07-29)

Authorization: owner's nationwide rest-area milestone prompt (M1/M2 guarded
database changes authorized; rest-area work read-only).

## Sequence
1. Preflight gates all green: digest `640482ae283d3445b88f8d32688cfce7`,
   2,830 live / 2,454 published / 1,973 coordinated / 0 featured-indexable;
   schema 44 columns / 13 constraints / 17 indexes with none of the six
   target columns; NTAD 5 unpublished NULL-count; CAT paused (0 tagged
   rows); Love's cohort exactly 541 (id-set fingerprint
   `d68a000a205e14cfd7c58b4e60da34dc`).
2. No runtime dependency on the new columns (repo grep: zero references in
   src/ outside the documented unwired `DirectoryEntry.mileMarker` comment;
   the data layer's COLUMNS list does not select them).
3. Migration 047 committed BEFORE application (`6d12579`), body
   byte-identical to the reviewed PROPOSED-MIGRATION.sql (merged PR #207);
   exact rollback already committed on main (PROPOSED-ROLLBACK.sql).
4. Transactional dry-run: full script with `commit` replaced by `rollback`
   executed cleanly through drift guards, DDL, and post-conditions; a
   follow-up probe confirmed zero residue (0 new columns).
5. Applied via the guarded connected Supabase flow (single transaction,
   fail-closed guards + post-conditions, identical script with `commit`).

## Post-apply verification (live)
- `mile_marker numeric(6,2)` NULL · `mile_marker_source text` ·
  `mile_marker_verified_at timestamptz`
- `overnight_status text NOT NULL DEFAULT 'unknown'` ·
  `overnight_status_source text` · `overnight_status_verified_at timestamptz`
- All 7 constraints present (range, 2× source CHECK, 2× provenance pairing,
  status CHECK, anti-drift no-contradiction)
- `locations_corridor_position_idx` partial index exact
- Values: unknown=2,830 · confirmed=0 · prohibited=0 · mile_marker
  populated=0 (no data written by M1)
- Old-field digest byte-identical: `640482ae283d3445b88f8d32688cfce7`
  (2,830 / 2,454) — existing columns and values unchanged;
  `overnight_parking` untouched
- Column count 44 → 50; no runtime behavior change (nothing reads the
  new columns yet; M3 switchover NOT implemented per authorization)

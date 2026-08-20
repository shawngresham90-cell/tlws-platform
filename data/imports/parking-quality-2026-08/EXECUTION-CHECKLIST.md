# Execution checklist — PARKING-QUALITY-1

**Nothing in this package has been executed.** No SQL was run, no row was
written, no migration was created, and no parking record was published. The
audit is read-only output.

## State as shipped

| | |
|---|---:|
| Unpublished parking rows audited | 96 |
| Ready for owner review | **0** |
| Proposed for publication | **0** |
| Blocked | 96 |
| Production writes | 0 |
| Migrations added | 0 |
| Candidate SQL files | 0 (none earned — see QUALITY-GATE.md) |

## Before anything is published

1. Re-run `FINGERPRINT.sql`. If `row_count` or `id_fingerprint` differs from
   `manifest.json`, the inventory moved: rebuild the audit before acting.
2. Retrieve the blocking evidence. 75 rows carry a candidate source URL in
   `AUDIT.csv`; 17 have none and need one found. A candidate URL is a place to
   look, not a citation — record the agency, the retrieval date, and the exact
   claim it supports.
3. Obtain coordinates for the 91 rows that have none. These are addressed by
   mile marker and carriageway, which `census-geocoder.ts` already classifies
   as `highway-or-insufficient`, so the Census fallback cannot supply them.
   Directional pairs need two coordinates, never one shared.
4. Re-run the audit with evidence supplied. Rows that pass every mandatory gate
   become `ready-for-owner-review`.
5. Only then generate candidate SQL, and only for ids the manifest lists.

## Standing constraints on any future publication SQL

- Target exact ids from a current manifest; never a `WHERE` predicate that
  could widen.
- Assert expected pre-state, and that `category_slug` is still `parking`.
- Refuse rows with missing, zero, or unverified coordinates.
- Refuse duplicate detail slugs and published proximity collisions.
- Keep `is_featured = false`; leave `is_indexable` alone.
- Never upgrade `overnight_status` without a recorded source.
- Transactional, fail-closed, with post-conditions and a reviewed rollback.

## Egress note

Every agency host required to close step 2 is blocked at this environment's
proxy — re-verified for this milestone: `fdot.gov`,
`caltrans-gis.dot.ca.gov` and `data.transportation.gov` all answer `000`.
No source was retrieved and none was invented. This is a genuine external
blocker, not a gate that can be lowered.

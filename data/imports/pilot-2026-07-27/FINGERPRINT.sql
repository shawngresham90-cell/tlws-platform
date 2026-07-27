-- Pilot / Flying J / ONE9 import — before/after fingerprints. READ-ONLY.
--
-- Run BEFORE the package, record the output, run AFTER, and diff. Anything the
-- package was not authorized to touch must be byte-identical.

-- ===========================================================================
-- A. CONTROL DIGEST — everything OUT OF SCOPE must not change
-- ===========================================================================
-- Every live row that is neither a Pilot-network row nor created by this
-- import. This digest MUST be identical before and after all three phases.
--
-- MEASURED 2026-07-27, read-only:
--   out_of_scope_rows 1334
--   control_digest    576f641146dfdb8ddb0de518acaa100d
select count(*) as out_of_scope_rows,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as control_digest
from public.locations l
where l.deleted_at is null
  and coalesce(l.source, '') <> 'pilot-master-2026-07-27'
  and l.name !~* '(pilot|flying\s*j|one\s*9|one9|mr\.?\s*fuel)';

-- ===========================================================================
-- B. IN-SCOPE DIGEST — the 222 pre-existing Pilot-network rows
-- ===========================================================================
-- Before the import this digest covers the 222 rows in DB-SNAPSHOT.tsv.
-- Their id digest is 130a63b248982b1e7d7977c6c728c484 (verified 2026-07-27).
-- After ENRICH-EXISTING.sql exactly 84 of them change; the other 138 must not.
--
-- MEASURED 2026-07-27, read-only:
--   pilot_related_rows 222
--   id_digest          130a63b248982b1e7d7977c6c728c484
--   row_digest         c5fce983f8965be1898d2d83dcf5bd60
select count(*) as pilot_related_rows,
       md5(string_agg(l.id::text, ',' order by l.id::text)) as id_digest,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as row_digest
from public.locations l
where l.deleted_at is null
  and l.name ~* '(pilot|flying\s*j|one\s*9|one9|mr\.?\s*fuel)';

-- ===========================================================================
-- C. THE 138 PRE-EXISTING ROWS THIS IMPORT MUST NOT TOUCH
-- ===========================================================================
-- Everything Pilot-related that is NOT an enrichment target. This digest must
-- be identical before and after. It covers the 5 conflicting records, the 12
-- probable-closure candidates, the 92 colocated service rows and the rest.
select count(*) as untouched_rows,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as untouched_digest
from public.locations l
where l.deleted_at is null
  and l.name ~* '(pilot|flying\s*j|one\s*9|one9|mr\.?\s*fuel)'
  and coalesce(l.geocode_source, '') <> 'pilot-master-2026-07-27';

-- ===========================================================================
-- D. HELD / EXCLUDED NETWORKS MUST NOT CHANGE
-- ===========================================================================
-- Third-party brands colocated at network sites carry their own numbering and
-- are explicitly out of scope. Fourteen sit inside the Pilot-network snapshot
-- (12 Southern Tire Mart, 1 Speedway, 1 Blue Beacon); "Pro Stop (Pilot Flying J
-- Dealer #962)" is handled separately because it does carry a dealer number.
-- This package must not touch any of them.
-- MUST NOT CHANGE — neither the count nor the digest.
--
-- MEASURED 2026-07-27, read-only (the pattern also catches these brands away
-- from network sites, which makes it a stricter control):
--   third_party_rows      50
--   third_party_published 41
--   third_party_digest    b22022a473551064bdf5183ec37d4467
select count(*) as third_party_rows,
       count(*) filter (where is_published) as third_party_published,
       md5(string_agg(md5(to_jsonb(l)::text), '' order by l.id)) as third_party_digest
from public.locations l
where l.deleted_at is null
  and l.name ~* '^(southern tire mart|speedway|blue beacon|pro stop)';

-- ===========================================================================
-- E. DIRECTORY-WIDE COUNTERS
-- ===========================================================================
-- Before, measured 2026-07-27:
--   total_live 1556 · published 1165 · with_coords 534 ·
--   published_unmappable 635 · featured 0 · indexable 0 · soft_deleted 0
--
-- After all three phases, expected:
--   total_live 2275 (+719) · published 1870 (+705) · with_coords 1335 (+801)
--   published_unmappable 635 (UNCHANGED — every imported row has a coordinate)
--   featured UNCHANGED · indexable UNCHANGED
select count(*)                                             as total_live,
       count(*) filter (where is_published)                 as published,
       count(*) filter (where lat is not null)              as with_coords,
       count(*) filter (where is_published and lat is null) as published_unmappable,
       count(*) filter (where is_featured)                  as featured,
       count(*) filter (where is_indexable)                 as indexable,
       count(*) filter (where deleted_at is not null)       as soft_deleted
from public.locations;

-- ===========================================================================
-- F. NOTHING WAS DELETED
-- ===========================================================================
-- The forward path never deletes. soft_deleted above must be identical before
-- and after, and this must stay 0 for imported rows.
select count(*) as imported_rows_soft_deleted
from public.locations
where source = 'pilot-master-2026-07-27' and deleted_at is not null;

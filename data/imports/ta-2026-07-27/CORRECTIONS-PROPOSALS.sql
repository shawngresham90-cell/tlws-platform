-- TA/Petro data corrections — SEPARATE PACKAGE, NOT EXECUTED.
--
-- Two proposals plus one quarantine record. Each needs its own authorization,
-- because each changes a row the enrichment package does not own. NOTHING IS
-- DELETED anywhere in this file.
--
-- Preconditions of ANY execution:
--   1. The official a0c612f0… artifact is committed and content-diffed against
--      the working copy (see data/sources/ta-master/2026-07-27/CHECKSUM.txt).
--   2. Shawn has separately authorized this file, distinct from enrichment.
--
-- ---------------------------------------------------------------------------
--  A. 33e41d22-1dac-425b-a17d-c9b6affcda21  "TA Atlanta South #268"
--     GA / Jackson · PUBLISHED · 33.205898,-84.058286
--
--     DUPLICATE. The 2026-07-25 import created the site's row of record:
--     15de1227-c048-4efc-9434-ac55e17356f1 "TA Atlanta South" (PUBLISHED,
--     33.2065,-84.0585 — ~30 m away, same 122 Truckstop Way address, same 108
--     spaces). Two published pins for one official site (0268). Proposal:
--     unpublish the legacy duplicate; the imported row remains live.
--
--     Note: the duplicate carries overnight_parking = true while the imported
--     row carries false (not confirmed). Unpublishing the duplicate removes an
--     overnight claim no current authoritative source states — the safe
--     direction. If TA later confirms overnight permission it belongs on the
--     imported row, not here.
--
--  B. beb05d53-db50-49cb-8790-ec01b45c8187  "Love's Travel Stop #420"
--     SC / Florence · UNPUBLISHED · 3001 TV Rd · no coordinates
--
--     CROSS-BRAND MISLABEL, now proven from two independent operator exports:
--       · Love's complete export (731/731): store #420 is Flowood,
--         MISSISSIPPI. South Carolina's fourteen Love's do not include
--         Florence. (This is why the row was quarantined.)
--       · TA's official master: site 0393 "Petro Florence" sits at exactly
--         3001 TV Rd, Florence SC 29501 — this row's address — with
--         coordinates 34.2665,-79.7321 and 210 truck parking spaces. The
--         prior TA review had already flagged the address as identical.
--     The row is a Petro Florence mislabeled as a Love's. Proposal: relabel it
--     to the official identity, fill its blanks from the TA master, and KEEP
--     IT UNPUBLISHED. Publication stays a separate decision.
--
--     Executing B also unblocks the Love's package: MS #420 (Flowood) is held
--     there as net-new-state-conflict solely because this row squats on the
--     store number.
--
--  C. 74398e08-61e6-41b8-b3fd-e22c6c6cf6d0  "TA Jacksonville South #248"
--     FL / Saint Johns · ALREADY UNPUBLISHED · no coordinates
--
--     Duplicate of the imported "TA Jacksonville South" row (f3ec3f7f…,
--     published, mappable — same 1650 C.R. 210 W address, zip5 32259). It is
--     already unpublished, so the state it needs to be in is the state it is
--     in. NO SQL IS PROPOSED; recorded in QUARANTINE.md and asserted by test.

-- ===========================================================================
-- A. Unpublish the published duplicate (guarded, value-matched)
-- ===========================================================================
begin;
do $$
declare n integer;
begin
  -- Identity of the duplicate, exactly as reconciled.
  select count(*) into n from public.locations
   where id = '33e41d22-1dac-425b-a17d-c9b6affcda21' and deleted_at is null
     and name = 'TA Atlanta South #268' and state = 'GA' and city = 'Jackson'
     and is_published;
  if n <> 1 then raise exception 'Precondition failed: duplicate row A is not in the reconciled state.'; end if;

  -- The site's row of record must exist, be published, and be mappable.
  select count(*) into n from public.locations
   where id = '15de1227-c048-4efc-9434-ac55e17356f1' and deleted_at is null
     and name = 'TA Atlanta South' and state = 'GA' and is_published
     and lat is not null and lng is not null
     and source = 'official-ta-petro-20260725-5ebe0e9f';
  if n <> 1 then raise exception 'Precondition failed: the imported row of record is missing or unpublished — do NOT remove the only live pin.'; end if;

  update public.locations set is_published = false, updated_at = now()
   where id = '33e41d22-1dac-425b-a17d-c9b6affcda21' and is_published;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected to unpublish exactly 1 row, changed %.', n; end if;

  -- Nothing deleted; the row of record still live.
  select count(*) into n from public.locations
   where id in ('33e41d22-1dac-425b-a17d-c9b6affcda21','15de1227-c048-4efc-9434-ac55e17356f1')
     and deleted_at is not null;
  if n <> 0 then raise exception 'Post-check failed: something was deleted.'; end if;
  select count(*) into n from public.locations
   where id = '15de1227-c048-4efc-9434-ac55e17356f1' and is_published;
  if n <> 1 then raise exception 'Post-check failed: the row of record is no longer published.'; end if;
end $$;
commit;

-- A rollback — value-matched republish of the duplicate:
--   begin;
--   update public.locations set is_published = true, updated_at = now()
--    where id = '33e41d22-1dac-425b-a17d-c9b6affcda21'
--      and name = 'TA Atlanta South #268' and not is_published and deleted_at is null;
--   commit;

-- ===========================================================================
-- B. Relabel the mislabeled Petro Florence (guarded, value-matched, stays UNPUBLISHED)
-- ===========================================================================
begin;
do $$
declare n integer;
begin
  -- The row must still be EXACTLY the quarantined state this was written
  -- against: mislabeled name, unpublished, blank coordinates and spaces.
  select count(*) into n from public.locations
   where id = 'beb05d53-db50-49cb-8790-ec01b45c8187' and deleted_at is null
     and name = 'Love''s Travel Stop #420' and state = 'SC' and city = 'Florence'
     and address = '3001 TV Rd' and zip = '29501'
     and not is_published and lat is null and lng is null and parking_spaces is null;
  if n <> 1 then raise exception 'Precondition failed: row B is not in the quarantined state this proposal was written against.'; end if;

  -- No other row may already carry the official identity in SC.
  select count(*) into n from public.locations
   where deleted_at is null and state = 'SC' and name = 'Petro Florence';
  if n <> 0 then raise exception 'Precondition failed: a Petro Florence row already exists in SC.'; end if;
  select count(*) into n from public.locations
   where deleted_at is null and detail_slug = 'petro-florence-florence-sc';
  if n <> 0 then raise exception 'Precondition failed: target detail_slug already taken.'; end if;

  -- The official coordinate must not collide with any published pin.
  select count(*) into n from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and abs(l.lat - 34.2665) < 0.0015 and abs(l.lng - (-79.7321)) < 0.0015;
  if n <> 0 then raise exception 'Precondition failed: official coordinate collides with a published pin.'; end if;

  update public.locations
     set name = 'Petro Florence',
         slug = 'petro-florence',
         detail_slug = 'petro-florence-florence-sc',
         lat = 34.2665, lng = -79.7321,
         parking_spaces = 210,
         geocode_source = 'batch-csv',
         geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(),
         updated_at = now()
   where id = 'beb05d53-db50-49cb-8790-ec01b45c8187'
     and name = 'Love''s Travel Stop #420' and not is_published;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected to relabel exactly 1 row, changed %.', n; end if;

  -- STAYS UNPUBLISHED. Publication is a separate decision.
  select count(*) into n from public.locations
   where id = 'beb05d53-db50-49cb-8790-ec01b45c8187' and (is_published or is_featured or is_indexable);
  if n <> 0 then raise exception 'Post-check failed: row B changed publication state.'; end if;
end $$;
commit;

-- B rollback — value-matched restore of the mislabeled identity:
--   begin;
--   update public.locations
--      set name = 'Love''s Travel Stop #420', slug = 'love-s-travel-stop-420',
--          detail_slug = 'love-s-travel-stop-420-florence-sc',
--          lat = null, lng = null, parking_spaces = null,
--          geocode_source = null, geocode_confidence = null,
--          coord_verification_status = null, last_geocoded_at = null,
--          updated_at = now()
--    where id = 'beb05d53-db50-49cb-8790-ec01b45c8187'
--      and name = 'Petro Florence' and not is_published and deleted_at is null;
--   commit;

-- ===========================================================================
-- C. TA Jacksonville South #248 — quarantine record, no statement
-- ===========================================================================
--   select id, name, is_published, deleted_at from public.locations
--    where id = '74398e08-61e6-41b8-b3fd-e22c6c6cf6d0';
--   -- expected: is_published = false, deleted_at null — and it stays that way.

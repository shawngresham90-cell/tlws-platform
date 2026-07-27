-- Pilot / Flying J / ONE9 import — value-matched rollback. NOT EXECUTED.
--
-- Three independent reversals. Run in reverse order of application:
-- unpublish, then de-enrich, then delete the inserted rows.
--
-- Everything is scoped by `source = 'pilot-master-2026-07-27'` or
-- `geocode_source = 'pilot-master-2026-07-27'`, which only the forward
-- statements set. A row this import did not create or touch cannot be reached
-- by any block here.

-- ===========================================================================
-- 1. UNPUBLISH — reverses PUBLISH-CANARY.sql / PUBLISH-PER-STATE.sql
-- ===========================================================================
begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where source = 'pilot-master-2026-07-27' and is_published and deleted_at is null;
  if expected = 0 then raise exception 'Nothing published by this import; nothing to unpublish.'; end if;

  update public.locations set is_published = false, updated_at = now()
   where source = 'pilot-master-2026-07-27' and is_published and deleted_at is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Expected to unpublish %, changed %.', expected, n; end if;

  -- Unpublishing must not disturb coordinates or featured state.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and (is_featured or lat is null);
  if n <> 0 then raise exception 'Post-check failed: % row(s) lost a coordinate or became featured.', n; end if;
end $$;
commit;

-- ===========================================================================
-- 2. DE-ENRICH — reverses ENRICH-EXISTING.sql
-- ===========================================================================
-- Value-matched: only reverts a row still carrying exactly what the forward
-- statement wrote. Every coordinate target had lat IS NULL AND lng IS NULL
-- beforehand — the forward statement's blank-only guard proves it — so NULL is
-- the exact pre-state for the coordinate fields.
begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where geocode_source = 'pilot-master-2026-07-27' and deleted_at is null;
  if expected = 0 then raise exception 'Nothing enriched by this import.'; end if;

  select count(*) into n from public.locations
   where geocode_source = 'pilot-master-2026-07-27' and is_published;
  if n <> 0 then
    raise exception 'Rollback refused: % enriched row(s) are published. Run the UNPUBLISH block first.', n;
  end if;

  update public.locations
     set lat = null, lng = null,
         geocode_source = null, geocode_confidence = null,
         coord_verification_status = null, last_geocoded_at = null,
         updated_at = now()
   where geocode_source = 'pilot-master-2026-07-27' and deleted_at is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Expected to de-enrich %, changed %.', expected, n; end if;
end $$;
commit;

-- NOTE: de-enrichment does not revert interstate or parking_spaces. The forward
-- statement wrote those with coalesce(existing, new), so it only ever filled
-- blanks; reverting them to NULL could erase a value that predates this import.
-- To revert those too, use the per-row prior values in
-- data/sources/pilot-master/2026-07-27/ENRICHMENT-PLAN.csv, by id — the
-- `fills` and `existing_parking_spaces` columns record exactly what changed.
-- overnight_parking was never written and needs no reversal.

-- ===========================================================================
-- 3. DELETE INSERTED ROWS — reverses INSERT-NET-NEW.sql
-- ===========================================================================
-- The only block in this package that deletes, and it can only reach rows this
-- import created: `source = 'pilot-master-2026-07-27'` is set by the insert and
-- by nothing else. It refuses if any target is published or featured.
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and is_published;
  if n <> 0 then
    raise exception 'Rollback refused: % inserted row(s) are published. Run the UNPUBLISH block first.', n;
  end if;

  -- Refuse to delete anything that has since been edited into a claim, review
  -- or sponsorship relationship. Deleting under those would orphan data.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and is_featured;
  if n <> 0 then raise exception 'Rollback refused: % row(s) are featured.', n; end if;

  -- An enriched pre-existing row must never be deleted here: it was not created
  -- by this import. Enriched rows keep their original `source`, so this is a
  -- belt-and-braces check.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and geocode_source = 'pilot-master-2026-07-27'
     and created_at < '2026-07-27';
  if n <> 0 then raise exception 'Rollback refused: % target(s) predate this import.', n; end if;

  delete from public.locations where source = 'pilot-master-2026-07-27';
  get diagnostics n = row_count;
  raise notice 'Deleted % inserted Pilot-network row(s).', n;

  select count(*) into n from public.locations where source = 'pilot-master-2026-07-27';
  if n <> 0 then raise exception 'Post-check failed: % row(s) survive.', n; end if;
end $$;
commit;

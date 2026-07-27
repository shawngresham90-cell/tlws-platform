-- Love's import — value-matched rollback. NOT EXECUTED.
--
-- Three independent reversals. Run in reverse order of application:
-- unpublish, then de-enrich, then delete the inserted rows.
--
-- Everything is scoped by `source = 'loves-master-2026-07-27'`, which only the
-- forward statements set. A row this import did not create or touch cannot be
-- reached by any block here.

-- ===========================================================================
-- 1. UNPUBLISH — reverses PUBLISH-CANARY.sql / PUBLISH-PER-STATE.sql
-- ===========================================================================
begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where source = 'loves-master-2026-07-27' and is_published and deleted_at is null;
  if expected = 0 then raise exception 'Nothing published by this import; nothing to unpublish.'; end if;

  update public.locations set is_published = false, updated_at = now()
   where source = 'loves-master-2026-07-27' and is_published and deleted_at is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Expected to unpublish %, changed %.', expected, n; end if;

  -- Unpublishing must not disturb coordinates or featured state.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and (is_featured or lat is null);
  if n <> 0 then raise exception 'Post-check failed: % row(s) lost a coordinate or became featured.', n; end if;
end $$;
commit;

-- ===========================================================================
-- 2. DE-ENRICH — reverses ENRICH-EXISTING.sql
-- ===========================================================================
-- Value-matched: only reverts a row still carrying exactly what the forward
-- statement wrote. A row edited since is reported, not clobbered. Every target
-- had lat IS NULL AND lng IS NULL beforehand — the forward statement's
-- blank-only guard proves it — so NULL is the exact pre-state.
-- !! REGENERATE BEFORE ANY EXECUTION !!
-- The schema CHECK constraint locations_geocode_source_check forbids the
-- bespoke tag 'loves-master-2026-07-27'; the forward statements now write the
-- shared legal value 'batch-csv', which OTHER packages' rows also carry. A
-- tag-scoped bulk reversal is therefore impossible here. Before this package
-- is ever executed, regenerate this block as per-row, id-scoped, value-matched
-- statements from ENRICHMENT-PLAN.csv — see data/imports/ta-2026-07-27/
-- ROLLBACK.sql for the exact pattern.
do $$ begin
  raise exception 'STALE ROLLBACK: regenerate per-row from ENRICHMENT-PLAN.csv (see ta-2026-07-27/ROLLBACK.sql pattern) before use.';
end $$;

-- NOTE: de-enrichment does not revert interstate / exit_number /
-- parking_spaces / overnight_parking. The forward statement wrote those with
-- coalesce(existing, new), so it only ever filled blanks; reverting them to
-- NULL could erase a value that predates this import. If those must also be
-- reverted, do it from the ENRICHMENT-PLAN.csv per-row prior values, by id.

-- ===========================================================================
-- 3. DELETE INSERTED ROWS — reverses INSERT-NET-NEW.sql
-- ===========================================================================
-- The only block in this package that deletes, and it can only reach rows this
-- import created: `source = 'loves-master-2026-07-27'` is set by the insert and
-- by nothing else. It refuses if any target is published.
begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where source = 'loves-master-2026-07-27' and geocode_source is distinct from 'batch-csv';
  -- inserted rows carry source but were never enriched (they arrived with coords)

  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and is_published;
  if n <> 0 then
    raise exception 'Rollback refused: % inserted row(s) are published. Run the UNPUBLISH block first.', n;
  end if;

  -- Refuse to delete anything that has since been edited into a claim, review
  -- or sponsorship relationship. Deleting under those would orphan data.
  select count(*) into n from public.locations l
   where l.source = 'loves-master-2026-07-27' and l.is_featured;
  if n <> 0 then raise exception 'Rollback refused: % row(s) are featured.', n; end if;

  delete from public.locations where source = 'loves-master-2026-07-27';
  get diagnostics n = row_count;
  raise notice 'Deleted % inserted Love''s row(s).', n;

  select count(*) into n from public.locations where source = 'loves-master-2026-07-27';
  if n <> 0 then raise exception 'Post-check failed: % row(s) survive.', n; end if;
end $$;
commit;

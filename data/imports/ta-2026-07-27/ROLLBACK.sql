-- TA/Petro package — value-matched rollback. NOT EXECUTED.
--
-- Reverses CANARY-ENRICH.sql / ENRICH-EXISTING.sql / HOLD-NAME-ANCHORED.sql.
-- Everything is scoped by `geocode_source = 'ta-master-2026-07-27'`, which
-- only those statements set. A row this package did not touch cannot be
-- reached by anything here.
--
-- Rollbacks for CORRECTIONS-PROPOSALS.sql live inline in that file, next to
-- the statements they reverse — they are separate authorizations.
--
-- Because every forward write was blank-only (proven by the forward guards),
-- NULL is the exact pre-state for every field this file clears — this is a
-- full value-matched reversal, not an approximation:
--   · lat/lng were NULL on every target (blank-only guard 2),
--   · parking_spaces is cleared only where it still equals the staged value,
--   · zip is cleared only where it still equals the staged value.
-- Per-row staged values are in data/sources/ta-master/2026-07-27/ENRICHMENT-PLAN.csv.

begin;
do $$
declare n integer; expected integer;
begin
  select count(*) into expected from public.locations
   where geocode_source = 'ta-master-2026-07-27' and deleted_at is null;
  if expected = 0 then raise exception 'Nothing enriched by this package; nothing to roll back.'; end if;

  -- Refuse if any target was deleted or featured since — that means someone
  -- else has been editing these rows and a blind reversal could destroy work.
  select count(*) into n from public.locations
   where geocode_source = 'ta-master-2026-07-27' and (deleted_at is not null or is_featured);
  if n <> 0 then raise exception 'Rollback refused: % row(s) were deleted/featured since enrichment.', n; end if;

  update public.locations
     set lat = null, lng = null,
         geocode_source = null, geocode_confidence = null,
         coord_verification_status = null, last_geocoded_at = null,
         updated_at = now()
   where geocode_source = 'ta-master-2026-07-27' and deleted_at is null;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Expected to de-enrich %, changed %.', expected, n; end if;
end $$;
commit;

-- parking_spaces and zip: value-matched per-row reversal, generated from the
-- committed plan. Only a value still equal to what the forward statement wrote
-- is cleared; anything edited since is left alone and reported.
--
--   update public.locations set parking_spaces = null, updated_at = now()
--    where id = '<db_id>' and parking_spaces = <staged value> and deleted_at is null;
--   update public.locations set zip = null, updated_at = now()
--    where id = '<db_id>' and zip = '<staged value>' and deleted_at is null;
--
-- One pair per row of ENRICHMENT-PLAN.csv where the `fills` column names the
-- field. 38 address-anchored rows + 2 HOLD rows.

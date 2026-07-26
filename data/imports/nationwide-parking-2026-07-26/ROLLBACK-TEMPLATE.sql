-- Value-matched rollback for the parking expansion — GUARDED TEMPLATE.
--
-- Two independent reversals. Run the one that matches what you are undoing;
-- to undo both, run PUBLISH first, then ENRICH (reverse order of application).
--
-- VALUE-MATCHED: each statement only reverts a row whose current values are
-- exactly what the forward statement wrote. A row someone has since edited by
-- hand is left alone and reported, rather than silently clobbered.

-- ===========================================================================
-- 1. UNPUBLISH — reverses PUBLISH-TEMPLATE.sql
-- ===========================================================================

begin;

create temporary table _unpublish (id uuid primary key) on commit drop;
insert into _unpublish (id) values
  -- ('00000000-0000-0000-0000-000000000000'),
  ;

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _unpublish;
  if batch = 0 then raise exception 'Nothing to unpublish.'; end if;

  -- Only revert rows that are currently published — the state we put them in.
  select count(*) into n
    from _unpublish u join public.locations l on l.id = u.id
   where l.is_published;
  if n <> batch then
    raise exception 'Rollback precondition failed: % of % target row(s) are not currently published.', batch - n, batch;
  end if;

  update public.locations
     set is_published = false, updated_at = now()
   where id in (select id from _unpublish) and is_published;
  get diagnostics n = row_count;
  if n <> batch then
    raise exception 'Expected to unpublish exactly % row(s), changed %.', batch, n;
  end if;

  -- Unpublishing must not disturb anything else about the row.
  select count(*) into n
    from _unpublish u join public.locations l on l.id = u.id
   where l.is_featured or l.lat is null;
  if n <> 0 then
    raise exception 'Post-check failed: % row(s) lost coordinates or became featured.', n;
  end if;
end $$;

commit;

-- ===========================================================================
-- 2. DE-ENRICH — reverses ENRICH-TEMPLATE.sql
-- ===========================================================================
--
-- Returns the coordinate columns to NULL, which is the exact pre-state: every
-- row this milestone would enrich had lat IS NULL AND lng IS NULL, asserted by
-- the forward statement's blank-only guard.
--
-- Refuses to run on a published row: removing the coordinate under a live
-- page would leave an unmappable published location, the precise defect this
-- work exists to prevent. Unpublish first.

begin;

create temporary table _deenrich (
  id  uuid primary key,
  lat double precision not null,   -- the value the forward statement wrote
  lng double precision not null
) on commit drop;

insert into _deenrich (id, lat, lng) values
  -- ('00000000-0000-0000-0000-000000000000', 00.000000, -00.000000),
  ;

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _deenrich;
  if batch = 0 then raise exception 'Nothing to de-enrich.'; end if;

  -- Value match: the row must still carry exactly the coordinate we wrote.
  select count(*) into n
    from _deenrich d join public.locations l on l.id = d.id
   where l.lat is not distinct from d.lat
     and l.lng is not distinct from d.lng;
  if n <> batch then
    raise exception 'Rollback precondition failed: % of % row(s) no longer hold the coordinate this rollback was written against. They have been edited since; resolve by hand.', batch - n, batch;
  end if;

  -- Never strip a coordinate out from under a published page.
  select count(*) into n
    from _deenrich d join public.locations l on l.id = d.id
   where l.is_published;
  if n <> 0 then
    raise exception 'Rollback refused: % row(s) are published. Run the UNPUBLISH block first.', n;
  end if;

  update public.locations l
     set lat = null, lng = null,
         geocode_source = null, geocode_confidence = null,
         coord_verification_status = null, last_geocoded_at = null,
         updated_at = now()
    from _deenrich d
   where l.id = d.id
     and l.lat is not distinct from d.lat
     and l.lng is not distinct from d.lng;
  get diagnostics n = row_count;
  if n <> batch then
    raise exception 'Expected to de-enrich exactly % row(s), changed %.', batch, n;
  end if;

  select count(*) into n
    from _deenrich d join public.locations l on l.id = d.id
   where l.lat is not null or l.lng is not null;
  if n <> 0 then
    raise exception 'Post-check failed: % row(s) still carry a coordinate.', n;
  end if;
end $$;

commit;

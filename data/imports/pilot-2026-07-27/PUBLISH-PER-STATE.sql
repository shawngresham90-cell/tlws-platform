-- Pilot / Flying J / ONE9 publication, ONE TRANSACTION PER STATE — GUARDED.
--
-- NOT EXECUTED. Run only after the canary has been verified, and only with a
-- separate publication authorization.
--
-- Source of record: all_locations.csv
-- sha256 d39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a
-- 875 official-network locations: 820 U.S. + 55 Canada.
-- Independently verified: 43 U.S. states, 803 U.S. with a positive parking
-- count, 17 with zero, 72,189 stated U.S. spaces, no duplicate store numbers,
-- coordinates or name/address/state triples.
--
-- CANADA IS EXCLUDED FROM EVERY U.S. DENOMINATOR. 875 is never the U.S. number.
--
-- BRAND IDENTITY IS PRESERVED. The operator's own Name value is stored verbatim
-- and the stable store number is appended. Nothing is renamed to "Pilot":
-- Pilot Travel Center, Flying J Travel Center, ONE9 Travel Center, ONE9 Dealer,
-- Pilot Dealer, Mr. Fuel Travel Center, Pilot Licensed Location, Flying J
-- Cardlock, Shell Cardlock, EZ Trip, Xpress Fuel, Pride, Stamart and Arco all
-- keep their published names.
--
-- OVERNIGHT PERMISSION IS NOT IN THIS EXPORT AND IS NOT INVENTED.
-- locations.overnight_parking is NOT NULL DEFAULT false, so it cannot hold
-- "unknown". Every row this package touches therefore lands at false, which
-- here means NOT CONFIRMED, not "prohibited". A positive operator space count
-- confirms truck parking for directory and map purposes only. No row from this
-- import may be offered as overnight or HOS-rest parking, and parking
-- restrictions and duration limits stay unknown, until another authoritative
-- source states them.
--
-- Publishes rows inserted by INSERT-NET-NEW.sql that carry a POSITIVE official
-- parking-space count. The 14 zero-space locations are NEVER published by
-- this file: the guard below excludes them, and they remain directory-only
-- records that must never be returned as parking or as a last-legal-stop
-- recommendation.
--
-- 43 states.

-- ---------------------------------------------------------------- AL (11)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 11 then
    raise exception 'AL: expected 11 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'AL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'AL: expected to publish 11, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AL'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'AL: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AL' and overnight_parking;
  if n <> 0 then raise exception 'AL: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- AR (6)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AR'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 6 then
    raise exception 'AR: expected 6 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'AR'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'AR: expected to publish 6, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AR'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'AR: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AR' and overnight_parking;
  if n <> 0 then raise exception 'AR: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- AZ (38)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AZ'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 38 then
    raise exception 'AZ: expected 38 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'AZ'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 38 then raise exception 'AZ: expected to publish 38, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AZ'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'AZ: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'AZ' and overnight_parking;
  if n <> 0 then raise exception 'AZ: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CA (42)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 42 then
    raise exception 'CA: expected 42 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'CA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 42 then raise exception 'CA: expected to publish 42, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'CA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CA' and overnight_parking;
  if n <> 0 then raise exception 'CA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CO (5)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CO'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 5 then
    raise exception 'CO: expected 5 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'CO'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'CO: expected to publish 5, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CO'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'CO: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CO' and overnight_parking;
  if n <> 0 then raise exception 'CO: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CT (1)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 1 then
    raise exception 'CT: expected 1 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'CT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'CT: expected to publish 1, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CT'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'CT: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'CT' and overnight_parking;
  if n <> 0 then raise exception 'CT: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- FL (18)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'FL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 18 then
    raise exception 'FL: expected 18 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'FL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 18 then raise exception 'FL: expected to publish 18, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'FL'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'FL: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'FL' and overnight_parking;
  if n <> 0 then raise exception 'FL: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- GA (16)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'GA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 16 then
    raise exception 'GA: expected 16 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'GA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'GA: expected to publish 16, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'GA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'GA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'GA' and overnight_parking;
  if n <> 0 then raise exception 'GA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IA (17)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 17 then
    raise exception 'IA: expected 17 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'IA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 17 then raise exception 'IA: expected to publish 17, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'IA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IA' and overnight_parking;
  if n <> 0 then raise exception 'IA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- ID (10)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ID'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 10 then
    raise exception 'ID: expected 10 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'ID'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'ID: expected to publish 10, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ID'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'ID: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ID' and overnight_parking;
  if n <> 0 then raise exception 'ID: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IL (40)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 40 then
    raise exception 'IL: expected 40 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'IL'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 40 then raise exception 'IL: expected to publish 40, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IL'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'IL: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IL' and overnight_parking;
  if n <> 0 then raise exception 'IL: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IN (28)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 28 then
    raise exception 'IN: expected 28 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'IN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 28 then raise exception 'IN: expected to publish 28, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IN'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'IN: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'IN' and overnight_parking;
  if n <> 0 then raise exception 'IN: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- KS (6)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KS'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 6 then
    raise exception 'KS: expected 6 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'KS'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'KS: expected to publish 6, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KS'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'KS: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KS' and overnight_parking;
  if n <> 0 then raise exception 'KS: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- KY (21)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 21 then
    raise exception 'KY: expected 21 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'KY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 21 then raise exception 'KY: expected to publish 21, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KY'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'KY: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'KY' and overnight_parking;
  if n <> 0 then raise exception 'KY: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- LA (13)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'LA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 13 then
    raise exception 'LA: expected 13 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'LA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 13 then raise exception 'LA: expected to publish 13, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'LA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'LA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'LA' and overnight_parking;
  if n <> 0 then raise exception 'LA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MA (2)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 2 then
    raise exception 'MA: expected 2 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'MA: expected to publish 2, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MA' and overnight_parking;
  if n <> 0 then raise exception 'MA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MD (3)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MD'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 3 then
    raise exception 'MD: expected 3 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MD'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'MD: expected to publish 3, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MD'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MD: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MD' and overnight_parking;
  if n <> 0 then raise exception 'MD: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MI (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MI'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'MI: expected 9 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MI'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'MI: expected to publish 9, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MI'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MI: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MI' and overnight_parking;
  if n <> 0 then raise exception 'MI: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MN (5)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 5 then
    raise exception 'MN: expected 5 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'MN: expected to publish 5, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MN'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MN: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MN' and overnight_parking;
  if n <> 0 then raise exception 'MN: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MO (24)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MO'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 24 then
    raise exception 'MO: expected 24 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MO'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 24 then raise exception 'MO: expected to publish 24, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MO'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MO: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MO' and overnight_parking;
  if n <> 0 then raise exception 'MO: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MS (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MS'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'MS: expected 9 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MS'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'MS: expected to publish 9, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MS'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MS: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MS' and overnight_parking;
  if n <> 0 then raise exception 'MS: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MT (17)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 17 then
    raise exception 'MT: expected 17 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'MT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 17 then raise exception 'MT: expected to publish 17, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MT'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'MT: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'MT' and overnight_parking;
  if n <> 0 then raise exception 'MT: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NC (12)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NC'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 12 then
    raise exception 'NC: expected 12 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NC'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NC: expected to publish 12, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NC'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NC: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NC' and overnight_parking;
  if n <> 0 then raise exception 'NC: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- ND (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ND'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'ND: expected 7 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'ND'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'ND: expected to publish 7, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ND'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'ND: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'ND' and overnight_parking;
  if n <> 0 then raise exception 'ND: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NE (6)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NE'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 6 then
    raise exception 'NE: expected 6 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NE'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'NE: expected to publish 6, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NE'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NE: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NE' and overnight_parking;
  if n <> 0 then raise exception 'NE: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NJ (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NJ'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'NJ: expected 8 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NJ'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'NJ: expected to publish 8, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NJ'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NJ: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NJ' and overnight_parking;
  if n <> 0 then raise exception 'NJ: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NM (16)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NM'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 16 then
    raise exception 'NM: expected 16 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NM'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'NM: expected to publish 16, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NM'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NM: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NM' and overnight_parking;
  if n <> 0 then raise exception 'NM: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NV (16)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NV'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 16 then
    raise exception 'NV: expected 16 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NV'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'NV: expected to publish 16, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NV'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NV: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NV' and overnight_parking;
  if n <> 0 then raise exception 'NV: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NY (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'NY: expected 8 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'NY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'NY: expected to publish 8, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NY'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'NY: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'NY' and overnight_parking;
  if n <> 0 then raise exception 'NY: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OH (33)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OH'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 33 then
    raise exception 'OH: expected 33 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'OH'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 33 then raise exception 'OH: expected to publish 33, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OH'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'OH: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OH' and overnight_parking;
  if n <> 0 then raise exception 'OH: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OK (11)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OK'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 11 then
    raise exception 'OK: expected 11 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'OK'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'OK: expected to publish 11, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OK'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'OK: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OK' and overnight_parking;
  if n <> 0 then raise exception 'OK: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OR (11)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OR'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 11 then
    raise exception 'OR: expected 11 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'OR'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'OR: expected to publish 11, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OR'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'OR: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'OR' and overnight_parking;
  if n <> 0 then raise exception 'OR: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- PA (18)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'PA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 18 then
    raise exception 'PA: expected 18 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'PA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 18 then raise exception 'PA: expected to publish 18, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'PA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'PA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'PA' and overnight_parking;
  if n <> 0 then raise exception 'PA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- SC (21)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SC'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 21 then
    raise exception 'SC: expected 21 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'SC'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 21 then raise exception 'SC: expected to publish 21, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SC'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'SC: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SC' and overnight_parking;
  if n <> 0 then raise exception 'SC: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- SD (4)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SD'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 4 then
    raise exception 'SD: expected 4 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'SD'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'SD: expected to publish 4, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SD'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'SD: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'SD' and overnight_parking;
  if n <> 0 then raise exception 'SD: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- TN (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'TN: expected 9 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'TN'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'TN: expected to publish 9, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TN'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'TN: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TN' and overnight_parking;
  if n <> 0 then raise exception 'TN: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- TX (116)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TX'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 116 then
    raise exception 'TX: expected 116 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'TX'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 116 then raise exception 'TX: expected to publish 116, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TX'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'TX: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'TX' and overnight_parking;
  if n <> 0 then raise exception 'TX: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- UT (17)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'UT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 17 then
    raise exception 'UT: expected 17 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'UT'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 17 then raise exception 'UT: expected to publish 17, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'UT'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'UT: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'UT' and overnight_parking;
  if n <> 0 then raise exception 'UT: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- VA (19)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'VA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 19 then
    raise exception 'VA: expected 19 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'VA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 19 then raise exception 'VA: expected to publish 19, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'VA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'VA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'VA' and overnight_parking;
  if n <> 0 then raise exception 'VA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WA (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'WA: expected 9 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'WA'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'WA: expected to publish 9, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WA'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'WA: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WA' and overnight_parking;
  if n <> 0 then raise exception 'WA: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WI (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WI'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'WI: expected 9 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'WI'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'WI: expected to publish 9, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WI'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'WI: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WI' and overnight_parking;
  if n <> 0 then raise exception 'WI: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WV (3)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WV'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 3 then
    raise exception 'WV: expected 3 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'WV'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'WV: expected to publish 3, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WV'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'WV: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WV' and overnight_parking;
  if n <> 0 then raise exception 'WV: % row(s) claim overnight parking.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WY (11)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 11 then
    raise exception 'WY: expected 11 publishable row(s) with parking, found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'pilot-master-2026-07-27' and state = 'WY'
     and category_slug = 'truck-stops' and not is_published
     and coalesce(parking_spaces, 0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'WY: expected to publish 11, published %.', n; end if;

  -- A zero-space location must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WY'
     and is_published and coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception 'WY: % zero-space row(s) were published.', n; end if;

  -- Nothing may claim overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and state = 'WY' and overnight_parking;
  if n <> 0 then raise exception 'WY: % row(s) claim overnight parking.', n; end if;
end $$;
commit;


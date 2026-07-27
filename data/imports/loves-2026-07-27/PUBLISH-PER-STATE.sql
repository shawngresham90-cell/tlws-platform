-- Love's publication, ONE TRANSACTION PER STATE — GUARDED.
--
-- NOT EXECUTED. Run only after the canary has been verified, and only with a
-- separate publication authorization.
--
-- Publishes overnight-eligible Love's rows inserted by INSERT-NET-NEW.sql.
-- The 11 non-overnight Travel Stops are NEVER published by this file: the
-- overnight guard below excludes them, and they remain directory-only records.
--
-- 42 states.

-- ---------------------------------------------------------------- AL (15)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 15 then
    raise exception 'AL: expected 15 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'AL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 15 then raise exception 'AL: expected to publish 15, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AL'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'AL: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- AR (10)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AR'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 10 then
    raise exception 'AR: expected 10 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'AR'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'AR: expected to publish 10, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AR'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'AR: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- AZ (17)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AZ'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 17 then
    raise exception 'AZ: expected 17 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'AZ'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 17 then raise exception 'AZ: expected to publish 17, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'AZ'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'AZ: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CA (16)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 16 then
    raise exception 'CA: expected 16 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'CA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'CA: expected to publish 16, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'CA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CO (15)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CO'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 15 then
    raise exception 'CO: expected 15 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'CO'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 15 then raise exception 'CO: expected to publish 15, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CO'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'CO: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- CT (1)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 1 then
    raise exception 'CT: expected 1 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'CT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'CT: expected to publish 1, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'CT'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'CT: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- FL (12)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'FL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 12 then
    raise exception 'FL: expected 12 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'FL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'FL: expected to publish 12, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'FL'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'FL: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- GA (10)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'GA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 10 then
    raise exception 'GA: expected 10 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'GA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'GA: expected to publish 10, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'GA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'GA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IA (11)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 11 then
    raise exception 'IA: expected 11 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'IA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'IA: expected to publish 11, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'IA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- ID (4)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'ID'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 4 then
    raise exception 'ID: expected 4 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'ID'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'ID: expected to publish 4, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'ID'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'ID: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IL (37)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 37 then
    raise exception 'IL: expected 37 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'IL'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 37 then raise exception 'IL: expected to publish 37, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IL'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'IL: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- IN (19)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 19 then
    raise exception 'IN: expected 19 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'IN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 19 then raise exception 'IN: expected to publish 19, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'IN'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'IN: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- KS (19)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'KS'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 19 then
    raise exception 'KS: expected 19 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'KS'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 19 then raise exception 'KS: expected to publish 19, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'KS'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'KS: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- KY (9)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'KY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 9 then
    raise exception 'KY: expected 9 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'KY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'KY: expected to publish 9, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'KY'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'KY: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- LA (15)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'LA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 15 then
    raise exception 'LA: expected 15 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'LA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 15 then raise exception 'LA: expected to publish 15, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'LA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'LA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MD (2)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MD'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 2 then
    raise exception 'MD: expected 2 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MD'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'MD: expected to publish 2, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MD'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MD: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MI (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MI'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'MI: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MI'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'MI: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MI'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MI: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MN (4)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 4 then
    raise exception 'MN: expected 4 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'MN: expected to publish 4, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MN'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MN: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MO (25)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MO'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 25 then
    raise exception 'MO: expected 25 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MO'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 25 then raise exception 'MO: expected to publish 25, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MO'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MO: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MS (20)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MS'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 20 then
    raise exception 'MS: expected 20 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MS'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 20 then raise exception 'MS: expected to publish 20, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MS'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MS: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- MT (4)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 4 then
    raise exception 'MT: expected 4 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'MT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'MT: expected to publish 4, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'MT'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'MT: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NC (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NC'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'NC: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NC'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'NC: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NC'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NC: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- ND (5)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'ND'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 5 then
    raise exception 'ND: expected 5 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'ND'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'ND: expected to publish 5, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'ND'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'ND: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NE (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NE'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'NE: expected 8 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NE'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'NE: expected to publish 8, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NE'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NE: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NJ (1)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NJ'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 1 then
    raise exception 'NJ: expected 1 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NJ'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'NJ: expected to publish 1, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NJ'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NJ: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NM (16)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NM'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 16 then
    raise exception 'NM: expected 16 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NM'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'NM: expected to publish 16, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NM'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NM: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NV (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NV'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'NV: expected 8 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NV'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'NV: expected to publish 8, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NV'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NV: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- NY (6)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 6 then
    raise exception 'NY: expected 6 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'NY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'NY: expected to publish 6, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'NY'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'NY: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OH (27)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OH'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 27 then
    raise exception 'OH: expected 27 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'OH'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 27 then raise exception 'OH: expected to publish 27, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OH'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'OH: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OK (37)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OK'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 37 then
    raise exception 'OK: expected 37 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'OK'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 37 then raise exception 'OK: expected to publish 37, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OK'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'OK: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- OR (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OR'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'OR: expected 8 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'OR'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'OR: expected to publish 8, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'OR'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'OR: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- PA (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'PA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'PA: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'PA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'PA: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'PA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'PA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- SC (10)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'SC'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 10 then
    raise exception 'SC: expected 10 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'SC'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'SC: expected to publish 10, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'SC'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'SC: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- SD (3)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'SD'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 3 then
    raise exception 'SD: expected 3 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'SD'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'SD: expected to publish 3, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'SD'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'SD: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- TN (8)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'TN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 8 then
    raise exception 'TN: expected 8 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'TN'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'TN: expected to publish 8, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'TN'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'TN: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- TX (79)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'TX'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 79 then
    raise exception 'TX: expected 79 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'TX'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 79 then raise exception 'TX: expected to publish 79, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'TX'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'TX: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- UT (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'UT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'UT: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'UT'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'UT: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'UT'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'UT: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- VA (12)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'VA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 12 then
    raise exception 'VA: expected 12 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'VA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'VA: expected to publish 12, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'VA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'VA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WA (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'WA: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'WA'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'WA: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WA'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'WA: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WI (7)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WI'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 7 then
    raise exception 'WI: expected 7 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'WI'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'WI: expected to publish 7, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WI'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'WI: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WV (1)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WV'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 1 then
    raise exception 'WV: expected 1 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'WV'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'WV: expected to publish 1, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WV'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'WV: % non-overnight row(s) were published.', n; end if;
end $$;
commit;

-- ---------------------------------------------------------------- WY (5)
begin;
do $$
declare n integer;
begin
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  if n <> 5 then
    raise exception 'WY: expected 5 publishable overnight row(s), found %.', n;
  end if;

  update public.locations
     set is_published = true, updated_at = now()
   where source = 'loves-master-2026-07-27' and state = 'WY'
     and category_slug = 'truck-stops' and not is_published
     and overnight_parking is true and coalesce(parking_spaces,0) > 0
     and lat is not null and lng is not null and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'WY: expected to publish 5, published %.', n; end if;

  -- A non-overnight store must never have been published by this run.
  select count(*) into n from public.locations
   where source = 'loves-master-2026-07-27' and state = 'WY'
     and is_published and overnight_parking is not true;
  if n <> 0 then raise exception 'WY: % non-overnight row(s) were published.', n; end if;
end $$;
commit;


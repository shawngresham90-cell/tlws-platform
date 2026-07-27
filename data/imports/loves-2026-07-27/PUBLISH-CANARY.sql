-- Love's publication CANARY — 10 locations, GUARDED.
--
-- NOT EXECUTED. Publication requires separate authorization, distinct from
-- insertion and from enrichment.
--
-- Ten overnight-eligible Love's Travel Stops, each in a different state and on
-- a different corridor, weighted to corridors the directory currently has zero
-- parking on. Every one must already have been inserted by INSERT-NET-NEW.sql
-- and therefore already carries an machine-checked coordinate.
--
--   1. #766  Atkinson, IL  I-80   137 spaces
--   2. #432  Oak Creek, WI  I-94   116 spaces
--   3. #1043 Laurel, MT  I-90   177 spaces
--   4. #401  Baytown, TX  I-10   160 spaces
--   5. #340  Las Vegas, NV  I-15   153 spaces
--   6. #300  Bennett, CO  I-70   200 spaces
--   7. #411  Clive, IA  I-35   275 spaces
--   8. #448  Tacoma, WA  I-5    160 spaces
--   9. #868  Mims, FL  I-95   93 spaces
--  10. #262  Tucumcari, NM  I-40   160 spaces

begin;

create temporary table _canary (source_ref text primary key, state char(2)) on commit drop;
insert into _canary values
  ('766', 'IL'),
  ('432', 'WI'),
  ('1043', 'MT'),
  ('401', 'TX'),
  ('340', 'NV'),
  ('300', 'CO'),
  ('411', 'IA'),
  ('448', 'WA'),
  ('868', 'FL'),
  ('262', 'NM');

do $$
declare n integer;
begin
  -- 1. All ten resolve to exactly one unpublished Love's truck-stops row each.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.deleted_at is null and l.category_slug = 'truck-stops'
     and l.source = 'loves-master-2026-07-27';
  if n <> 10 then raise exception 'Expected 10 canary rows, matched %.', n; end if;

  -- 2. COORDINATES REQUIRED.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.lat is null or l.lng is null;
  if n <> 0 then raise exception '% canary row(s) have no coordinate.', n; end if;

  -- 3. OVERNIGHT REQUIRED. A non-overnight store may never enter a parking canary.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.overnight_parking is not true or coalesce(l.parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% canary row(s) are not overnight-eligible.', n; end if;

  -- 4. None already published (idempotent).
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.is_published;
  if n <> 0 then raise exception '% canary row(s) are already published.', n; end if;

  -- 5. Publish. is_featured and is_indexable untouched.
  update public.locations l
     set is_published = true, updated_at = now()
    from _canary c
   where l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
     and l.category_slug = 'truck-stops' and l.source = 'loves-master-2026-07-27'
     and l.lat is not null and l.lng is not null;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'Expected to publish exactly 10 row(s), published %.', n; end if;
end $$;

commit;

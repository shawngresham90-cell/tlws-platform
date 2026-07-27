-- TA/Petro enrichment REMAINDER — the 28 address-anchored rows not in the
-- canary. Same guards as ENRICH-EXISTING.sql, counts recomputed per state.
-- Run only after the canary has passed its audit.
--
-- EXECUTED 2026-07-27: all states committed EXCEPT the TN transaction, which
-- failed its collision guard and rolled back atomically — site 0269
-- TA Knoxville West's staged pin exactly matches the site's own published
-- CAT-scale / truck-service records. 0269 was QUARANTINED (the collision
-- guard is not to be weakened) and TN re-ran with its 4 independently safe
-- rows, which committed. Final: 37 of 38 rows applied. See EXECUTION-RECORD.md.
--
-- Source of record: the current official TA/Petro location master,
-- downloaded 2026-07-27 via "Download Location Data" at ta-petro.com/location/.
-- Official artifact sha256 a0c612f0426d141c481f84aae59dc15a0204617183bbf9c0866bfbb726ed63f7
-- COMMITTED 2026-07-27 as locmaster20260727.xlsx and checksum-verified.
-- Cell-content diff against the earlier working copy (5ebe0e9f…3303): identical
-- except two service-hours cells at TA Kingman AZ — columns never read by the
-- reconciliation and never written by any statement. All ten verified facts
-- hold on the exact artifact. PRECONDITION OF EXECUTION: SATISFIED.
--
-- Stable keys: Site ID first, then Location ID; then address and coordinate
-- checks. A loose business name is never sufficient on its own.
--
-- Goasis and Thorntons are HELD — separate and untouched.
-- The 7 zero-parking locations are never counted as truck-parking coverage.
-- overnight_parking, is_published, is_featured and is_indexable are NEVER
-- written by any statement in this package.

-- ============================================================ AL (2)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('25721d01-d3ed-4da5-a9cc-448fd166e75b', 'Petro Dodge City (Petro Stopping Center #397)', '0485', 34.05078, -86.87234, null, null),
  ('2937ca5e-063c-4ac7-b4c4-0e7da286f488', 'TA Montgomery #111', '0539', 32.32746, -86.33221, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 2 then raise exception 'Expected 2 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ AR (3)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('20ea502e-9d1f-43e3-b369-520d35c38c5f', 'Petro Stopping Center #311 (Petro West Memphis)', '0311', 35.1544, -90.136, null, null),
  ('03c39975-0f38-4f41-97e7-d50d95b9edf0', 'Petro Stopping Center #326 (Petro N. Little Rock)', '0326', 34.781, -92.1298, null, null),
  ('366ea2a6-4116-4ce3-bc64-01fdac0dcb60', 'TA Express Atkins', '0954', 35.22162, -92.82594, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 3 then raise exception 'Expected 3 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ FL (3)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('245d9e0f-cb95-461e-822a-e458c03212ed', 'TA Wildwood (TravelCenters of America)', '0053', 28.875, -82.0939, null, null),
  ('687996be-4fd9-4464-a9b3-3df5b2c7f505', 'TA Travel Center #288 (Lake City)', '0288', 29.99558, -82.59672, null, null),
  ('904bda8d-b42d-49ce-88d2-5b2fd4ca4191', 'Petro Stopping Center #323 (Ocala / Reddick)', '0323', 29.409, -82.2462, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 3 then raise exception 'Expected 3 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ GA (2)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('28c41568-118b-4e1f-aee1-469f8a634af9', 'TA Travel Center Brunswick', '0258', null, null, 107, null),
  ('36d48fe4-d2ce-4d99-987a-9e8341644b7a', 'Petro Stopping Center #344 (TA/Petro Kingsland)', '0344', null, null, 136, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 2 then raise exception 'Expected 2 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ IN (4)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('b9b49d33-ae7d-4ca0-b197-6986c17eef18', 'TA Seymour', '0065', 38.9576, -85.8366, null, null),
  ('0fd1e82b-0a8e-410b-9af9-8787d6ab89b8', 'TA Whitestown (TravelCenters of America #173)', '0173', 39.9478, -86.357, null, null),
  ('8578017a-7ea0-4c38-a6ed-abf7b5a39d0f', 'Petro Gary #369 (Grant Street)', '0369', 41.5638, -87.3557, null, null),
  ('bd27e9bc-6b14-4810-b20d-26a04702c477', 'Petro Stopping Center #382', '0382', 40.767, -87.1261, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 4 then raise exception 'Expected 4 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ KY (1)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('eec1d852-2b50-47f7-a59e-b1238f1ace2d', 'TA Florence', '0093', 39.0001, -84.6447, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 1 then raise exception 'Expected 1 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ MD (2)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('f35c37d4-6118-40c1-8380-1edf8e79777d', 'TA Elkton #019', '0019', null, null, 151, null),
  ('e102d6bd-874c-43d0-b9f6-c8a9dbbe4832', 'TA Baltimore #216', '0216', null, null, 181, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 2 then raise exception 'Expected 2 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ MI (2)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('7b340f8f-28fc-4bca-83a8-bee8a793a4fb', 'TA Travel Center - Monroe #069', '0069', 41.9267, -83.3632, null, null),
  ('eb48d156-9ad9-4fa3-b8eb-cfc7b29a49a4', 'TA Saginaw #198 (Bridgeport)', '0528', 43.3517, -83.869, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 2 then raise exception 'Expected 2 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ NC (1)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('91b8ddaa-6012-4ab7-839a-ded888eb912d', 'TA Candler (TravelCenters of America #221)', '0221', 35.5432, -82.754, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 1 then raise exception 'Expected 1 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ OH (2)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('51296b6f-d325-4a97-a48f-d7a315a5e7e0', 'TA Wapakoneta #082', '0082', 40.5582, -84.1656, null, null),
  ('bb4d283f-1f08-4acd-a062-850f5bc309c6', 'Petro Stopping Center #325', '0325', 41.1738, -83.6475, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 2 then raise exception 'Expected 2 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ SC (1)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('8bf6630b-8c97-45c5-b219-f6b2e21d760a', 'Petro / TA Florence (TravelCenters of America #195)', '0527', null, null, 77, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 1 then raise exception 'Expected 1 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

-- ============================================================ TN (5)
begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('09974385-8c93-4bb5-be59-13552b53e2b3', 'TA Denmark (TravelCenters of America #245)', '0245', 35.5955, -89.0557, null, null),
  ('cd4783d1-b67c-4c09-b056-6a72f5606229', 'TA Knoxville West', '0269', 35.8731, -84.2379, null, null),
  ('68afff98-8a4c-42be-b099-e87e50b08a38', 'TA Express Cookeville', '0287', 36.1305, -85.4796, null, null),
  ('5e829807-6932-4f13-b44f-e5dea115f755', 'Petro Knoxville', '0312', 35.875, -84.2361, null, null),
  ('d19be5c3-65f2-471d-9281-0cfeeaa8ceb0', 'TA Franklin (TravelCenters of America #157)', '0544', 35.8603, -86.8299, null, null);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 5 then raise exception 'Expected 5 staged, found %.', batch; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> batch then raise exception '% row(s) failed the identity check.', batch - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null)
      or (e.zip is not null and l.zip is not null and btrim(l.zip) <> '');
  if n <> 0 then raise exception '% row(s) already hold a value this would write. Blank-only violated.', n; end if;

  select count(*) into n from _enr
   where lat is not null and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;
  select count(*) into n from (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared inside the batch.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich %, updated %.', batch, n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;


-- TA/Petro enrichment CANARY — 10 rows, 10 states, GUARDED.
--
-- NOT EXECUTED. Run before ENRICH-EXISTING.sql, verify with VERIFY.sql, then
-- proceed. Same guards as the full file; the canary rows are a strict subset,
-- and ENRICH-EXISTING.sql is idempotent so the overlap is safe (blank-only
-- guards make the second pass skip rows the canary already filled — those
-- states' transactions will FAIL their expected-count checks and roll back,
-- which is the designed signal to run only the remaining states).
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

begin;

create temporary table _enr (
  db_id uuid primary key, expected_name text, site_id text,
  lat double precision, lng double precision, parking_spaces int, zip text
) on commit drop;

insert into _enr values
  ('ff19357b-eb93-4483-9e4e-ebb40e07fe36', 'TA Baltimore South #151', '0151', null, null, 436, null),
  ('0a0c7a0d-2fb0-4201-a93f-b934e2617b5b', 'Petro Kenly 95 #395', '0395', null, null, 350, null),
  ('6bad6451-4f76-45b8-9a3b-4a1aad414f83', 'TA Savannah (TravelCenters of America #177)', '0177', null, null, 222, null),
  ('7d74bb54-f22d-4594-8bc8-9d9710f88ac0', 'TA Vero Beach #197', '0197', null, null, 162, null),
  ('3e5fef77-bc72-4174-b45d-04f6096c8fde', 'TA Earle (TravelCenters of America #033)', '0033', 35.1364, -90.488, 137, null),
  ('b621363d-e4d4-40c6-a04d-09e950264b12', 'TA Manning (TravelCenters of America #179)', '0179', null, null, 84, null),
  ('ebb8ad22-3283-4fc6-9918-66a8ef8ef9dd', 'TA Express Stony Creek (former Davis Travel Center)', '0486', null, null, 80, null),
  ('8018aa5b-c428-465d-9809-fde4e03cd4a2', 'Petro Stopping Center Kingston Springs #349', '0349', 36.0824, -87.0955, 68, null),
  ('783d1792-e352-4fb3-bd2b-fc38951c19c8', 'TA Gary #010 (Burr Street)', '0010', 41.573, -87.4045, null, null),
  ('dee17bfa-a6bf-4da0-8d48-95a9231de439', 'TA Walton', '0028', 38.9172, -84.6266, null, null);

do $$
declare n integer;
begin
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and l.name = e.expected_name;
  if n <> 10 then raise exception '% canary row(s) failed identity.', 10 - n; end if;

  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null);
  if n <> 0 then raise exception '% canary row(s) not blank. Already run?', n; end if;

  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% collision(s) with a published pin.', n; end if;

  update public.locations l
     set lat = coalesce(l.lat, e.lat), lng = coalesce(l.lng, e.lng),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         zip = case when l.zip is null or btrim(l.zip) = '' then coalesce(e.zip, l.zip) else l.zip end,
         geocode_source = case when l.lat is null and e.lat is not null then 'batch-csv' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null then 'machine-checked' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'Expected 10, updated %.', n; end if;
end $$;

commit;

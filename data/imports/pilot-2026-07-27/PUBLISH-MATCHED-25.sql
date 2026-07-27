-- Pilot / Flying J / ONE9 — publication of the 25 ELIGIBLE matched pre-existing
-- rows. NOT EXECUTED.
--
-- AUTHORIZATION STOP, 2026-07-27: the closeout authorization named "29 verified
-- matched rows" and required a stop if the expected set is not exactly 29. The
-- measured eligible set is 25: the other 4 unpublished matched rows are the
-- enrichment-quarantined records (#1330 AR, #1550 AL, #353 KY, #95 FL), which
-- are coordless (the published-pin collision guard blocked their enrichment)
-- and are excluded by the authorization's own "not quarantined" criterion.
-- Publication therefore STOPPED before any write. This file is the prepared,
-- guarded package for the corrected 25-row set, awaiting re-authorization.
--
-- Every row below was verified against the checksummed official source
-- (all_locations.csv, sha256 d39ab57d…e330a): DB coordinate and parking count
-- equal the official values exactly, and a fresh read-only sweep found no
-- published pin within ~150 m of any of the 25 (guard 4 re-proves it in-tx).
--
-- The only permitted field change is is_published false -> true (plus
-- updated_at). Canary first (5 rows, 5 states, Flying J + Pilot brands),
-- then one guarded transaction per state. Any guard failure aborts that
-- transaction; the failing row is quarantined, never forced.
--
-- Expected if all 25 pass: live rows stay 2,265 · published 1,862 -> 1,887 ·
-- Gate 3a stays 809/820 · Gate 3b 763/803 -> 788/803. (The originally
-- stated 1,891 / 792 assumed 29 rows and is unreachable without the four
-- quarantined records, which need their own review first.)

-- ===== CANARY — 5 rows, 5 states (#90 FL, #4562 GA, #875 MD, #6990 NC, #62 SC) (5 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('e5c73805-b895-443e-ad46-5b33992106d6'::uuid, 27.4138524510288, -80.40013848915262, 100),
  ('0fda85a9-364c-4541-99d7-fac38c8f755e'::uuid, 30.75989471461253, -81.65574789931874, 111),
  ('39a7ad06-c801-4b4f-8ea1-3d847839a62c'::uuid, 39.63836410068015, -75.80598211474991, 230),
  ('062c24f7-7145-41f3-97f7-431b2d8965b3'::uuid, 35.58299557135885, -78.14789037301635, 125),
  ('a77f9fde-3b52-4f86-961d-91e168d388d5'::uuid, 34.26660455384255, -79.70179281338103, 75);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 5 then raise exception 'Expected 5 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'Expected to publish exactly 5 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- Audit the canary before continuing. Then, per state, the remainder:

-- ===== FL (5 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('ca4da6a3-c18d-4f65-88ec-1076319eb6c5'::uuid, 28.359164203862274, -80.79245792270183, 8),
  ('1f226de3-a16d-434e-9db3-2cb86dbf9e31'::uuid, 30.065564, -81.493909, 17),
  ('9d5b4987-bd0e-4332-ae57-b774ca5ee801'::uuid, 27.448956010822528, -80.3977813214264, 156),
  ('c372a30e-8b6d-44db-b71f-1a3621ef7a7e'::uuid, 29.74996120681377, -81.34444617182768, 99),
  ('b8bff6ef-fb37-4415-9966-9e0ef40bbb4d'::uuid, 30.371257849974512, -81.7642421064314, 65);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 5 then raise exception 'Expected 5 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'Expected to publish exactly 5 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- ===== GA (3 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('da315672-4e7f-4389-a555-4e4b7aa1d94a'::uuid, 32.188725774101115, -81.19496020325909, 112),
  ('50cf9353-443d-406e-b1d2-9889112e116c'::uuid, 30.760673125363606, -81.64907624610727, 235),
  ('f0129700-18d1-49cf-b92f-0be14a549686'::uuid, 31.14016746021323, -81.57832099692367, 150);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 3 then raise exception 'Expected 3 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Expected to publish exactly 3 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- ===== MD (1 row)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('d56cff01-0dcb-4610-82aa-920d1214a828'::uuid, 39.6254814074548, -75.95014760199173, 185);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 1 then raise exception 'Expected 1 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected to publish exactly 1 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- ===== NC (3 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('b89a9bb7-6833-4f23-8466-1d6660615cd3'::uuid, 36.523299, -77.587281, 42),
  ('f97ef111-f094-422a-bc61-7362a0a27d26'::uuid, 35.57450741129341, -78.14640144688613, 145),
  ('438d7ce9-59d8-4fec-b8d5-24f36c3a5481'::uuid, 35.31835659787999, -78.57574679036492, 265);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 3 then raise exception 'Expected 3 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Expected to publish exactly 3 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- ===== SC (5 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('4f23643b-4ec9-471a-beac-7a7538e73adf'::uuid, 34.23256102007648, -79.80240283883901, 90),
  ('455f776b-7681-45be-8604-fdb9593beb44'::uuid, 33.193987365125956, -80.60230509010448, 118),
  ('a109cc92-378c-4d57-ac39-da50a5c2a2c6'::uuid, 34.338987832171995, -79.53411028419238, 200),
  ('9ac45310-ac8c-4885-a5aa-ebf787c2f13a'::uuid, 32.26878204646999, -81.08101432460634, 90),
  ('989e6437-46b1-45ce-a5b2-7f7d4d0cb18a'::uuid, 34.344825, -79.534595, 112);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 5 then raise exception 'Expected 5 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'Expected to publish exactly 5 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;

-- ===== VA (3 rows)
begin;
create temporary table _pub (
  db_id uuid primary key, lat double precision, lng double precision, parking_spaces int
) on commit drop;
insert into _pub values
  ('ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6'::uuid, 37.3108667, -77.3915178, 110),
  ('3f7408df-a39e-46cd-843a-61694fabbe9c'::uuid, 36.7045199441136, -77.55285515344238, 300),
  ('8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8'::uuid, 36.6069402079367, -77.56095702090148, 85);
do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _pub;
  if batch <> 3 then raise exception 'Expected 3 staged row(s), found %.', batch; end if;

  -- 1. Every id resolves to a live, unpublished truck-stops row.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.deleted_at is null and l.category_slug = 'truck-stops' and not l.is_published;
  if n <> batch then raise exception '% row(s) are not live unpublished truck-stops rows.', batch - n; end if;

  -- 2. VALUE MATCH. The row must still hold exactly the enriched official
  --    coordinate and parking count. A drifted row is refused, not published.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.lat is distinct from p.lat or l.lng is distinct from p.lng
      or l.parking_spaces is distinct from p.parking_spaces;
  if n <> 0 then raise exception '% row(s) drifted from the verified official values.', n; end if;

  -- 3. POSITIVE PARKING. A zero-space row can never be published as parking.
  select count(*) into n from _pub where coalesce(parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% staged row(s) have no positive parking count.', n; end if;

  -- 4. COLLISION GUARD. No published pin within ~150 m of any staged pin.
  select count(*) into n
    from _pub p join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> p.db_id
     and abs(l.lat - p.lat) < 0.0015 and abs(l.lng - p.lng) < 0.0015;
  if n <> 0 then raise exception '% staged pin(s) collide with a published pin.', n; end if;

  -- 5. Publish. THE ONLY FIELD CHANGE IS is_published false -> true.
  update public.locations l
     set is_published = true, updated_at = now()
    from _pub p
   where l.id = p.db_id and not l.is_published;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Expected to publish exactly 3 row(s), published %.', n; end if;

  -- 6. Nothing became featured / indexable / overnight.
  select count(*) into n from _pub p join public.locations l on l.id = p.db_id
   where l.is_featured or l.is_indexable or l.overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % row(s) carry a forbidden flag.', n; end if;
end $$;
commit;


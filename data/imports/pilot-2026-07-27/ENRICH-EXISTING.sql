-- Pilot / Flying J / ONE9 enrichment of EXISTING rows — GUARDED, blank-only,
-- exact id.
--
-- NOT EXECUTED. 84 rows, all of them the `truck-stops` record for a
-- network site.
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
-- THE MAP-PIN RULE: only the truck-stops row receives a coordinate. The
-- 92 colocated CAT scale / tire / wash / roadside rows at the same
-- addresses are reconciled in COLOCATED-SERVICE-ROWS.csv and deliberately get
-- NO coordinate, so the collision guard is never weakened and the map never
-- shows two pins for one site.
--
-- BLANK-ONLY, per field. A field is staged only where the directory row is
-- actually missing it, checked against the real current values:
--   lat/lng         82 row(s)
--   interstate       0 row(s)
--   parking_spaces  38 row(s)   (73 rows already have a count; they are not restaged)
--
-- overnight_parking is NEVER written. exit_number is NEVER written: 217 of the
-- 222 directory rows already carry one and this export's exit strings are a
-- different format.

begin;

create temporary table _enr (
  db_id uuid primary key, source_ref text, lat double precision, lng double precision,
  interstate text, parking_spaces int
) on commit drop;

insert into _enr values
  ('5cf98762-e51b-4116-8a71-1934fcc47f35', '89', 27.528565346887518, -82.51230464049281, null, null),
  ('5fc5e9a4-17f9-40c7-9c65-d3904e90140f', '226', 36.03750642605513, -83.44555030270627, null, null),
  ('7e79bd38-6884-4e0c-a05e-0303faa8514e', '457', 40.8339660627421, -83.9644058889723, null, null),
  ('7e949312-8bda-4eb3-b270-bed57d56fdc0', '53', 35.88214835938339, -87.80100000398463, null, null),
  ('a77f9fde-3b52-4f86-961d-91e168d388d5', '62', 34.26660455384255, -79.70179281338103, null, 75),
  ('f9e3ec91-4b3f-4c36-a174-96eafb9e907e', '403', null, null, null, 25),
  ('28ed1b57-596a-42e2-bcb7-55434d32fe02', '441', 34.538005252844954, -86.91097605562913, null, null),
  ('9172f64e-0836-45fd-a136-3e9c914b7097', '653', 41.28823088555331, -87.29464827116392, null, null),
  ('989e6437-46b1-45ce-a5b2-7f7d4d0cb18a', '4584', 34.344825, -79.534595, null, 112),
  ('e5c73805-b895-443e-ad46-5b33992106d6', '90', 27.4138524510288, -80.40013848915262, null, 100),
  ('b7a1bf29-998f-498a-a44a-0974411802b6', '231', 36.97511182002901, -84.10778245470296, null, null),
  ('2e036deb-3b94-41b3-9fcb-fd5b71923e44', '254', 34.97848385096656, -85.4139074441803, null, null),
  ('5527d376-b806-4a10-bc75-0478c35672d0', '284', 41.96358907420919, -83.35375333735163, null, null),
  ('930d8058-2612-4312-99fe-c80cc9d03e11', '332', 34.781197952345856, -92.12783413251053, null, null),
  ('92a67cb7-3086-461e-a710-7ab4be8446cf', '437', 36.72208144037753, -84.16803532055776, null, null),
  ('4f77aa49-f11e-4ebd-a86e-9c6290ec1ec1', '114', 35.9857961, -85.0116688, null, null),
  ('1f226de3-a16d-434e-9db3-2cb86dbf9e31', '91', 30.065564, -81.493909, null, 17),
  ('b3c074e4-06a3-4cb4-b205-6ad5ddae3476', '219', 35.9992434, -83.7775841, null, null),
  ('c4fa7a01-7327-4a45-9a23-1d24e9bd4a3e', '409', 36.02270726288148, -87.34116938028716, null, null),
  ('8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8', '4651', 36.6069402079367, -77.56095702090148, null, 85),
  ('a8a32662-d389-4d96-9653-6fde235726d0', '353', 38.27605548759607, -84.55335544912026, null, null),
  ('49310225-476e-403f-bc11-b296444ee454', '1063', 35.64256181522499, -82.04021014643918, null, null),
  ('4c7eff4b-4b93-4969-8d19-5fb1d388779b', '4597', 36.17723841617246, -85.9486013542818, null, null),
  ('da315672-4e7f-4389-a555-4e4b7aa1d94a', '71', 32.188725774101115, -81.19496020325909, null, 112),
  ('c251431a-ff37-4d55-9b22-1fd126b525aa', '602', 33.56259486492335, -86.83074711838533, null, 157),
  ('76f653aa-907b-4800-865a-1dd03003185a', '95', 28.873918542991504, -82.09515797982287, null, 10),
  ('f77f6c23-384f-4f64-af4d-2b73d30dbfbb', '604', 32.194202910088684, -86.41967308332825, null, null),
  ('4b07b610-8186-4ad2-b037-cb9c402928a9', '34', 40.7663019, -87.1234491, null, null),
  ('e780ec0a-3a95-42b8-b7bd-eca1cadf2a72', '265', 36.133737186379726, -85.50421763558195, null, null),
  ('6e1f345b-b3fd-42bb-848c-acfb5573ebc8', '366', 35.682945179393094, -88.77758901995591, null, null),
  ('455f776b-7681-45be-8604-fdb9593beb44', '493', 33.193987365125956, -80.60230509010448, null, 118),
  ('1beb847b-eca9-4b86-a151-558340292504', '624', 28.326050432621614, -82.32248806404851, null, null),
  ('54eb73aa-b523-42b7-bb42-be43bfe1e235', '664', 38.8576816680839, -84.625863390213, null, null),
  ('a109cc92-378c-4d57-ac39-da50a5c2a2c6', '713', 34.338987832171995, -79.53411028419238, null, 200),
  ('48942c6d-d58b-46ad-8a29-906278fceb35', '75', 30.8727989, -88.0469468, null, 77),
  ('ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6', '384', 37.3108667, -77.3915178, null, 110),
  ('7d43f079-09a4-4f73-a484-93682b5e28aa', '429', 35.157735969602406, -90.13770261293222, null, null),
  ('1dac7271-b06e-47a7-9845-3ea235276d79', '656', 39.5496802, -86.0368062, null, 173),
  ('7edab277-0c0b-4498-a04d-3389926b0fe4', '37', 39.55117863378675, -86.04598800859831, null, 110),
  ('321b8c5c-5c9f-48e1-aa9c-fd0332dee69e', '24', 41.9247909, -83.3661458, null, null),
  ('4f23643b-4ec9-471a-beac-7a7538e73adf', '337', 34.23256102007648, -79.80240283883901, null, 90),
  ('b8bff6ef-fb37-4415-9966-9e0ef40bbb4d', '1047', 30.371257849974512, -81.7642421064314, null, 65),
  ('062c24f7-7145-41f3-97f7-431b2d8965b3', '6990', 35.58299557135885, -78.14789037301635, null, 125),
  ('d7265e8b-ae0a-4d0b-84f1-de75c9f7a70d', '430', 35.28063189312379, -93.09278987752802, null, null),
  ('ca4da6a3-c18d-4f65-88ec-1076319eb6c5', '88', 28.359164203862274, -80.79245792270183, null, 8),
  ('894798c3-0460-4016-b5a1-ca4505143ee5', '92', 29.267799374341905, -82.19160579877662, null, null),
  ('34ba01ad-945f-4960-b099-01964f28815d', '278', 38.91921224492679, -84.62533229563141, null, null),
  ('362f1bd5-2789-488a-8652-ffa580d9737a', '411', 36.1791753, -86.2994386, null, null),
  ('9d5b4987-bd0e-4332-ae57-b774ca5ee801', '622', 27.448956010822528, -80.3977813214264, null, 156),
  ('39a7ad06-c801-4b4f-8ea1-3d847839a62c', '875', 39.63836410068015, -75.80598211474991, null, 230),
  ('7d145a52-2a8c-420b-87c8-5c8668bca4d9', '293', 29.02513864695603, -82.15903012349477, null, null),
  ('3e2d7707-cfa9-4fff-a6e1-b564b40bfc32', '895', 42.13676883345559, -83.23951225141504, null, 254),
  ('d4d6ed3b-3e72-4011-b0cc-29783bc21dd0', '47', 38.27672724577639, -84.56014385515596, null, null),
  ('d806f887-5291-49e4-8e36-4e7ae97c3996', '271', 41.57311335096673, -87.40281201852419, null, 215),
  ('6d8f6cd0-78e1-489f-9f94-7878cba55e77', '500', 30.5163005, -83.0587583, null, null),
  ('f0129700-18d1-49cf-b92f-0be14a549686', '627', 31.14016746021323, -81.57832099692367, null, 150),
  ('3f7408df-a39e-46cd-843a-61694fabbe9c', '898', 36.7045199441136, -77.55285515344238, null, 300),
  ('58ed9375-a7ad-4139-95ec-8c928564778c', '4556', 28.873736500809937, -82.09055893068847, null, 75),
  ('07d998a5-79fa-4b95-b63f-7bbeb29ca62e', '406', 35.30525595924141, -86.88404011772155, null, null),
  ('9eaf0102-674a-4c29-a360-b2de6807e4f1', '424', 29.26616378692671, -82.18890931994056, null, null),
  ('f7f69a6a-d032-46ee-9ce6-52796f556a07', '448', 41.290344107421696, -87.2951070101934, null, null),
  ('da698161-6d20-4069-9e12-64db6fb9cf21', '9', 39.542654037902615, -84.29043254773055, null, null),
  ('bf859b17-33b7-4fb7-995a-1d7cb462c529', '360', 41.136826925351244, -83.66038718114063, null, null),
  ('6c2078f9-7d25-48bf-8e8f-10d24ac2b372', '393', 35.5727, -82.955867, null, null),
  ('a70da55a-2a2e-420a-953c-4b6d46e1c435', '652', 40.0323480743644, -86.47280271031188, null, null),
  ('0ecffefe-7964-4da6-9052-c230adc0a249', '695', 40.832295840216204, -83.9673392043686, null, null),
  ('d7247403-1ed3-49de-83a5-af2862cdbd9f', '1550', 34.116865025472514, -86.86373995824155, null, null),
  ('5aecf10b-8e95-48a4-a815-da033b1d7cf4', '1577', null, null, null, 88),
  ('f68a555f-f314-4506-91bc-db780f009c31', '97', 39.9024827, -84.1927628, null, null),
  ('7500cfb3-d609-4280-9869-356cb5588398', '94', 26.8941468, -82.0092852, null, 39),
  ('50cf9353-443d-406e-b1d2-9889112e116c', '575', 30.760673125363606, -81.64907624610727, null, 235),
  ('99e14e2c-5498-4df1-b60b-7ff743aec8ae', '605', 35.28320640968396, -93.09000597552921, null, null),
  ('b89a9bb7-6833-4f23-8466-1d6660615cd3', '58', 36.523299, -77.587281, null, 42),
  ('5c42f488-24de-40af-a67d-88e61d627d64', '321', 38.91737631038006, -84.63245170304107, null, null),
  ('c372a30e-8b6d-44db-b71f-1a3621ef7a7e', '626', 29.74996120681377, -81.34444617182768, null, 99),
  ('effb0793-cbed-44f7-b05c-3645ccfdda21', '668', 43.45188561064311, -83.89413353950054, null, null),
  ('d56cff01-0dcb-4610-82aa-920d1214a828', '784', 39.6254814074548, -75.95014760199173, null, 185),
  ('438d7ce9-59d8-4fec-b8d5-24f36c3a5481', '900', 35.31835659787999, -78.57574679036492, null, 265),
  ('394f5b7a-2970-453b-91d4-fc87c30a51a0', '607', 35.15415439265023, -90.14396355128943, null, null),
  ('f97ef111-f094-422a-bc61-7362a0a27d26', '683', 35.57450741129341, -78.14640144688613, null, 145),
  ('0fda85a9-364c-4541-99d7-fac38c8f755e', '4562', 30.75989471461253, -81.65574789931874, null, 111),
  ('9ac45310-ac8c-4885-a5aa-ebf787c2f13a', '4569', 32.26878204646999, -81.08101432460634, null, 90),
  ('69f1f244-c4c0-480b-9e95-f1b02554cb6b', '1330', 34.912544273597874, -91.19621866623427, null, 42),
  ('cc5fe530-72f9-4f40-82de-bb55487a82cc', '1366', 35.843010167500815, -88.08471945506712, null, 118);

do $$
declare n integer; batch integer;
begin
  select count(*) into batch from _enr;
  if batch <> 84 then
    raise exception 'Expected 84 staged rows, found %.', batch;
  end if;

  -- 1. Every id resolves to a live row.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id where l.deleted_at is null;
  if n <> batch then raise exception '% id(s) do not resolve to a live row.', batch - n; end if;

  -- 2. Every target is the truck-stops record — the only row that gets a pin.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.category_slug <> 'truck-stops';
  if n <> 0 then raise exception '% target(s) are not truck-stops rows; only the map-pin row may be enriched.', n; end if;

  -- 3. BLANK-ONLY, PER FIELD. A value is staged only where the row is empty.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where (e.lat is not null and l.lat is not null)
      or (e.lng is not null and l.lng is not null)
      or (e.interstate is not null and l.interstate is not null)
      or (e.parking_spaces is not null and l.parking_spaces is not null);
  if n <> 0 then raise exception '% target(s) already hold a value this statement would write. Blank-only violated.', n; end if;

  -- 4. Staged coordinates plausible and inside the U.S. envelope.
  select count(*) into n from _enr
   where lat is not null
     and (lat = 0 or lng = 0 or lat not between 24.0 and 49.5 or lng not between -125.0 and -66.5);
  if n <> 0 then raise exception '% coordinate(s) unusable.', n; end if;

  -- 5. COLLISION GUARD. No two staged sites share a coordinate, and no staged
  --    coordinate lands on an existing published pin.
  select count(*) into n from
    (select lat, lng from _enr where lat is not null group by lat, lng having count(*) > 1) d;
  if n <> 0 then raise exception '% coordinate(s) shared by more than one site.', n; end if;
  select count(*) into n
    from _enr e join public.locations l
      on l.deleted_at is null and l.is_published and l.lat is not null and l.id <> e.db_id
     and abs(l.lat - e.lat) < 0.0015 and abs(l.lng - e.lng) < 0.0015
   where e.lat is not null;
  if n <> 0 then raise exception '% staged coordinate(s) collide with a published pin.', n; end if;

  -- 6. Store number on the row must match, WHERE THE ROW HAS ONE. Five targets
  --    were matched by address + brand + state instead and legitimately carry
  --    no number; they are listed in ADDRESS-MATCHED.csv.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where substring(l.name from '#\s*(\d+)') is not null
     and substring(l.name from '#\s*(\d+)') <> e.source_ref;
  if n <> 0 then raise exception '% row(s) have a store number that disagrees with the source.', n; end if;

  -- 7. Write. coalesce keeps it blank-only even if step 3 were bypassed.
  update public.locations l
     set lat = coalesce(l.lat, e.lat),
         lng = coalesce(l.lng, e.lng),
         interstate = coalesce(l.interstate, e.interstate),
         parking_spaces = coalesce(l.parking_spaces, e.parking_spaces),
         geocode_source = case when l.lat is null and e.lat is not null
                               then 'pilot-master-2026-07-27' else l.geocode_source end,
         geocode_confidence = case when l.lat is null and e.lat is not null
                                   then 'high' else l.geocode_confidence end,
         coord_verification_status = case when l.lat is null and e.lat is not null
                                          then 'operator-authoritative' else l.coord_verification_status end,
         last_geocoded_at = case when l.lat is null and e.lat is not null
                                 then now() else l.last_geocoded_at end,
         updated_at = now()
    from _enr e
   where l.id = e.db_id;
  get diagnostics n = row_count;
  if n <> batch then raise exception 'Expected to enrich exactly % row(s), updated %.', batch, n; end if;

  -- 8. Enrichment must never publish, feature, index or claim overnight.
  select count(*) into n from _enr e join public.locations l on l.id = e.db_id
   where l.is_featured or l.is_indexable;
  if n <> 0 then raise exception 'Post-check failed: % row(s) became featured/indexable.', n; end if;
end $$;

commit;

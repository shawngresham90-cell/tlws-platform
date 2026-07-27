-- Rollback for PUBLISH-MATCHED-25.sql — exact-ID, value-matched. NOT EXECUTED.
-- Un-publishes ONLY a row that (a) is one of the 25 ids, (b) is currently
-- published, and (c) still carries exactly the verified official coordinate
-- and parking count it was published with. A drifted row is left alone and
-- must be reviewed by hand instead of blindly unpublished.
begin;
update public.locations set is_published = false, updated_at = now()
 where id = 'ca4da6a3-c18d-4f65-88ec-1076319eb6c5' and is_published
   and lat = 28.359164203862274 and lng = -80.79245792270183 and parking_spaces = 8;
update public.locations set is_published = false, updated_at = now()
 where id = 'e5c73805-b895-443e-ad46-5b33992106d6' and is_published
   and lat = 27.4138524510288 and lng = -80.40013848915262 and parking_spaces = 100;
update public.locations set is_published = false, updated_at = now()
 where id = '1f226de3-a16d-434e-9db3-2cb86dbf9e31' and is_published
   and lat = 30.065564 and lng = -81.493909 and parking_spaces = 17;
update public.locations set is_published = false, updated_at = now()
 where id = '9d5b4987-bd0e-4332-ae57-b774ca5ee801' and is_published
   and lat = 27.448956010822528 and lng = -80.3977813214264 and parking_spaces = 156;
update public.locations set is_published = false, updated_at = now()
 where id = 'c372a30e-8b6d-44db-b71f-1a3621ef7a7e' and is_published
   and lat = 29.74996120681377 and lng = -81.34444617182768 and parking_spaces = 99;
update public.locations set is_published = false, updated_at = now()
 where id = 'b8bff6ef-fb37-4415-9966-9e0ef40bbb4d' and is_published
   and lat = 30.371257849974512 and lng = -81.7642421064314 and parking_spaces = 65;
update public.locations set is_published = false, updated_at = now()
 where id = 'da315672-4e7f-4389-a555-4e4b7aa1d94a' and is_published
   and lat = 32.188725774101115 and lng = -81.19496020325909 and parking_spaces = 112;
update public.locations set is_published = false, updated_at = now()
 where id = '50cf9353-443d-406e-b1d2-9889112e116c' and is_published
   and lat = 30.760673125363606 and lng = -81.64907624610727 and parking_spaces = 235;
update public.locations set is_published = false, updated_at = now()
 where id = 'f0129700-18d1-49cf-b92f-0be14a549686' and is_published
   and lat = 31.14016746021323 and lng = -81.57832099692367 and parking_spaces = 150;
update public.locations set is_published = false, updated_at = now()
 where id = '0fda85a9-364c-4541-99d7-fac38c8f755e' and is_published
   and lat = 30.75989471461253 and lng = -81.65574789931874 and parking_spaces = 111;
update public.locations set is_published = false, updated_at = now()
 where id = 'd56cff01-0dcb-4610-82aa-920d1214a828' and is_published
   and lat = 39.6254814074548 and lng = -75.95014760199173 and parking_spaces = 185;
update public.locations set is_published = false, updated_at = now()
 where id = '39a7ad06-c801-4b4f-8ea1-3d847839a62c' and is_published
   and lat = 39.63836410068015 and lng = -75.80598211474991 and parking_spaces = 230;
update public.locations set is_published = false, updated_at = now()
 where id = 'b89a9bb7-6833-4f23-8466-1d6660615cd3' and is_published
   and lat = 36.523299 and lng = -77.587281 and parking_spaces = 42;
update public.locations set is_published = false, updated_at = now()
 where id = 'f97ef111-f094-422a-bc61-7362a0a27d26' and is_published
   and lat = 35.57450741129341 and lng = -78.14640144688613 and parking_spaces = 145;
update public.locations set is_published = false, updated_at = now()
 where id = '438d7ce9-59d8-4fec-b8d5-24f36c3a5481' and is_published
   and lat = 35.31835659787999 and lng = -78.57574679036492 and parking_spaces = 265;
update public.locations set is_published = false, updated_at = now()
 where id = '062c24f7-7145-41f3-97f7-431b2d8965b3' and is_published
   and lat = 35.58299557135885 and lng = -78.14789037301635 and parking_spaces = 125;
update public.locations set is_published = false, updated_at = now()
 where id = 'a77f9fde-3b52-4f86-961d-91e168d388d5' and is_published
   and lat = 34.26660455384255 and lng = -79.70179281338103 and parking_spaces = 75;
update public.locations set is_published = false, updated_at = now()
 where id = '4f23643b-4ec9-471a-beac-7a7538e73adf' and is_published
   and lat = 34.23256102007648 and lng = -79.80240283883901 and parking_spaces = 90;
update public.locations set is_published = false, updated_at = now()
 where id = '455f776b-7681-45be-8604-fdb9593beb44' and is_published
   and lat = 33.193987365125956 and lng = -80.60230509010448 and parking_spaces = 118;
update public.locations set is_published = false, updated_at = now()
 where id = 'a109cc92-378c-4d57-ac39-da50a5c2a2c6' and is_published
   and lat = 34.338987832171995 and lng = -79.53411028419238 and parking_spaces = 200;
update public.locations set is_published = false, updated_at = now()
 where id = '9ac45310-ac8c-4885-a5aa-ebf787c2f13a' and is_published
   and lat = 32.26878204646999 and lng = -81.08101432460634 and parking_spaces = 90;
update public.locations set is_published = false, updated_at = now()
 where id = '989e6437-46b1-45ce-a5b2-7f7d4d0cb18a' and is_published
   and lat = 34.344825 and lng = -79.534595 and parking_spaces = 112;
update public.locations set is_published = false, updated_at = now()
 where id = 'ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6' and is_published
   and lat = 37.3108667 and lng = -77.3915178 and parking_spaces = 110;
update public.locations set is_published = false, updated_at = now()
 where id = '3f7408df-a39e-46cd-843a-61694fabbe9c' and is_published
   and lat = 36.7045199441136 and lng = -77.55285515344238 and parking_spaces = 300;
update public.locations set is_published = false, updated_at = now()
 where id = '8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8' and is_published
   and lat = 36.6069402079367 and lng = -77.56095702090148 and parking_spaces = 85;
commit;

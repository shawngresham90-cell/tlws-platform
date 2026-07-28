-- NTAD canary rollback (2026-07-28) - VALUE-MATCHED. Prepared BEFORE any
-- execution of CANARY-INSERT.sql. Removes exactly the five package rows and
-- refuses to touch anything else: each DELETE requires the package source
-- tag, the exact staged coordinate, unpublished state, and NULL spaces -
-- if a row was later published or altered, the rollback deliberately
-- leaves it for manual review.

begin;

delete from public.locations
 where detail_slug = 'guilford-welcome-center-i-91-north-guilford-vt'
   and source = 'ntad-2019-v04' and state = 'VT'
   and lat = 42.812017 and lng = -72.5662
   and is_published = false and parking_spaces is null;

delete from public.locations
 where detail_slug = 'kennebunk-service-plaza-i-95-northbound-kennebunk-me'
   and source = 'ntad-2019-v04' and state = 'ME'
   and lat = 43.410379 and lng = -70.55824
   and is_published = false and parking_spaces is null;

delete from public.locations
 where detail_slug = 'smyrna-rest-area-us-13-smyrna-de'
   and source = 'ntad-2019-v04' and state = 'DE'
   and lat = 39.3235 and lng = -75.6175
   and is_published = false and parking_spaces is null;

delete from public.locations
 where detail_slug = 'darien-service-plaza-i-95-southbound-darien-ct'
   and source = 'ntad-2019-v04' and state = 'CT'
   and lat = 41.068057 and lng = -73.504342
   and is_published = false and parking_spaces is null;

delete from public.locations
 where detail_slug = 'gold-run-safety-roadside-rest-area-i-80-eastbound-gold-run-ca'
   and source = 'ntad-2019-v04' and state = 'CA'
   and lat = 39.17545 and lng = -120.85773
   and is_published = false and parking_spaces is null;

commit;

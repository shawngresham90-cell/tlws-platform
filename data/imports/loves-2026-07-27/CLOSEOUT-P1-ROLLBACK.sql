-- Phase 1 rollback — unpublish the 15 verified matches, VALUE-MATCHED.
-- Prepared and committed BEFORE any write. Each statement fires only if the
-- row is currently published and still carries the exact staged identity,
-- coordinate, positive spaces and overnight confirmation this run verified.

begin;

update public.locations set is_published = false, updated_at = now()
 where id = 'ad67dd4a-685b-4d62-be05-0b97f31c8e5f' and is_published
   and name = 'Love''s Travel Stop #316' and lat = 29.339663 and lng = -81.13461;
update public.locations set is_published = false, updated_at = now()
 where id = '89c2531c-300b-4d19-b9f8-e4f065f2d605' and is_published
   and name = 'Love''s Travel Stop #338' and lat = 31.960662 and lng = -81.331564;
update public.locations set is_published = false, updated_at = now()
 where id = '22da63bd-9ee8-45b1-b8cd-ada2c8cb7899' and is_published
   and name = 'Love''s Travel Stop #371' and lat = 34.419584 and lng = -79.41594;
update public.locations set is_published = false, updated_at = now()
 where id = 'cb44453b-2e91-403c-b840-fa0ebe9c211e' and is_published
   and name = 'Love''s Travel Stop #405' and lat = 31.137752 and lng = -81.571797;
update public.locations set is_published = false, updated_at = now()
 where id = '29c0000b-e9ee-401d-a502-417243b91f6c' and is_published
   and name = 'Love''s Travel Stop #412' and lat = 35.339906 and lng = -78.55693;
update public.locations set is_published = false, updated_at = now()
 where id = 'd875c6d8-cf43-4d30-a76f-53bed4397cb3' and is_published
   and name = 'Love''s Travel Stop #415' and lat = 27.413167 and lng = -80.397701;
update public.locations set is_published = false, updated_at = now()
 where id = '025700b8-af4a-4322-96c1-64fff65ec6b4' and is_published
   and name = 'Love''s Travel Stop #435 (Ruther Glen)' and lat = 37.937868 and lng = -77.465815;
update public.locations set is_published = false, updated_at = now()
 where id = 'f31f9d24-b631-4513-869b-d943b30882d3' and is_published
   and name = 'Love''s Travel Stop #467' and lat = 27.445606 and lng = -80.398175;
update public.locations set is_published = false, updated_at = now()
 where id = 'd58e3dbf-f1ed-4822-adf6-94841a1a7c64' and is_published
   and name = 'Love''s Travel Stop #480' and lat = 35.872378 and lng = -84.32321;
update public.locations set is_published = false, updated_at = now()
 where id = '8c6afd87-8cac-4a4e-9490-fae510386cdf' and is_published
   and name = 'Love''s Travel Stop #603' and lat = 30.516861 and lng = -81.632633;
update public.locations set is_published = false, updated_at = now()
 where id = 'b2af1bed-36cf-4497-8e3d-d2c2209fca12' and is_published
   and name = 'Love''s Travel Stop #740' and lat = 32.705457 and lng = -80.874488;
update public.locations set is_published = false, updated_at = now()
 where id = 'a5c289a1-177f-479f-9e18-84571c3d8190' and is_published
   and name = 'Love''s Travel Stop #790' and lat = 33.591813 and lng = -80.355763;
update public.locations set is_published = false, updated_at = now()
 where id = '29e9199c-a535-47dd-8d12-887485484bc3' and is_published
   and name = 'Love''s Travel Stop #828' and lat = 30.463245 and lng = -81.673875;
update public.locations set is_published = false, updated_at = now()
 where id = 'a7cd01f6-bc31-4983-8bb6-89a2d6360e0f' and is_published
   and name = 'Love''s Travel Stop #893' and lat = 32.103201 and lng = -81.194401;
update public.locations set is_published = false, updated_at = now()
 where id = 'aab7a84d-f5c3-436a-a8c4-5b3c181f2ed2' and is_published
   and name = 'Love''s Travel Stop #894' and lat = 29.745791 and lng = -81.349601;

commit;

-- Phase 5 rollback — unpublish Love's #201 Elk City OK (directory-only row),
-- VALUE-MATCHED. Prepared and committed BEFORE the publish. Fires only if
-- the row still carries the exact official identity, zero-space count and
-- overnight=false this run verified.

begin;

update public.locations set is_published = false, updated_at = now()
 where id = (select id from public.locations
              where detail_slug = 'love-s-travel-stop-201-elk-city-ok'
                and source = 'loves-master-2026-07-27' limit 1)
   and is_published
   and name = 'Love''s Travel Stop #201'
   and state = 'OK' and city = 'Elk City'
   and lat = 35.423039 and lng = -99.372528
   and parking_spaces = 0 and overnight_parking = false;

commit;

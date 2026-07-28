-- Love's #317 Skippers VA closeout rollback (2026-07-28) — VALUE-MATCHED.
-- Prepared and committed BEFORE any write. Reverses the two authorized
-- transactions in reverse order: unpublish first, then restore
-- overnight_parking = false. Each statement fires only if the row still
-- carries the exact identity, coordinate and space count verified pre-write.

begin;

-- Reverse transaction 2 (publication)
update public.locations set is_published = false, updated_at = now()
 where id = '5a5fa4df-c324-4405-bdb6-977ffb7f01a5'
   and name = 'Love''s Travel Stop #317' and state = 'VA' and city = 'Skippers'
   and lat = 36.605447 and lng = -77.560647
   and parking_spaces = 72 and is_published = true;

-- Reverse transaction 1 (overnight confirmation)
update public.locations set overnight_parking = false, updated_at = now()
 where id = '5a5fa4df-c324-4405-bdb6-977ffb7f01a5'
   and name = 'Love''s Travel Stop #317' and state = 'VA' and city = 'Skippers'
   and lat = 36.605447 and lng = -77.560647
   and parking_spaces = 72 and overnight_parking = true;

commit;

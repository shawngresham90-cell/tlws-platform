-- Overnight-confirmation closeout rollback (2026-07-28) — VALUE-MATCHED.
-- Prepared and committed BEFORE any write. Restores overnight_parking = false
-- for each of the nine rows this run flips. Each statement fires only if the
-- row still carries the exact identity, coordinate and space count verified
-- pre-write AND the flipped overnight flag. #317 (5a5fa4df) has no entry:
-- it was quarantined (unpublished) and receives no write.

begin;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '4c23e030-e4d3-473c-a3b8-cfafc1599bc4'
   and name = 'Love''s Travel Stop #307' and state = 'GA'
   and lat = 33.208091 and lng = -84.05852
   and parking_spaces = 50 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '6dbef08c-6306-4db2-bccf-5da49a0a2ac8'
   and name = 'Love''s Travel Stop #325' and state = 'GA'
   and lat = 31.415715 and lng = -83.503054
   and parking_spaces = 115 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = 'a45b0906-ec99-4785-bfd6-afae328bc2aa'
   and name = 'Love''s Travel Stop #359' and state = 'GA'
   and lat = 34.118857 and lng = -84.743165
   and parking_spaces = 93 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '08d24d71-a131-473b-9ffd-cc56b92b5466'
   and name = 'Love''s Travel Stop #364' and state = 'TN'
   and lat = 35.291951 and lng = -84.818048
   and parking_spaces = 85 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '371724fa-2260-4d55-bbc7-0ddeeb680138'
   and name = 'Love''s Travel Stop #550' and state = 'GA'
   and lat = 30.77424 and lng = -83.29849
   and parking_spaces = 111 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = 'ed2d89b5-609b-4e0e-91fa-bde1dbd93533'
   and name = 'Love''s Travel Stop #698' and state = 'GA'
   and lat = 32.717528 and lng = -83.733418
   and parking_spaces = 119 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '15f5c84b-8284-455e-8928-c688f5a308ab'
   and name = 'Love''s Travel Stop #735' and state = 'GA'
   and lat = 34.443856 and lng = -84.915181
   and parking_spaces = 93 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = 'f4591f0b-087b-4856-8957-5a7e020fa209'
   and name = 'Love''s Travel Stop #801' and state = 'GA'
   and lat = 31.975579 and lng = -83.758552
   and parking_spaces = 92 and overnight_parking = true;

update public.locations set overnight_parking = false, updated_at = now()
 where id = '0b49a63f-9886-4ac2-a547-81b6ecda5d6f'
   and name = 'Love''s Travel Stop #861' and state = 'TN'
   and lat = 35.733196 and lng = -84.397797
   and parking_spaces = 102 and overnight_parking = true;

commit;

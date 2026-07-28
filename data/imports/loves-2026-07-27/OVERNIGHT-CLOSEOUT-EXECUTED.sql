-- Love's overnight-confirmation closeout — the EXACT guarded SQL executed
-- 2026-07-28 (inert record; already applied; safe to re-run — every guard
-- requires overnight_parking = false, so re-execution matches zero rows and
-- raises, changing nothing).
--
-- Order executed: canary #307 GA, canary #364 TN (each own transaction),
-- canary verified through the trip-planner contract
-- (scripts/verify-overnight-canary.ts, 14/14), then GA batch of 6, then TN #861.

-- CANARY 1: #307 GA
begin;
do $$
declare n int;
begin
  update public.locations set overnight_parking = true, updated_at = now()
   where id = '4c23e030-e4d3-473c-a3b8-cfafc1599bc4'
     and name = 'Love''s Travel Stop #307'
     and state = 'GA' and city = 'Jackson'
     and is_published and lat = 33.208091 and lng = -84.05852
     and parking_spaces = 50 and overnight_parking = false
     and is_featured = false and is_indexable = false
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'CANARY #307 GA: expected exactly 1 row, got % — ABORT', n;
  end if;
end $$;
commit;

-- CANARY 2: #364 TN
begin;
do $$
declare n int;
begin
  update public.locations set overnight_parking = true, updated_at = now()
   where id = '08d24d71-a131-473b-9ffd-cc56b92b5466'
     and name = 'Love''s Travel Stop #364'
     and state = 'TN' and city = 'Charleston'
     and is_published and lat = 35.291951 and lng = -84.818048
     and parking_spaces = 85 and overnight_parking = false
     and coord_verification_status = 'manually-verified'
     and is_featured = false and is_indexable = false
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'CANARY #364 TN: expected exactly 1 row, got % — ABORT', n;
  end if;
end $$;
commit;

-- GA remainder: #325 #359 #550 #698 #735 #801
begin;
do $$
declare n int; total int := 0;
begin
  update public.locations set overnight_parking = true, updated_at = now()
   where id = '6dbef08c-6306-4db2-bccf-5da49a0a2ac8'
     and name = 'Love''s Travel Stop #325' and state = 'GA' and city = 'Tifton'
     and is_published and lat = 31.415715 and lng = -83.503054
     and parking_spaces = 115 and overnight_parking = false
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #325: expected 1 row, got % — ABORT', n; end if;

  update public.locations set overnight_parking = true, updated_at = now()
   where id = 'a45b0906-ec99-4785-bfd6-afae328bc2aa'
     and name = 'Love''s Travel Stop #359' and state = 'GA' and city = 'Emerson'
     and is_published and lat = 34.118857 and lng = -84.743165
     and parking_spaces = 93 and overnight_parking = false
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #359: expected 1 row, got % — ABORT', n; end if;

  update public.locations set overnight_parking = true, updated_at = now()
   where id = '371724fa-2260-4d55-bbc7-0ddeeb680138'
     and name = 'Love''s Travel Stop #550' and state = 'GA' and city = 'Valdosta'
     and is_published and lat = 30.77424 and lng = -83.29849
     and parking_spaces = 111 and overnight_parking = false
     and coord_verification_status = 'manually-verified'
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #550: expected 1 row, got % — ABORT', n; end if;

  update public.locations set overnight_parking = true, updated_at = now()
   where id = 'ed2d89b5-609b-4e0e-91fa-bde1dbd93533'
     and name = 'Love''s Travel Stop #698' and state = 'GA' and city = 'Macon'
     and is_published and lat = 32.717528 and lng = -83.733418
     and parking_spaces = 119 and overnight_parking = false
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #698: expected 1 row, got % — ABORT', n; end if;

  update public.locations set overnight_parking = true, updated_at = now()
   where id = '15f5c84b-8284-455e-8928-c688f5a308ab'
     and name = 'Love''s Travel Stop #735' and state = 'GA' and city = 'Calhoun'
     and is_published and lat = 34.443856 and lng = -84.915181
     and parking_spaces = 93 and overnight_parking = false
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #735: expected 1 row, got % — ABORT', n; end if;

  update public.locations set overnight_parking = true, updated_at = now()
   where id = 'f4591f0b-087b-4856-8957-5a7e020fa209'
     and name = 'Love''s Travel Stop #801' and state = 'GA' and city = 'Cordele'
     and is_published and lat = 31.975579 and lng = -83.758552
     and parking_spaces = 92 and overnight_parking = false
     and coord_verification_status = 'manually-verified'
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count; total := total + n;
  if n <> 1 then raise exception 'GA #801: expected 1 row, got % — ABORT', n; end if;

  if total <> 6 then raise exception 'GA batch: expected 6 total, got % — ABORT', total; end if;
end $$;
commit;

-- TN remainder: #861
begin;
do $$
declare n int;
begin
  update public.locations set overnight_parking = true, updated_at = now()
   where id = '0b49a63f-9886-4ac2-a547-81b6ecda5d6f'
     and name = 'Love''s Travel Stop #861' and state = 'TN' and city = 'Loudon'
     and is_published and lat = 35.733196 and lng = -84.397797
     and parking_spaces = 102 and overnight_parking = false
     and coord_verification_status = 'manually-verified'
     and is_featured = false and is_indexable = false and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TN #861: expected 1 row, got % — ABORT', n; end if;
end $$;
commit;

-- #317 (5a5fa4df-c324-4405-bdb6-977ffb7f01a5): NO STATEMENT — quarantined
-- unpublished; writing it was not authorized once it failed the Published
-- pre-write condition.

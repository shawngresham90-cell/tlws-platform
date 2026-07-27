-- Love's data corrections — SEPARATE PACKAGE, NOT EXECUTED.
--
-- Four directory rows disagree with Love's own complete national export
-- (731 locations, confirmed against Love's published count). Three of them are
-- LIVE PAGES for locations the operator does not list.
--
-- This package is deliberately kept apart from the import: it changes rows the
-- import does not own, and it needs its own authorization.
--
-- NOTHING IS DELETED. The proposal is to unpublish pending verification, so the
-- rows and their history survive and the decision is reversible in one step.
--
-- ---------------------------------------------------------------------------
-- The four rows, by exact id
-- ---------------------------------------------------------------------------
--
--  A. c32686ff-6cf3-4422-af97-80b823e07eb9
--     "Love's Travel Stop #618 (Birch Run)"  MI / Birch Run  truck-stops  PUBLISHED
--  B. 485085d9-98c6-4e88-9661-862c3bc0c514
--     "CAT Scale — Love's Travel Stop #618, Birch Run"  MI  cat-scales  PUBLISHED
--
--     Store #618 is Sadieville, KENTUCKY in the authoritative export. Michigan
--     has nine Love's — Alamo, Holland, Marshall, Grand Ledge, Milan,
--     Frenchtown, Bridgeport, Capac, St. Clair — and Birch Run is not among
--     them. The Kentucky rows for #618 (0c0c4cac, b67852b7, 33c7ebe8) are
--     correct and are NOT touched.
--
--  C. f6404302-7971-4884-8f37-82f098913d65
--     "Love's Travel Stop #306"  TN / Dandridge  truck-stops  PUBLISHED
--
--     #306 does not appear anywhere in the authoritative export. Closure
--     candidate. Its companion a199a4b9 ("Love's Truck Care #306") is already
--     unpublished and is left alone.
--
--  D. beb05d53-db50-49cb-8790-ec01b45c8187
--     "Love's Travel Stop #420"  SC / Florence  truck-stops  ALREADY UNPUBLISHED
--
--     #420 is Flowood, MISSISSIPPI. South Carolina's fourteen Love's do not
--     include Florence. This row stays unpublished and is quarantined — no
--     state change is proposed, so it is NOT in the transaction below.
--
-- ---------------------------------------------------------------------------
-- Why unpublish rather than correct in place
-- ---------------------------------------------------------------------------
-- Renaming a Michigan row to "Sadieville, KY" would be inventing a location:
-- we do not know whether Birch Run is a closed Love's, a mis-keyed store
-- number, or a different brand recorded wrongly. Unpublishing removes the
-- incorrect claim from drivers without asserting a replacement fact. The
-- correct next step is exact-ID verification against Love's, then either a
-- targeted correction or a permanent retirement.

-- ===========================================================================
-- PROPOSED: unpublish the three published rows (A, B, C)
-- ===========================================================================

begin;

do $$
declare
  n integer;
  ids uuid[] := array[
    'c32686ff-6cf3-4422-af97-80b823e07eb9',  -- A  MI Birch Run  travel stop
    '485085d9-98c6-4e88-9661-862c3bc0c514',  -- B  MI Birch Run  CAT scale
    'f6404302-7971-4884-8f37-82f098913d65'   -- C  TN Dandridge  travel stop
  ]::uuid[];
begin
  -- 1. Exactly three rows, all live, all still published — the state this
  --    package was written against.
  select count(*) into n from public.locations
   where id = any(ids) and deleted_at is null;
  if n <> 3 then
    raise exception 'Precondition failed: expected 3 live target rows, found %.', n;
  end if;

  select count(*) into n from public.locations
   where id = any(ids) and is_published;
  if n <> 3 then
    raise exception 'Precondition failed: expected 3 published target rows, found %. Someone has already changed them.', n;
  end if;

  -- 2. Identity check. Guards against an id that has been reused or renamed
  --    since this package was written.
  select count(*) into n from public.locations
   where id = 'c32686ff-6cf3-4422-af97-80b823e07eb9'
     and state = 'MI' and city = 'Birch Run' and name ~ '#\s*618';
  if n <> 1 then raise exception 'Precondition failed: row A is not the expected MI #618 travel stop.'; end if;

  select count(*) into n from public.locations
   where id = '485085d9-98c6-4e88-9661-862c3bc0c514'
     and state = 'MI' and city = 'Birch Run' and category_slug = 'cat-scales';
  if n <> 1 then raise exception 'Precondition failed: row B is not the expected MI #618 CAT scale.'; end if;

  select count(*) into n from public.locations
   where id = 'f6404302-7971-4884-8f37-82f098913d65'
     and state = 'TN' and city = 'Dandridge' and name ~ '#\s*306';
  if n <> 1 then raise exception 'Precondition failed: row C is not the expected TN #306 travel stop.'; end if;

  -- 3. The correct Kentucky #618 rows must exist and must NOT be in scope.
  select count(*) into n from public.locations
   where state = 'KY' and city = 'Sadieville' and name ~ '#\s*618' and deleted_at is null;
  if n < 1 then
    raise exception 'Precondition failed: the correct KY Sadieville #618 row is missing; re-verify before unpublishing Michigan.';
  end if;
  if 'b67852b7-a14e-43d2-b786-b8536fed05d5'::uuid = any(ids) then
    raise exception 'Guard failed: a Kentucky row is inside the target set.';
  end if;

  -- 4. Unpublish. Nothing else changes.
  update public.locations
     set is_published = false, updated_at = now()
   where id = any(ids) and is_published;
  get diagnostics n = row_count;
  if n <> 3 then
    raise exception 'Expected to unpublish exactly 3 row(s), changed %.', n;
  end if;

  -- 5. NOTHING IS DELETED, and nothing else moved.
  select count(*) into n from public.locations
   where id = any(ids) and deleted_at is not null;
  if n <> 0 then raise exception 'Post-check failed: % row(s) were deleted. This package must never delete.', n; end if;

  select count(*) into n from public.locations
   where id = any(ids) and is_published;
  if n <> 0 then raise exception 'Post-check failed: % row(s) are still published.', n; end if;

  -- 6. The Kentucky #618 rows are untouched and still published.
  select count(*) into n from public.locations
   where state = 'KY' and city = 'Sadieville' and name ~ '#\s*618' and is_published;
  if n < 1 then raise exception 'Post-check failed: the correct KY #618 rows are no longer published.'; end if;
end $$;

commit;

-- ===========================================================================
-- ROLLBACK — value-matched republish
-- ===========================================================================
-- Restores exactly the three rows this package unpublished, and only if they
-- are still unpublished and undeleted.

begin;

do $$
declare
  n integer;
  ids uuid[] := array[
    'c32686ff-6cf3-4422-af97-80b823e07eb9',
    '485085d9-98c6-4e88-9661-862c3bc0c514',
    'f6404302-7971-4884-8f37-82f098913d65'
  ]::uuid[];
begin
  select count(*) into n from public.locations
   where id = any(ids) and deleted_at is null and not is_published;
  if n <> 3 then
    raise exception 'Rollback precondition failed: expected 3 live unpublished rows, found %.', n;
  end if;

  update public.locations set is_published = true, updated_at = now()
   where id = any(ids) and not is_published;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Expected to republish exactly 3 row(s), changed %.', n; end if;
end $$;

commit;

-- ===========================================================================
-- D. Florence SC — quarantine record, no statement
-- ===========================================================================
-- beb05d53-db50-49cb-8790-ec01b45c8187 is already unpublished. It stays that
-- way. No SQL is proposed; the row is recorded as quarantined in
-- QUARANTINE.md with the reason and the authoritative contradiction, and
-- scripts/test-parking-expansion.ts asserts it is never published.
--
--   select id, name, state, city, is_published from public.locations
--    where id = 'beb05d53-db50-49cb-8790-ec01b45c8187';
--   -- expected: is_published = false, deleted_at null

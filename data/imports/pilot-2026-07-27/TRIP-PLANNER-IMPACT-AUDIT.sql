-- PR #197 zero-space guard — production impact audit. READ-ONLY.
--
-- NOT YET RUN: database access was unavailable during the 2026-07-28
-- autonomous run (permission error on every call). Run each section and
-- record the output in the PR before merging #197. Nothing here writes.
--
-- "Recommendable" means what the trip planner can actually offer as parking
-- BEFORE the guard: a live, published row with coordinates (toStopCandidates
-- drops coordless rows) in a category the overnight/parking needs accept.
-- The guard then additionally requires a finite parking_spaces > 0.
--
-- parking_spaces is an integer column, so NaN / Infinity / non-numeric
-- values cannot exist at rest; they are handled at the application boundary
-- (zod contract + hasConfirmedTruckParking) and are expected to measure 0
-- here. The classes that CAN exist at rest: NULL, 0, negative.

-- ============================================================ 1. HEADLINE
with pool as (
  select * from public.locations
  where deleted_at is null and is_published
    and lat is not null and lng is not null
    and category_slug in ('truck-stops','parking','hotels-truck-parking','rest-areas')
)
select
  count(*)                                                as recommendable_before_guard,
  count(*) filter (where parking_spaces > 0)              as remaining_after_guard,
  count(*) filter (where parking_spaces = 0)              as excluded_stated_zero,
  count(*) filter (where parking_spaces < 0)              as excluded_negative,
  count(*) filter (where parking_spaces is null)          as excluded_null_unknown
from pool;

-- ================================================= 2. BY STATE (before/after)
select state,
       count(*)                                   as before_guard,
       count(*) filter (where parking_spaces > 0) as after_guard,
       count(*) filter (where coalesce(parking_spaces, -1) <= 0
                        or parking_spaces is null) as excluded
from public.locations
where deleted_at is null and is_published
  and lat is not null and lng is not null
  and category_slug in ('truck-stops','parking','hotels-truck-parking','rest-areas')
group by state order by state;

-- ============================================ 3. BY CORRIDOR (before/after)
select coalesce(interstate, '(no corridor)') as corridor,
       count(*)                                   as before_guard,
       count(*) filter (where parking_spaces > 0) as after_guard
from public.locations
where deleted_at is null and is_published
  and lat is not null and lng is not null
  and category_slug in ('truck-stops','parking','hotels-truck-parking','rest-areas')
group by 1 order by before_guard desc;

-- ============== 4. CORRIDORS LOSING THEIR LAST USABLE RECOMMENDATION
-- A corridor appears here only when EVERY previously recommendable row on it
-- lacked a confirmed positive count. Record these as honest gaps — the guard
-- exposed them; it did not create them.
select coalesce(interstate, '(no corridor)') as corridor,
       count(*) as rows_all_unconfirmed
from public.locations
where deleted_at is null and is_published
  and lat is not null and lng is not null
  and category_slug in ('truck-stops','parking','hotels-truck-parking','rest-areas')
group by 1
having count(*) filter (where parking_spaces > 0) = 0
order by rows_all_unconfirmed desc;

-- ===================== 5. THE 25 NEWLY PUBLISHED MATCHED ROWS STAY ELIGIBLE
-- Run AFTER the 25-row publication. Expected: eligible_25 = 25.
select count(*) as eligible_25
from public.locations
where id in (
  '9d5b4987-bd0e-4332-ae57-b774ca5ee801','c372a30e-8b6d-44db-b71f-1a3621ef7a7e',
  'ca4da6a3-c18d-4f65-88ec-1076319eb6c5','b8bff6ef-fb37-4415-9966-9e0ef40bbb4d',
  'e5c73805-b895-443e-ad46-5b33992106d6','1f226de3-a16d-434e-9db3-2cb86dbf9e31',
  'f0129700-18d1-49cf-b92f-0be14a549686','0fda85a9-364c-4541-99d7-fac38c8f755e',
  '50cf9353-443d-406e-b1d2-9889112e116c','da315672-4e7f-4389-a555-4e4b7aa1d94a',
  'd56cff01-0dcb-4610-82aa-920d1214a828','39a7ad06-c801-4b4f-8ea1-3d847839a62c',
  'f97ef111-f094-422a-bc61-7362a0a27d26','438d7ce9-59d8-4fec-b8d5-24f36c3a5481',
  'b89a9bb7-6833-4f23-8466-1d6660615cd3','062c24f7-7145-41f3-97f7-431b2d8965b3',
  'a109cc92-378c-4d57-ac39-da50a5c2a2c6','455f776b-7681-45be-8604-fdb9593beb44',
  '4f23643b-4ec9-471a-beac-7a7538e73adf','9ac45310-ac8c-4885-a5aa-ebf787c2f13a',
  '989e6437-46b1-45ce-a5b2-7f7d4d0cb18a','a77f9fde-3b52-4f86-961d-91e168d388d5',
  '3f7408df-a39e-46cd-843a-61694fabbe9c','ac64dd0e-2288-4bb0-85b8-2f1913dfd9f6',
  '8cb6aa2b-13c3-4f79-8b1b-ee434bb8cee8')
  and deleted_at is null and is_published
  and lat is not null and lng is not null and parking_spaces > 0;

-- ======================= 6. DIRECTORY VISIBILITY IS A CODE-LEVEL GUARANTEE
-- The guard lives only in src/lib/trip-planner/* and the corridor
-- truck-parking pages; ordinary directory listing/detail pages have no
-- spaces filter. Nothing to measure in SQL — noted for completeness.

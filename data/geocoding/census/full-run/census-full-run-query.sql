-- Census full-run eligibility categorization (READ-ONLY).
--
-- Deterministic source of `census-full-run-input.csv` (eligible) and
-- `census-full-run-excluded.csv` (rejected). Selects only coordinate-free
-- rows (lat is null) so the 85 existing coordinates are never included. The
-- authoritative gate is isEligible() in scripts/imports/census-geocode.ts;
-- this SQL mirrors it and the produced CSV is re-validated by
-- scripts/validation/validate-census-input.ts (must be 100% eligible).
--
-- Run against project cgvxwvymkembftznhcdl. Never writes.

with cf as (
  select
    id,
    coalesce(trim(regexp_replace(address, '\s+', ' ', 'g')), '') as address,
    coalesce(trim(city), '')  as city,
    upper(state)              as state,
    coalesce(trim(zip), '')   as zip
  from public.locations
  where deleted_at is null
    and lat is null            -- coordinate-free ONLY (never the 85 with lat/lng)
),
cat as (
  select *,
    case
      when address = '' then 'missing-address'
      when address ~* 'p\.?\s*o\.?\s*box' then 'po-box'
      when address ~* '(mile ?marker|mile ?post|milepost|median service plaza|service plaza|not published)'
           or (address ~* '^(i|us|sr|hwy|highway|interstate|route|rt|state road|state route)[-. ]*[0-9]'
               and address !~ '[0-9]+\s+[a-zA-Z]')
        then 'highway-or-insufficient'
      else 'eligible'
    end as bucket
  from cf
)
-- Eligible → official 5-column Census input (headerless), ordered state,id.
select
  '"' || id::text || '","' || replace(address, '"', '""') || '","' ||
  replace(city, '"', '""') || '","' || state || '","' || zip || '"' as census_input_row
from cat
where bucket = 'eligible'
order by state, id;

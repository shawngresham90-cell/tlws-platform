-- Read-only verification for the Lauren Gresham addition. Safe to run before
-- and after; it writes nothing.

-- 1. Is Lauren on the wall, exactly once, in the Steel tier?
select display_name, tier, position, is_public, status
from public.founders
where lower(display_name) like '%lauren%';

-- 2. The Steel tier in recognition order — Lauren should be last, at 9, and
--    every earlier position should be unchanged.
select position, display_name, is_public
from public.founders
where tier = 'steel'
order by position nulls last;

-- 3. The public thermometer, as the site reads it.
--    Expected after: founder_count 27, raised 955500, remaining 199500,
--    goal 1155000.
select founder_count,
       raised_cents,
       goal_cents,
       remaining_cents,
       pct_to_goal,
       raised_cents + remaining_cents as should_equal_goal,
       (raised_cents + remaining_cents = goal_cents) as math_reconciles
from public.campaign_progress;

-- 4. Nobody else moved: total rows, and the per-tier spread.
select tier, count(*) as spots, min(position) as first_pos, max(position) as last_pos
from public.founders
group by tier
order by tier;

select count(*) as total_founders, count(*) filter (where is_public) as public_founders
from public.founders;

-- 5. Privacy: the public reader never selects amount_cents. This confirms the
--    column holds Lauren's amount but is not part of the public projection —
--    compare against src/lib/community/founders.ts, which selects
--    id, display_name, business_name, business_url, tier, position, message,
--    logo_url, paid_at and nothing else.
select count(*) filter (where amount_cents is not null) as rows_with_amount,
       count(*) as total
from public.founders;

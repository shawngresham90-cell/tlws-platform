-- 012: Make campaign_progress respect RLS (security_invoker) instead of bypassing it.
-- The thermometer should only ever aggregate rows the caller can see — public founders.
alter view public.campaign_progress set (security_invoker = true);

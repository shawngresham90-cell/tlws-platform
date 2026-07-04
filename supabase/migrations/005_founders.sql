-- 005: Founders Wall + campaign progress view
create table public.founders (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  business_name text,
  business_url text,        -- rendered rel="sponsored"
  tier text not null check (tier in ('iron','steel','brick','student_sponsor','equipment_sponsor')),
  amount_cents int not null check (amount_cents > 0),
  message text,
  logo_url text,
  payment_provider text check (payment_provider in ('stripe','stan','gofundme','cash','check','other')),
  payment_ref text,
  is_public boolean not null default true,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index founders_public on public.founders (paid_at desc) where is_public = true;

create view public.campaign_progress
  with (security_invoker = true) as
select
  count(*)::int as founder_count,
  coalesce(sum(amount_cents), 0)::bigint as raised_cents,
  1200000::bigint as goal_cents,
  round(coalesce(sum(amount_cents),0)::numeric / 1200000 * 100, 1) as pct_to_goal
from public.founders
where is_public = true;
